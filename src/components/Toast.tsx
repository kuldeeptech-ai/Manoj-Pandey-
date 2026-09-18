import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose, duration = 4000 }) => {
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast?.id, duration]);

  if (!toast) return null;

  const config = {
    error: {
      bg: 'bg-rose-900/95 border-rose-500 text-white',
      icon: <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />,
      defaultTitle: 'त्रुटि (Error)',
      accent: 'bg-rose-400',
    },
    warning: {
      bg: 'bg-amber-900/95 border-amber-500 text-white',
      icon: <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />,
      defaultTitle: 'चेतावनी (Notice)',
      accent: 'bg-amber-400',
    },
    success: {
      bg: 'bg-emerald-900/95 border-emerald-500 text-white',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />,
      defaultTitle: 'सफल (Success)',
      accent: 'bg-emerald-400',
    },
    info: {
      bg: 'bg-[#0f2b48]/95 border-blue-400 text-white',
      icon: <Info className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />,
      defaultTitle: 'सूचना (Info)',
      accent: 'bg-blue-400',
    },
  }[toast.type];

  return (
    <div
      className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-in fade-in slide-in-from-top-4 duration-200"
      role="alert"
    >
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border-2 shadow-2xl backdrop-blur-md ${config.bg}`}
      >
        {config.icon}
        <div className="flex-1 text-xs">
          {toast.title && (
            <p className="font-bold uppercase tracking-wider text-[11px] mb-0.5">
              {toast.title}
            </p>
          )}
          <p className="font-semibold leading-relaxed text-slate-100">
            {toast.message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Dismiss"
          aria-label="Close message"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
