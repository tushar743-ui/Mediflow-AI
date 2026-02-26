// import React, { useState, useEffect } from 'react';
// import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
// import axios from 'axios';
// import ChatInterface from './components/ChatInterface';
// import AdminDashboard from './components/AdminDashboard';
// import ConsumerSelector from './components/ConsumerSelector';
// import AdminLoginModal from './components/AdminLoginModal';
// import GetStarted from './components/GetStarted';
// import { useClerk, UserButton , useUser} from '@clerk/clerk-react'
// import './App.css';

// const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://mediflow-ai-three.vercel.app';

// function App() {
//   const navigate = useNavigate();
//   const location = useLocation();
// const { signOut}=useClerk();
//   const [selectedConsumer, setSelectedConsumer] = useState(null);
//   const [sessionId, setSessionId] = useState(null);
//   const [consumers, setConsumers] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [adminUnlocked, setAdminUnlocked] = useState(false);
//   const [showLoginModal, setShowLoginModal] = useState(false);

//   // Only load consumers when not on landing page
//   useEffect(() => {
//     if (location.pathname !== '/') {
//       loadConsumers();
//     }
//   }, [location.pathname]);

//   // Check if admin was previously unlocked
//   useEffect(() => {
//     const wasUnlocked = localStorage.getItem('adminUnlocked') === 'true';
//     setAdminUnlocked(wasUnlocked);
//   }, []);

//   // Handle browser back button when on admin page
//   useEffect(() => {
//     const handlePopState = () => {
//       if (location.pathname !== '/admin') {
//         setShowLoginModal(false);
//       }
//     };

//     window.addEventListener('popstate', handlePopState);
//     return () => window.removeEventListener('popstate', handlePopState);
//   }, [location]);

//   const loadConsumers = async () => {
//     setLoading(true);
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

//     try {
//       const response = await axios.post(`${API_BASE_URL}/conversation/start`, {
//         consumerId: consumer.id
//       });
//       setSessionId(response.data.sessionId);
//       navigate('/chat');
//     } catch (error) {
//       console.error('Error starting session:', error);
//     }
//   };

//   const handleLogout = () => {
//     setSelectedConsumer(null);
//     setSessionId(null);
//     navigate('/app');
//   };

//   const handleAdminClick = () => {
//     if (!adminUnlocked) {
//       setShowLoginModal(true);
//     } else {
//       navigate('/admin');
//     }
//   };

//   const handlePasswordSubmit = (password) => {
//     localStorage.setItem('adminPassword', password);
//     localStorage.setItem('adminUnlocked', 'true');
//     setAdminUnlocked(true);
//     setShowLoginModal(false);
//     navigate('/admin');
//   };

//   const handleModalClose = () => {
//     setShowLoginModal(false);
//   };

//   const handleLockAdmin = () => {
//     localStorage.removeItem('adminPassword');
//     localStorage.removeItem('adminUnlocked');
//     setAdminUnlocked(false);
//     navigate('/app');
//   };

//   // Show landing page at root
//   if (location.pathname === '/') {
//     return <GetStarted />;
//   }

//   if (loading) {
//     return (
//       <div className="loading-container">
//         <div className="loading-spinner"></div>
//         <p>Loading Mediflow AI System...</p>
//       </div>
//     );
//   }

//   const currentPath = location.pathname;

//   return (
//     <div className="app">
//       {/* Admin Login Modal */}
//       {showLoginModal && (
//         <AdminLoginModal
//           onSubmit={handlePasswordSubmit}
//           onClose={handleModalClose}
//         />
//       )}

//       <header className="app-header">
//         <div className="header-content">
//           <div className="header-left">
//             <h1 className="app-title">
//               <span className="icon"><img src="/qw.png" /></span>
//               Mediflow AI
//             </h1>
//             <p className="app-subtitle">
//               Autonomous Intelligent Pharmacy System
//             </p>
//           </div>

//           <nav className="header-nav">
//             {/* signout button using clerk , which will sign sout and force redirect to getstarted page */}
//             <button className={`nav-btn ${currentPath === '/app' || currentPath === '/chat' ? 'active' : ''}`} onClick={()=>signOut({forceRedirectUrl: "/", })}>
//                Sign Out
//             </button>
            

//             <button
//               className={`nav-btn ${currentPath === '/app' || currentPath === '/chat' ? 'active' : ''}`}
//               onClick={() => navigate('/app')}
//             >
//                Chat
//             </button>
//             <button
//               className={`nav-btn ${currentPath === '/admin' ? 'active' : ''}`}
//               onClick={handleAdminClick}
//             >
//                Admin {adminUnlocked ? '🔓' : '🔒'}
//             </button>
            
//             {adminUnlocked && currentPath === '/admin' && (
//               <button
//                 className="nav-btn lock-btn"
//                 onClick={handleLockAdmin}
//                 title="Lock Admin Panel"
//               >
//                 🔒 Lock
//               </button>
//             )}
//           </nav>

//           {selectedConsumer && (currentPath === '/app' || currentPath === '/chat') && (
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
//         <Routes>
//           <Route
//             path="/app"
//             element={
//               <ConsumerSelector
//                 consumers={consumers}
//                 onSelect={handleConsumerSelect}
//               />
//             }
//           />

//           <Route
//             path="/chat"
//             element={
//               selectedConsumer && sessionId ? (
//                 <ChatInterface
//                   consumer={selectedConsumer}
//                   sessionId={sessionId}
//                   apiBaseUrl={API_BASE_URL}
//                 />
//               ) : (
//                 <ConsumerSelector
//                   consumers={consumers}
//                   onSelect={handleConsumerSelect}
//                 />
//               )
//             }
//           />

//           <Route
//             path="/admin"
//             element={<AdminDashboard apiBaseUrl={API_BASE_URL} />}
//           />
//         </Routes>
//       </main>

//       <footer className="app-footer">
//         <p>
//           Agentic AI Pharmacy System • Multi-Agent Architecture • Production
//           Ready
//         </p>
//       </footer>
//     </div>
//   );
// }

// export default App;










// import React, { useState, useEffect } from 'react';
// import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
// import axios from 'axios';
// import ChatInterface from './components/ChatInterface';
// import AdminDashboard from './components/AdminDashboard';
// import ConsumerSelector from './components/ConsumerSelector';
// import AdminLoginModal from './components/AdminLoginModal';
// import GetStarted from './components/GetStarted';
// import { useClerk, UserButton, useUser } from '@clerk/clerk-react';
// import './App.css';

// const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://mediflow-ai-three.vercel.app';

// function App() {
//   const navigate = useNavigate();
//   const location = useLocation();
//   const { signOut } = useClerk();
//   const { user, isLoaded, isSignedIn } = useUser(); // Get Clerk user info

//   const [selectedConsumer, setSelectedConsumer] = useState(null);
//   const [sessionId, setSessionId] = useState(null);
//   const [consumers, setConsumers] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [adminUnlocked, setAdminUnlocked] = useState(false);
//   const [showLoginModal, setShowLoginModal] = useState(false);

//   // Redirect to landing if not signed in (except on landing page)
//   useEffect(() => {
//     if (isLoaded && !isSignedIn && location.pathname !== '/') {
//       navigate('/');
//     }
//   }, [isLoaded, isSignedIn, location.pathname, navigate]);

//   // Only load consumers when signed in and not on landing page
//   useEffect(() => {
//     if (isLoaded && isSignedIn && location.pathname !== '/') {
//       loadConsumers();
//     }
//   }, [isLoaded, isSignedIn, location.pathname]);

//   // Check if admin was previously unlocked
//   useEffect(() => {
//     const wasUnlocked = localStorage.getItem('adminUnlocked') === 'true';
//     setAdminUnlocked(wasUnlocked);
//   }, []);

//   // Handle browser back button when on admin page
//   useEffect(() => {
//     const handlePopState = () => {
//       if (location.pathname !== '/admin') {
//         setShowLoginModal(false);
//       }
//     };

//     window.addEventListener('popstate', handlePopState);
//     return () => window.removeEventListener('popstate', handlePopState);
//   }, [location]);

//   const loadConsumers = async () => {
//     setLoading(true);
//     try {
//       const response = await axios.get(`${API_BASE_URL}/consumers`);
//       setConsumers(response.data);

//       // Auto-match or create consumer based on Clerk email
//       if (user?.primaryEmailAddress?.emailAddress) {
//         let matchedConsumer = response.data.find(
//           c => c.email === user.primaryEmailAddress.emailAddress
//         );

//         // If no consumer exists with this email, create one
//         if (!matchedConsumer) {
//           console.log('Creating new consumer for Clerk user:', user.primaryEmailAddress.emailAddress);
//           matchedConsumer = await createConsumerFromClerkUser();
          
//           // Reload consumers to get the new one
//           if (matchedConsumer) {
//             const updatedResponse = await axios.get(`${API_BASE_URL}/consumers`);
//             setConsumers(updatedResponse.data);
//           }
//         }

//         // Auto-select the matched consumer
//         if (matchedConsumer) {
//           setSelectedConsumer(matchedConsumer);
//           console.log('Auto-selected consumer:', matchedConsumer);
//         }
//       }

//       setLoading(false);
//     } catch (error) {
//       console.error('Error loading consumers:', error);
//       setLoading(false);
//     }
//   };

//   const createConsumerFromClerkUser = async () => {
//     if (!user?.primaryEmailAddress?.emailAddress) return null;

//     try {
//       const response = await axios.post(`${API_BASE_URL}/consumers`, {
//         name: user.fullName || user.firstName || 'User',
//         email: user.primaryEmailAddress.emailAddress,
//         phone: user.primaryPhoneNumber?.phoneNumber || null
//       });
//       console.log('Created new consumer:', response.data);
//       return response.data;
//     } catch (error) {
//       console.error('Error creating consumer:', error);
//       return null;
//     }
//   };

//   const handleConsumerSelect = async (consumer) => {
//     setSelectedConsumer(consumer);

//     try {
//       const response = await axios.post(`${API_BASE_URL}/conversation/start`, {
//         consumerId: consumer.id
//       });
//       setSessionId(response.data.sessionId);
//       navigate('/chat');
//     } catch (error) {
//       console.error('Error starting session:', error);
//     }
//   };

//   const handleLogout = () => {
//     setSelectedConsumer(null);
//     setSessionId(null);
//     navigate('/app');
//   };

//   const handleAdminClick = () => {
//     if (!adminUnlocked) {
//       setShowLoginModal(true);
//     } else {
//       navigate('/admin');
//     }
//   };

//   const handlePasswordSubmit = (password) => {
//     localStorage.setItem('adminPassword', password);
//     localStorage.setItem('adminUnlocked', 'true');
//     setAdminUnlocked(true);
//     setShowLoginModal(false);
//     navigate('/admin');
//   };

//   const handleModalClose = () => {
//     setShowLoginModal(false);
//   };

//   const handleLockAdmin = () => {
//     localStorage.removeItem('adminPassword');
//     localStorage.removeItem('adminUnlocked');
//     setAdminUnlocked(false);
//     navigate('/app');
//   };

//   // Show landing page at root
//   if (location.pathname === '/') {
//     return <GetStarted />;
//   }

//   // Show loading while Clerk is initializing
//   if (!isLoaded || loading) {
//     return (
//       <div className="loading-container">
//         <div className="loading-spinner"></div>
//         <p>Loading Mediflow AI System...</p>
//       </div>
//     );
//   }

//   const currentPath = location.pathname;

//   return (
//     <div className="app">
//       {/* Admin Login Modal */}
//       {showLoginModal && (
//         <AdminLoginModal
//           onSubmit={handlePasswordSubmit}
//           onClose={handleModalClose}
//         />
//       )}

//       <header className="app-header">
//         <div className="header-content">
//           <div className="header-left">
//             <h1 className="app-title">
//               <span className="icon"><img src="/qw.png" alt="Mediflow AI" /></span>
//               Mediflow AI
//             </h1>
//             <p className="app-subtitle">
//               Autonomous Intelligent Pharmacy System
//             </p>
//           </div>

//           <nav className="header-nav">
//             {/* User info with Clerk UserButton */}
//             {isSignedIn && (
//               <div className="user-info-nav">
//                 <span className="user-email">{user?.primaryEmailAddress?.emailAddress}</span>
//                 <UserButton afterSignOutUrl="/" />
//               </div>
//             )}

//             {/* Sign Out Button */}
//             <button 
//               className="nav-btn sign-out-btn" 
//               onClick={() => signOut({ redirectUrl: "/" })}
//             >
//               Sign Out
//             </button>

//             {/* Chat Button */}
//             <button
//               className={`nav-btn ${currentPath === '/app' || currentPath === '/chat' ? 'active' : ''}`}
//               onClick={() => navigate('/app')}
//             >
//               Chat
//             </button>

//             {/* Admin Button */}
//             <button
//               className={`nav-btn ${currentPath === '/admin' ? 'active' : ''}`}
//               onClick={handleAdminClick}
//             >
//               Admin {adminUnlocked ? '🔓' : '🔒'}
//             </button>

//             {/* Lock Admin Button */}
//             {adminUnlocked && currentPath === '/admin' && (
//               <button
//                 className="nav-btn lock-btn"
//                 onClick={handleLockAdmin}
//                 title="Lock Admin Panel"
//               >
//                 🔒 Lock
//               </button>
//             )}
//           </nav>

//           {selectedConsumer && (currentPath === '/app' || currentPath === '/chat') && (
//             <div className="user-info">
//               <span className="user-name">{selectedConsumer.name}</span>
//               <button className="logout-btn" onClick={handleLogout}>
//                 Change Consumer
//               </button>
//             </div>
//           )}
//         </div>
//       </header>

//       <main className="app-main">
//         <Routes>
//           <Route
//             path="/app"
//             element={
//               <ConsumerSelector
//                 consumers={consumers}
//                 onSelect={handleConsumerSelect}
//                 clerkUser={user}
//                 selectedConsumer={selectedConsumer}
//               />
//             }
//           />

//           <Route
//             path="/chat"
//             element={
//               selectedConsumer && sessionId ? (
//                 <ChatInterface
//                   consumer={selectedConsumer}
//                   sessionId={sessionId}
//                   apiBaseUrl={API_BASE_URL}
//                   clerkUser={user}
//                 />
//               ) : (
//                 <ConsumerSelector
//                   consumers={consumers}
//                   onSelect={handleConsumerSelect}
//                   clerkUser={user}
//                   selectedConsumer={selectedConsumer}
//                 />
//               )
//             }
//           />

//           <Route
//             path="/admin"
//             element={<AdminDashboard apiBaseUrl={API_BASE_URL} />}
//           />
//         </Routes>
//       </main>

//       <footer className="app-footer">
//         <p>
//           Agentic AI Pharmacy System • Multi-Agent Architecture • Production Ready
//         </p>
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
import AdminLoginModal from './components/AdminLoginModal';
import GetStarted from './components/GetStarted';
import PaymentPage from './components/PaymentPage';
import PaymentSuccess from './components/PaymentSuccess';
import PaymentCancelled from './components/PaymentCancelled';
import { useClerk, UserButton, useUser } from '@clerk/clerk-react';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://mediflow-ai-three.vercel.app';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useClerk();
  const { user, isLoaded, isSignedIn } = useUser(); // Get Clerk user info

  const [selectedConsumer, setSelectedConsumer] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect to landing if not signed in (except on landing page)
  useEffect(() => {
    if (isLoaded && !isSignedIn && location.pathname !== '/') {
      navigate('/');
    }
  }, [isLoaded, isSignedIn, location.pathname, navigate]);

  // Only load consumers when signed in and not on landing page
  useEffect(() => {
    if (isLoaded && isSignedIn && location.pathname !== '/') {
      loadConsumers();
    }
  }, [isLoaded, isSignedIn, location.pathname]);

  // Check if admin was previously unlocked
  useEffect(() => {
    const wasUnlocked = localStorage.getItem('adminUnlocked') === 'true';
    setAdminUnlocked(wasUnlocked);
  }, []);

  // Handle browser back button when on admin page
  useEffect(() => {
    const handlePopState = () => {
      if (location.pathname !== '/admin') {
        setShowLoginModal(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location]);

  const loadConsumers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/consumers`);
      setConsumers(response.data);

      // Auto-match or create consumer based on Clerk email
      if (user?.primaryEmailAddress?.emailAddress) {
        let matchedConsumer = response.data.find(
          c => c.email === user.primaryEmailAddress.emailAddress
        );

        // If no consumer exists with this email, create one
        if (!matchedConsumer) {
          console.log('Creating new consumer for Clerk user:', user.primaryEmailAddress.emailAddress);
          matchedConsumer = await createConsumerFromClerkUser();
          
          // Reload consumers to get the new one
          if (matchedConsumer) {
            const updatedResponse = await axios.get(`${import.meta.env.VITE_API_URL}/consumers`);
            setConsumers(updatedResponse.data);
          }
        }

        // Auto-select the matched consumer
        if (matchedConsumer) {
          setSelectedConsumer(matchedConsumer);
          console.log('Auto-selected consumer:', matchedConsumer);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading consumers:', error);
      setLoading(false);
    }
  };

  const createConsumerFromClerkUser = async () => {
    if (!user?.primaryEmailAddress?.emailAddress) return null;

    try {
      const response = await axios.post(`${API_BASE_URL}/consumers`, {
        name: user.fullName || user.firstName || 'User',
        email: user.primaryEmailAddress.emailAddress,
        phone: user.primaryPhoneNumber?.phoneNumber || null
      });
      console.log('Created new consumer:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating consumer:', error);
      return null;
    }
  };

  const handleConsumerSelect = async (consumer) => {
    setSelectedConsumer(consumer);

    try {
      const response = await axios.post(`${API_BASE_URL}/conversation/start`, {
        consumerId: consumer.id
      });
      setSessionId(response.data.sessionId);
      navigate('/chat');
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const handleLogout = () => {
    setSelectedConsumer(null);
    setSessionId(null);
    navigate('/app');
  };

  const handleAdminClick = () => {
    if (!adminUnlocked) {
      setShowLoginModal(true);
    } else {
      navigate('/admin');
    }
  };

  const handlePasswordSubmit = (password) => {
    localStorage.setItem('adminPassword', password);
    localStorage.setItem('adminUnlocked', 'true');
    setAdminUnlocked(true);
    setShowLoginModal(false);
    navigate('/admin');
  };

  const handleModalClose = () => {
    setShowLoginModal(false);
  };

  const handleLockAdmin = () => {
    localStorage.removeItem('adminPassword');
    localStorage.removeItem('adminUnlocked');
    setAdminUnlocked(false);
    navigate('/app');
  };

  // Show landing page at root
  if (location.pathname === '/') {
    return <GetStarted />;
  }

  // Show loading while Clerk is initializing
  if (!isLoaded || loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading Mediflow AI System...</p>
      </div>
    );
  }

  const currentPath = location.pathname;

  // Check if we're on a payment-related page
  const isPaymentPage = currentPath.startsWith('/payment');

  return (
    <div className="app">
      {/* Admin Login Modal */}
      {showLoginModal && (
        <AdminLoginModal
          onSubmit={handlePasswordSubmit}
          onClose={handleModalClose}
        />
      )}

      {/* Header - Hide on payment pages for cleaner look */}
      {!isPaymentPage && (
        <header className="app-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="app-title">
                <span className="icon"><img src="/jg.png" alt="Mediflow AI" /></span>
                Mediflow AI
              </h1>
              <p className="app-subtitle">
                Autonomous Intelligent Pharmacy System
              </p>
            </div>

            {/* Menu Button */}
<button 
  className="menu-toggle"
  onClick={() => setSidebarOpen(true)}
>
  ☰
</button>

            {selectedConsumer && (currentPath === '/app' || currentPath === '/chat') && (
              <div className="user-info">
                <span className="user-name">{selectedConsumer.name}</span>
                
              </div>
            )}
          </div>
        </header>
      )}
{/* Sidebar Overlay */}
<div 
  className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} 
  onClick={() => setSidebarOpen(false)}
></div>

{/* Sidebar */}
<div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
  <div className="sidebar-header">
    <h3>Menu</h3>
    <button onClick={() => setSidebarOpen(false)}>✕</button>
  </div>

  {isSignedIn && (
    <div className="sidebar-user">
      <p>{user?.primaryEmailAddress?.emailAddress}</p>
      <UserButton afterSignOutUrl="/" />
    </div>
  )}

  <button
    className="sidebar-btn"
    onClick={() => {
      navigate('/app');
      setSidebarOpen(false);
    }}
  >
    💬 Chat
  </button>

  <button
    className="sidebar-btn"
    onClick={() => {
      handleAdminClick();
      setSidebarOpen(false);
    }}
  >
    🛠 Admin {adminUnlocked ? '🔓' : '🔒'}
  </button>

  {adminUnlocked && location.pathname === '/admin' && (
    <button
      className="sidebar-btn"
      onClick={() => {
        handleLockAdmin();
        setSidebarOpen(false);
      }}
    >
      🔒 Lock Admin
    </button>
  )}

  

  <button
    className="sidebar-btn signout"
    onClick={() => signOut({ redirectUrl: "/" })}
  >
    🚪 Sign Out
  </button>
</div>
      <main className={`app-main ${isPaymentPage ? 'payment-page-main' : ''}`}>
        <Routes>
          <Route
            path="/app"
            element={
              <ConsumerSelector
                consumers={consumers}
                onSelect={handleConsumerSelect}
                clerkUser={user}
                selectedConsumer={selectedConsumer}
              />
            }
          />

          <Route
            path="/chat"
            element={
              selectedConsumer && sessionId ? (
                <ChatInterface
                  consumer={selectedConsumer}
                  sessionId={sessionId}
                  apiBaseUrl={API_BASE_URL}
                  clerkUser={user}
                />
              ) : (
                <ConsumerSelector
                  consumers={consumers}
                  onSelect={handleConsumerSelect}
                  clerkUser={user}
                  selectedConsumer={selectedConsumer}
                />
              )
            }
          />

          <Route
            path="/admin"
            element={<AdminDashboard apiBaseUrl={API_BASE_URL} />}
          />

          {/* NEW: Payment Routes */}
          <Route
            path="/payment/:orderId"
            element={<PaymentPage />}
          />

          <Route
            path="/payment/success/:orderId"
            element={<PaymentSuccess />}
          />

          <Route
            path="/payment/cancelled"
            element={<PaymentCancelled />}
          />
        </Routes>
      </main>

      {/* Footer - Hide on payment pages */}
      {!isPaymentPage && (
        <footer className="app-footer">
          <p>
            Agentic AI Pharmacy System • Multi-Agent Architecture • Production Ready
          </p>
        </footer>
      )}
    </div>
  );
}

export default App;

















