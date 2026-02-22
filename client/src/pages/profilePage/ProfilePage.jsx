import React, { useState, useEffect } from 'react';
import { fetchUserProfile, deleteAccount, updateUserCredits } from '../../api/api';
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
  const [addingCredits, setAddingCredits] = useState(false);
  const { showNotification } = useNotification();
  const { logout } = useAuth();

  useEffect(() => {
    console.log('[PROFILE PAGE] ========== COMPONENT MOUNTED ==========');
    console.log('[PROFILE PAGE] useEffect triggered - loading profile on mount');
    loadProfile();
  }, []);

  const loadProfile = async () => {
    console.log('[PROFILE PAGE] ========== LOAD PROFILE CALLED ==========');
    console.log('[PROFILE PAGE] Step 1: Setting loading state to true');
    setLoading(true);
    setError(null);
    
    try {
      console.log('[PROFILE PAGE] Step 2: Calling fetchUserProfile API...');
      const response = await fetchUserProfile();
      console.log('[PROFILE PAGE] Step 3: API response received:', {
        status: response?.status,
        hasUser: !!response?.user,
        username: response?.user?.username,
        fullName: response?.user?.full_name,
        preferredName: response?.user?.preferred_name,
        birthday: response?.user?.birthday,
        email: response?.user?.email,
        credits: response?.user?.credits
      });
      
      if (response.status === 'success') {
        console.log('[PROFILE PAGE] Step 4: Profile fetch successful, setting profile state');
        console.log('[PROFILE PAGE] User data:', {
          username: response.user?.username,
          full_name: response.user?.full_name,
          preferred_name: response.user?.preferred_name,
          birthday: response.user?.birthday,
          email: response.user?.email,
          credits: response.user?.credits,
          created_at: response.user?.created_at,
          last_login: response.user?.last_login
        });
        setProfile(response.user);
        console.log('[PROFILE PAGE] ========== LOAD PROFILE SUCCESS ==========');
      } else {
        console.warn('[PROFILE PAGE] Profile fetch returned non-success status:', response.status);
        console.warn('[PROFILE PAGE] Error message:', response.message);
        const errorMessage = response.message || 'Failed to load profile';
        console.warn('[PROFILE PAGE] Setting error:', errorMessage);
        setError(errorMessage);
        console.log('[PROFILE PAGE] ========== LOAD PROFILE FAILED ==========');
      }
    } catch (err) {
      console.error('[PROFILE PAGE] ========== LOAD PROFILE ERROR ==========');
      console.error('[PROFILE PAGE] Error type:', err.constructor.name);
      console.error('[PROFILE PAGE] Error message:', err.message);
      console.error('[PROFILE PAGE] Error details:', {
        message: err.message,
        responseStatus: err.response?.status,
        responseStatusText: err.response?.statusText,
        responseData: err.response?.data,
        hasResponse: !!err.response,
        stack: err.stack?.split('\n').slice(0, 5).join('\n')
      });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load profile';
      if (err.response?.status === 401 || err.response?.status === 403) {
        errorMessage = 'Authentication required. Please log in again.';
        console.error('[PROFILE PAGE] Authentication error - user may need to re-login');
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
        console.error('[PROFILE PAGE] Server error occurred');
      } else if (err.message?.includes('Network Error') || err.message?.includes('CORS')) {
        errorMessage = 'Network error. Please check your connection and try again.';
        console.error('[PROFILE PAGE] Network/CORS error - check server connection');
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      console.error('[PROFILE PAGE] Setting error message:', errorMessage);
      setError(errorMessage);
      console.error('[PROFILE PAGE] ========== LOAD PROFILE ERROR HANDLED ==========');
    } finally {
      console.log('[PROFILE PAGE] Step 5: Setting loading state to false');
      setLoading(false);
    }
  };

  const handleAddCredits = async () => {
    console.log('[PROFILE PAGE] ========== ADD CREDITS CALLED ==========');
    setAddingCredits(true);
    
    try {
      console.log('[PROFILE PAGE] Step 1: Calling updateUserCredits API...');
      const response = await updateUserCredits({
        username: profile.username,
        credits: 3,
        operation: 'add'
      });
      
      console.log('[PROFILE PAGE] Step 2: Add credits response:', {
        status: response?.status,
        old_credits: response?.old_credits,
        new_credits: response?.new_credits
      });
      
      if (response.status === 'success') {
        console.log('[PROFILE PAGE] Step 3: Credits added successfully');
        showNotification(`Added 3 credits! New balance: ${response.new_credits}`, 'success');
        
        // Reload profile to get updated credits
        await loadProfile();
        console.log('[PROFILE PAGE] ========== ADD CREDITS COMPLETE ==========');
      } else {
        console.warn('[PROFILE PAGE] Add credits returned non-success status:', response.status);
        showNotification(response.message || 'Failed to add credits', 'error');
      }
    } catch (err) {
      console.error('[PROFILE PAGE] ========== ADD CREDITS ERROR ==========');
      console.error('[PROFILE PAGE] Error type:', err.constructor.name);
      console.error('[PROFILE PAGE] Error message:', err.message);
      console.error('[PROFILE PAGE] Error details:', {
        message: err.message,
        responseStatus: err.response?.status,
        responseData: err.response?.data
      });
      showNotification(err.message || 'Failed to add credits', 'error');
    } finally {
      setAddingCredits(false);
    }
  };

  const handleDeleteAccount = async () => {
    console.log('[PROFILE PAGE] ========== DELETE ACCOUNT CALLED ==========');
    console.log('[PROFILE PAGE] Step 1: Setting deleting state to true');
    setDeleting(true);
    
    try {
      console.log('[PROFILE PAGE] Step 2: Calling deleteAccount API...');
      const response = await deleteAccount();
      console.log('[PROFILE PAGE] Step 3: Delete account response:', {
        status: response?.status,
        message: response?.message
      });
      
      if (response.status === 'success') {
        console.log('[PROFILE PAGE] Step 4: Account deletion successful');
        showNotification('Account deleted successfully', 'success');
        
        // Logout user and redirect to login
        console.log('[PROFILE PAGE] Step 5: Logging out user...');
        try {
          await logoutUser();
          console.log('[PROFILE PAGE] Logout successful');
        } catch (err) {
          // Even if logout fails, we should still clear local state
          console.error('[PROFILE PAGE] Logout error (non-critical):', err);
        }
        
        console.log('[PROFILE PAGE] Step 6: Clearing auth state');
        logout();
        console.log('[PROFILE PAGE] ========== DELETE ACCOUNT COMPLETE ==========');
        // Redirect will happen automatically via AuthContext
      } else {
        console.warn('[PROFILE PAGE] Delete account returned non-success status:', response.status);
        console.warn('[PROFILE PAGE] Error message:', response.message);
        showNotification(response.message || 'Failed to delete account', 'error');
        setDeleting(false);
        setShowDeleteConfirm(false);
        console.log('[PROFILE PAGE] ========== DELETE ACCOUNT FAILED ==========');
      }
    } catch (err) {
      console.error('[PROFILE PAGE] ========== DELETE ACCOUNT ERROR ==========');
      console.error('[PROFILE PAGE] Error type:', err.constructor.name);
      console.error('[PROFILE PAGE] Error message:', err.message);
      console.error('[PROFILE PAGE] Error details:', {
        message: err.message,
        responseStatus: err.response?.status,
        responseData: err.response?.data
      });
      showNotification(err.message || 'Failed to delete account', 'error');
      setDeleting(false);
      setShowDeleteConfirm(false);
      console.error('[PROFILE PAGE] ========== DELETE ACCOUNT ERROR HANDLED ==========');
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
            <label htmlFor="profile-full-name">Full Name</label>
            <input 
              id="profile-full-name"
              type="text" 
              value={profile.full_name || profile.username || 'Not set'}
              readOnly
              className="form-input"
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="profile-preferred-name">What should we call you?</label>
            <input 
              id="profile-preferred-name"
              type="text" 
              value={profile.preferred_name || profile.full_name || profile.username || 'Not set'}
              readOnly
              className="form-input"
            />
          </div>

          {profile.email && (
            <div className="form-field">
              <label htmlFor="profile-email">Email</label>
              <input 
                id="profile-email"
                type="email" 
                value={profile.email}
                readOnly
                className="form-input"
              />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="profile-credits">Credits</label>
            <div className="credits-field-container">
              <input 
                id="profile-credits"
                type="text" 
                value={`${profile.credits} credits available`}
                readOnly
                className="form-input"
              />
              <button
                className="add-credits-button"
                onClick={handleAddCredits}
                disabled={addingCredits}
              >
                {addingCredits ? 'Adding...' : '+ Add 3 Credits'}
              </button>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="profile-member-since">Member Since</label>
            <input 
              id="profile-member-since"
              type="text" 
              value={profile.created_at 
                ? new Date(profile.created_at).toLocaleDateString()
                : 'Unknown'
              }
              readOnly
              className="form-input"
            />
          </div>

          {profile.birthday && (
            <div className="form-field">
              <label htmlFor="profile-birthday">Birthday</label>
              <input 
                id="profile-birthday"
                type="text" 
                value={new Date(profile.birthday).toLocaleDateString()}
                readOnly
                className="form-input"
              />
            </div>
          )}

          {profile.last_login && (
            <div className="form-field">
              <label htmlFor="profile-last-login">Last Login</label>
              <input 
                id="profile-last-login"
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

