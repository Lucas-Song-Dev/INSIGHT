import React from "react";
import "./ConfirmModal.scss";

/**
 * Simple confirmation modal.
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {string} title - Modal title
 * @param {React.ReactNode} children - Body content
 * @param {string} confirmLabel - Primary button label
 * @param {string} cancelLabel - Cancel button label
 * @param {() => void} onConfirm - Called when user confirms
 * @param {() => void} onCancel - Called when user cancels or clicks overlay
 */
const ConfirmModal = ({
  isOpen,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-modal-title" className="confirm-modal-title">{title}</h3>
        <div className="confirm-modal-body">{children}</div>
        <div className="confirm-modal-actions">
          <button type="button" className="confirm-modal-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="confirm-modal-confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
