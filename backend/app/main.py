import os
import datetime
from datetime import timedelta
import httpx
import xml.etree.ElementTree as ET
import logging
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from app.database import engine, Base, get_db
from app.models import Auction, SecurityHolding, MarketInventory
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

XML_TO_FRONTEND = {
    "BC_1MONTH": "1 Mo",
    "BC_2MONTH": "2 Mo",
    "BC_3MONTH": "3 Mo",
    "BC_6MONTH": "6 Mo",
    "BC_1YEAR": "1 Yr",
    "BC_2YEAR": "2 Yr",
    "BC_3YEAR": "3 Yr",
    "BC_5YEAR": "5 Yr",
    "BC_7YEAR": "7 Yr",
    "BC_10YEAR": "10 Yr",
    "BC_20YEAR": "20 Yr",
    "BC_30YEAR": "30 Yr",
}


class YieldPoint(BaseModel):
    term: str
    current: float
    yesterday: float | None = None
    lastMonth: float | None = None
    lastYear: float | None = None


class SecurityBase(BaseModel):
    term: str
    cusip: str
    amount: float
    purchase_yield: float
    portfolio_type: str
    order_type: str


class SecurityCreate(SecurityBase):
    pass


class SecurityDisplay(SecurityBase):
    id: int
    timestamp: datetime.datetime

    class Config:
        from_attributes = True


scheduler = BackgroundScheduler()
app_cache = {"yield_curve": [], "last_fetched": None}


async def query_treasury_auctions():
    logger.info("Querying Treasury Auctions...")

    url = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query"
    today = datetime.date.today().strftime("%Y-%m-%d")
    params = (
        f"?filter=auction_date:gte:{today}&sort=auction_date&format=json&page[size]=100"
    )

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=30.0)) as client:
            response = await client.get(url + params)
            response.raise_for_status()
            data = response.json().get("data", [])

        with Session(bind=engine) as db:
            for item in data:
                cusip = item.get("cusip")
                if not cusip:
                    continue

                existing_auction = (
                    db.query(Auction).filter(Auction.cusip == cusip).first()
                )

                if existing_auction:
                    existing_auction.auction_date = datetime.datetime.strptime(
                        item["auction_date"], "%Y-%m-%d"
                    ).date()
                    existing_auction.offering_amount = float(item["offering_amt"] or 0)
                else:
                    new_auction = Auction(
                        cusip=cusip,
                        security_type=item["security_type"],
                        security_term=item["security_term"],
                        auction_date=datetime.datetime.strptime(
                            item["auction_date"], "%Y-%m-%d"
                        ).date(),
                        issue_date=datetime.datetime.strptime(
                            item["issue_date"], "%Y-%m-%d"
                        ).date(),
                        offering_amount=float(item["offering_amt"] or 0),
                    )
                    db.add(new_auction)

            db.commit()
            logger.info(f"Queried {len(data)} auctions.")

    except Exception as e:
        logger.error(f"Error querying auctions: {e}")


async def update_yield_cache():
    logger.info("Fetching Yield Curve Data from XML feed...")

    # Fetch XML for current and previous year
    current_year = datetime.date.today().year
    base_url = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value="
    urls = [base_url + str(current_year), base_url + str(current_year - 1)]

    def get_xml_val(tag):
        node = props.find(f"d:{tag}", ns)
        return float(node.text) if node is not None and node.text else None

    all_data = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=30.0)) as client:
        for url in urls:
            try:
                resp = await client.get(url)
                if resp.status_code != 200:
                    continue

                root = ET.fromstring(resp.content)

                ns = {
                    "atom": "http://www.w3.org/2005/Atom",
                    "m": "http://schemas.microsoft.com/ado/2007/08/dataservices/metadata",
                    "d": "http://schemas.microsoft.com/ado/2007/08/dataservices",
                }

                for entry in root.findall("atom:entry", ns):
                    content = entry.find("atom:content", ns)
                    props = content.find("m:properties", ns)

                    # Parse Date (Format: 2025-05-15T00:00:00)
                    date_str = props.find("d:NEW_DATE", ns).text[:10]

                    record = {"date": date_str}
                    for field in XML_TO_FRONTEND.keys():
                        record[field] = get_xml_val(field)
                    all_data.append(record)

            except Exception as e:
                logger.error(f"Error fetching XML from {url}: {e}")

    if not all_data:
        logger.warning("No XML data found.")
        return

    all_data.sort(key=lambda x: x["date"], reverse=True)

    def find_record_by_date(target_date):
        target_str = target_date.strftime("%Y-%m-%d")
        for row in all_data:
            if row["date"] <= target_str:
                return row
        return None

    today_date = datetime.date.today()

    current_rec = all_data[0]
    prev_day_rec = all_data[1] if len(all_data) > 1 else None

    last_month_rec = find_record_by_date(today_date - timedelta(days=30))
    last_year_rec = find_record_by_date(today_date - timedelta(days=365))

    formatted_data = []

    for xml_key, label in XML_TO_FRONTEND.items():
        point = {
            "term": label,
            "current": current_rec.get(xml_key),
            "yesterday": prev_day_rec.get(xml_key) if prev_day_rec else None,
            "lastMonth": last_month_rec.get(xml_key) if last_month_rec else None,
            "lastYear": last_year_rec.get(xml_key) if last_year_rec else None,
        }
        formatted_data.append(point)

    app_cache["yield_curve"] = formatted_data
    app_cache["last_fetched"] = datetime.datetime.now()
    logger.info(f"Yield Cache Updated. Latest: {current_rec['date']}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application starting up...")

    Base.metadata.create_all(bind=engine)
    await update_yield_cache()
    await query_treasury_auctions()

    scheduler.add_job(
        update_yield_cache, "interval", seconds=86400, id="yield_cache_job"
    )
    scheduler.add_job(
        query_treasury_auctions, "interval", seconds=86400, id="auction_query_job"
    )

    scheduler.start()

    yield

    logger.info("Application shutting down...")
    scheduler.shutdown()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/yields", response_model=list[YieldPoint])
async def get_yield_curve():
    if not app_cache["yield_curve"]:
        raise HTTPException(
            status_code=503,
            detail="Yield data is not yet available. Please try again in a moment.",
        )

    return app_cache["yield_curve"]


@app.get("/api/auctions")
async def get_auctions(db: Session = Depends(get_db)):
    today = datetime.date.today()
    return (
        db.query(Auction)
        .filter(Auction.auction_date >= today)
        .order_by(Auction.auction_date)
        .all()
    )


@app.post("/api/orders", response_model=SecurityDisplay)
def create_order(order: SecurityCreate, db: Session = Depends(get_db)):
    inventory_item = (
        db.query(MarketInventory)
        .filter(MarketInventory.cusip == order.cusip)
        .with_for_update()
        .first()
    )
    if inventory_item:
        if inventory_item.quantity_available < order.amount:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient quantity available in market inventory. Requested: {order.amount}, Available: {inventory_item.quantity_available}",
            )
        if order.amount < inventory_item.quantity_min:
            raise HTTPException(
                status_code=400,
                detail=f"Order amount {order.amount} is below the minimum quantity {inventory_item.quantity_min} for this security.",
            )

        inventory_item.quantity_available -= int(order.amount)

    try:
        db_security = SecurityHolding(
            cusip=order.cusip,
            term=order.term,
            amount=order.amount,
            purchase_yield=order.purchase_yield,
            portfolio_type=order.portfolio_type,
            order_type=order.order_type,
        )
        db.add(db_security)

        db.commit()
        db.refresh(db_security)
        return db_security

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate Order Detected.")


@app.get("/api/market/inventory")
def get_market_inventory(db: Session = Depends(get_db)):
    return db.query(MarketInventory).all()


@app.get("/api/orders", response_model=list[SecurityDisplay])
def get_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    orders = (
        db.query(SecurityHolding)
        .order_by(SecurityHolding.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return orders
