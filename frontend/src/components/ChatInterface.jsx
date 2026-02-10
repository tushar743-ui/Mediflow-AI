import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import VoiceInput from './VoiceInput';
import './ChatInterface.css';

function ChatInterface({ consumer, sessionId, apiBaseUrl }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadConversationHistory();
    loadPendingAlerts();
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversationHistory = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/conversation/${sessionId}/history`);
      const history = response.data.history || [];
      
      setMessages(history.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at
      })));
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const loadPendingAlerts = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/consumers/${consumer.id}/alerts`);
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
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await axios.post(`${apiBaseUrl}/conversation/message`, {
        sessionId,
        consumerId: consumer.id,
        message: message
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date().toISOString(),
        metadata: response.data
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Refresh alerts if order was created
      if (response.data.orderCreated) {
        setTimeout(loadPendingAlerts, 1000);
      }

      // Speak response if voice is enabled
      if (window.speechSynthesis && response.data.message) {
        speakText(response.data.message);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
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
    // Text-to-speech using Web Speech API (browser-based)
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

  return (
    <div className="chat-interface">
      {/* Proactive Alerts Banner */}
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

      {/* Quick Actions */}
      <div className="quick-actions">
        <button onClick={() => handleQuickAction('Show my recent orders')}>
          📋 Recent Orders
        </button>
        <button onClick={() => handleQuickAction('Check my prescriptions')}>
          💊 Prescriptions
        </button>
        <button onClick={() => handleQuickAction('What medicines do you have?')}>
          🏪 Browse Medicines
        </button>
      </div>

      {/* Messages Container */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Welcome, {consumer.name}! 👋</h2>
            <p>I'm your AI pharmacy assistant. I can help you:</p>
            <ul>
              <li>Order medications with natural conversation</li>
              <li>Get refill reminders before you run out</li>
              <li>Answer questions about your medications</li>
              <li>Check prescription requirements</li>
            </ul>
            <p className="voice-hint">
              💡 Use the microphone button below to speak your request!
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role} ${message.isError ? 'error' : ''}`}
          >
            <div className="message-avatar">
              {message.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              {message.metadata?.orderCreated && (
                <div className="order-confirmation">
                  ✅ Order #{message.metadata.order.id} Created Successfully!
                </div>
              )}
              {message.metadata?.requiresClarification && (
                <div className="clarification-needed">
                  ℹ️ Please provide more information
                </div>
              )}
              <div className="message-timestamp">
                {formatTimestamp(message.timestamp)}
              </div>
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

      {/* Input Area */}
      <form className="message-input-container" onSubmit={handleSubmit}>
        <VoiceInput onTranscript={handleVoiceInput} />
        
        <input
          ref={inputRef}
          type="text"
          className="message-input"
          placeholder="Type your message or use voice..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={loading}
        />
        
        <button
          type="submit"
          className="send-btn"
          disabled={loading || !inputMessage.trim()}
        >
          {loading ? '⏳' : '📤'}
        </button>
      </form>
    </div>
  );
}

export default ChatInterface;
