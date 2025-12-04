from app.database import Base
import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Date,
)


class Auction(Base):
    __tablename__ = "auctions"

    id = Column(Integer, primary_key=True)
    cusip = Column(String, unique=True, index=True)
    security_type = Column(String)
    security_term = Column(String)
    auction_date = Column(Date)
    issue_date = Column(Date)
    offering_amount = Column(Float)
    status = Column(String, default="OPEN")


class SecurityHolding(Base):
    __tablename__ = "securities"
    id = Column(Integer, primary_key=True, index=True)
    cusip = Column(String, index=True, default="N/A")
    term = Column(String)
    amount = Column(Float)
    purchase_yield = Column(Float)
    portfolio_type = Column(String)
    order_type = Column(String, default="Trade")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


class MarketInventory(Base):
    __tablename__ = "market_inventory"
    id = Column(Integer, primary_key=True)
    cusip = Column(String, unique=True, index=True)
    description = Column(String)
    coupon = Column(Float)
    maturity_date = Column(Date)
    price_ask = Column(Float)
    yield_to_worst = Column(Float)
    quantity_min = Column(Integer)
    quantity_available = Column(Integer)
