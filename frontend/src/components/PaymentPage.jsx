import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import './PaymentPage.css';

// Load Stripe (outside component to avoid recreating)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function PaymentForm({ orderDetails, apiBaseUrl, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setErrorMessage('');

    try {
      // Step 1: Create payment intent on backend
      const { data } = await axios.post(`${apiBaseUrl}/stripe/create-payment-intent`, {
        orderId: orderDetails.id,
        amount: Math.round(orderDetails.total_amount * 100), // Convert to cents
      });

      // Step 2: Confirm payment with Stripe
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            email: orderDetails.consumer_email,
            name: orderDetails.consumer_name,
          },
        },
      });

      if (result.error) {
        // Payment failed
        setErrorMessage(result.error.message);
        onError(result.error.message);
      } else if (result.paymentIntent.status === 'succeeded') {
        // Payment succeeded
        console.log('Payment successful!', result.paymentIntent);
        onSuccess(result.paymentIntent.id);
      }
    } catch (error) {
      console.error('Payment error:', error);
      setErrorMessage(error.response?.data?.error || 'Payment failed. Please try again.');
      onError(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#0f172a',
        fontFamily: "'DM Sans', sans-serif",
        '::placeholder': {
          color: '#94a3b8',
        },
        lineHeight: '24px',
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444',
      },
    },
    hidePostalCode: false,
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <div className="card-element-container">
        <label className="card-label">Card Details</label>
        <div className="card-element-wrapper">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {errorMessage && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        className="pay-button"
        disabled={!stripe || processing}
      >
        {processing ? (
          <>
            <span className="spinner"></span>
            Processing...
          </>
        ) : (
          <>
            Pay ${orderDetails.total_amount?.toFixed(2)}
          </>
        )}
      </button>

      <div className="test-card-info">
        💳 Test card: <code>4242 4242 4242 4242</code> • Any future date • Any CVC
      </div>
    </form>
  );
}

function PaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://mediflow-ai-three.vercel.app';

  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setError('Failed to load order details');
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      await axios.post(`${apiBaseUrl}/orders/${orderId}/cancel`);
      alert('Order cancelled successfully');
      navigate('/chat');
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order. Please try again.');
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    try {
      // Confirm order on backend
      await axios.put(`${apiBaseUrl}/orders/${orderId}/confirm`, {
        paymentIntentId,
      });

      // Navigate to success page
      navigate(`/payment/success/${orderId}`);
    } catch (error) {
      console.error('Error confirming order:', error);
      alert('Payment successful but order confirmation failed. Please contact support.');
    }
  };

  const handlePaymentError = (errorMessage) => {
    console.error('Payment failed:', errorMessage);
    // Error is already shown in the form
  };

  if (loading) {
    return (
      <div className="payment-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !orderDetails) {
    return (
      <div className="payment-page">
        <div className="error-container">
          <h2>⚠️ Error</h2>
          <p>{error || 'Order not found'}</p>
          <button onClick={() => navigate('/chat')} className="btn-back">
            Return to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <div className="payment-container">
        {/* Header */}
        <div className="payment-header">
          <button className="back-btn" onClick={() => navigate('/chat')}>
            ← Back
          </button>
          <h1>Complete Your Payment</h1>
          <div className="security-badge">
            <span className="lock-icon">🔒</span>
            Secured by Stripe
          </div>
        </div>

        <div className="payment-content">
          {/* Order Summary Card */}
          <div className="order-summary-card">
            <h2>Order Summary</h2>

            <div className="order-meta">
              <div className="meta-item">
                <span className="meta-label">Order Number</span>
                <span className="meta-value">#{orderDetails.id}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Status</span>
                <span className="status-badge pending">Pending Payment</span>
              </div>
            </div>

            {/* Items */}
            <div className="items-section">
              <h3>Items</h3>
              {orderDetails.items?.map((item, index) => (
                <div key={index} className="summary-item">
                  <div className="item-details">
                    <span className="item-name">{item.medicine_name}</span>
                    <span className="item-qty">Qty: {item.quantity}</span>
                  </div>
                  <span className="item-price">
                    ${(item.unit_price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="total-section">
              <div className="total-row">
                <span>Subtotal</span>
                <span>${orderDetails.total_amount?.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Tax</span>
                <span>$0.00</span>
              </div>
              <div className="total-row final">
                <span>Total</span>
                <span>${orderDetails.total_amount?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Form Card */}
          <div className="payment-form-card">
            <h2>Payment Information</h2>

            <Elements stripe={stripePromise}>
              <PaymentForm
                orderDetails={orderDetails}
                apiBaseUrl={apiBaseUrl}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </Elements>

            <div className="divider">
              <span>or</span>
            </div>

            <button onClick={handleCancelOrder} className="cancel-order-btn">
              Cancel Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentPage;