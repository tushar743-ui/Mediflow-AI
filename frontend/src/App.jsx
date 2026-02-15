// import React, { useState, useEffect, useRef } from 'react';
// import axios from 'axios';
// import ChatInterface from './components/ChatInterface';
// import AdminDashboard from './components/AdminDashboard';
// import ConsumerSelector from './components/ConsumerSelector';
// import './App.css';

// const API_BASE_URL = '/api';

// function App() {
//   const [currentView, setCurrentView] = useState('chat'); // 'chat' or 'admin'
//   const [selectedConsumer, setSelectedConsumer] = useState(null);
//   const [sessionId, setSessionId] = useState(null);
//   const [consumers, setConsumers] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     loadConsumers();
//   }, []);

//   const loadConsumers = async () => {
//     try {
//       const response = await axios.get(`${API_BASE_URL}/consumers`);
//       setConsumers(response.data);
//       setLoading(false);
//     } catch (error) {
//       console.error('Error loading consumers:', error);
//       setLoading(false);
//     }
//   };

//   const handleConsumerSelect = async (consumer) => {
//     setSelectedConsumer(consumer);
    
//     // Start new conversation session
//     try {
//       const response = await axios.post(`${API_BASE_URL}/conversation/start`, {
//         consumerId: consumer.id
//       });
//       setSessionId(response.data.sessionId);
//     } catch (error) {
//       console.error('Error starting session:', error);
//     }
//   };

//   const handleLogout = () => {
//     setSelectedConsumer(null);
//     setSessionId(null);
//   };

//   if (loading) {
//     return (
//       <div className="loading-container">
//         <div className="loading-spinner"></div>
//         <p>Loading Mediflow AI System...</p>
//       </div>
//     );
//   }

//   return (
//     <div className="app">
//       <header className="app-header">
//         <div className="header-content">
//           <div className="header-left">
//             <h1 className="app-title">
//               <span className="icon">🏥</span>
//               Mediflow AI
//             </h1>
//             <p className="app-subtitle">Autonomous Intelligent Pharmacy System</p>
//           </div>
          
//           <nav className="header-nav">
//             <button
//               className={`nav-btn ${currentView === 'chat' ? 'active' : ''}`}
//               onClick={() => setCurrentView('chat')}
//             >
//               💬 Chat
//             </button>
//             <button
//               className={`nav-btn ${currentView === 'admin' ? 'active' : ''}`}
//               onClick={() => setCurrentView('admin')}
//             >
//               ⚙️ Admin
//             </button>
//           </nav>

//           {selectedConsumer && currentView === 'chat' && (
//             <div className="user-info">
//               <span className="user-name">{selectedConsumer.name}</span>
//               <button className="logout-btn" onClick={handleLogout}>
//                 Logout
//               </button>
//             </div>
//           )}
//         </div>
//       </header>

//       <main className="app-main">
//         {currentView === 'chat' ? (
//           selectedConsumer && sessionId ? (
//             <ChatInterface
//               consumer={selectedConsumer}
//               sessionId={sessionId}
//               apiBaseUrl={API_BASE_URL}
//             />
//           ) : (
//             <ConsumerSelector
//               consumers={consumers}
//               onSelect={handleConsumerSelect}
//             />
//           )
//         ) : (
//           <AdminDashboard apiBaseUrl={API_BASE_URL} />
//         )}
//       </main>

//       <footer className="app-footer">
//         <p>Agentic AI Pharmacy System • Multi-Agent Architecture • Production Ready</p>
//       </footer>
//     </div>
//   );
// }

// export default App;


import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ChatInterface from './components/ChatInterface';
import AdminDashboard from './components/AdminDashboard';
import ConsumerSelector from './components/ConsumerSelector';
import './App.css';

const API_BASE_URL = '/api';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedConsumer, setSelectedConsumer] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConsumers();
  }, []);

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
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">
              <span className="icon">🏥</span>
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
              onClick={() => navigate('/admin')}
            >
              ⚙️ Admin
            </button>
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
