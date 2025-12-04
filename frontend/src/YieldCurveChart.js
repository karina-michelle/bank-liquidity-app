import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';
const YieldCurveChart = () => {
  const [data, setData] = useState([]);
  const [showYesterday, setShowYesterday] = useState(false);
  const [showLastMonth, setShowLastMonth] = useState(false);
  const [showLastYear, setShowLastYear] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/yields`)
      .then(res => setData(res.data)) 
      .catch(e => console.error(e));
  }, []);

  return (
    <div style={{ width: '100%', height: '350px', minHeight: '350px' }}>
      <h3 style={{ marginTop: 0 }}>Treasury Yield Curve</h3>

      <div style={{ marginBottom: '5px', display: 'flex', gap: '15px', fontSize: '14px' }}>
        
        <label style={{cursor: 'pointer'}}>
          <input 
            type="checkbox" 
            checked={showYesterday} 
            onChange={e => setShowYesterday(e.target.checked)} 
          /> Show Yesterday
        </label>
        <label style={{cursor: 'pointer'}}>
          <input 
            type="checkbox" 
            checked={showLastMonth} 
            onChange={e => setShowLastMonth(e.target.checked)} 
          /> Show Last Month
        </label>
        <label style={{cursor: 'pointer'}}>
          <input 
            type="checkbox" 
            checked={showLastYear} 
            onChange={e => setShowLastYear(e.target.checked)} 
          /> Show Last Year
        </label>
      </div>

      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 15, right: 30, left: 10, bottom: 65 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="term" axisLine={false} tickLine={false} padding={{ left: 30, right: 30 }}/>
          <YAxis 
            domain={['auto', 'auto']} 
            axisLine={false} 
            tickLine={false} 
            width={30}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '10px' }}/>
          
          <Line 
            type="monotone" 
            dataKey="current"
            name="Current" 
            stroke="#2563eb" 
            strokeWidth={3} 
            dot={{ r: 4 }}
          />

          {showYesterday && (
            <Line 
              type="monotone" 
              dataKey="yesterday" 
              name="Yesterday" 
              stroke="#c6879eff" 
              strokeDasharray="2 4" 
              strokeWidth={2} 
            />
          )}
          
          {showLastMonth && (
            <Line 
              type="monotone" 
              dataKey="lastMonth" 
              name="Last Month" 
              stroke="#9333ea" 
              strokeDasharray="5 5" 
              strokeWidth={2} 
            />
          )}

          {showLastYear && (
            <Line 
              type="monotone" 
              dataKey="lastYear" 
              name="Last Year" 
              stroke="#94a3b8" 
              strokeDasharray="3 4" 
              strokeWidth={2} 
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default YieldCurveChart;