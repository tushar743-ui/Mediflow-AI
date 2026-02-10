import React from 'react';
import './ConsumerSelector.css';

function ConsumerSelector({ consumers, onSelect }) {
  return (
    <div className="consumer-selector">
      <div className="selector-content">
        <h2>Select Your Profile</h2>
        <p className="selector-subtitle">Choose a consumer profile to start your pharmacy session</p>
        
        <div className="consumers-grid">
          {consumers.map((consumer) => (
            <button
              key={consumer.id}
              className="consumer-card"
              onClick={() => onSelect(consumer)}
            >
              <div className="consumer-avatar">
                {consumer.name.charAt(0).toUpperCase()}
              </div>
              <div className="consumer-info">
                <h3>{consumer.name}</h3>
                <p>{consumer.email}</p>
                {consumer.phone && <p className="phone">{consumer.phone}</p>}
              </div>
              <div className="consumer-arrow">→</div>
            </button>
          ))}
        </div>

        <div className="demo-note">
          <p>
            💡 <strong>Demo Mode:</strong> Select any consumer profile to experience the AI pharmacy assistant.
            Each profile has different order history and medication needs.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConsumerSelector;
