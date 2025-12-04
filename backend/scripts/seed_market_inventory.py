"""
Seeds the MarketInventory table from a CSV file.
"""

import logging
from datetime import date, datetime, timedelta
import random
import string
from app.database import engine, SessionLocal, Base
from app.models import MarketInventory

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def parse_float(val):
    return float(val) if val else 0.0


NUM_RECORDS = 500
OUTPUT_FILE = "market_inventory.csv"


def generate_treasury_cusip():
    """Generates a mock CUSIP starting with 912 (US Treasury)."""
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=5))
    check = random.choice(string.digits)
    return f"912{suffix}{check}"


def generate_row():
    today = date.today()
    sec_type = random.choices(["Bill", "Note", "Bond"], weights=[0.2, 0.5, 0.3])[0]

    if sec_type == "Bill":
        days_to_mat = random.randint(30, 360)
        maturity_date = today + timedelta(days=days_to_mat)
        coupon = 0.00
        # Bills trade based on discount rate, currently high (~5.3%)
        market_yield = random.uniform(5.20, 5.45)
        # Simplified price calc for bills: 100 - (yield * fraction of year)
        price_ask = 100 - (market_yield * (days_to_mat / 360))
        desc_type = "BILL"

    elif sec_type == "Note":
        years_to_mat = random.randint(2, 10)
        maturity_date = today + timedelta(days=years_to_mat * 365)
        # Random coupon in 1/8th increments
        coupon = random.choice([x * 0.125 for x in range(8, 48)])  # 1.0% to 6.0%
        # Yield curve assumption (inverted): Notes yield less than bills (~4.3%)
        market_yield = random.uniform(4.10, 4.60)
        desc_type = "NOTE"

    else:  # Bond
        years_to_mat = random.randint(15, 30)
        maturity_date = today + timedelta(days=years_to_mat * 365)
        coupon = random.choice([x * 0.125 for x in range(16, 48)])  # 2.0% to 6.0%
        # Long end yields (~4.5%)
        market_yield = random.uniform(4.40, 4.70)
        desc_type = "BOND"

    # Calculate Price for Notes/Bonds (Heuristic approximation)
    if sec_type != "Bill":
        # If Coupon > Yield, Price > 100. If Coupon < Yield, Price < 100.
        # This is a Rough approximation, not exact bond math
        spread = coupon - market_yield
        # Duration factor magnifies price impact for longer maturities
        duration_factor = years_to_mat * 0.8
        price_ask = 100 + (spread * duration_factor)

    description = (
        f"US TREASURY {desc_type} {coupon:.3f}% {maturity_date.strftime('%m/%d/%y')}"
    )

    qty_min = random.choice([1000, 5000, 10000, 25000]) * 1000

    qty_available = qty_min * random.randint(10, 100)

    return {
        "CUSIP": generate_treasury_cusip(),
        "Description": description,
        "Coupon": f"{coupon:.3f}",
        "Maturity Date": maturity_date.strftime("%Y-%m-%d"),
        "Price Ask": f"{price_ask:.3f}",
        "Ask Yield to Worst": f"{market_yield:.3f}",
        "Quantity Ask Minimum": qty_min,
        "Quantity Available": qty_available,
    }


def seed_market_inventory():
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()

    if session.query(MarketInventory).count() > 0:
        logger.warning("Database already contains data. Skipping seed.")
        session.close()
        return

    logger.info("Seeding market inventory with synthetic data...")

    try:
        batch = []
        for _ in range(NUM_RECORDS):
            row = generate_row()
            item = MarketInventory(
                cusip=row["CUSIP"],
                description=row["Description"],
                coupon=parse_float(row["Coupon"]),
                maturity_date=datetime.strptime(
                    row["Maturity Date"], "%Y-%m-%d"
                ).date(),
                price_ask=parse_float(row["Price Ask"]),
                yield_to_worst=parse_float(row["Ask Yield to Worst"]),
                quantity_min=int(row["Quantity Ask Minimum"]),
                quantity_available=int(row["Quantity Available"]),
            )
            batch.append(item)

        session.add_all(batch)
        session.commit()
        logger.info(f"Successfully added {len(batch)} securities to the database.")

    except Exception as e:
        logger.error(f"Error during seeding: {e}")
        session.rollback()
    finally:
        session.close()


if __name__ == "__main__":
    seed_market_inventory()
