import React from "react";
import "./SummarySection.scss";

/**
 * Shared summary block used for both Analysis Summary and Recommendations Summary.
 * Renders a titled section with a paragraph of summary text.
 */
const SummarySection = ({ title, summary }) => {
  return (
    <div className="summary-section">
      <h4>{title}</h4>
      <p>{summary || "No summary available"}</p>
    </div>
  );
};

export default SummarySection;
