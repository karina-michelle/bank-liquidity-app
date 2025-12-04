import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import './OrderForm.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';
const formatCurrency = (val) => val ? val.toLocaleString() : "0";
const formatDate = (isoDateString) => {
    if (!isoDateString) return "N/A";
    const cleanDate = isoDateString.toString().split('T')[0];
    const [year, month, day] = cleanDate.split('-');
    
    return `${month}/${day}/${year}`;
};

const OrderForm = ({ onNewOrder }) => {
    const [activeTab, setActiveTab] = useState('secondary');

    const [parValue, setParValue] = useState(1000000);
    const [portfolioType, setPortfolioType] = useState('AFS');

    const [marketInventory, setMarketInventory] = useState([]);
    const [auctionList, setAuctionList] = useState([]);

    const [selectedSecurity, setSelectedSecurity] = useState(null);
    const [yieldRange, setYieldRange] = useState([0, 10]);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    useEffect(() => {
        // Fetch secondary market inventory
        axios.get(`${API_URL}/api/market/inventory`)
            .then(res => {
                setMarketInventory(res.data);

                // Initialize yield range based on fetched data
                if (res.data.length > 0) {
                    const yields = res.data.map(i => i.yield_to_worst);
                    setYieldRange([Math.min(...yields), Math.max(...yields)]);

                    const dates = res.data.map(i => i.maturity_date);

                    dates.sort();

                    setDateRange({
                        start: dates[0],
                        end: dates[dates.length - 1]
                    });
                }
            })
            .catch(err => console.error(err));

        // Fetch active auctions
        axios.get(`${API_URL}/api/auctions`)
            .then(res => setAuctionList(res.data))
            .catch(err => console.error(err));
    }, []);

    const filteredInventory = useMemo(() => {
        return marketInventory.filter(item => {
            const inYield = item.yield_to_worst >= yieldRange[0] &&
                item.yield_to_worst <= yieldRange[1];
            let inDate = true;
            if (dateRange.start && dateRange.end) {
                const matDate = new Date(item.maturity_date);
                const startDate = new Date(dateRange.start);
                const endDate = new Date(dateRange.end);
                inDate = matDate >= startDate && matDate <= endDate;
            }

            return inYield && inDate;
        });
    }, [marketInventory, yieldRange, dateRange]);

    const handleSecondarySelect = (e) => {
        const cusip = e.target.value;
        const item = marketInventory.find(i => i.cusip === cusip);
        setSelectedSecurity(item);
    };

    const handleAuctionSelect = (e) => {
        const cusip = e.target.value;
        const item = auctionList.find(i => i.cusip === cusip);
        // Transform auction data to match our schema
        setSelectedSecurity({
            cusip: item.cusip,
            description: `AUCTION: ${item.security_type} - ${item.security_term}`,
            term: item.security_term,
            purchase_yield: 0,
            price_ask: 100.00,
            issue_date: item.issue_date,
            offering_amount: item.offering_amount,
            is_auction: true
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedSecurity) return alert("Please select a security");

        const orderData = {
            cusip: selectedSecurity.cusip,
            term: selectedSecurity.term || "N/A",
            amount: parseFloat(parValue),
            portfolio_type: portfolioType,
            purchase_yield: selectedSecurity.is_auction ? 0 : selectedSecurity.yield_to_worst,
            order_type: activeTab === 'auction' ? 'Auction Bid' : 'Trade'
        };

        axios.post(`${API_URL}/api/orders`, orderData)
            .then(() => {
                alert(`${activeTab === 'auction' ? 'Bid' : 'Trade'} Submitted!`);
                onNewOrder();
                axios.get(`${API_URL}/api/market/inventory`)
                    .then(res => setMarketInventory(res.data))
                    .catch(console.error);

                setSelectedSecurity(null);
            })
            .catch(err => {
                const msg = err.response?.data?.detail || "Failed to submit order";
                alert(msg);
            });
    };

    return (
        <div className="order-form-container">
            <h3>Submit Order</h3>

            <div className="tabs-header">
                <button
                    className={activeTab === 'secondary' ? 'active' : ''}
                    onClick={() => { setActiveTab('secondary'); setSelectedSecurity(null); }}
                >
                    Secondary Market
                </button>
                <button
                    className={activeTab === 'auction' ? 'active' : ''}
                    onClick={() => { setActiveTab('auction'); setSelectedSecurity(null); }}
                >
                    Primary Auction
                </button>
            </div>

            <form onSubmit={handleSubmit} className="tab-content">

                <div className="form-group">
                    <label>Portfolio:</label>
                    <select value={portfolioType} onChange={e => setPortfolioType(e.target.value)}>
                        <option value="AFS">Available-for-Sale</option>
                        <option value="HTM">Held-to-Maturity</option>
                    </select>
                </div>

                <div className="form-group">
                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Amount ($):</span>

                        {activeTab === 'secondary' && selectedSecurity && (
                            <span style={{ color: '#64748b', fontSize: '11px' }}>
                                Max: ${formatCurrency(selectedSecurity.quantity_available)}
                            </span>
                        )}
                    </label>

                    <input
                        type="number"
                        value={parValue}
                        min={selectedSecurity ? selectedSecurity.quantity_min : 0}
                        max={selectedSecurity ? selectedSecurity.quantity_available : 1000000000}
                        onChange={e => {
                            const val = parseFloat(e.target.value);
                            setParValue(val);
                        }}
                        // Visual cue if they exceed the limit
                        style={{
                            borderColor: (selectedSecurity && parValue > selectedSecurity.quantity_available)
                                ? 'red'
                                : '#cbd5e1'
                        }}
                    />

                    {activeTab === 'secondary' && selectedSecurity && parValue > selectedSecurity.quantity_available && (
                        <p className="note" style={{ color: 'red' }}>
                            Amount exceeds available inventory.
                        </p>
                    )}
                </div>

                {activeTab === 'secondary' ? (

                    <>
                        <div className="form-group" style={{ padding: '0 5px' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Yield-To-Worst Filter:</span>
                                <span style={{ color: '#2563eb' }}>
                                    {yieldRange[0].toFixed(2)}% - {yieldRange[1].toFixed(2)}%
                                </span>
                            </label>
                            <div style={{ padding: '10px 5px 20px 5px' }}>
                                <Slider
                                    range
                                    min={0}
                                    max={10}
                                    step={0.10}
                                    value={yieldRange}
                                    onChange={(val) => setYieldRange(val)}
                                    trackStyle={[{ backgroundColor: '#2563eb' }]}
                                    handleStyle={[{ borderColor: '#2563eb' }, { borderColor: '#2563eb' }]}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ padding: '0 5px' }}>
                            <label>Maturity Date:</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                                    style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                />

                                <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 500 }}>to</span>

                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                                    style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ padding: '0 5px' }}>
                            <label>Select Security ({filteredInventory.length} Available):</label>
                            <select onChange={handleSecondarySelect} value={selectedSecurity?.cusip || ""}>
                                <option value="" disabled>-- Select a Security --</option>
                                {filteredInventory.map(item => (
                                    <option key={item.cusip} value={item.cusip}>
                                        {item.description} | YTM: {item.yield_to_worst.toFixed(2)}%
                                    </option>
                                ))}
                            </select>
                            {filteredInventory.length === 0 && (
                                <p className="note" style={{ color: 'red' }}>No bonds match your yield filter.</p>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="form-group">
                        <label>Select Auction Item:</label>
                        <select onChange={handleAuctionSelect} defaultValue="">
                            <option value="" disabled>-- Select Auction Item --</option>
                            {auctionList.map(item => (
                                <option key={item.cusip} value={item.cusip}>
                                    {formatDate(item.auction_date)} | {item.security_term} {item.security_type}
                                </option>
                            ))}
                        </select>
                        <p className="note">Note: Final yield determined at auction close.</p>
                    </div>
                )}

                {selectedSecurity && (
                    <div className="order-preview">
                        <strong>Details:</strong>
                        <div>CUSIP: {selectedSecurity.cusip}</div>
                        {!selectedSecurity.is_auction ? (
                            <>
                                <div>Price: {selectedSecurity.price_ask}</div>
                                <div>Yield: {selectedSecurity.yield_to_worst}%</div>
                                <div>Est. Cost: ${(parValue * (selectedSecurity.price_ask / 100)).toLocaleString()}</div>
                            </>
                        ) : (
                            <>
                                <div>Issue Date: {formatDate(selectedSecurity.issue_date)}</div>
                                <div>Offering Amount: {selectedSecurity.offering_amount}</div>
                            </>
                        )}
                    </div>
                )}

                <button type="submit" className="submit-btn">
                    {activeTab === 'secondary' ? 'Execute Trade' : 'Submit Bid'}
                </button>
            </form>
        </div>
    );
};

export default OrderForm;