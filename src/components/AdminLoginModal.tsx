import React, { useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Mail,
  CheckCircle2,
  RefreshCw,
  Send,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  signInAdminWithGoogle,
  sendAdminFirebasePasswordReset,
  signInAdminWithFirebaseEmailPassword,
  AUTHORIZED_ADMIN_EMAIL,
  isAuthorizedAdmin,
} from '../utils/firebase';

interface AdminLoginModalProps {
  isOpen: boolean;
  onSuccess?: () => void;
  onLoginSuccess?: () => void;
  onClose: () => void;
  schoolName?: string;
  adminUserId?: string;
  adminPassword?: string;
  adminEmail?: string;
}

const DEFAULT_ADMIN_EMAIL = AUTHORIZED_ADMIN_EMAIL;
const DEFAULT_ADMIN_PASS = 'Kld@2314';

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onSuccess,
  onLoginSuccess,
  onClose,
  schoolName = 'H.D. Pandey Public Junior High School',
  adminPassword = DEFAULT_ADMIN_PASS,
  adminEmail = DEFAULT_ADMIN_EMAIL,
}) => {
  const [viewMode, setViewMode] = useState<'login' | 'forgot_password'>('login');

  // Login Form States
  const targetEmail = (adminEmail || DEFAULT_ADMIN_EMAIL).trim();
  const [emailInput, setEmailInput] = useState(targetEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Forgot Password / Firebase Reset Link States
  const [isSendingFirebaseReset, setIsSendingFirebaseReset] = useState(false);
  const [firebaseResetSuccess, setFirebaseResetSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const triggerSuccess = () => {
    localStorage.setItem('school_admin_email', AUTHORIZED_ADMIN_EMAIL);
    localStorage.setItem('school_admin_logged_in', 'true');
    const callback = onSuccess || onLoginSuccess;
    if (callback) callback();
  };

  // 1. Google 1-Click Sign-In via Firebase Auth
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);

    try {
      const res = await signInAdminWithGoogle();

      if (res.success && res.email) {
        // Notify local server API of verified Firebase session
        try {
          await fetch('/api/admin/firebase-auth-success', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: res.email }),
          });
        } catch {}

        triggerSuccess();
        return;
      }

      if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Google लॉगिन में त्रुटि हुई।');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // 2. Email & Password Sign-In
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPass = password.trim();

    // Strict Sole Admin Enforcement: Only kuldeeprai75220@gmail.com
    if (!isAuthorizedAdmin(cleanEmail)) {
      setIsSubmitting(false);
      setErrorMessage(
        `अनधिकृत ईमेल! केवल अधिकृत व्यवस्थापक (${AUTHORIZED_ADMIN_EMAIL}) ही एडमिन पैनल में प्रवेश कर सकते हैं। अन्य किसी भी खाते को अनुमति नहीं है।`
      );
      return;
    }

    if (!cleanPass) {
      setIsSubmitting(false);
      setErrorMessage('कृपया पासवर्ड दर्ज करें।');
      return;
    }

    // Step A: Attempt Firebase Email/Password Authentication
    try {
      const fbResult = await signInAdminWithFirebaseEmailPassword(cleanEmail, cleanPass);
      if (fbResult.success) {
        try {
          await fetch('/api/admin/firebase-auth-success', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail }),
          });
        } catch {}

        setIsSubmitting(false);
        triggerSuccess();
        return;
      }
    } catch (fbErr) {
      console.warn('Firebase Email/Password login note:', fbErr);
    }

    // Step B: Check against backend server API endpoint
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPass,
        }),
      });

      const resData = await response.json().catch(() => ({}));
      if (response.ok && resData.success) {
        setIsSubmitting(false);
        triggerSuccess();
        return;
      }
    } catch {}

    // Step C: Check local / master password fallback
    const expectedPass = (adminPassword || localStorage.getItem('school_admin_pass') || DEFAULT_ADMIN_PASS).trim();
    if (cleanPass === expectedPass) {
      setIsSubmitting(false);
      triggerSuccess();
      return;
    }

    setIsSubmitting(false);
    setErrorMessage(
      `गलत पासवर्ड! कृपया सही पासवर्ड दर्ज करें अथवा ऊपर दिए गए 'Google से 1-क्लिक लॉगिन' बटन का उपयोग करें।`
    );
  };

  // 3. Official Firebase Password Reset Email Dispatch
  const handleFirebasePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingFirebaseReset(true);
    setErrorMessage(null);
    setFirebaseResetSuccess(null);

    const res = await sendAdminFirebasePasswordReset(AUTHORIZED_ADMIN_EMAIL);
    setIsSendingFirebaseReset(false);

    if (res.success) {
      setFirebaseResetSuccess(
        res.message ||
          `पासवर्ड रीसेट लिंक आपके ईमेल (${AUTHORIZED_ADMIN_EMAIL}) पर सफलतापूर्वक भेज दिया गया है!`
      );
    } else {
      setErrorMessage(res.error || 'Firebase ईमेल भेजने में त्रुटि हुई।');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#0f2b48] w-full max-w-md overflow-hidden transition-all">
        {/* Header */}
        <div className="bg-[#0f2b48] text-white p-5 text-center border-b-2 border-[#b8860b]">
          <div className="w-12 h-12 bg-white/10 rounded-full mx-auto mb-2 flex items-center justify-center border border-white/20">
            {viewMode === 'login' ? (
              <Lock className="w-6 h-6 text-[#ffd54f]" />
            ) : (
              <KeyRound className="w-6 h-6 text-[#ffd54f]" />
            )}
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight uppercase">
            {viewMode === 'login' ? 'व्यवस्थापक प्रमाणीकरण (ADMIN AUTH)' : 'पासवर्ड रीसेट (FIREBASE PASSWORD RESET)'}
          </h2>
          <p className="text-xs text-slate-200 mt-1 font-medium line-clamp-1">
            {schoolName}
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-[#ffd54f] text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>एकमात्र अधिकृत एडमिन: कुलदीप राय</span>
          </div>
        </div>

        {/* View Mode 1: LOGIN FORM */}
        {viewMode === 'login' && (
          <div className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* METHOD 1: GOOGLE 1-CLICK SIGN-IN (POWERED BY FIREBASE AUTH) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  आसान व सुरक्षित तरीका (अनुशंसित):
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  बिना पासवर्ड
                </span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isSubmitting}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border-2 border-slate-300 hover:border-[#0f2b48] text-slate-800 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
              >
                {isGoogleLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#0f2b48]" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span>
                  {isGoogleLoading
                    ? 'Google से सत्यापित हो रहा है...'
                    : 'Google से 1-क्लिक लॉगिन करें (Sign in with Google)'}
                </span>
              </button>
              <span className="text-[10px] text-slate-500 mt-1 block text-center">
                केवल अधिकृत ईमेल <strong>{AUTHORIZED_ADMIN_EMAIL}</strong> से ही प्रवेश होगा
              </span>
            </div>

            {/* DIVIDER */}
            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 shrink-0 uppercase tracking-wider">
                अथवा पासवर्ड द्वारा
              </span>
              <div className="border-t border-slate-200 w-full" />
            </div>

            {/* METHOD 2: EMAIL & PASSWORD FORM */}
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              {/* Email Field - Fixed to Authorized Admin Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  अधिकृत व्यवस्थापक ईमेल (Admin Email)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder={AUTHORIZED_ADMIN_EMAIL}
                    className="w-full pl-9 pr-20 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f2b48]"
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      अधिकृत
                    </span>
                  </span>
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    पासवर्ड (Password)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('forgot_password');
                      setErrorMessage(null);
                      setFirebaseResetSuccess(null);
                    }}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3 text-amber-600" />
                    <span>पासवर्ड भूल गए?</span>
                  </button>
                </div>
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
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f2b48]"
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
                  <span>रद्द करें</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isGoogleLoading}
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
          </div>
        )}

        {/* View Mode 2: FIREBASE OFFICIAL PASSWORD RESET */}
        {viewMode === 'forgot_password' && (
          <div className="p-6 space-y-4">
            {firebaseResetSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs font-medium space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Firebase ईमेल सफलतापूर्वक भेजा गया!</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  {firebaseResetSuccess}
                </p>
                <p className="text-[11px] text-emerald-900 font-bold">
                  अपने Gmail इनबॉक्स या Spam फ़ोल्डर में जाकर लिंक पर क्लिक करें और नया पासवर्ड सेट करें।
                </p>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleFirebasePasswordReset} className="space-y-4">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-blue-950">
                  <Mail className="w-4 h-4 text-blue-700" />
                  Firebase आधिकारिक पासवर्ड रीसेट:
                </p>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  OTP के इंतज़ार के बिना, Google Firebase सीधे आपके पंजीकृत ईमेल पर 1-क्लिक पासवर्ड रीसेट लिंक भेजेगा।
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  अधिकृत व्यवस्थापक ईमेल (Authorized Admin Email)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    readOnly
                    value={AUTHORIZED_ADMIN_EMAIL}
                    className="w-full pl-9 pr-24 py-2.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 cursor-not-allowed"
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      एकमात्र एडमिन
                    </span>
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  सुरक्षा कारणों से रीसेट लिंक केवल इसी अधिकृत ईमेल पर भेजा जाएगा।
                </span>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-relaxed">
                💡 <strong>तत्काल विकल्प:</strong> यदि आपको पासवर्ड याद नहीं है, तो रीसेट करने की भी आवश्यकता नहीं है! आप सीधे <strong>'Google से 1-क्लिक लॉगिन'</strong> बटन दबाकर तुरंत एडमिन पोर्टल में प्रवेश कर सकते हैं।
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setErrorMessage(null);
                    setFirebaseResetSuccess(null);
                  }}
                  className="flex-1 py-2.5 px-3 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>लॉगिन पर वापस</span>
                </button>
                <button
                  type="submit"
                  disabled={isSendingFirebaseReset}
                  className="flex-1 py-2.5 px-3 bg-[#0f2b48] hover:bg-[#1b4975] disabled:bg-slate-400 text-white text-xs font-bold rounded-lg shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSendingFirebaseReset ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-[#ffd54f]" />
                  )}
                  <span>रीसेट लिंक भेजें</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <p className="text-[11px] text-slate-600 font-medium">
            प्रशासनिक नियंत्रण केवल <strong>{AUTHORIZED_ADMIN_EMAIL}</strong> के अधीन है
          </p>
        </div>
      </div>
    </div>
  );
};
