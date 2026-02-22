import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ChatInterface from './components/ChatInterface';
import AdminDashboard from './components/AdminDashboard';
import ConsumerSelector from './components/ConsumerSelector';
import AdminLoginModal from './components/AdminLoginModal';
import PrescriptionUpload from './components/PrescriptionUpload';

import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://mediflow-ai-three.vercel.app/api';
function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedConsumer, setSelectedConsumer] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    loadConsumers();
    // Check if admin was previously unlocked
    const wasUnlocked = localStorage.getItem('adminUnlocked') === 'true';
    setAdminUnlocked(wasUnlocked);
  }, []);

  // Handle browser back button when on admin page
  useEffect(() => {
    const handlePopState = () => {
      // If navigating away from admin, close modal
      if (location.pathname !== '/admin') {
        setShowLoginModal(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location]);

  const loadConsumers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/consumers`);
      setConsumers(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading consumers:', error);
      setLoading(false);
    }
  };

  const handleConsumerSelect = async (consumer) => {
    setSelectedConsumer(consumer);

    try {
      const response = await axios.post(`${API_BASE_URL}/conversation/start`, {
        consumerId: consumer.id
      });
      setSessionId(response.data.sessionId);
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const handleLogout = () => {
    setSelectedConsumer(null);
    setSessionId(null);
  };

  const handleAdminClick = () => {
    if (!adminUnlocked) {
      // Show modal instead of prompt
      setShowLoginModal(true);
    } else {
      // Already unlocked, just navigate
      navigate('/admin');
    }
  };

  const handlePasswordSubmit = (password) => {
    // Store password
    localStorage.setItem('adminPassword', password);
    localStorage.setItem('adminUnlocked', 'true');
    setAdminUnlocked(true);
    setShowLoginModal(false);
    navigate('/admin');
  };

  const handleModalClose = () => {
    setShowLoginModal(false);
    // If modal was closed without login, stay on current page
    // Don't navigate to admin
  };

  const handleLockAdmin = () => {
    // Lock admin and clear credentials
    localStorage.removeItem('adminPassword');
    localStorage.removeItem('adminUnlocked');
    setAdminUnlocked(false);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading Mediflow AI System...</p>
      </div>
    );
  }

  const currentPath = location.pathname;

  return (
    <div className="app">
      {/* Admin Login Modal */}
      {showLoginModal && (
        <AdminLoginModal
          onSubmit={handlePasswordSubmit}
          onClose={handleModalClose}
        />
      )}

      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">
              <span className="icon"><img src="/qw.png" /></span>
              Mediflow AI
            </h1>
            <p className="app-subtitle">
              Autonomous Intelligent Pharmacy System
            </p>
          </div>

          <nav className="header-nav">
            <button
              className={`nav-btn ${currentPath === '/' ? 'active' : ''}`}
              onClick={() => navigate('/')}
            >
              💬 Chat
            </button>
            <button
              className={`nav-btn ${currentPath === '/admin' ? 'active' : ''}`}
              onClick={handleAdminClick}
            >
              ⚙️ Admin {adminUnlocked ? '🔓' : '🔒'}
            </button>
            
            {/* Lock button - only show when admin is unlocked and on admin page */}
            {adminUnlocked && currentPath === '/admin' && (
              <button
                className="nav-btn lock-btn"
                onClick={handleLockAdmin}
                title="Lock Admin Panel"
              >
                🔒 Lock
              </button>
            )}
          </nav>

          {selectedConsumer && currentPath === '/' && (
            <div className="user-info">
              <span className="user-name">{selectedConsumer.name}</span>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              selectedConsumer && sessionId ? (
                <ChatInterface
                  consumer={selectedConsumer}
                  sessionId={sessionId}
                  apiBaseUrl={API_BASE_URL}
                />
              ) : (
                <ConsumerSelector
                  consumers={consumers}
                  onSelect={handleConsumerSelect}
                />
              )
            }
          />

          <Route
            path="/admin"
            element={<AdminDashboard apiBaseUrl={API_BASE_URL} />}
          />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>
          Agentic AI Pharmacy System • Multi-Agent Architecture • Production
          Ready
        </p>
      </footer>
    </div>
  );
}

export default App;