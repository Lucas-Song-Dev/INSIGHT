import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
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

const Sidebar = ({ handleLogout, onCollapseChange }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleCollapse = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    if (onCollapseChange) {
      onCollapseChange(newCollapsed);
    }
  };

  const buildItems = [
    { path: "/find-insights", label: "Find Insights", icon: Search },
    { path: "/results", label: "Results", icon: FileText },
    { path: "/about", label: "About", icon: Info },
  ];

  const analyticsItems = [
    { path: "/status", label: "Status", icon: Activity },
  ];

  const manageItems = [
    { path: "/profile", label: "Profile", icon: User },
  ];

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <button
          className="sidebar-title clickable"
          onClick={() => navigate("/insights")}
          title="Go to Insights Home"
        >
          {!collapsed && <span className="title-text">INSIGHT</span>}
        </button>
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
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? "active" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="nav-icon" />
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        <div className="nav-section">
          <div className="nav-section-label">ANALYTICS</div>
          {analyticsItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? "active" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="nav-icon" />
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        <div className="nav-section">
          <div className="nav-section-label">MANAGE</div>
          {manageItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? "active" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="nav-icon" />
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </Link>
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

