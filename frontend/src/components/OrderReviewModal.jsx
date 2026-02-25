import React from 'react';
import { useNavigate } from 'react-router-dom';
import './OrderReviewModal.css';

function OrderReviewModal({ orderDetails, onClose }) {
  const navigate = useNavigate();

  if (!orderDetails) return null;

  const handleProceedToPayment = () => {
    navigate(`/payment/${orderDetails.orderId}`);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>Review Your Order</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Order Summary */}
        <div className="modal-body">
          <div className="order-info-section">
            <div className="info-item">
              <span className="info-label">Order Number:</span>
              <span className="info-value">#{orderDetails.orderId}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Status:</span>
              <span className="status-badge pending">Pending Payment</span>
            </div>
          </div>

          {/* Items List */}
          <div className="items-section">
            <h3>Order Items</h3>
            <div className="items-list">
              {orderDetails.items?.map((item, index) => (
                <div key={index} className="order-item">
                  <div className="item-info">
                    <span className="item-name">{item.medicine_name}</span>
                    <span className="item-details">
                      {item.dosage && `${item.dosage} • `}
                      Qty: {item.quantity}
                    </span>
                  </div>
                  <div className="item-price">
                    ${(item.unit_price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="total-section">
            <div className="total-row">
              <span className="total-label">Subtotal:</span>
              <span className="total-value">${orderDetails.totalAmount?.toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span className="total-label">Tax:</span>
              <span className="total-value">$0.00</span>
            </div>
            <div className="total-row final-total">
              <span className="total-label">Total:</span>
              <span className="total-value">${orderDetails.totalAmount?.toFixed(2)}</span>
            </div>
          </div>

          {/* Info Note */}
          <div className="info-note">
            <span className="info-icon">ℹ️</span>
            <p>You'll be redirected to a secure payment page to complete your purchase.</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button className="btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-proceed" onClick={handleProceedToPayment}>
            Proceed to Payment →
          </button>
        </div>
      </div>
    </div>
  );
}

export default OrderReviewModal;