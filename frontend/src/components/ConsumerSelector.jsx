// import React, { useState, useEffect } from 'react';
// import './ConsumerSelector.css';

// function ConsumerSelector({ consumers, onSelect }) {
//   const [visible, setVisible] = useState(false);

//   useEffect(() => {
//     // Entrance animation
//     const timer = setTimeout(() => setVisible(true), 100);
//     return () => clearTimeout(timer);
//   }, []);

//   return (
//     <div className="consumer-selector">
//       {/* Animated background grid */}
//       <div className="grid-bg" />
      
//       {/* Glowing orbs */}
//       <div className="orb orb-1" />
//       <div className="orb orb-2" />

//       <div 
//         className="selector-content"
//         style={{
//           opacity: visible ? 1 : 0,
//           transform: visible ? 'translateY(0)' : 'translateY(30px)',
//           transition: 'opacity 0.8s ease, transform 0.8s ease'
//         }}
//       >
//         {/* Badge */}
//         <div className="selector-badge">
//           <span className="badge-dot" />
//           Choose Your Profile
//         </div>

//         {/* Title */}
//         <h2 className="selector-title">
//           Welcome to <span className="title-accent">MediFlow AI</span>
//         </h2>
        
//         <p className="selector-subtitle">
//           Select a consumer profile to experience our intelligent pharmacy assistant
//         </p>
        
//         {/* Consumers Grid */}
//         <div className="consumers-grid">
//           {consumers.map((consumer, index) => (
//             <button
//               key={consumer.id}
//               className="consumer-card"
//               onClick={() => onSelect(consumer)}
//               style={{
//                 opacity: visible ? 1 : 0,
//                 transform: visible ? 'translateY(0)' : 'translateY(40px)',
//                 transition: `opacity 0.7s ease ${index * 0.1}s, transform 0.7s ease ${index * 0.1}s`
//               }}
//             >
//               <div className="consumer-avatar">
//                 {consumer.name.charAt(0).toUpperCase()}
//               </div>
//               <div className="consumer-info">
//                 <h3>{consumer.name}</h3>
//                 <p className="consumer-email">{consumer.email}</p>
//                 {consumer.phone && <p className="consumer-phone">{consumer.phone}</p>}
//               </div>
//               <div className="consumer-arrow">→</div>
//             </button>
//           ))}
//         </div>

//         {/* Demo Note */}
//         <div 
//           className="demo-note"
//           style={{
//             opacity: visible ? 1 : 0,
//             transition: `opacity 0.8s ease ${consumers.length * 0.1 + 0.2}s`
//           }}
//         >
//           <div className="demo-icon">💡</div>
//           <div className="demo-text">
//             <strong>Demo Mode Active</strong>
//             <p>Each profile has unique order history and medication needs. Experience personalized AI assistance.</p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default ConsumerSelector;











import React, { useState, useEffect } from 'react';
import './ConsumerSelector.css';

function ConsumerSelector({ consumers, onSelect, clerkUser, selectedConsumer }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Entrance animation
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Auto-select consumer when component loads and consumer is found
  useEffect(() => {
    if (selectedConsumer && onSelect) {
      // Small delay for better UX
      const timer = setTimeout(() => {
        onSelect(selectedConsumer);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedConsumer]);

  // Find the consumer that matches the Clerk user's email
  const userConsumer = selectedConsumer || consumers.find(
    c => c.email === clerkUser?.primaryEmailAddress?.emailAddress
  );

  // If no consumer found, show loading or error
  if (!userConsumer) {
    return (
      <div className="consumer-selector">
        <div className="grid-bg" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        
        <div className="selector-content" style={{ opacity: visible ? 1 : 0 }}>
          <div className="selector-badge">
            <span className="badge-dot" />
            Setting Up Your Profile
          </div>
          
          <h2 className="selector-title">
            Welcome to <span className="title-accent">MediFlow AI</span>
          </h2>
          
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Creating your pharmacy profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="consumer-selector">
      {/* Animated background grid */}
      <div className="grid-bg" />
      
      {/* Glowing orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <div 
        className="selector-content"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease'
        }}
      >
        {/* Badge */}
        <div className="selector-badge">
          <span className="badge-dot" />
          Your Profile
        </div>

        {/* Title */}
        <h2 className="selector-title">
          Welcome, <span className="title-accent">{userConsumer.name}</span>
        </h2>
        
        <p className="selector-subtitle">
          Your intelligent pharmacy assistant is ready to help you manage your medications
        </p>
        
        {/* Single User Profile Card */}
        <div className="user-profile-container">
          <div 
            className="user-profile-card"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.95)',
              transition: 'opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s'
            }}
          >
            <div className="profile-header">
              <div className="profile-avatar">
                {userConsumer.name.charAt(0).toUpperCase()}
              </div>
              <div className="profile-status">
                <span className="status-dot"></span>
                Active
              </div>
            </div>

            <div className="profile-info">
              <h3 className="profile-name">{userConsumer.name}</h3>
              <div className="profile-details">
                <div className="detail-item">
                  <span className="detail-icon">📧</span>
                  <span className="detail-text">{userConsumer.email}</span>
                </div>
                {userConsumer.phone && (
                  <div className="detail-item">
                    <span className="detail-icon">📱</span>
                    <span className="detail-text">{userConsumer.phone}</span>
                  </div>
                )}
              </div>
            </div>

            <button 
              className="start-chat-btn"
              onClick={() => onSelect(userConsumer)}
            >
              Start Conversation
              <span className="btn-arrow">→</span>
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div 
          className="features-grid"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s ease 0.6s'
          }}
        >
          <div className="feature-item">
            <span className="feature-icon">💊</span>
            <div className="feature-content">
              <h4>Medication Management</h4>
              <p>Track prescriptions and refills</p>
            </div>
          </div>
          
          <div className="feature-item">
            <span className="feature-icon">🔔</span>
            <div className="feature-content">
              <h4>Smart Reminders</h4>
              <p>Never miss a dose</p>
            </div>
          </div>
          
          <div className="feature-item">
            <span className="feature-icon">🤖</span>
            <div className="feature-content">
              <h4>AI Assistant</h4>
              <p>24/7 pharmacy support</p>
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div 
          className="info-note"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s ease 0.8s'
          }}
        >
          <div className="info-icon">🔒</div>
          <div className="info-text">
            <strong>Your data is secure</strong>
            <p>HIPAA compliant • End-to-end encrypted • Privacy protected</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConsumerSelector;