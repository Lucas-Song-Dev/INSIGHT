import React, { useState, useEffect } from 'react';
import { fetchUserProfile, deleteAccount } from '../../api/api';
import { logoutUser } from '../../api/api';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import './ProfilePage.scss';

const ProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { showNotification } = useNotification();
  const { logout } = useAuth();

  useEffect(() => {
    loadProfile();
  }, []);

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

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const response = await deleteAccount();
      if (response.status === 'success') {
        showNotification('Account deleted successfully', 'success');
        // Logout user and redirect to login
        try {
          await logoutUser();
        } catch (err) {
          // Even if logout fails, we should still clear local state
          console.error('Logout error:', err);
        }
        logout();
        // Redirect will happen automatically via AuthContext
      } else {
        showNotification(response.message || 'Failed to delete account', 'error');
        setDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      showNotification(err.message || 'Failed to delete account', 'error');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadProfile} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Profile</h1>
      </div>
      
      {profile && (
        <div className="profile-form">
          <div className="form-field">
            <label>Full Name</label>
            <input 
              type="text" 
              value={profile.username}
              readOnly
              className="form-input"
            />
          </div>
          
          <div className="form-field">
            <label>What should we call you?</label>
            <input 
              type="text" 
              value={profile.username}
              readOnly
              className="form-input"
            />
          </div>

          {profile.email && (
            <div className="form-field">
              <label>Email</label>
              <input 
                type="email" 
                value={profile.email}
                readOnly
                className="form-input"
              />
            </div>
          )}

          <div className="form-field">
            <label>Credits</label>
            <input 
              type="text" 
              value={`${profile.credits} credits available`}
              readOnly
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label>Member Since</label>
            <input 
              type="text" 
              value={profile.created_at 
                ? new Date(profile.created_at).toLocaleDateString()
                : 'Unknown'
              }
              readOnly
              className="form-input"
            />
          </div>

          {profile.last_login && (
            <div className="form-field">
              <label>Last Login</label>
              <input 
                type="text" 
                value={new Date(profile.last_login).toLocaleString()}
                readOnly
                className="form-input"
              />
            </div>
          )}

          <div className="danger-zone">
            <h2>Danger Zone</h2>
            <p>Once you delete your account, there is no going back. Please be certain.</p>
            <button
              className="delete-account-button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-dialog">
            <h2>Delete Account</h2>
            <p>Are you sure you want to delete your account? This action cannot be undone.</p>
            <p>All your data, including posts, analysis, and credits will be permanently deleted.</p>
            <div className="delete-confirm-actions">
              <button
                className="cancel-button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-button"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

