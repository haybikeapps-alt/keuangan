import React, { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  text: string;
}

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  onClose?: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose, duration = 2000 }) => {
  useEffect(() => {
    if (!onClose) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, type, onClose, duration]);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <div
        className={`px-4 py-2.5 rounded-lg text-white text-xs font-medium shadow-lg pointer-events-auto transition-all animate-fade-in flex items-center gap-2 ${
          type === 'error' ? 'bg-red-500' : 'bg-emerald-600'
        }`}
      >
        <i className={`fa-solid ${type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
        <span>{message}</span>
        {onClose && (
          <button onClick={onClose} className="ml-2 hover:opacity-80 cursor-pointer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2.5 rounded-lg text-white text-xs font-medium shadow-lg pointer-events-auto transition-all animate-bounce ${
            t.type === 'error' ? 'bg-red-500' : 'bg-emerald-600'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
};
