import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = () => {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <h2>Initializing Market Data...</h2>
      <p>Fetching latest Treasury rates and syncing auctions.</p>
    </div>
  );
};

export default LoadingScreen;