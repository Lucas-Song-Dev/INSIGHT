import StatusBar from "../../components/StatusBar/StatusBar";
import "./StatusPage.scss";

const StatusPage = () => {
  return (
    <div className="status-page">
      <div className="status-page-header">
        <h1>Status</h1>
        <p className="status-page-subtitle">
          Monitor scraping jobs and system status
        </p>
      </div>
      <div className="status-page-content">
        <StatusBar />
      </div>
    </div>
  );
};

export default StatusPage;

