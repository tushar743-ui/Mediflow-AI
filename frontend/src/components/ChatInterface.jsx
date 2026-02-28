// import React, { useState, useEffect, useRef } from 'react';
// import axios from 'axios';
// import VoiceInput from './VoiceInput';
// import PrescriptionUpload from './PrescriptionUpload';
// import OrderReviewModal from './OrderReviewModal';
// import { useUser } from '@clerk/clerk-react'; 
// import { useNavigate } from 'react-router-dom';
// import './ChatInterface.css';

// function ChatInterface({ consumer, sessionId, apiBaseUrl, clerkUser }) {
//   // Get Clerk user if not passed as prop
//   const { user } = useUser();
//   const currentUser = clerkUser || user;
//   const navigate = useNavigate();

// const BASE = (apiBaseUrl || '').replace(/\/+$/, '');

//   const [messages, setMessages] = useState([]);
//   const [inputMessage, setInputMessage] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [pendingAlerts, setPendingAlerts] = useState([]);
//   const [showOrderReview, setShowOrderReview] = useState(false);
//   const [currentOrderDetails, setCurrentOrderDetails] = useState(null);
//   const messagesEndRef = useRef(null);
//   const inputRef = useRef(null);

//   useEffect(() => {
//     loadConversationHistory();
//     loadPendingAlerts();
//   }, [sessionId]);

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

//   const loadConversationHistory = async () => {
//     try {
//       const response = await axios.get(`${apiBaseUrl}/api/conversation/${sessionId}/history`);
//       const history = response.data.history || [];
      
//       setMessages(history.map(msg => ({
//         role: msg.role,
//         content: msg.content,
//         timestamp: msg.created_at
//       })));
//     } catch (error) {
//       console.error('Error loading history:', error);
//     }
//   };

//   const loadPendingAlerts = async () => {
//     try {
//       const response = await axios.get(`${apiBaseUrl}/api/consumers/${consumer.id}/alerts`);
//       setPendingAlerts(response.data.alerts || []);
//     } catch (error) {
//       console.error('Error loading alerts:', error);
//     }
//   };

//   const sendMessage = async (message) => {
//     if (!message.trim()) return;

//     const userMessage = {
//       role: 'user',
//       content: message,
//       timestamp: new Date().toISOString()
//     };

//     setMessages(prev => [...prev, userMessage]);
//     setInputMessage('');
//     setLoading(true);

//     try {
//       // Get Clerk email for the request
//       const customerEmail = currentUser?.primaryEmailAddress?.emailAddress || consumer.email || 'no-email@example.com';

//       console.log('Sending message with email:', customerEmail);

//       const response = await axios.post(`${apiBaseUrl}/api/conversation/message`, {
//         sessionId,
//         consumerId: consumer.id,
//         message: message,
//         customer_email: customerEmail  // Send Clerk email to backend
//       });

//       const assistantMessage = {
//         role: 'assistant',
//         content: response.data.message,
//         timestamp: new Date().toISOString(),
//         metadata: response.data
//       };

//       setMessages(prev => [...prev, assistantMessage]);

//       // NEW: Check if order was created and needs payment
//       if (response.data.orderCreated && response.data.needsPayment) {
//         console.log('Order created, showing review modal:', response.data.orderDetails);
        
//         // Show order review modal
//         setCurrentOrderDetails(response.data.orderDetails);
//         setShowOrderReview(true);
//       }

//       // Refresh alerts if order was created
//       if (response.data.orderCreated) {
//         setTimeout(loadPendingAlerts, 1000);
//       }

//       // Speak response if voice is enabled
//       if (window.speechSynthesis && response.data.message) {
//         speakText(response.data.message);
//       }

//     } catch (error) {
//       console.error('Error sending message:', error);
      
//       const errorMessage = {
//         role: 'assistant',
//         content: 'Sorry, I encountered an error. Please try again.',
//         timestamp: new Date().toISOString(),
//         isError: true
//       };

//       setMessages(prev => [...prev, errorMessage]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     sendMessage(inputMessage);
//   };

//   const handleVoiceInput = (transcript) => {
//     setInputMessage(transcript);
//     sendMessage(transcript);
//   };

//   const handleQuickAction = (action) => {
//     sendMessage(action);
//   };

//   const speakText = (text) => {
//     // Text-to-speech using Web Speech API (browser-based)
//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.rate = 1.0;
//     utterance.pitch = 1.0;
//     utterance.volume = 1.0;
//     window.speechSynthesis.speak(utterance);
//   };

//   const formatTimestamp = (timestamp) => {
//     const date = new Date(timestamp);
//     return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//   };

//   // Handle prescription upload
//   const handlePrescriptionExtracted = (medicines, patientInfo) => {
//     // Build message from extracted medicines
//     let message = 'I have a prescription with: ';
//     message += medicines.map(m => 
//       `${m.name}${m.dosage ? ' ' + m.dosage : ''}${m.quantity ? ' x ' + m.quantity : ''}`
//     ).join(', ');
    
//     // Send to backend
//     sendMessage(message);
//   };

//   // NEW: Handle order review modal close
//   const handleCloseOrderReview = () => {
//     setShowOrderReview(false);
//     setCurrentOrderDetails(null);
//   };

//   return (
//     <div className="chat-interface">
//       {/* NEW: Order Review Modal */}
//       {showOrderReview && currentOrderDetails && (
//         <OrderReviewModal
//           orderDetails={currentOrderDetails}
//           onClose={handleCloseOrderReview}
//         />
//       )}

//       {/* Proactive Alerts Banner */}
//       {pendingAlerts.length > 0 && (
//         <div className="alerts-banner">
//           <div className="alert-icon">🔔</div>
//           <div className="alert-content">
//             <strong>Refill Reminders:</strong>
//             {pendingAlerts.map((alert, idx) => (
//               <div key={idx} className="alert-item">
//                 {alert.alert_message}
//               </div>
//             ))}
//           </div>
//           <button 
//             className="alert-action-btn"
//             onClick={() => handleQuickAction('Yes, I would like to refill')}
//           >
//             Order Now
//           </button>
//         </div>
//       )}

//       {/* Quick Actions */}
//       <div className="quick-actions">
//         <button onClick={() => handleQuickAction('Show my recent orders')}>
//           📋 Recent Orders
//         </button>
//         <button onClick={() => handleQuickAction('Check my prescriptions')}>
//           💊 Prescriptions
//         </button>
//         <button onClick={() => handleQuickAction('What medicines do you have?')}>
//           🏪 Browse Medicines
//         </button>
//       </div>

//       {/* Messages Container */}
//       <div className="messages-container">
//         {messages.length === 0 && (
//           <div className="welcome-message">
//             <h2>Welcome, {consumer.name}! 👋</h2>
//             <p>I'm your AI pharmacy assistant. I can help you:</p>
//             <ul>
//               <li>Order medications with natural conversation</li>
//               <li>Get refill reminders before you run out</li>
//               <li>Answer questions about your medications</li>
//               <li>Check prescription requirements</li>
//             </ul>
//             <p className="voice-hint">
//               💡 Use the microphone or upload button below!
//             </p>
//           </div>
//         )}

//         {messages.map((message, index) => (
//           <div
//             key={index}
//             className={`message ${message.role} ${message.isError ? 'error' : ''}`}
//           >
//             <div className="message-avatar">
//               {message.role === 'user' ? '👤' : '🤖'}
//             </div>
//             <div className="message-content">
//               <div className="message-text">{message.content}</div>
//               {message.metadata?.orderCreated && message.metadata?.needsPayment && (
//                 <div className="order-confirmation payment-needed">
//                   💳 Order #{message.metadata.orderId} - Proceed to Payment
//                   <button 
//                     className="view-order-btn"
//                     onClick={() => navigate(`/payment/${message.metadata.orderId}`)}
//                   >
//                     Review & Pay
//                   </button>
//                 </div>
//               )}
//               {message.metadata?.orderCreated && !message.metadata?.needsPayment && (
//                 <div className="order-confirmation">
//                   ✅ Order #{message.metadata.orderId} Confirmed!
//                 </div>
//               )}
//               {message.metadata?.requiresClarification && (
//                 <div className="clarification-needed">
//                   ℹ️ Please provide more information
//                 </div>
//               )}
//               <div className="message-timestamp">
//                 {formatTimestamp(message.timestamp)}
//               </div>
//             </div>
//           </div>
//         ))}

//         {loading && (
//           <div className="message assistant">
//             <div className="message-avatar">🤖</div>
//             <div className="message-content">
//               <div className="typing-indicator">
//                 <span></span>
//                 <span></span>
//                 <span></span>
//               </div>
//             </div>
//           </div>
//         )}

//         <div ref={messagesEndRef} />
//       </div>

//       {/* Input Area */}
//       <form className="message-input-container" onSubmit={handleSubmit}>


//        <PrescriptionUpload 
//   apiBaseUrl={BASE}
//   onMedicinesExtracted={handlePrescriptionExtracted}
//   consumerId={consumer?.id}
//   customerEmail={currentUser?.primaryEmailAddress?.emailAddress || consumer.email}
// />
        
//         <input
//           ref={inputRef}
//           type="text"
//           className="message-input"
//           placeholder="Type your message or upload prescription..."
//           value={inputMessage}
//           onChange={(e) => setInputMessage(e.target.value)}
//           disabled={loading}
//         />
        
//         <VoiceInput onTranscript={handleVoiceInput} />
        
//         <button
//           type="submit"
//           className="send-btn"
//           disabled={loading || !inputMessage.trim()}
//         >
//           {loading ? '⏳' : (<img src="/search.png" className='Sbtn' alt="Send"/>)}
//         </button>
//       </form>
//     </div>
//   );
// }

// export default ChatInterface;









import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import VoiceInput from './VoiceInput';
import PrescriptionUpload from './PrescriptionUpload';
import OrderReviewModal from './OrderReviewModal';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import './ChatInterface.css';

/**
 * Simple Quantity Modal (multi-item)
 * Expects items like:
 * [{ medicineId, medicine_name, unit_type, suggested_default_quantity, ... }]
 */
function QuantityModal({ open, items = [], onClose, onConfirm }) {
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    if (!open) return;

    const initial = {};
    for (const it of items) {
      initial[it.medicineId] = Number.isInteger(it.suggested_default_quantity)
        ? it.suggested_default_quantity
        : 30; // UI-only default (NOT order default)
    }
    setQuantities(initial);
  }, [open, items]);

  if (!open) return null;

  const updateQty = (medicineId, nextQty) => {
    const safe = Math.max(1, Number(nextQty) || 1);
    setQuantities((prev) => ({ ...prev, [medicineId]: safe }));
  };

  const handleConfirm = () => {
    const payload = items.map((it) => ({
      ...it,
      quantity: Number(quantities[it.medicineId] || 1),
    }));
    onConfirm(payload);
  };

  return (
    <div className="modal-backdrop" style={backdropStyle}>
      <div className="modal" style={modalStyle}>
        <h3 style={{ marginTop: 0 }}>Select quantity</h3>
        <p style={{ marginTop: 6, opacity: 0.85 }}>
          Choose the quantity to continue with your order.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {items.map((it) => {
            const qty = quantities[it.medicineId] ?? 30;
            return (
              <div key={it.medicineId} style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{it.medicine_name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Unit: {it.unit_type || 'units'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => updateQty(it.medicineId, (qty || 1) - 1)}
                    style={btnStyle}
                  >
                    −
                  </button>

                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => updateQty(it.medicineId, e.target.value)}
                    style={inputStyle}
                  />

                  <button
                    type="button"
                    onClick={() => updateQty(it.medicineId, (qty || 1) + 1)}
                    style={btnStyle}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={onClose} style={secondaryStyle}>
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} style={primaryStyle}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// Minimal inline styles (so you don’t have to create a new CSS file)
const backdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const modalStyle = {
  width: 'min(560px, 92vw)',
  background: 'white',
  borderRadius: 14,
  padding: 18,
  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: 12,
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
};

const btnStyle = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.15)',
  background: 'white',
  cursor: 'pointer',
};

const inputStyle = {
  width: 70,
  height: 34,
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.15)',
  textAlign: 'center',
};

const primaryStyle = {
  padding: '10px 14px',
  borderRadius: 12,
  border: 'none',
  background: '#111827',
  color: 'white',
  cursor: 'pointer',
};

const secondaryStyle = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.15)',
  background: 'white',
  cursor: 'pointer',
};

function ChatInterface({ consumer, sessionId, apiBaseUrl, clerkUser }) {
  const { user } = useUser();
  const currentUser = clerkUser || user;
  const navigate = useNavigate();

  const BASE = (apiBaseUrl || import.meta.env.VITE_API_URL || "http://localhost:3001").replace(
    /\/+$/,
    ''
  );

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState([]);
  const [showOrderReview, setShowOrderReview] = useState(false);
  const [currentOrderDetails, setCurrentOrderDetails] = useState(null);

  // ✅ NEW: quantity popup state
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [pendingQtyItems, setPendingQtyItems] = useState([]); // from backend pendingQuantitySelections

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;
    loadConversationHistory();
    loadPendingAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversationHistory = async () => {
    try {
      const response = await axios.get(`${BASE}/api/conversation/${sessionId}/history`);
      const history = response.data.history || [];
      setMessages(
        history.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_at,
        }))
      );
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const loadPendingAlerts = async () => {
    try {
      if (!consumer?.id) return;
      const response = await axios.get(`${BASE}/api/consumers/${consumer.id}/alerts`);
      setPendingAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const sendMessage = async (message) => {
    if (!message.trim()) return;

    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const customerEmail =
        currentUser?.primaryEmailAddress?.emailAddress ||
        consumer?.email ||
        'no-email@example.com';

      const response = await axios.post(`${BASE}/api/conversation/message`, {
        sessionId,
        consumerId: consumer?.id,
        message: message,
        customer_email: customerEmail,
      });

      const data = response.data;

      const assistantMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        metadata: data,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // ✅ NEW: trigger quantity popup
      if (data?.next_action === 'ask_quantity' && Array.isArray(data?.pendingQuantitySelections)) {
        setPendingQtyItems(data.pendingQuantitySelections);
        setShowQuantityModal(true);
        // Important: do NOT proceed with payment modal etc.
        return;
      }

      if (data.orderCreated && data.needsPayment) {
        setCurrentOrderDetails(data.orderDetails);
        setShowOrderReview(true);
      }

      if (data.orderCreated) {
        setTimeout(loadPendingAlerts, 1000);
      }

      if (window.speechSynthesis && data.message) {
        speakText(data.message);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: when user confirms quantities, send follow-up order message
  const handleConfirmQuantities = async (itemsWithQty) => {
    setShowQuantityModal(false);

    // Build a natural follow-up message that your existing NLP pipeline can parse.
    // Example: "Order Paracetamol 500mg 20 tablets and Amlodipine 5mg 60 tablets"
    const parts = itemsWithQty.map((it) => {
      const unit = it.unit_type || 'units';
      return `${it.medicine_name} ${it.quantity} ${unit}`;
    });

    const followUp = `Order ${parts.join(' and ')}`;

    setPendingQtyItems([]);
    await sendMessage(followUp);
  };

  const handleCloseQuantityModal = () => {
    setShowQuantityModal(false);
    setPendingQtyItems([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const handleVoiceInput = (transcript) => {
    setInputMessage(transcript);
    sendMessage(transcript);
  };

  const handleQuickAction = (action) => {
    sendMessage(action);
  };

  const speakText = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handlePrescriptionExtracted = (medicines, patientInfo) => {
    let message = 'I have a prescription with: ';
    message += medicines
      .map(
        (m) =>
          `${m.name}${m.dosage ? ' ' + m.dosage : ''}${m.quantity ? ' x ' + m.quantity : ''}`
      )
      .join(', ');
    sendMessage(message);
  };

  const handleCloseOrderReview = () => {
    setShowOrderReview(false);
    setCurrentOrderDetails(null);
  };

  const customerEmailForUpload =
    currentUser?.primaryEmailAddress?.emailAddress ||
    consumer?.email ||
    '';

  return (
    <div className="chat-interface">
      {/* ✅ NEW: Quantity popup */}
      <QuantityModal
        open={showQuantityModal}
        items={pendingQtyItems}
        onClose={handleCloseQuantityModal}
        onConfirm={handleConfirmQuantities}
      />

      {showOrderReview && currentOrderDetails && (
        <OrderReviewModal orderDetails={currentOrderDetails} onClose={handleCloseOrderReview} />
      )}

      {pendingAlerts.length > 0 && (
        <div className="alerts-banner">
          <div className="alert-icon">🔔</div>
          <div className="alert-content">
            <strong>Refill Reminders:</strong>
            {pendingAlerts.map((alert, idx) => (
              <div key={idx} className="alert-item">
                {alert.alert_message}
              </div>
            ))}
          </div>
          <button
            className="alert-action-btn"
            onClick={() => handleQuickAction('Yes, I would like to refill')}
          >
            Order Now
          </button>
        </div>
      )}

      <div className="quick-actions">
        <button onClick={() => handleQuickAction('Show my recent orders')}>📋 Recent Orders</button>
        <button onClick={() => handleQuickAction('Check my prescriptions')}>💊 Prescriptions</button>
        <button onClick={() => handleQuickAction('What medicines do you have?')}>🏪 Browse Medicines</button>
      </div>

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Welcome, {consumer?.name}! 👋</h2>
            <p>I'm your AI pharmacy assistant. I can help you:</p>
            <ul>
              <li>Order medications with natural conversation</li>
              <li>Get refill reminders before you run out</li>
              <li>Answer questions about your medications</li>
              <li>Check prescription requirements</li>
            </ul>
            <p className="voice-hint">💡 Use the microphone or upload button below!</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role} ${message.isError ? 'error' : ''}`}>
            <div className="message-avatar">{message.role === 'user' ? '👤' : '🤖'}</div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>

              {message.metadata?.orderCreated && message.metadata?.needsPayment && (
                <div className="order-confirmation payment-needed">
                  💳 Order #{message.metadata.orderId} - Proceed to Payment
                  <button
                    className="view-order-btn"
                    onClick={() => navigate(`/payment/${message.metadata.orderId}`)}
                  >
                    Review & Pay
                  </button>
                </div>
              )}

              {message.metadata?.orderCreated && !message.metadata?.needsPayment && (
                <div className="order-confirmation">✅ Order #{message.metadata.orderId} Confirmed!</div>
              )}

              {/* Optional: show a small hint if backend asks clarification */}
              {message.metadata?.next_action === 'ask_quantity' && (
                <div className="clarification-needed">ℹ️ Please select quantity to continue</div>
              )}

              <div className="message-timestamp">{formatTimestamp(message.timestamp)}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-container" onSubmit={handleSubmit}>
        <PrescriptionUpload
          apiBaseUrl={BASE}
          onMedicinesExtracted={handlePrescriptionExtracted}
          consumerId={consumer?.id}
          customerEmail={customerEmailForUpload}
        />

        <input
          ref={inputRef}
          type="text"
          className="message-input"
          placeholder="Type your message or upload prescription..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={loading}
        />

        <VoiceInput onTranscript={handleVoiceInput} apiBaseUrl={BASE} />

        <button type="submit" className="send-btn" disabled={loading || !inputMessage.trim()}>
          {loading ? '⏳' : <img src="/search.png" className="Sbtn" alt="Send" />}
        </button>
      </form>
    </div>
  );
}

export default ChatInterface;








