import React from "react";
import SummarySection from "@/components/SummarySection/SummarySection";
import "./DetailCard.scss";

/**
 * Shared card body for Analysis and Recommendations detail views.
 * Renders: header (product name or regenerate button), summary section, and content (children).
 */
const DetailCard = ({
  embedded = false,
  productName = null,
  onRegenerate = null,
  isRegenerating = false,
  summaryTitle,
  summary,
  children,
}) => {
  const showRegenerateInHeader = embedded && onRegenerate;
  const showProductInHeader = !embedded && productName;
  const showHeader = showRegenerateInHeader || showProductInHeader;

  return (
    <div className="detail-card">
      {showHeader && (
        <div
          className={`detail-card-header${
            showRegenerateInHeader && !showProductInHeader
              ? " detail-card-header--actions-only"
              : ""
          }`}
        >
          {showRegenerateInHeader && (
            <button
              type="button"
              className="regenerate-button"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? "Regenerating…" : "Regenerate"}
            </button>
          )}
          {showProductInHeader && <h3>{productName}</h3>}
        </div>
      )}

      <SummarySection title={summaryTitle} summary={summary} />

      {children}
    </div>
  );
};

export default DetailCard;
