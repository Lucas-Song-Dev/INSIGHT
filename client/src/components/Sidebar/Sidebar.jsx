import { useState } from "react";
import { 
  Home, 
  Search, 
  FileText, 
  Info, 
  User, 
  Activity,
  ChevronLeft,
  ChevronRight,
  BookOpen
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./Sidebar.scss";

const Sidebar = ({ activePage, setActivePage, handleLogout, onCollapseChange }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  const handleCollapse = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    if (onCollapseChange) {
      onCollapseChange(newCollapsed);
    }
  };

  const buildItems = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "scrapepage", label: "Find Insights", icon: Search },
    { id: "results", label: "Results", icon: FileText },
    { id: "about", label: "About", icon: Info },
  ];

  const analyticsItems = [
    { id: "status", label: "Status", icon: Activity },
  ];

  const manageItems = [
    { id: "profile", label: "Profile", icon: User },
  ];

  const handleNavClick = (pageId) => {
    setActivePage(pageId);
  };

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-title">
          {!collapsed && <span className="title-text">INSIGHT</span>}
        </div>
        <button 
          className="collapse-button"
          onClick={handleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-label">BUILD</div>
          {buildItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? "active" : ""}`}
                onClick={() => handleNavClick(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="nav-icon" />
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="nav-section">
          <div className="nav-section-label">ANALYTICS</div>
          {analyticsItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? "active" : ""}`}
                onClick={() => handleNavClick(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="nav-icon" />
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="nav-section">
          <div className="nav-section-label">MANAGE</div>
          {manageItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? "active" : ""}`}
                onClick={() => handleNavClick(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="nav-icon" />
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        <a 
          href="https://docs.example.com" 
          className="footer-link"
          title={collapsed ? "Documentation" : undefined}
        >
          <BookOpen size={16} className="footer-icon" />
          {!collapsed && <span>Documentation</span>}
        </a>
        
        <div className="user-section">
          {!collapsed && (
            <>
              <div className="user-name">{user?.username || "User"}</div>
              <button 
                className="logout-button"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

