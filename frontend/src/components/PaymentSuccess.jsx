import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './PaymentSuccess.css';

function PaymentSuccess() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://mediflow-ai-three.vercel.app';

  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/orders/${orderId}`);
      setOrderDetails(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading order:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="success-page">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="success-page">
      <div className="success-container">
        {/* Success Animation */}
        <div className="success-icon-wrapper">
          <div className="success-icon">✓</div>
        </div>

        {/* Success Message */}
        <h1 className="success-title">Payment Successful!</h1>
        <p className="success-subtitle">
          Your order has been confirmed and is being processed.
        </p>

        {/* Order Details Card */}
        <div className="success-card">
          <div className="order-number">
            <span className="label">Order Number</span>
            <span className="value">#{orderDetails?.id}</span>
          </div>

          <div className="confirmation-details">
            <div className="detail-item">
              <span className="icon">📧</span>
              <div className="detail-text">
                <span className="detail-label">Confirmation sent to</span>
                <span className="detail-value">{orderDetails?.email || orderDetails?.consumer_email}</span>
              </div>
            </div>

            <div className="detail-item">
              <span className="icon">💰</span>
              <div className="detail-text">
                <span className="detail-label">Amount paid</span>
                <span className="detail-value">${orderDetails?.total_amount?.toFixed(2)}</span>
              </div>
            </div>

            <div className="detail-item">
              <span className="icon">📦</span>
              <div className="detail-text">
                <span className="detail-label">Estimated delivery</span>
                <span className="detail-value">2-3 business days</span>
              </div>
            </div>
          </div>

          {/* Items Summary */}
          {orderDetails?.items && orderDetails.items.length > 0 && (
            <div className="items-summary">
              <h3>Order Items</h3>
              {orderDetails.items.map((item, index) => (
                <div key={index} className="item-row">
                  <span className="item-name">{item.medicine_name}</span>
                  <span className="item-qty">×{item.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="success-actions">
          <button onClick={() => navigate('/chat')} className="btn-primary">
            Return to Chat
          </button>
          <button onClick={() => navigate('/app')} className="btn-secondary">
            View Dashboard
          </button>
        </div>

        {/* Info Note */}
        <div className="info-banner">
          <span className="info-icon">ℹ️</span>
          <p>
            You can track your order status in the chat interface or view your order history in the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess;