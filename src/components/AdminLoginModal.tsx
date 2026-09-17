import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onSuccess?: () => void;
  onLoginSuccess?: () => void;
  onClose: () => void;
  schoolName?: string;
  adminUserId?: string;
  adminPassword?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onSuccess,
  onLoginSuccess,
  onClose,
  schoolName = 'H.D. Pandey Public Junior High School',
  adminUserId = 'Kld75',
  adminPassword = 'Kld@2314',
}) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const trimmedUser = userId.trim();
    const trimmedPass = password.trim();

    // 1. Primary verification: Call backend server endpoint
    // The server verifies against the persisted active credentials in data-store.json
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: trimmedUser, password: trimmedPass }),
      });

      if (response.ok) {
        setIsSubmitting(false);
        const callback = onSuccess || onLoginSuccess;
        if (callback) callback();
        return;
      }

      if (response.status === 401) {
        setIsSubmitting(false);
        setErrorMessage('अमान्य यूज़र आईडी या पासवर्ड! यदि आपने हाल ही में पासवर्ड बदला था, तो केवल नया पासवर्ड ही कार्य करेगा। पुराना पासवर्ड निरस्त हो चुका है।');
        return;
      }
    } catch {
      // Server unreachable, proceed to local check fallback
    }

    // 2. Offline / Local fallback verification
    const expectedUser = (adminUserId || localStorage.getItem('school_admin_user') || 'Kld75').trim();
    const expectedPass = (adminPassword || localStorage.getItem('school_admin_pass') || 'Kld@2314').trim();

    const isUserValid = trimmedUser.toLowerCase() === expectedUser.toLowerCase();
    const isPassValid = trimmedPass === expectedPass;

    if (isUserValid && isPassValid) {
      setIsSubmitting(false);
      const callback = onSuccess || onLoginSuccess;
      if (callback) callback();
    } else {
      setIsSubmitting(false);
      setErrorMessage('अमान्य यूज़र आईडी या पासवर्ड! केवल वर्तमान अधिकृत क्रेडेंशियल्स ही स्वीकार्य हैं। पुराना पासवर्ड अब अमान्य है।');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border-2 border-[#0f2b48] w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#0f2b48] text-white p-5 text-center border-b-2 border-[#b8860b]">
          <div className="w-12 h-12 bg-white/10 rounded-full mx-auto mb-2.5 flex items-center justify-center border border-white/20">
            <Lock className="w-6 h-6 text-[#ffd54f]" />
          </div>
          <h2 className="text-lg font-bold tracking-tight uppercase">
            प्रशासनिक लॉगिन / ADMIN LOGIN
          </h2>
          <p className="text-xs text-slate-200 mt-1 font-medium line-clamp-1">
            {schoolName}
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-[#ffd54f] text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>सुरक्षित एडमिन पोर्टल (Restricted Access)</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* User ID Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              एडमिन यूज़र आईडी (User ID)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                autoFocus
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="User ID दर्ज करें"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f2b48]"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              पासवर्ड (Password)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="पासवर्ड दर्ज करें"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f2b48]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>वापस जाएं (Cancel)</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-[#0f2b48] hover:bg-[#1b4975] disabled:bg-slate-400 text-white text-xs font-bold rounded-lg shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <span>सत्यापित कर रहे हैं...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#ffd54f]" />
                  <span>प्रवेश करें (LOGIN)</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-500">
            केवल अधिकृत विद्यालय कर्मचारियों के लिए सुरक्षित लॉगिन पोर्टल
          </p>
        </div>
      </div>
    </div>
  );
};
