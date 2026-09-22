import "./FirstTimeGuideModal.css";

export default function FirstTimeGuideModal({ title, description, onClose, badge = "Primer paso" }) {
  return (
    <div className="first-time-guide-overlay" role="dialog" aria-modal="true">
      <div className="first-time-guide">
        <div className="first-time-guide__copy">
          <span className="first-time-guide__badge">{badge}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button type="button" className="first-time-guide__close" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  );
}
