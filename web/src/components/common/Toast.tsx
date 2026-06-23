import React, { useEffect, useState } from 'react';

export interface ToastData {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export const Toast: React.FC = () => {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastData>;
      setToast(customEvent.detail);
      setIsVisible(true);
      
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsVisible(false);
        // Wait for exit animation before removing from DOM
        setTimeout(() => setToast(null), 300);
      }, 4000);
    };

    window.addEventListener('app-toast', handleToast);
    return () => {
      window.removeEventListener('app-toast', handleToast);
      clearTimeout(timeout);
    };
  }, []);

  if (!toast) return null;

  let accentColor = 'bg-lime';
  let textColor = 'text-lime';
  let kickerText = 'SUCCESS';

  if (toast.type === 'error') {
    accentColor = 'bg-red-500';
    textColor = 'text-red-500';
    kickerText = 'ERROR';
  } else if (toast.type === 'info') {
    accentColor = 'bg-blue-500';
    textColor = 'text-blue-500';
    kickerText = 'INFO';
  } else if (toast.type === 'warning') {
    accentColor = 'bg-amber-500';
    textColor = 'text-amber-500';
    kickerText = 'WARNING';
  }

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
      <div className="flex bg-navy rounded-xl border border-[#1D2A78] overflow-hidden shadow-[0_10px_18px_rgba(0,0,0,0.3)]">
        <div className={`w-1.5 ${accentColor}`} />
        <div className="flex-1 py-2 px-3">
          <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${textColor}`}>{kickerText}</p>
          <h4 className="text-white text-sm font-bold mb-0.5">{toast.title}</h4>
          <p className="text-white/70 text-xs font-medium">{toast.message}</p>
          
          <div className="mt-1.5 h-[3px] rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full w-full origin-left ${accentColor} animate-[shrink_4s_linear_forwards]`} />
          </div>
        </div>
      </div>
    </div>
  );
};
