// components/Navbar.jsx
import { useState, useEffect } from "react";
import { fetchUserProfile } from "../../api/api";
import UserProfile from "../UserProfile/UserProfile";
import "./navBar.scss";

const Navbar = ({ activePage, setActivePage, handleLogout }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userCredits, setUserCredits] = useState(null);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const loadUserCredits = async () => {
    try {
      const response = await fetchUserProfile();
      if (response.status === 'success') {
        setUserCredits(response.user.credits);
      }
    } catch (err) {
      console.error('Failed to load user credits:', err);
    }
  };

  useEffect(() => {
    loadUserCredits();
    // Refresh credits every 30 seconds
    const interval = setInterval(loadUserCredits, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="logo-container">
          <button className="collapse-toggle" onClick={toggleCollapse}>
            {isCollapsed ? (
              <svg
                className="icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <polyline
                  points="9 18 15 12 9 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                className="icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <polyline
                  points="15 18 9 12 15 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          {!isCollapsed && <span className="app-name">INSIGHT</span>}
        </div>
      </div>

      <nav className="nav-menu">
        <ul>
          <li
            className={activePage === "home" ? "active" : ""}
            onClick={() => setActivePage("home")}
            title="Home"
          >
            <span className="menu-icon">🏠</span>
            {!isCollapsed && <span className="menu-text">Home</span>}
          </li>
          <li
            className={activePage === "scrapepage" || activePage === "analysisPage" ? "active" : ""}
            onClick={() => setActivePage("scrapepage")}
            title="Find Insights"
          >
            <span className="menu-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
            </span>
            {!isCollapsed && <span className="menu-text">Find Insights</span>}
          </li>
          <li
            className={activePage === "results" || activePage === "productDetail" ? "active" : ""}
            onClick={() => setActivePage("results")}
            title="Results"
          >
            <span className="menu-icon">📋</span>
            {!isCollapsed && <span className="menu-text">Results</span>}
          </li>
          <li
            className={activePage === "about" ? "active" : ""}
            onClick={() => setActivePage("about")}
            title="About"
          >
            <span className="menu-icon">ℹ️</span>
            {!isCollapsed && <span className="menu-text">About</span>}
          </li>
          {/* User Profile and Credits */}
          <li 
            className="profile-item" 
            onClick={() => setShowProfile(true)} 
            title="User Profile"
          >
            <span className="menu-icon">👤</span>
            {!isCollapsed && (
              <div className="profile-info">
                <span className="menu-text">Profile</span>
                {userCredits !== null && (
                  <span className="credits-badge">{userCredits} credits</span>
                )}
              </div>
            )}
          </li>
          
          {/* Logout button at the bottom of sidebar */}
          <li className="logout-item" onClick={handleLogout} title="Logout">
            <span className="menu-icon">🚪</span>
            {!isCollapsed && <span className="menu-text">Logout</span>}
          </li>
        </ul>
      </nav>
      
      <UserProfile 
        isVisible={showProfile} 
        onClose={() => setShowProfile(false)} 
      />
    </div>
  );
};

export default Navbar;
