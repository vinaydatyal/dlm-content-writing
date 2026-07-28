import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: <CheckCircle style={{ color: '#10B981' }} size={20} />,
  error: <XCircle style={{ color: '#EF4444' }} size={20} />,
  warning: <AlertTriangle style={{ color: '#F59E0B' }} size={20} />,
  info: <Info style={{ color: '#60A5FA' }} size={20} />
};

export default function Toast({ onClose, message, type = 'info' }) {
  const [isHiding, setIsHiding] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHiding(true);
      setTimeout(onClose, 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsHiding(true);
    setTimeout(onClose, 300);
  };

  return (
    <div className={`toast ${isHiding ? 'hiding' : ''}`}>
      {ICONS[type]}
      <div style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500 }}>{message}</div>
      <button
        onClick={handleClose}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
