import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SchoolSettings, StudentResultData, RecentSearchItem } from '../types';
import {
  Search,
  GraduationCap,
  Award,
  FileText,
  ArrowRight,
  RotateCw,
  ShieldCheck,
  Hash,
  Lock,
  BookOpen,
  Wrench,
  Clock,
  History as HistoryIcon,
  X,
} from 'lucide-react';
import { Toast, ToastMessage } from './Toast';

interface PublicSearchProps {
  schoolSettings: SchoolSettings;
  availableClasses?: string[];
  onSearch: (rollOrAdmission: string, selectedClass: string) => Promise<boolean>;
  errorMessage: string | null;
  isLoading: boolean;
  onSwitchToAdmin?: () => void;
  onDirectViewResult?: (result: StudentResultData) => void;
}

export const PublicSearch: React.FC<PublicSearchProps> = ({
  schoolSettings,
  availableClasses = [],
  onSearch,
  errorMessage,
  isLoading,
  onSwitchToAdmin,
  onDirectViewResult,
}) => {
  // Captcha active state strictly governed by Admin Panel schoolSettings
  const isCaptchaActive = schoolSettings.enableCaptcha !== false;

  // Local storage rules governed by Admin Panel schoolSettings
  const allowSaveClass = schoolSettings.saveSelectedClass !== false;
  const allowSaveRoll = schoolSettings.saveSearchRoll !== false;
  const allowRecentSearches = schoolSettings.saveRecentSearches !== false;
  const allowSaveLastResult = schoolSettings.saveLastResult !== false;
  const allowAutoFill = schoolSettings.autoFillOnLoad !== false;

  // Initialize selected class from LocalStorage if allowed by Admin
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    try {
      if (allowAutoFill && allowSaveClass) {
        return localStorage.getItem('hp_saved_class') || '';
      }
    } catch {}
    return '';
  });

  // Initialize roll number from LocalStorage if allowed by Admin
  const [searchTerm, setSearchTerm] = useState<string>(() => {
    try {
      if (allowAutoFill && allowSaveRoll) {
        return localStorage.getItem('hp_saved_roll') || '';
      }
    } catch {}
    return '';
  });

  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Recent Searches from LocalStorage
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() => {
    if (!allowRecentSearches) return [];
    try {
      const saved = localStorage.getItem('hp_recent_searches');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Cached Last Result from LocalStorage
  const [cachedLastResult, setCachedLastResult] = useState<StudentResultData | null>(() => {
    if (!allowSaveLastResult) return null;
    try {
      const saved = localStorage.getItem('hp_cached_last_result');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  // Compute active class options from schoolSettings.activeClasses or availableClasses prop
  const classOptions = useMemo(() => {
    if (availableClasses && availableClasses.length > 0) {
      return availableClasses;
    }
    if (schoolSettings.activeClasses && schoolSettings.activeClasses.length > 0) {
      return schoolSettings.activeClasses;
    }
    return ['5th', '6th', '7th', '8th'];
  }, [availableClasses, schoolSettings.activeClasses]);

  // Generate a random 4-digit numeric captcha
  const generateNumericCaptcha = useCallback(() => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setCaptchaCode(code);
    setCaptchaInput('');
  }, []);

  useEffect(() => {
    if (isCaptchaActive) {
      generateNumericCaptcha();
    }
  }, [isCaptchaActive, generateNumericCaptcha]);

  // Sync errorMessage from parent into Toast notification if triggered
  useEffect(() => {
    if (errorMessage) {
      setToast({
        id: `err-${Date.now()}`,
        type: 'error',
        title: 'रिजल्ट नहीं मिला (Not Found)',
        message: errorMessage,
      });
      if (isCaptchaActive) {
        generateNumericCaptcha();
      }
    }
  }, [errorMessage, isCaptchaActive, generateNumericCaptcha]);

  // Synchronize inputs to LocalStorage as per Admin Panel settings
  const handleClassChange = (newClass: string) => {
    setSelectedClass(newClass);
    try {
      if (allowSaveClass) {
        localStorage.setItem('hp_saved_class', newClass);
      } else {
        localStorage.removeItem('hp_saved_class');
      }
    } catch {}
  };

  const handleRollChange = (newRoll: string) => {
    setSearchTerm(newRoll);
    try {
      if (allowSaveRoll) {
        localStorage.setItem('hp_saved_roll', newRoll);
      } else {
        localStorage.removeItem('hp_saved_roll');
      }
    } catch {}
  };

  // Remove single recent search item
  const handleRemoveRecentSearch = (rollNo: string, className: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter((item) => !(item.rollNo === rollNo && item.className === className));
    setRecentSearches(updated);
    try {
      localStorage.setItem('hp_recent_searches', JSON.stringify(updated));
    } catch {}
  };

  // Submit search
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanClass = selectedClass.trim();
    const cleanRoll = searchTerm.trim();
    const cleanCaptcha = captchaInput.trim();

    // 1. Validation: Class empty check
    if (!cleanClass) {
      setToast({
        id: `toast-${Date.now()}`,
        type: 'warning',
        title: 'कक्षा चुनना अनिवार्य है',
        message: 'कृपया विकल्प 1 से अपनी कक्षा (Class) चुनें!',
      });
      return;
    }

    // 2. Validation: Roll Number empty check
    if (!cleanRoll) {
      setToast({
        id: `toast-${Date.now()}`,
        type: 'warning',
        title: 'अनुक्रमांक आवश्यक है',
        message: 'कृपया विकल्प 2 में अपना रोल नंबर (Roll No.) या प्रवेश संख्या दर्ज करें!',
      });
      return;
    }

    // 3. Validation: Captcha (Strictly executed ONLY when isCaptchaActive is enabled by Admin)
    if (isCaptchaActive) {
      if (!cleanCaptcha) {
        setToast({
          id: `toast-${Date.now()}`,
          type: 'warning',
          title: 'कैप्चा आवश्यक है',
          message: 'कृपया विकल्प 3 में नीचे दिया गया 4-अंकीय कैप्चा कोड दर्ज करें!',
        });
        return;
      }

      if (cleanCaptcha !== captchaCode) {
        generateNumericCaptcha();
        setToast({
          id: `toast-${Date.now()}`,
          type: 'error',
          title: 'गलत कैप्चा (Invalid Captcha)',
          message: 'दर्ज किया गया कैप्चा कोड सही नहीं है! कृपया नया 4-अंकीय कोड देखकर दोबारा भरें।',
        });
        return;
      }
    }

    // Save inputs to localStorage if configured by Admin
    try {
      if (allowSaveClass) {
        localStorage.setItem('hp_saved_class', cleanClass);
      }
      if (allowSaveRoll) {
        localStorage.setItem('hp_saved_roll', cleanRoll);
      }
    } catch {}

    // Execute verified search
    const success = await onSearch(cleanRoll, cleanClass);

    if (success) {
      // Save to recent searches if allowed
      if (allowRecentSearches) {
        const newItem: RecentSearchItem = {
          rollNo: cleanRoll,
          className: cleanClass,
          timestamp: Date.now(),
        };
        const updated = [newItem, ...recentSearches.filter((item) => !(item.rollNo === cleanRoll && item.className === cleanClass))].slice(0, 8);
        setRecentSearches(updated);
        try {
          localStorage.setItem('hp_recent_searches', JSON.stringify(updated));
        } catch {}
      }
    } else {
      if (isCaptchaActive) {
        generateNumericCaptcha();
      }
    }
  };

  // Quick search when clicking a recent search tag
  const handleQuickRecentSearch = (item: RecentSearchItem) => {
    setSelectedClass(item.className);
    setSearchTerm(item.rollNo);
    if (allowSaveClass) {
      localStorage.setItem('hp_saved_class', item.className);
    }
    if (allowSaveRoll) {
      localStorage.setItem('hp_saved_roll', item.rollNo);
    }
    onSearch(item.rollNo, item.className);
  };

  // View cached last result directly
  const handleOpenCachedResult = () => {
    if (cachedLastResult && onDirectViewResult) {
      onDirectViewResult(cachedLastResult);
    } else if (cachedLastResult?.student) {
      setSelectedClass(cachedLastResult.student.className);
      setSearchTerm(cachedLastResult.student.rollNo);
      onSearch(cachedLastResult.student.rollNo, cachedLastResult.student.className);
    }
  };

  // If Maintenance Mode is active, render dedicated maintenance notice screen
  if (schoolSettings.isMaintenanceMode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f2b48]/5 via-amber-50/40 to-slate-100 flex flex-col justify-between">
        {/* Toast Notification */}
        <Toast toast={toast} onClose={() => setToast(null)} duration={4000} />

        {/* Top Header */}
        <header className="bg-[#0f2b48] text-white py-3.5 px-4 sm:px-8 border-b-4 border-amber-500 shadow-md">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {schoolSettings.logoUrl && (
                <div className="w-12 h-12 bg-white rounded-full p-1 flex items-center justify-center shadow-inner shrink-0">
                  <img
                    src={schoolSettings.logoUrl}
                    alt={schoolSettings.schoolName}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <div>
                <h1
                  className="font-bold text-base sm:text-xl tracking-tight leading-none uppercase"
                  style={{
                    fontSize: schoolSettings.publicPortalSchoolNameSize
                      ? `${schoolSettings.publicPortalSchoolNameSize}px`
                      : undefined,
                  }}
                >
                  {schoolSettings.schoolName}
                </h1>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  {schoolSettings.address}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 rounded-full border border-amber-400/40 text-xs text-amber-300 font-bold">
              <Wrench className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>कार्य प्रगति पर है</span>
            </div>
          </div>
        </header>

        {/* Maintenance Content */}
        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 sm:py-14 flex flex-col items-center justify-center">
          <div className="w-full bg-white rounded-2xl shadow-xl border-2 border-amber-300 overflow-hidden text-center">
            <div className="bg-gradient-to-r from-[#0f2b48] via-amber-950/70 to-[#0f2b48] text-white p-6 sm:p-8 relative">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 backdrop-blur-xs mb-3 border-2 border-amber-400/40 shadow-inner">
                <Wrench className="w-8 h-8 text-amber-300 animate-bounce" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
                पोर्टल पर कार्य चल रहा है
              </h2>
              <p className="text-amber-200 text-xs sm:text-sm font-semibold mt-1">
                PORTAL UNDER MAINTENANCE & UPDATING • SESSION {schoolSettings.session}
              </p>
            </div>

            <div className="p-6 sm:p-8 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded-full text-xs font-black">
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                <span>🚧 मेंटेनेंस मोड सक्रिय (Maintenance Active)</span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm leading-relaxed text-left space-y-2">
                <p className="font-semibold text-slate-900">
                  {schoolSettings.maintenanceMessage || 'प्रिय अभिभावक एवं छात्रगण, वर्तमान में वेबसाइट पर परीक्षा परिणाम एवं मार्कशीट अपडेट/मेंटेनेंस का कार्य किया जा रहा है।'}
                </p>
                <p className="text-xs text-slate-600">
                  सर्वर पर परीक्षा परिणाम व अंकपत्र सत्यापन का कार्य प्रगति पर है। कृपया कुछ समय प्रतीक्षा करें एवं बाद में पुनः प्रयास करें।
                </p>
              </div>

              <div className="p-3.5 bg-amber-50/70 rounded-lg border border-amber-200 text-xs text-slate-700 space-y-1">
                <p className="font-bold text-slate-900">{schoolSettings.schoolName}</p>
                <p>हेल्पलाइन संपर्क: <span className="font-bold text-[#0f2b48]">+91-{schoolSettings.mobile}</span></p>
                <p className="text-slate-500">{schoolSettings.address}</p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full py-3 px-4 bg-[#0f2b48] hover:bg-[#1b4975] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>पेज रिफ्रेश करें (Check Again)</span>
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer with discrete Admin Login */}
        <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-700">
            {schoolSettings.tagline}
          </p>
          <p className="mt-0.5">
            शैक्षणिक सत्र {schoolSettings.session} • सर्वाधिकार सुरक्षित
          </p>
          {onSwitchToAdmin && (
            <div className="mt-2">
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-700 transition-colors cursor-pointer py-1 px-2.5 rounded hover:bg-slate-100"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>प्रशासनिक लॉगिन (Staff Admin Login)</span>
              </button>
            </div>
          )}
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f2b48]/5 via-slate-50 to-slate-100 flex flex-col justify-between">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} duration={4000} />

      {/* Top Banner (Clean, Public Header with School Info) */}
      <header className="bg-[#0f2b48] text-white py-3.5 px-4 sm:px-8 border-b-4 border-[#b8860b] shadow-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {schoolSettings.logoUrl && (
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white rounded-full p-1 flex items-center justify-center shadow-inner shrink-0">
                <img
                  src={schoolSettings.logoUrl}
                  alt={schoolSettings.schoolName}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div>
              <h1
                className="font-bold text-sm sm:text-xl tracking-tight leading-none uppercase"
                style={{
                  fontSize: schoolSettings.publicPortalSchoolNameSize
                    ? `${schoolSettings.publicPortalSchoolNameSize}px`
                    : undefined,
                }}
              >
                {schoolSettings.schoolName}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-1">
                {schoolSettings.address}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full border border-white/20 text-xs text-amber-300 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-[#ffd54f]" />
            <span>Official Student Portal</span>
          </div>
        </div>
      </header>

      {/* Main Search Section */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 sm:py-10 flex flex-col items-center justify-center">
        {/* Live Status Notification Banner */}
        {schoolSettings.isResultLive !== false ? (
          <div className="w-full mb-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-3.5 sm:p-4 rounded-xl shadow-lg border-2 border-emerald-400/50 flex items-center gap-3.5 relative overflow-hidden transition-all duration-300">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none animate-pulse"></div>
            
            <div className="relative flex items-center justify-center shrink-0 w-9 h-9 bg-emerald-950/70 rounded-full border border-emerald-400/60 shadow-inner">
              <span className="w-4 h-4 bg-red-500 rounded-full animate-ping absolute opacity-75"></span>
              <span className="w-3 h-3 bg-red-500 rounded-full relative shadow-sm"></span>
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider bg-red-600 px-2.5 py-0.5 rounded-full text-white shadow-xs flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  LIVE
                </span>
                <span className="font-bold text-xs sm:text-sm tracking-tight text-white drop-shadow-xs">
                  सभी मार्कशीट लाइव हैं (Results Announced)
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-100 font-medium mt-1 leading-snug">
                {schoolSettings.liveBannerText || `सत्र ${schoolSettings.session} की सभी कक्षाओं की मार्कशीट लाइव हैं! आप नीचे रोल नंबर व कक्षा दर्ज करके रिजल्ट देख सकते हैं।`}
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full mb-4 bg-amber-50 text-amber-950 p-3.5 rounded-xl border border-amber-300 flex items-center gap-3 shadow-xs">
            <Clock className="w-5 h-5 text-amber-700 shrink-0" />
            <div className="flex-1 text-xs">
              <span className="font-bold block text-amber-950">
                📢 परिणाम सूचना: मार्कशीट प्रक्रियाधीन (Results In Progress)
              </span>
              <span className="text-[11px] text-amber-800 block mt-0.5">
                अंकपत्रों की जांच एवं अपलोड प्रक्रिया जारी है। यदि आपका परिणाम अपलोड हो चुका है तो नीचे विवरण दर्ज करके जांच करें।
              </span>
            </div>
          </div>
        )}

        {/* Cached Last Result Quick-Open Banner (if enabled and cached) */}
        {allowSaveLastResult && cachedLastResult?.student && (
          <div className="w-full mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs shadow-xs hover:border-blue-300 transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-blue-950 block truncate">
                  पिछला देखा गया अंकपत्र: {cachedLastResult.student.name}
                </span>
                <span className="text-[11px] text-blue-700 block truncate">
                  कक्षा: {cachedLastResult.student.className} • रोल नंबर: {cachedLastResult.student.rollNo}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenCachedResult}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer transition-all shadow-xs"
            >
              <span>अंकपत्र देखें</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Verification Card */}
        <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-[#0f2b48] to-[#1b4975] text-white p-6 sm:p-7 text-center relative">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 backdrop-blur-xs mb-3 border border-white/20">
              <GraduationCap className="w-8 h-8 text-[#ffd54f]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight uppercase">
              छात्र परीक्षा परिणाम पोर्टल
            </h2>
            <p className="text-slate-200 text-xs sm:text-sm mt-1 max-w-md mx-auto">
              ONLINE RESULT VERIFICATION PORTAL • SESSION {schoolSettings.session}
            </p>
          </div>

          {/* Search Form */}
          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Field 1: Class Selection */}
              <div>
                <label
                  htmlFor="class-select"
                  className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-[#0f2b48]" />
                    <span>1. कक्षा चुनें (Select Class)</span>
                  </span>
                  <span className="text-rose-500 font-bold">*अनिवार्य</span>
                </label>
                <div className="relative flex items-center">
                  <select
                    id="class-select"
                    value={selectedClass}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full px-4 py-3 text-base font-bold text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:border-[#0f2b48] focus:ring-2 focus:ring-[#0f2b48]/20 transition-all outline-none cursor-pointer"
                    autoFocus
                  >
                    <option value="">-- अपनी कक्षा चुनें (Choose Your Class) --</option>
                    {classOptions.map((cls) => (
                      <option key={cls} value={cls} className="font-bold py-1">
                        {cls.toLowerCase().startsWith('class') || cls.startsWith('कक्षा') ? cls : `Class ${cls}`}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  जिस कक्षा का परीक्षा परिणाम देखना है, वह कक्षा चुनें।
                </p>
              </div>

              {/* Field 2: Roll Number / Admission Number */}
              <div>
                <label
                  htmlFor="search-input"
                  className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-[#0f2b48]" />
                    <span>2. अनुक्रमांक या प्रवेश संख्या (Roll No. / Admission No.)</span>
                  </span>
                  <span className="text-rose-500 font-bold">*अनिवार्य</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <input
                    id="search-input"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleRollChange(e.target.value)}
                    placeholder="उदा. 17 अथवा ADM-2024-0017"
                    className="w-full pl-10 pr-4 py-3 text-base font-bold text-slate-900 border-2 border-slate-300 rounded-lg focus:border-[#0f2b48] focus:ring-2 focus:ring-[#0f2b48]/20 transition-all outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  कक्षा में मिला अपना रोल नंबर अथवा स्कूल का प्रवेश नंबर दर्ज करें।
                </p>
              </div>

              {/* Recent Searches Tags (if enabled in Admin Panel) */}
              {allowRecentSearches && recentSearches.length > 0 && (
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                      <HistoryIcon className="w-3.5 h-3.5 text-[#0f2b48]" />
                      <span>हालिया सर्च (Recent Searches):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRecentSearches([]);
                        try {
                          localStorage.removeItem('hp_recent_searches');
                        } catch {}
                      }}
                      className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      इतिहास साफ करें
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((item, idx) => (
                      <div
                        key={`${item.className}-${item.rollNo}-${idx}`}
                        onClick={() => handleQuickRecentSearch(item)}
                        className="group inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#0f2b48] text-slate-700 hover:text-white border border-slate-300 hover:border-[#0f2b48] rounded-md text-xs font-bold cursor-pointer transition-all shadow-2xs"
                        title={`कक्षा ${item.className}, रोल ${item.rollNo} का तुरंत रिजल्ट देखें`}
                      >
                        <span>कक्षा {item.className} • रोल {item.rollNo}</span>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveRecentSearch(item.rollNo, item.className, e)}
                          className="text-slate-400 group-hover:text-slate-300 hover:text-rose-400 p-0.5 rounded transition-colors"
                          title="हटाएं"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Field 3: Security Captcha Code (ONLY rendered if enabled by Admin) */}
              {isCaptchaActive ? (
                <div>
                  <label
                    htmlFor="captcha-input"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#0f2b48]" />
                      <span>3. सुरक्षा कैप्चा कोड (Security Captcha Code)</span>
                    </span>
                    <span className="text-rose-500 font-bold">*केवल 4 अंक</span>
                  </label>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Styled Numeric Security Captcha Display */}
                    <div className="flex items-center gap-2 bg-slate-900 text-amber-300 px-4 py-2.5 rounded-lg border-2 border-slate-700 select-none shadow-inner shrink-0">
                      <Hash className="w-4 h-4 text-slate-500" />
                      <span className="text-2xl font-black tracking-widest font-mono text-[#ffd54f] drop-shadow-md">
                        {captchaCode}
                      </span>
                      <button
                        type="button"
                        onClick={generateNumericCaptcha}
                        className="ml-2 p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
                        title="नया कैप्चा कोड बनाएं (Refresh Captcha)"
                        aria-label="Refresh Captcha"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Numeric Captcha Input */}
                    <div className="flex-1 relative">
                      <input
                        id="captcha-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={captchaInput}
                        onChange={(e) => setCaptchaInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="सामने दिख रहे 4 अंक दर्ज करें"
                        className="w-full px-4 py-3 text-base font-bold tracking-widest text-slate-900 border-2 border-slate-300 rounded-lg focus:border-[#0f2b48] focus:ring-2 focus:ring-[#0f2b48]/20 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    सुरक्षा के लिए केवल संख्यात्मक (Numbers only) कोड दर्ज करें।
                  </p>
                </div>
              ) : null}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-[#0f2b48] hover:bg-[#1b4975] disabled:bg-slate-400 text-white text-base font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>रिजल्ट खोजा जा रहा है...</span>
                  </>
                ) : (
                  <>
                    <span>CHECK RESULT / अंकपत्र देखें</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Features Footer */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 sm:px-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#b8860b] shrink-0" />
              <span className="font-semibold">आधिकारिक अंकपत्र (Verified)</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-700 shrink-0" />
              <span className="font-semibold">A4 प्रिंटेबल एवं PDF डाउनलोड</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-semibold">
                {isCaptchaActive ? 'कैप्चा द्वारा सुरक्षित पोर्टल' : 'सुरक्षित ऑनलाइन पोर्टल'}
              </span>
            </div>
          </div>
        </div>

        {/* School Management Details */}
        <div className="mt-8 text-center text-xs text-slate-500 font-medium">
          <p className="font-bold text-slate-700">{schoolSettings.schoolName}</p>
          <p className="mt-0.5">{schoolSettings.address}</p>
          <p className="mt-0.5">
            प्रबंधक: {schoolSettings.managedBy} • हेल्पलाइन: +91-{schoolSettings.mobile}
          </p>
        </div>
      </main>

      {/* Clean Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">
          {schoolSettings.tagline}
        </p>
        <p className="mt-0.5">
          शैक्षणिक सत्र {schoolSettings.session} • सर्वाधिकार सुरक्षित
        </p>
        {onSwitchToAdmin && (
          <div className="mt-2">
            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-700 transition-colors cursor-pointer py-1 px-2.5 rounded hover:bg-slate-100"
            >
              <Lock className="w-3 h-3 text-slate-400" />
              <span>प्रशासनिक लॉगिन (Staff Admin Login)</span>
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};
