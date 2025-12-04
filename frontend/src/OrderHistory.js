import React from 'react';
import './OrderHistory.css';

const OrderHistory = ({ orders }) => {
  return (
    <div className="history-container">
      <h3 style={{ marginTop: 0 }}>Order History</h3>
      <div className="table-wrapper">
        <table className="history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>CUSIP</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Portfolio</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>No orders found.</td></tr>
            ) : (
              orders.map(order => (
                <tr key={order.id}>
                  <td>{new Date(order.timestamp).toLocaleDateString()}</td>
                  <td>{order.cusip}</td>
                  <td>
                    <span style={{
                        backgroundColor: order.order_type === 'Auction Bid' ? '#f3e8ff' : '#e0f2fe',
                        color: order.order_type === 'Auction Bid' ? '#7e22ce' : '#0369a1',
                        padding: '4px 12px',
                        whiteSpace: 'nowrap',
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: '600'
                    }}>
                        {order.order_type}
                    </span>
                </td>
                  <td>${order.amount.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${order.portfolio_type}`}>
                        {order.portfolio_type}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderHistory;