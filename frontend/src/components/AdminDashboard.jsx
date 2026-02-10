import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';

function AdminDashboard({ apiBaseUrl }) {
  const [activeTab, setActiveTab] = useState('inventory');
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [agentActions, setAgentActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [predictionRunning, setPredictionRunning] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'inventory':
          await loadInventory();
          break;
        case 'orders':
          await loadOrders();
          break;
        case 'alerts':
          await loadAlerts();
          break;
        case 'agents':
          await loadAgentActions();
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    const response = await axios.get(`${apiBaseUrl}/admin/inventory`);
    setInventory(response.data);
  };

  const loadOrders = async () => {
    const response = await axios.get(`${apiBaseUrl}/orders`);
    setOrders(response.data);
  };

  const loadAlerts = async () => {
    const response = await axios.get(`${apiBaseUrl}/admin/alerts`);
    setAlerts(response.data);
  };

  const loadAgentActions = async () => {
    const response = await axios.get(`${apiBaseUrl}/admin/agent-actions`);
    setAgentActions(response.data);
  };

  const runPredictions = async () => {
    setPredictionRunning(true);
    try {
      const response = await axios.post(`${apiBaseUrl}/admin/run-predictions`);
      alert(`Predictions completed! Generated ${response.data.predictionsCount} refill predictions.`);
      await loadAlerts();
    } catch (error) {
      console.error('Error running predictions:', error);
      alert('Error running predictions. Check console for details.');
    } finally {
      setPredictionRunning(false);
    }
  };

  const getStockStatusClass = (status) => {
    const classes = {
      out_of_stock: 'status-critical',
      low_stock: 'status-warning',
      medium_stock: 'status-caution',
      good_stock: 'status-good'
    };
    return classes[status] || '';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h2>Admin Dashboard</h2>
        <div className="dashboard-actions">
          <button 
            className="action-btn primary"
            onClick={runPredictions}
            disabled={predictionRunning}
          >
            {predictionRunning ? '⏳ Running...' : '🔮 Run Predictions'}
          </button>
          <button className="action-btn" onClick={loadData}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          📦 Inventory
        </button>
        <button
          className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          🛒 Orders
        </button>
        <button
          className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          🔔 Alerts
        </button>
        <button
          className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          🤖 Agent Actions
        </button>
      </div>

      <div className="dashboard-content">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading data...</p>
          </div>
        ) : (
          <>
            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
              <div className="inventory-view">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Generic Name</th>
                      <th>Stock</th>
                      <th>Unit</th>
                      <th>Price</th>
                      <th>Prescription Required</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.medicine_name}</strong></td>
                        <td>{item.generic_name}</td>
                        <td className="stock-quantity">{item.stock_quantity}</td>
                        <td>{item.unit_type}</td>
                        <td>${item.price}</td>
                        <td>
                          {item.prescription_required ? (
                            <span className="badge badge-warning">Yes</span>
                          ) : (
                            <span className="badge badge-success">No</span>
                          )}
                        </td>
                        <td>
                          <span className={`stock-badge ${getStockStatusClass(item.stock_status)}`}>
                            {item.stock_status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="orders-view">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Consumer</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Webhook Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td><strong>#{order.id}</strong></td>
                        <td>{order.consumer_name}</td>
                        <td>{formatDate(order.order_date)}</td>
                        <td>${order.total_amount}</td>
                        <td>
                          <span className={`badge badge-${order.status}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          {order.fulfillment_webhook_sent ? '✅' : '⏳'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
              <div className="alerts-view">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Consumer</th>
                      <th>Medicine</th>
                      <th>Message</th>
                      <th>Triggered</th>
                      <th>Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => (
                      <tr key={alert.id}>
                        <td>
                          <span className={`badge badge-${alert.alert_type}`}>
                            {alert.alert_type}
                          </span>
                        </td>
                        <td>{alert.consumer_name || 'System'}</td>
                        <td>{alert.medicine_name || 'N/A'}</td>
                        <td className="alert-message">{alert.alert_message}</td>
                        <td>{formatDate(alert.triggered_at)}</td>
                        <td>{alert.sent ? '✅ Yes' : '⏳ Pending'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Agent Actions Tab */}
            {activeTab === 'agents' && (
              <div className="agents-view">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Agent Type</th>
                      <th>Action</th>
                      <th>Decision</th>
                      <th>Reasoning</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentActions.map((action) => (
                      <tr key={action.id}>
                        <td>
                          <span className="agent-type-badge">
                            {action.agent_type}
                          </span>
                        </td>
                        <td>{action.action_type}</td>
                        <td>
                          {action.decision && (
                            <span className={`badge badge-${action.decision.toLowerCase()}`}>
                              {action.decision}
                            </span>
                          )}
                        </td>
                        <td className="reasoning-cell">
                          {action.reasoning || 'N/A'}
                        </td>
                        <td>
                          <span className={`badge badge-${action.execution_status}`}>
                            {action.execution_status}
                          </span>
                        </td>
                        <td>{formatDate(action.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
