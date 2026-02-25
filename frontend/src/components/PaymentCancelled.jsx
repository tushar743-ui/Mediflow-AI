import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PaymentCancelled.css';

function PaymentCancelled() {
  const navigate = useNavigate();

  return (
    <div className="cancelled-page">
      <div className="cancelled-container">
        {/* Cancelled Icon */}
        <div className="cancelled-icon-wrapper">
          <div className="cancelled-icon">✕</div>
        </div>

        {/* Cancelled Message */}
        <h1 className="cancelled-title">Order Cancelled</h1>
        <p className="cancelled-subtitle">
          Your order has been cancelled and inventory has been restored.
        </p>

        {/* Info Card */}
        <div className="cancelled-card">
          <div className="info-item">
            <span className="icon">ℹ️</span>
            <div className="info-text">
              <h3>What happened?</h3>
              <p>
                The order was cancelled before payment was processed. No charges were made to your account.
              </p>
            </div>
          </div>

          <div className="info-item">
            <span className="icon">💊</span>
            <div className="info-text">
              <h3>Need medication?</h3>
              <p>
                You can place a new order anytime by chatting with our AI assistant.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="cancelled-actions">
          <button onClick={() => navigate('/chat')} className="btn-primary">
            Return to Chat
          </button>
          <button onClick={() => navigate('/app')} className="btn-secondary">
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentCancelled;