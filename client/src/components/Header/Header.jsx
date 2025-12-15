import { useState, useEffect } from "react";
import { fetchUserProfile } from "../../api/api";
import { Coins, User, LogOut } from "lucide-react";
import "./Header.scss";

const Header = ({ activePage, setActivePage, handleLogout }) => {
  const [userCredits, setUserCredits] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

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
    const interval = setInterval(loadUserCredits, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: "home", label: "Home" },
    { id: "scrapepage", label: "Find Insights" },
    { id: "results", label: "Results" },
    { id: "about", label: "About" },
  ];

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="header-left">
          <div className="logo">
            <span className="logo-text">INSIGHT</span>
          </div>
          <nav className="header-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? "active" : ""}`}
                onClick={() => {
                  setActivePage(item.id);
                  setShowProfileDropdown(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="header-right">
          <div className="profile-section">
            {userCredits !== null && (
              <span className="credits-display">
                <Coins size={18} className="credits-icon" />
                {userCredits} credits
              </span>
            )}
            <div className="profile-dropdown">
              <button
                className="profile-button"
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              >
                <User size={18} className="profile-icon" />
                Profile
              </button>
              {showProfileDropdown && (
                <div className="dropdown-menu">
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setActivePage("profile");
                      setShowProfileDropdown(false);
                    }}
                  >
                    <User size={16} className="dropdown-icon" />
                    View Profile
                  </button>
                  <button
                    className="dropdown-item logout-item"
                    onClick={() => {
                      handleLogout();
                      setShowProfileDropdown(false);
                    }}
                  >
                    <LogOut size={16} className="dropdown-icon" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

