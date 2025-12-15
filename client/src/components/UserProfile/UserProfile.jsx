import React, { useState, useEffect } from 'react';
import { fetchUserProfile } from '../../api/api';
import './UserProfile.scss';

const UserProfile = ({ isVisible, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isVisible) {
      loadProfile();
    }
  }, [isVisible]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchUserProfile();
      if (response.status === 'success') {
        setProfile(response.user);
      } else {
        setError(response.message || 'Failed to load profile');
      }
    } catch (err) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="user-profile-overlay" onClick={onClose}>
      <div className="user-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <h2>User Profile</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="profile-content">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading profile...</p>
            </div>
          )}
          
          {error && (
            <div className="error-state">
              <div className="error-icon">!</div>
              <p>{error}</p>
              <button onClick={loadProfile} className="retry-button">
                Try Again
              </button>
            </div>
          )}
          
          {profile && !loading && (
            <div className="profile-details">
              <div className="profile-section">
                <h3>Account Information</h3>
                <div className="profile-field">
                  <label>Username:</label>
                  <span>{profile.username}</span>
                </div>
                {profile.email && (
                  <div className="profile-field">
                    <label>Email:</label>
                    <span>{profile.email}</span>
                  </div>
                )}
                <div className="profile-field">
                  <label>Member Since:</label>
                  <span>
                    {profile.created_at 
                      ? new Date(profile.created_at).toLocaleDateString()
                      : 'Unknown'
                    }
                  </span>
                </div>
                {profile.last_login && (
                  <div className="profile-field">
                    <label>Last Login:</label>
                    <span>
                      {new Date(profile.last_login).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="profile-section credits-section">
                <h3>Credits</h3>
                <div className="credits-display">
                  <div className="credits-amount">
                    <span className="credits-number">{profile.credits}</span>
                    <span className="credits-label">Credits Available</span>
                  </div>
                  <div className="credits-info">
                    <p>Credits are used to run insight analyses. Different operations cost different amounts based on scope and complexity.</p>
                    <div className="cost-breakdown">
                      <h4>Cost Examples:</h4>
                      <ul>
                        <li>Small analysis (≤50 discussions, week): 2 credits</li>
                        <li>Medium analysis (≤100 discussions, month): 6 credits</li>
                        <li>Large analysis (≤200 discussions, year): 12 credits</li>
                        <li>Comprehensive analysis (200+ discussions, all time): 20 credits</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;