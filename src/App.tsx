import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Student,
  SubjectConfig,
  SchoolSettings,
  GradeRule,
  StudentResultData,
  ClearedMarksBackup,
} from './types';
import {
  DEFAULT_SCHOOL_SETTINGS,
  DEFAULT_SUBJECTS,
  DEFAULT_STUDENTS,
} from './data/defaultData';
import {
  DEFAULT_GRADE_RULES,
  calculateStudentResult,
  normalizeSchoolSettings,
  formatDisplayDate,
  normalizeStudentRecord,
  sortStudentsByRoll,
} from './utils/calculations';
import { PublicSearch } from './components/PublicSearch';
import { ResultViewer } from './components/ResultViewer';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginModal } from './components/AdminLoginModal';
import {
  isFirebaseConfigured,
  subscribeToSchoolSettingsToggles,
  subscribeToFirebaseData,
  subscribeToDeletedStudents,
  fetchAllFromFirebase,
  saveAllStudentsToFirebase,
  saveSubjectsToFirebase,
  saveSchoolSettingsToFirebase,
  saveGradeRulesToFirebase,
  syncAllDataToFirebase,
  moveStudentToTrashInFirebase,
  moveBatchStudentsToTrashInFirebase,
  restoreStudentFromTrashInFirebase,
  restoreAllStudentsFromTrashInFirebase,
  permanentlyDeleteStudentFromTrashInFirebase,
  emptyTrashInFirebase,
  saveClearedMarksBackupToFirebase,
  deleteClearedMarksBackupFromFirebase,
  emptyClearedMarksHistoryInFirebase,
  subscribeToClearedMarksHistory,
} from './utils/firebase';

type ViewMode = 'public_search' | 'result_view' | 'admin';

// Purge legacy local storage items on boot to guarantee online-first persistence across all devices
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('hd_pandey_students');
    localStorage.removeItem('hd_pandey_deleted_students');
    localStorage.removeItem('hd_pandey_cleared_marks_history');
    localStorage.removeItem('hd_pandey_subjects');
    localStorage.removeItem('hd_pandey_settings');
    localStorage.removeItem('hd_pandey_grades');
  } catch {}
}

const getInitialViewMode = (): ViewMode => {
  if (typeof window === 'undefined') return 'public_search';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const isAdmin =
    path.endsWith('/admin') ||
    path.endsWith('/admin/') ||
    path.includes('/admin') ||
    hash.includes('admin') ||
    params.get('view') === 'admin' ||
    params.has('admin') ||
    search.includes('admin');

  if (isAdmin) {
    if (path.includes('/admin')) {
      try {
        window.history.replaceState({}, '', '/?admin');
      } catch {}
    }
    return 'admin';
  }
  return 'public_search';
};

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => getInitialViewMode());

  // Strict Admin authentication state: NO auto-login. Every access requires ID and Password.
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);

  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(() => {
    return getInitialViewMode() === 'admin';
  });

  // Online-First Database State (No reliance on local storage so all users see identical live records)
  const [students, setStudents] = useState<Student[]>(() => {
    return sortStudentsByRoll((DEFAULT_STUDENTS || []).map(normalizeStudentRecord));
  });

  const [deletedStudents, setDeletedStudents] = useState<Student[]>([]);
  const [clearedMarksHistory, setClearedMarksHistory] = useState<ClearedMarksBackup[]>([]);
  const [subjects, setSubjects] = useState<SubjectConfig[]>(DEFAULT_SUBJECTS);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(() => {
    const initial = { ...DEFAULT_SCHOOL_SETTINGS };
    if (!initial.classTeachers || !Array.isArray(initial.classTeachers) || initial.classTeachers.length === 0) {
      initial.classTeachers = DEFAULT_SCHOOL_SETTINGS.classTeachers;
    }
    return initial;
  });
  const [gradeRules, setGradeRules] = useState<GradeRule[]>(DEFAULT_GRADE_RULES);

  // Real-time Cloud / Online Synchronization Status
  const [onlineSyncStatus, setOnlineSyncStatus] = useState<{
    isSaving: boolean;
    message: string | null;
    lastSyncTime: string | null;
    type: 'idle' | 'saving' | 'success' | 'error';
  }>({
    isSaving: false,
    message: null,
    lastSyncTime: null,
    type: 'idle',
  });

  const schoolSettingsRef = useRef(schoolSettings);
  schoolSettingsRef.current = schoolSettings;
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const deletedStudentsRef = useRef(deletedStudents);
  deletedStudentsRef.current = deletedStudents;
  const subjectsRef = useRef(subjects);
  subjectsRef.current = subjects;
  const gradeRulesRef = useRef(gradeRules);
  gradeRulesRef.current = gradeRules;
  const clearedMarksHistoryRef = useRef(clearedMarksHistory);
  clearedMarksHistoryRef.current = clearedMarksHistory;

  const [activeResult, setActiveResult] = useState<StudentResultData | null>(null);
  const [resultSource, setResultSource] = useState<'public' | 'admin'>('public');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedStudentForAdminMarks, setSelectedStudentForAdminMarks] = useState<string | undefined>(undefined);

  // Compute available classes from school settings (admin configured) or fallback to 5th to 8th
  const availableClasses = useMemo(() => {
    if (schoolSettings.activeClasses && Array.isArray(schoolSettings.activeClasses) && schoolSettings.activeClasses.length > 0) {
      return schoolSettings.activeClasses;
    }
    return ['5th', '6th', '7th', '8th'];
  }, [schoolSettings.activeClasses]);

  // Dynamic Favicon Synchronization:
  // Automatically sets the browser tab favicon to the official school logo
  useEffect(() => {
    const faviconUrl = schoolSettings.logoUrl?.trim() || '/favicon.svg';
    try {
      const iconLinks = document.querySelectorAll("link[rel*='icon']");
      if (iconLinks.length > 0) {
        iconLinks.forEach((link) => {
          (link as HTMLLinkElement).href = faviconUrl;
        });
      } else {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = faviconUrl;
        document.head.appendChild(link);
      }
      const appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
      if (appleIcon) {
        appleIcon.href = faviconUrl;
      }
    } catch {}
  }, [schoolSettings.logoUrl]);

  // Tracks the timestamp of recent admin mutations (deletions/edits) to prevent polling race conditions
  const lastLocalMutationTimeRef = useRef<number>(0);

  // Sync with backend API and Firebase on initial mount & periodic refresh (Live Online Truth)
  const syncCloudData = useCallback(async () => {
    // If local changes were made in the last 15 seconds, pause background polling to prevent race condition
    if (Date.now() - lastLocalMutationTimeRef.current < 15000) {
      return;
    }

    let backendSuccess = false;
    const currentSettings = schoolSettingsRef.current;

    // 1. Backend API fetch (Primary Source of Truth for live cross-device consistency)
    try {
      const res = await fetch(`/api/admin/data?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (data.schoolSettings) {
            const norm = normalizeSchoolSettings(data.schoolSettings);
            setSchoolSettings(norm);
          }
          if (Array.isArray(data.students) && data.students.length > 0) {
            const normalizedStudents = sortStudentsByRoll(data.students.map(normalizeStudentRecord));
            setStudents(normalizedStudents);
          }
          if (Array.isArray(data.subjects) && data.subjects.length > 0) {
            setSubjects(data.subjects);
          }
          if (Array.isArray(data.gradeRules) && data.gradeRules.length > 0) {
            setGradeRules(data.gradeRules);
          }
          if (Array.isArray(data.deletedStudents)) {
            setDeletedStudents(data.deletedStudents.map(normalizeStudentRecord));
          }
          if (Array.isArray(data.clearedMarksHistory)) {
            setClearedMarksHistory(data.clearedMarksHistory);
          }
          backendSuccess = true;
          setOnlineSyncStatus((prev) => ({
            ...prev,
            isSaving: false,
            lastSyncTime: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'idle',
          }));
        }
      }
    } catch (e) {
      // Backend not accessible
    }

    // 2. Fetch dataset from Firebase Realtime Database if backend didn't supply
    if (!backendSuccess) {
      try {
        const fbData = await fetchAllFromFirebase();
        if (fbData) {
          if (fbData.students && fbData.students.length > 0) {
            const normalizedStudents = sortStudentsByRoll(fbData.students.map(normalizeStudentRecord));
            setStudents(normalizedStudents);
          }
          if (fbData.subjects && fbData.subjects.length > 0) {
            setSubjects(fbData.subjects);
          }
          if (fbData.settings) {
            const norm = normalizeSchoolSettings({ ...currentSettings, ...fbData.settings });
            setSchoolSettings(norm);
          }
          if (fbData.gradeRules && fbData.gradeRules.length > 0) {
            setGradeRules(fbData.gradeRules);
          }
          setOnlineSyncStatus((prev) => ({
            ...prev,
            isSaving: false,
            lastSyncTime: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'idle',
          }));
        }
      } catch (e) {
        // Firebase fallback notice
      }
    }
  }, []);

  // CRUCIAL REAL-TIME LISTENER: school_settings/toggles node
  // Whenever an admin changes a toggle in the Admin Panel (e.g. turning off the PDF button
  // or hiding Half-Yearly marks), it instantly hides/shows on the marksheet without requiring a page refresh.
  useEffect(() => {
    const unsubToggles = subscribeToSchoolSettingsToggles((newToggles) => {
      setSchoolSettings((prev) => {
        const merged = normalizeSchoolSettings({
          ...prev,
          ...newToggles,
          toggles: { ...(prev.toggles || {}), ...newToggles },
        });
        return merged;
      });

      // Update active result view in real-time
      setActiveResult((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          school: normalizeSchoolSettings({
            ...prev.school,
            ...newToggles,
            toggles: { ...(prev.school.toggles || {}), ...newToggles },
          }),
        };
      });
    });

    // Real-time listener for database updates across all devices
    const unsubAll = subscribeToFirebaseData({
      onSettings: (newSettings) => {
        setSchoolSettings((prev) => {
          return normalizeSchoolSettings({ ...prev, ...newSettings });
        });
      },
      onStudents: (newStudents) => {
        if (Date.now() - lastLocalMutationTimeRef.current < 15000) return;
        const formatted = sortStudentsByRoll(newStudents.map(normalizeStudentRecord));
        setStudents(formatted);
      },
      onSubjects: (newSubjects) => {
        if (Date.now() - lastLocalMutationTimeRef.current < 15000) return;
        setSubjects(newSubjects);
      },
      onGradeRules: (newRules) => {
        setGradeRules(newRules);
      },
    });

    const unsubDeleted = subscribeToDeletedStudents((newDeleted) => {
      if (Date.now() - lastLocalMutationTimeRef.current < 15000) return;
      const formatted = newDeleted.map(normalizeStudentRecord);
      setDeletedStudents(formatted);
    });

    const unsubClearedMarks = subscribeToClearedMarksHistory((newHistory) => {
      if (Date.now() - lastLocalMutationTimeRef.current < 15000) return;
      setClearedMarksHistory(newHistory);
    });

    return () => {
      unsubToggles();
      unsubAll();
      unsubDeleted();
      unsubClearedMarks();
    };
  }, []);

  useEffect(() => {
    syncCloudData();
    // Calmed background check cycle
    const timer = setInterval(() => {
      syncCloudData();
    }, 25000);

    const handleFocus = () => syncCloudData();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [syncCloudData]);

  // Handle Search function requiring Class, Roll/Admission No., and verified Captcha
  const handleSearch = useCallback(
    async (query: string, selectedClass?: string): Promise<boolean> => {
      setIsLoading(true);
      setErrorMessage(null);

      const cleanQuery = query.trim().toLowerCase();
      const cleanClass = selectedClass?.trim().toLowerCase() || '';

      // Helper to match student class accurately
      const isClassMatch = (studentClass?: string) => {
        if (!cleanClass) return true;
        if (!studentClass) return false;
        const sc = studentClass.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const cc = cleanClass.replace(/[^a-z0-9]/g, '');
        return sc === cc || sc.includes(cc) || cc.includes(sc);
      };

      // 1. Try fetching from backend API first (instant, guaranteed multi-device accuracy)
      try {
        const classParam = cleanClass ? `&className=${encodeURIComponent(cleanClass)}` : '';
        const res = await fetch(`/api/result?roll=${encodeURIComponent(cleanQuery)}&admission=${encodeURIComponent(cleanQuery)}${classParam}&t=${Date.now()}`);
        if (res.ok) {
          const resultData: StudentResultData = await res.json();
          if (resultData && resultData.student) {
            if (isClassMatch(resultData.student.className)) {
              const cleanRoll = resultData.student.rollNo.trim();
              const cleanCls = resultData.student.className.trim();
              sessionStorage.setItem(`verified_result_${cleanCls}_${cleanRoll}`, 'true');
              sessionStorage.setItem('active_verified_roll', cleanRoll);
              sessionStorage.setItem('active_verified_class', cleanCls);
              sessionStorage.setItem('active_verified_source', 'public');

              setActiveResult(resultData);
              setResultSource('public');
              setViewMode('result_view');
              setIsLoading(false);

              try {
                const newUrl = `?roll=${encodeURIComponent(cleanRoll)}&class=${encodeURIComponent(cleanCls)}`;
                window.history.replaceState({}, '', newUrl);
              } catch {}
              return true;
            } else {
              setErrorMessage(`कक्षा ${selectedClass} में अनुक्रमांक ${query} नहीं मिला। कृपया सही कक्षा चुनें।`);
              setIsLoading(false);
              return false;
            }
          }
        }
      } catch (e) {
        // Backend not responding or offline
      }

      // 2. Query against live students list (kept updated in real-time by Firebase)
      const matched = students.find((s) => {
        const rollMatch = s.rollNo.trim().toLowerCase() === cleanQuery;
        const admMatch = s.admissionNo.trim().toLowerCase() === cleanQuery;
        const idMatch = s.id.toLowerCase() === cleanQuery;
        if (!rollMatch && !admMatch && !idMatch) return false;
        return isClassMatch(s.className);
      });

      if (matched) {
        const cleanRoll = matched.rollNo.trim();
        const cleanCls = matched.className.trim();
        sessionStorage.setItem(`verified_result_${cleanCls}_${cleanRoll}`, 'true');
        sessionStorage.setItem('active_verified_roll', cleanRoll);
        sessionStorage.setItem('active_verified_class', cleanCls);
        sessionStorage.setItem('active_verified_source', 'public');

        const result = calculateStudentResult(matched, subjects, normalizeSchoolSettings(schoolSettings), gradeRules);
        setActiveResult(result);
        setResultSource('public');
        setViewMode('result_view');
        setIsLoading(false);

        try {
          const newUrl = `?roll=${encodeURIComponent(cleanRoll)}&class=${encodeURIComponent(cleanCls)}`;
          window.history.replaceState({}, '', newUrl);
        } catch {}
        return true;
      } else {
        // Check if student exists in another class to give friendly guidance
        const otherClassStudent = students.find((s) => {
          const rollMatch = s.rollNo.trim().toLowerCase() === cleanQuery;
          const admMatch = s.admissionNo.trim().toLowerCase() === cleanQuery;
          return rollMatch || admMatch;
        });

        if (otherClassStudent && selectedClass) {
          setErrorMessage(`अनुक्रमांक ${query} कक्षा ${otherClassStudent.className} में पंजीकृत है, जबकि आपने कक्षा ${selectedClass} चुनी है। कृपया सही कक्षा चुनें।`);
        } else {
          setErrorMessage('कृपया अपना अनुक्रमांक (Roll No.), कक्षा (Class) अथवा प्रवेश संख्या जांचें।');
        }
        setIsLoading(false);
        return false;
      }
    },
    [students, subjects, schoolSettings, gradeRules]
  );

  const handleSearchRef = useRef(handleSearch);
  handleSearchRef.current = handleSearch;

  // Address Bar URL Routing & History synchronization
  // Security Mandate:
  // - Roll number and class appear in the URL (e.g. ?roll=17&class=8th).
  // - On page refresh (F5), if this browser session has verified this student,
  //   the marksheet stays displayed and DOES NOT disappear or get cut off!
  // - Direct URL entry from a fresh/unverified browser is strictly blocked to protect student privacy!
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const roll = params.get('roll')?.trim();
      const classParam = params.get('class')?.trim();
      const admission = params.get('admission')?.trim();
      const id = params.get('id')?.trim();
      const queryTerm = roll || admission || id;

      const isAdminRoute =
        path.endsWith('/admin') ||
        path.endsWith('/admin/') ||
        path.includes('/admin') ||
        hash.includes('admin') ||
        viewParam === 'admin' ||
        params.has('admin') ||
        search.includes('admin');

      if (isAdminRoute) {
        if (path.includes('/admin')) {
          try {
            window.history.replaceState({}, '', '/?admin');
          } catch {}
        }
        setViewMode('admin');
        const isAuth =
          sessionStorage.getItem('school_admin_auth') === 'true' ||
          localStorage.getItem('school_admin_auth') === 'true';
        if (!isAuth) {
          setShowAdminLoginModal(true);
        } else {
          setIsAdminAuthenticated(true);
          setShowAdminLoginModal(false);
        }
      } else if (queryTerm) {
        // Check if verified in this browser session
        const isVerified =
          (classParam && roll && sessionStorage.getItem(`verified_result_${classParam}_${roll}`) === 'true') ||
          (queryTerm && sessionStorage.getItem('active_verified_roll') === queryTerm) ||
          sessionStorage.getItem('school_admin_auth') === 'true' ||
          localStorage.getItem('school_admin_auth') === 'true';

        if (isVerified) {
          // Permitted on refresh! Re-render marksheet without disappearing or cutting off
          const cleanClass = classParam ? classParam.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
          const target = studentsRef.current.find((s) => {
            const rollMatch = s.rollNo.trim().toLowerCase() === queryTerm.toLowerCase();
            const admMatch = s.admissionNo.trim().toLowerCase() === queryTerm.toLowerCase();
            const idMatch = s.id.toLowerCase() === queryTerm.toLowerCase();
            if (!rollMatch && !admMatch && !idMatch) return false;
            if (!cleanClass) return true;
            const sc = s.className.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            return sc === cleanClass || sc.includes(cleanClass) || cleanClass.includes(sc);
          });

          if (target) {
            const res = calculateStudentResult(
              target,
              subjectsRef.current,
              normalizeSchoolSettings(schoolSettingsRef.current),
              gradeRulesRef.current
            );
            setActiveResult(res);
            setResultSource(sessionStorage.getItem('active_verified_source') === 'admin' ? 'admin' : 'public');
            setViewMode('result_view');
            setShowAdminLoginModal(false);
            return;
          }

          // If not in local ref yet, try retrieving from backend API asynchronously
          const classParamQuery = classParam ? `&className=${encodeURIComponent(classParam)}` : '';
          fetch(`/api/result?roll=${encodeURIComponent(queryTerm)}&admission=${encodeURIComponent(queryTerm)}${classParamQuery}&t=${Date.now()}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((resData) => {
              if (resData && resData.student) {
                setActiveResult(resData);
                setResultSource(sessionStorage.getItem('active_verified_source') === 'admin' ? 'admin' : 'public');
                setViewMode('result_view');
                setShowAdminLoginModal(false);
              } else {
                setViewMode('public_search');
              }
            })
            .catch(() => {
              setViewMode('public_search');
            });
          return;
        }

        // Not verified (Direct address bar entry attempt) -> Enforce security!
        setViewMode('public_search');
        setShowAdminLoginModal(false);
        setErrorMessage('सुरक्षा कारणों से सीधे यूआरएल (Direct URL) द्वारा अंकपत्र देखना प्रतिबंधित है। कृपया नीचे अपना अनुक्रमांक (Roll No.), कक्षा व कैप्चा दर्ज करके परिणाम देखें।');
        try {
          window.history.replaceState({}, '', window.location.pathname);
        } catch {}
      } else {
        // Normal public search view
        setViewMode('public_search');
        setShowAdminLoginModal(false);
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Back to search
  const handleBackToSearch = () => {
    setIsAdminAuthenticated(false);
    setViewMode('public_search');
    setActiveResult(null);
    setResultSource('public');
    setErrorMessage(null);
    setShowAdminLoginModal(false);
    try {
      window.history.pushState({}, '', '/');
    } catch {
      window.location.hash = '';
    }
  };

  // Back to Admin from Marksheet
  const handleBackToAdmin = () => {
    setViewMode('admin');
    setActiveResult(null);
    try {
      window.history.replaceState({}, '', '/?admin');
    } catch {}
  };

  // View specific student result from Admin
  const handleViewStudentResult = (studentId: string) => {
    const st = students.find((s) => s.id === studentId);
    if (st) {
      sessionStorage.setItem(`verified_result_${st.className}_${st.rollNo}`, 'true');
      sessionStorage.setItem('active_verified_roll', st.rollNo);
      sessionStorage.setItem('active_verified_class', st.className);
      sessionStorage.setItem('active_verified_source', 'admin');
      const res = calculateStudentResult(st, subjects, schoolSettings, gradeRules);
      setActiveResult(res);
      setResultSource('admin');
      setViewMode('result_view');
      try {
        const newUrl = `?roll=${encodeURIComponent(st.rollNo)}&class=${encodeURIComponent(st.className)}`;
        window.history.replaceState({}, '', newUrl);
      } catch {}
    }
  };

  // Admin access gatekeeper (Navigates cleanly to /?admin)
  // Strict rule: EVERY visit to Admin Panel demands ID & Password. Never auto-login.
  const handleOpenAdmin = () => {
    try {
      window.history.pushState({}, '', '/?admin');
    } catch {
      window.location.hash = '#admin';
    }
    setViewMode('admin');
    setIsAdminAuthenticated(false);
    setShowAdminLoginModal(true);
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setShowAdminLoginModal(false);
    setViewMode('admin');
    try {
      window.history.pushState({}, '', '/?admin');
    } catch {
      window.location.hash = '#admin';
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('school_admin_auth');
    sessionStorage.removeItem('school_admin_user');
    setViewMode('public_search');
    setShowAdminLoginModal(false);
    try {
      window.history.pushState({}, '', '/');
    } catch {
      window.location.hash = '';
    }
  };

  // Jump from ResultViewer to Admin Marks
  const handleOpenAdminMarks = (studentId: string) => {
    setSelectedStudentForAdminMarks(studentId);
    try {
      window.history.pushState({}, '', '/?admin');
    } catch {
      window.location.hash = '#admin';
    }
    setViewMode('admin');
    if (!isAdminAuthenticated) {
      setShowAdminLoginModal(true);
    }
  };

  // Save Handlers (Online Express API and Firebase Realtime Database - NO localStorage)
  const handleSaveStudents = async (newStudents: Student[]) => {
    lastLocalMutationTimeRef.current = Date.now();
    const formatted = sortStudentsByRoll(newStudents.map((s) => ({
      ...s,
      dob: formatDisplayDate(s.dob),
      mobile: s.mobile ? String(s.mobile).trim() : '',
      address: s.address ? String(s.address).trim() : '',
      aadharNo: s.aadharNo ? String(s.aadharNo).trim() : '',
    })));
    setStudents(formatted);
    setOnlineSyncStatus({
      isSaving: true,
      message: 'ऑनलाइन सर्वर व डेटाबेस में सुरक्षित हो रहा है...',
      lastSyncTime: onlineSyncStatus.lastSyncTime,
      type: 'saving',
    });

    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolSettings: schoolSettingsRef.current,
          students: formatted,
          subjects: subjectsRef.current,
          gradeRules: gradeRulesRef.current,
          deletedStudents: deletedStudentsRef.current,
          clearedMarksHistory: clearedMarksHistoryRef.current,
        }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.store?.students) {
          setStudents(sortStudentsByRoll(json.store.students.map(normalizeStudentRecord)));
        }
      }
      setOnlineSyncStatus({
        isSaving: false,
        message: '✓ ऑनलाइन सर्वर पर सफलतापूर्वक सुरक्षित हो गया! (सभी उपयोगकर्ताओं को तुरंत दिखेगा)',
        lastSyncTime: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'success',
      });
      setTimeout(() => {
        setOnlineSyncStatus((prev) => ({ ...prev, message: null }));
      }, 5000);
    } catch (e) {
      setOnlineSyncStatus({
        isSaving: false,
        message: '⚠️ ऑनलाइन सेव करने में समस्या, पुनः प्रयास करें',
        lastSyncTime: onlineSyncStatus.lastSyncTime,
        type: 'error',
      });
    }

    // Persist directly to Firebase Realtime Database
    saveAllStudentsToFirebase(formatted).catch((err) => {
      console.warn('[Firebase RTDB] Error saving students to Firebase:', err);
    });
  };

  // Move single student to Recycle Bin (Trash)
  const handleDeleteStudent = async (studentId: string) => {
    lastLocalMutationTimeRef.current = Date.now();
    const target = students.find((s) => s.id === studentId);
    if (!target) return;

    const remaining = students.filter((s) => s.id !== studentId);
    const updatedTrash = [
      { ...target, deletedAt: new Date().toISOString() },
      ...deletedStudents.filter((s) => s.id !== studentId),
    ];

    setStudents(remaining);
    setDeletedStudents(updatedTrash);
    setOnlineSyncStatus({
      isSaving: true,
      message: 'ऑनलाइन डेटाबेस से छात्र हटाया जा रहा है...',
      lastSyncTime: onlineSyncStatus.lastSyncTime,
      type: 'saving',
    });

    try {
      await fetch(`/api/admin/student/${encodeURIComponent(studentId)}`, { method: 'DELETE' });
      setOnlineSyncStatus({
        isSaving: false,
        message: `✓ छात्र "${target.name}" ऑनलाइन डेटाबेस से हटाकर रीसायकल बिन में सुरक्षित कर दिया गया!`,
        lastSyncTime: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'success',
      });
      setTimeout(() => {
        setOnlineSyncStatus((prev) => ({ ...prev, message: null }));
      }, 5000);
    } catch {}

    moveStudentToTrashInFirebase(target).catch(console.warn);
  };

  // Move multiple students to Recycle Bin (Trash) in batch
  const handleBatchDeleteStudents = async (studentIds: string[]) => {
    if (!studentIds || studentIds.length === 0) return;
    lastLocalMutationTimeRef.current = Date.now();
    const targetIds = new Set(studentIds);
    const targets = students.filter((s) => targetIds.has(s.id));
    const remaining = students.filter((s) => !targetIds.has(s.id));

    const now = new Date().toISOString();
    const newTrashItems = targets.map((s) => ({ ...s, deletedAt: now }));
    const updatedTrash = [...newTrashItems, ...deletedStudents.filter((s) => !targetIds.has(s.id))];

    setStudents(remaining);
    setDeletedStudents(updatedTrash);
    setOnlineSyncStatus({
      isSaving: true,
      message: `${studentIds.length} छात्र ऑनलाइन रीसायकल बिन में भेजे जा रहे हैं...`,
      lastSyncTime: onlineSyncStatus.lastSyncTime,
      type: 'saving',
    });

    try {
      await fetch('/api/admin/student/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: studentIds }),
      });
      setOnlineSyncStatus({
        isSaving: false,
        message: `✓ ${studentIds.length} छात्र ऑनलाइन रीसायकल बिन में सफलतापूर्वक भेज दिए गए!`,
        lastSyncTime: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'success',
      });
      setTimeout(() => {
        setOnlineSyncStatus((prev) => ({ ...prev, message: null }));
      }, 5000);
    } catch {}

    moveBatchStudentsToTrashInFirebase(targets).catch(console.warn);
  };

  // Restore 1 student from Recycle Bin back to active list
  const handleRestoreStudent = async (studentId: string) => {
    lastLocalMutationTimeRef.current = Date.now();
    const target = deletedStudents.find((s) => s.id === studentId);
    if (!target) return;

    const { deletedAt, ...restored } = target;
    const remainingTrash = deletedStudents.filter((s) => s.id !== studentId);
    const updatedStudents = sortStudentsByRoll([...students.filter((s) => s.id !== studentId), restored]);

    setStudents(updatedStudents);
    setDeletedStudents(remainingTrash);

    try {
      await fetch(`/api/admin/trash/restore/${encodeURIComponent(studentId)}`, { method: 'POST' });
    } catch {}

    restoreStudentFromTrashInFirebase(target).catch(console.warn);
  };

  // Restore all students from Recycle Bin
  const handleRestoreAllStudents = async () => {
    if (deletedStudents.length === 0) return;
    lastLocalMutationTimeRef.current = Date.now();
    const restoredList = deletedStudents.map((s) => {
      const { deletedAt, ...rest } = s;
      return rest;
    });
    const updatedStudents = sortStudentsByRoll([...students, ...restoredList]);

    setStudents(updatedStudents);
    setDeletedStudents([]);

    try {
      await fetch('/api/admin/trash/restore-all', { method: 'POST' });
    } catch {}

    restoreAllStudentsFromTrashInFirebase(deletedStudents).catch(console.warn);
  };

  // Permanently delete student from Trash
  const handlePermanentlyDeleteStudent = (studentId: string) => {
    const remainingTrash = deletedStudents.filter((s) => s.id !== studentId);
    setDeletedStudents(remainingTrash);

    permanentlyDeleteStudentFromTrashInFirebase(studentId).catch(console.warn);
    fetch(`/api/admin/trash/${encodeURIComponent(studentId)}`, { method: 'DELETE' }).catch(() => {});
  };

  // Empty entire Recycle Bin
  const handleEmptyTrash = () => {
    setDeletedStudents([]);

    emptyTrashInFirebase().catch(console.warn);
    fetch('/api/admin/trash', { method: 'DELETE' }).catch(() => {});
  };

  // Cleared Marks Backups (Recycle Bin for Marks)
  const handleCreateClearedMarksBackup = (backup: ClearedMarksBackup) => {
    lastLocalMutationTimeRef.current = Date.now();
    setClearedMarksHistory((prev) => {
      const updated = [backup, ...prev.filter((b) => b.id !== backup.id)];
      return updated;
    });
    saveClearedMarksBackupToFirebase(backup).catch(console.warn);
    fetch('/api/admin/cleared-marks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backup),
    }).catch(() => {});
  };

  const handleRestoreClearedMarksBackup = (backupId: string) => {
    lastLocalMutationTimeRef.current = Date.now();
    const targetBackup = clearedMarksHistory.find((b) => b.id === backupId);
    if (!targetBackup) return false;

    // Restore marks from snapshot for each student
    const snapshotMap = new Map(targetBackup.studentsSnapshot.map((s) => [s.studentId, s]));
    const updatedStudents = students.map((std) => {
      const snap: any = snapshotMap.get(std.id);
      if (!snap) return std;

      let mergedMarks = { ...(std.marks || {}) };

      if (targetBackup.clearType === 'subject' && targetBackup.targetSubjectId) {
        // Restore only this specific subject
        if (snap.marks && snap.marks[targetBackup.targetSubjectId]) {
          mergedMarks[targetBackup.targetSubjectId] = snap.marks[targetBackup.targetSubjectId];
        }
      } else if (targetBackup.clearType === 'half_only') {
        // Restore only half-yearly marks
        Object.entries(snap.marks || {}).forEach(([subId, m]: [string, any]) => {
          mergedMarks[subId] = {
            halfObtained: m.halfObtained,
            annualObtained: mergedMarks[subId]?.annualObtained ?? 0,
          };
        });
      } else if (targetBackup.clearType === 'annual_only') {
        // Restore only annual marks
        Object.entries(snap.marks || {}).forEach(([subId, m]: [string, any]) => {
          mergedMarks[subId] = {
            halfObtained: mergedMarks[subId]?.halfObtained ?? 0,
            annualObtained: m.annualObtained,
          };
        });
      } else {
        // Restore entire marks map
        mergedMarks = {
          ...mergedMarks,
          ...(snap.marks || {}),
        };
      }

      return {
        ...std,
        marks: mergedMarks,
        teacherRemark: snap.teacherRemark !== undefined ? snap.teacherRemark : std.teacherRemark,
      };
    });

    handleSaveStudents(updatedStudents);
    return true;
  };

  const handleDeleteClearedMarksBackup = (backupId: string) => {
    const updated = clearedMarksHistory.filter((b) => b.id !== backupId);
    setClearedMarksHistory(updated);
    deleteClearedMarksBackupFromFirebase(backupId).catch(console.warn);
    fetch(`/api/admin/cleared-marks/${encodeURIComponent(backupId)}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleEmptyClearedMarksHistory = () => {
    setClearedMarksHistory([]);
    emptyClearedMarksHistoryInFirebase().catch(console.warn);
    fetch('/api/admin/cleared-marks', { method: 'DELETE' }).catch(() => {});
  };

  const handleSaveSubjects = async (newSubjects: SubjectConfig[]) => {
    lastLocalMutationTimeRef.current = Date.now();
    setSubjects(newSubjects);

    // Initialize marks map for newly added subjects so no student calculations break
    const updatedStudents = students.map((stu) => {
      const updatedMarks = { ...stu.marks };
      let changed = false;
      newSubjects.forEach((subj) => {
        if (!updatedMarks[subj.id]) {
          updatedMarks[subj.id] = { halfObtained: 0, annualObtained: 0 };
          changed = true;
        }
      });
      return changed ? { ...stu, marks: updatedMarks } : stu;
    });
    setStudents(updatedStudents);
    setOnlineSyncStatus({
      isSaving: true,
      message: 'विषय सूची ऑनलाइन डेटाबेस में सुरक्षित हो रही है...',
      lastSyncTime: onlineSyncStatus.lastSyncTime,
      type: 'saving',
    });

    try {
      await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolSettings,
          students: updatedStudents,
          subjects: newSubjects,
          gradeRules,
          deletedStudents,
          clearedMarksHistory,
        }),
      });
      setOnlineSyncStatus({
        isSaving: false,
        message: '✓ विषय सूची ऑनलाइन डेटाबेस में सफलतापूर्वक सुरक्षित हो गई!',
        lastSyncTime: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'success',
      });
      setTimeout(() => {
        setOnlineSyncStatus((prev) => ({ ...prev, message: null }));
      }, 5000);
    } catch {}

    saveSubjectsToFirebase(newSubjects).catch((err) => {
      console.warn('[Firebase RTDB] Error saving subjects to Firebase:', err);
    });
    saveAllStudentsToFirebase(updatedStudents).catch((err) => {
      console.warn('[Firebase RTDB] Error saving updated student marks to Firebase:', err);
    });
  };

  const handleSaveSchoolSettings = async (newSettings: SchoolSettings) => {
    lastLocalMutationTimeRef.current = Date.now();
    const normalized = normalizeSchoolSettings(newSettings);
    setSchoolSettings(normalized);
    setOnlineSyncStatus({
      isSaving: true,
      message: 'स्कूल सेटिंग्स ऑनलाइन डेटाबेस में सुरक्षित हो रही हैं...',
      lastSyncTime: onlineSyncStatus.lastSyncTime,
      type: 'saving',
    });

    try {
      await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolSettings: normalized,
          students,
          subjects,
          gradeRules,
          deletedStudents,
          clearedMarksHistory,
        }),
      });
      setOnlineSyncStatus({
        isSaving: false,
        message: '✓ स्कूल सेटिंग्स ऑनलाइन डेटाबेस में सफलतापूर्वक सुरक्षित हो गईं!',
        lastSyncTime: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'success',
      });
      setTimeout(() => {
        setOnlineSyncStatus((prev) => ({ ...prev, message: null }));
      }, 5000);
    } catch (e) {
      console.warn('Backend save error:', e);
    }

    saveSchoolSettingsToFirebase(normalized).catch((err) => {
      console.warn('[Firebase RTDB] Error saving settings to Firebase:', err);
    });
  };

  const handleSaveGradeRules = (newRules: GradeRule[]) => {
    lastLocalMutationTimeRef.current = Date.now();
    setGradeRules(newRules);
    fetch('/api/admin/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolSettings,
        students,
        subjects,
        gradeRules: newRules,
        deletedStudents,
        clearedMarksHistory,
      }),
    }).catch(() => {});

    saveGradeRulesToFirebase(newRules).catch((err) => {
      console.warn('[Firebase RTDB] Error saving grade rules to Firebase:', err);
    });
  };

  return (
    <div className="w-full min-h-screen bg-slate-100 font-sans">
      {/* 1. Public Search View (Address Bar: /) */}
      {viewMode === 'public_search' && (
        <PublicSearch
          schoolSettings={schoolSettings}
          availableClasses={availableClasses}
          onSearch={handleSearch}
          errorMessage={errorMessage}
          isLoading={isLoading}
          onSwitchToAdmin={handleOpenAdmin}
        />
      )}

      {/* 2. Official Academic Marksheet A4 Viewer */}
      {viewMode === 'result_view' && activeResult && (
        <ResultViewer
          resultData={activeResult}
          openedFromAdmin={resultSource === 'admin'}
          onBackToSearch={handleBackToSearch}
          onBackToAdmin={handleBackToAdmin}
          onOpenAdminMarks={isAdminAuthenticated ? handleOpenAdminMarks : undefined}
        />
      )}

      {/* 3. School Admin Management Console (Address Bar: /admin) */}
      {viewMode === 'admin' && (
        isAdminAuthenticated ? (
          <AdminPanel
            students={students}
            subjects={subjects}
            schoolSettings={schoolSettings}
            gradeRules={gradeRules}
            deletedStudents={deletedStudents}
            onSaveStudents={handleSaveStudents}
            onSaveSubjects={handleSaveSubjects}
            onSaveSchoolSettings={handleSaveSchoolSettings}
            onSaveGradeRules={handleSaveGradeRules}
            onViewStudentResult={handleViewStudentResult}
            onBackToPublic={handleBackToSearch}
            onLogout={handleAdminLogout}
            initialSelectedStudentId={selectedStudentForAdminMarks}
            onDeleteStudent={handleDeleteStudent}
            onBatchDeleteStudents={handleBatchDeleteStudents}
            onRestoreStudent={handleRestoreStudent}
            onRestoreAllStudents={handleRestoreAllStudents}
            onPermanentlyDeleteStudent={handlePermanentlyDeleteStudent}
            onEmptyTrash={handleEmptyTrash}
            clearedMarksHistory={clearedMarksHistory}
            onCreateClearedMarksBackup={handleCreateClearedMarksBackup}
            onRestoreClearedMarksBackup={handleRestoreClearedMarksBackup}
            onDeleteClearedMarksBackup={handleDeleteClearedMarksBackup}
            onEmptyClearedMarksHistory={handleEmptyClearedMarksHistory}
          />
        ) : (
          <div className="w-full min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <AdminLoginModal
              isOpen={true}
              onClose={handleBackToSearch}
              onSuccess={handleAdminLoginSuccess}
              onLoginSuccess={handleAdminLoginSuccess}
              schoolName={schoolSettings.schoolName}
              adminUserId={schoolSettings.adminUserId || (typeof localStorage !== 'undefined' ? localStorage.getItem('school_admin_user') || '' : '')}
              adminPassword={schoolSettings.adminPassword || (typeof localStorage !== 'undefined' ? localStorage.getItem('school_admin_pass') || '' : '')}
              adminEmail={schoolSettings.adminEmail || 'kuldeeprai75220@gmail.com'}
            />
          </div>
        )
      )}

      {/* 4. Secure Admin Login Modal (Over public views if triggered directly) */}
      {viewMode !== 'admin' && (
        <AdminLoginModal
          isOpen={showAdminLoginModal}
          onClose={() => setShowAdminLoginModal(false)}
          onSuccess={handleAdminLoginSuccess}
          onLoginSuccess={handleAdminLoginSuccess}
          schoolName={schoolSettings.schoolName}
          adminUserId={schoolSettings.adminUserId || (typeof localStorage !== 'undefined' ? localStorage.getItem('school_admin_user') || '' : '')}
          adminPassword={schoolSettings.adminPassword || (typeof localStorage !== 'undefined' ? localStorage.getItem('school_admin_pass') || '' : '')}
          adminEmail={schoolSettings.adminEmail || 'kuldeeprai75220@gmail.com'}
        />
      )}

      {/* Global Real-time Online Sync Toast Notification */}
      {onlineSyncStatus.message && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-xs sm:text-sm font-bold transition-all duration-300 animate-in slide-in-from-bottom-5 max-w-sm ${
            onlineSyncStatus.type === 'saving'
              ? 'bg-blue-950 text-blue-100 border-blue-500/70 shadow-blue-500/20'
              : onlineSyncStatus.type === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-500/70 shadow-rose-500/20'
              : 'bg-emerald-950 text-emerald-100 border-emerald-500/70 shadow-emerald-500/20'
          }`}
        >
          {onlineSyncStatus.type === 'saving' ? (
            <div className="w-4 h-4 border-2 border-blue-400 border-t-white rounded-full animate-spin shrink-0" />
          ) : onlineSyncStatus.type === 'error' ? (
            <span className="text-rose-400 text-base">⚠️</span>
          ) : (
            <span className="text-emerald-400 text-base">✓</span>
          )}
          <div className="min-w-0">
            <p className="leading-tight">{onlineSyncStatus.message}</p>
            {onlineSyncStatus.lastSyncTime && (
              <p className="text-[11px] text-white/70 mt-0.5 font-medium">लाइव ऑनलाइन सिंक: {onlineSyncStatus.lastSyncTime}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
