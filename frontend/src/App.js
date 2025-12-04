import React, { useState, useEffect } from 'react';
import axios from 'axios';
import YieldCurveChart from './YieldCurveChart';
import OrderForm from './OrderForm';
import OrderHistory from './OrderHistory';
import LoadingScreen from './LoadingScreen';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';

function App() {
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [yieldData, setYieldData] = useState([]);
  const [orders, setOrders] = useState([]);
  const [refreshOrders, setRefreshOrders] = useState(false);

  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        await axios.get(`${API_URL}/api/health`);
        setIsBackendReady(true);
      } catch (error) {
        console.log("Backend still initializing...");
      }
    };

    checkBackendHealth();
    const intervalId = setInterval(checkBackendHealth, 1000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    axios.get(`${API_URL}/api/yields`)
      .then(res => setYieldData(res.data))
      .catch(err => console.error("Error fetching yields:", err));
  }, []);

  useEffect(() => {

    axios.get(`${API_URL}/api/orders`)
      .then(res => setOrders(res.data))
      .catch(err => console.error("Error fetching orders:", err));

  }, [refreshOrders]);

  const handleNewOrder = () => {
    setRefreshOrders(prev => !prev);
  };

  if (!isBackendReady) {
    return <LoadingScreen />;
  }
  return (
    <div className="App">
      <header className="App-header">
        <h1>Bank Liquidity Management</h1>
      </header>

      <main className="App-main">
        <div className="module">
          <YieldCurveChart data={yieldData} />
        </div>

        <div className="module-container">
          <div className="left-column">
            <div className="module">
              <OrderForm onNewOrder={handleNewOrder} />
            </div>
          </div>

          <div className="right-column">
            <div className="module full-height">
              <OrderHistory orders={orders} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;