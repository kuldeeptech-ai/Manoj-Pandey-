import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Student,
  SubjectConfig,
  SchoolSettings,
  GradeRule,
  StudentResultData,
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
} from './utils/calculations';
import { PublicSearch } from './components/PublicSearch';
import { ResultViewer } from './components/ResultViewer';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginModal } from './components/AdminLoginModal';
import {
  isFirebaseConfigured,
  subscribeToSchoolSettingsToggles,
  subscribeToFirebaseData,
  fetchAllFromFirebase,
  saveAllStudentsToFirebase,
  saveSubjectsToFirebase,
  saveSchoolSettingsToFirebase,
  saveGradeRulesToFirebase,
  syncAllDataToFirebase,
} from './utils/firebase';

type ViewMode = 'public_search' | 'result_view' | 'admin';

const getInitialViewMode = (): ViewMode => {
  if (typeof window === 'undefined') return 'public_search';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  if (
    path.endsWith('/admin') ||
    path.endsWith('/admin/') ||
    path.includes('/admin') ||
    hash.includes('admin') ||
    params.get('view') === 'admin' ||
    params.has('admin') ||
    search.includes('admin')
  ) {
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

  // Persistence State
  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem('hd_pandey_students');
      const raw = saved ? JSON.parse(saved) : DEFAULT_STUDENTS;
      return (raw || []).map(normalizeStudentRecord);
    } catch {
      return (DEFAULT_STUDENTS || []).map(normalizeStudentRecord);
    }
  });

  const [subjects, setSubjects] = useState<SubjectConfig[]>(() => {
    const saved = localStorage.getItem('hd_pandey_subjects');
    return saved ? JSON.parse(saved) : DEFAULT_SUBJECTS;
  });

  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(() => {
    const saved = localStorage.getItem('hd_pandey_settings');
    const initial = saved ? JSON.parse(saved) : DEFAULT_SCHOOL_SETTINGS;
    if (!initial.classTeachers || !Array.isArray(initial.classTeachers) || initial.classTeachers.length === 0) {
      initial.classTeachers = DEFAULT_SCHOOL_SETTINGS.classTeachers;
    }
    return initial;
  });

  const [gradeRules, setGradeRules] = useState<GradeRule[]>(() => {
    const saved = localStorage.getItem('hd_pandey_grades');
    return saved ? JSON.parse(saved) : DEFAULT_GRADE_RULES;
  });

  const schoolSettingsRef = useRef(schoolSettings);
  schoolSettingsRef.current = schoolSettings;

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

  // Tracks the timestamp of recent admin mutations (deletions/edits) to prevent polling race conditions
  const lastLocalMutationTimeRef = useRef<number>(0);

  // Sync with backend API and Google Sheet on initial mount & periodic refresh
  const syncCloudData = useCallback(async () => {
    // If local changes were made in the last 10 seconds, pause background polling to prevent race condition
    if (Date.now() - lastLocalMutationTimeRef.current < 10000) {
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
            setSchoolSettings((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(norm)) {
                localStorage.setItem('hd_pandey_settings', JSON.stringify(norm));
                return norm;
              }
              return prev;
            });
          }
          if (Array.isArray(data.students)) {
            const normalizedStudents = data.students.map(normalizeStudentRecord);
            setStudents((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(normalizedStudents)) {
                localStorage.setItem('hd_pandey_students', JSON.stringify(normalizedStudents));
                return normalizedStudents;
              }
              return prev;
            });
          }
          if (Array.isArray(data.subjects) && data.subjects.length > 0) {
            setSubjects((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(data.subjects)) {
                localStorage.setItem('hd_pandey_subjects', JSON.stringify(data.subjects));
                return data.subjects;
              }
              return prev;
            });
          }
          if (Array.isArray(data.gradeRules) && data.gradeRules.length > 0) {
            setGradeRules((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(data.gradeRules)) {
                localStorage.setItem('hd_pandey_grades', JSON.stringify(data.gradeRules));
                return data.gradeRules;
              }
              return prev;
            });
          }
          backendSuccess = true;
        }
      }
    } catch (e) {
      // Backend not accessible
    }

    // 2. Fetch initial dataset from Firebase Realtime Database
    try {
      const fbData = await fetchAllFromFirebase();
      if (fbData) {
        if (fbData.students && fbData.students.length > 0) {
          const normalizedStudents = fbData.students.map(normalizeStudentRecord);
          setStudents((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(normalizedStudents)) {
              localStorage.setItem('hd_pandey_students', JSON.stringify(normalizedStudents));
              return normalizedStudents;
            }
            return prev;
          });
        }
        if (fbData.subjects && fbData.subjects.length > 0) {
          setSubjects((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(fbData.subjects)) {
              localStorage.setItem('hd_pandey_subjects', JSON.stringify(fbData.subjects));
              return fbData.subjects;
            }
            return prev;
          });
        }
        if (fbData.settings) {
          const norm = normalizeSchoolSettings({ ...currentSettings, ...fbData.settings });
          setSchoolSettings((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(norm)) {
              localStorage.setItem('hd_pandey_settings', JSON.stringify(norm));
              return norm;
            }
            return prev;
          });
        }
        if (fbData.gradeRules && fbData.gradeRules.length > 0) {
          setGradeRules((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(fbData.gradeRules)) {
              localStorage.setItem('hd_pandey_grades', JSON.stringify(fbData.gradeRules));
              return fbData.gradeRules;
            }
            return prev;
          });
        }
      }
    } catch (e) {
      // Firebase fallback notice
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
        localStorage.setItem('hd_pandey_settings', JSON.stringify(merged));
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
          const norm = normalizeSchoolSettings({ ...prev, ...newSettings });
          localStorage.setItem('hd_pandey_settings', JSON.stringify(norm));
          return norm;
        });
      },
      onStudents: (newStudents) => {
        const formatted = newStudents.map(normalizeStudentRecord);
        setStudents(formatted);
        localStorage.setItem('hd_pandey_students', JSON.stringify(formatted));
      },
      onSubjects: (newSubjects) => {
        setSubjects(newSubjects);
        localStorage.setItem('hd_pandey_subjects', JSON.stringify(newSubjects));
      },
      onGradeRules: (newRules) => {
        setGradeRules(newRules);
        localStorage.setItem('hd_pandey_grades', JSON.stringify(newRules));
      },
    });

    return () => {
      unsubToggles();
      unsubAll();
    };
  }, []);

  useEffect(() => {
    syncCloudData();
    // 4-second multi-device sync cycle for instant changes
    const timer = setInterval(() => {
      syncCloudData();
    }, 4000);

    const handleFocus = () => syncCloudData();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'hd_pandey_settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSchoolSettings(normalizeSchoolSettings(parsed));
        } catch {}
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [syncCloudData]);

  // Save to localStorage whenever states change
  useEffect(() => {
    localStorage.setItem('hd_pandey_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('hd_pandey_subjects', JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem('hd_pandey_settings', JSON.stringify(schoolSettings));
  }, [schoolSettings]);

  useEffect(() => {
    localStorage.setItem('hd_pandey_grades', JSON.stringify(gradeRules));
  }, [gradeRules]);

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
              setActiveResult(resultData);
              setResultSource('public');
              setViewMode('result_view');
              setIsLoading(false);
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
        const result = calculateStudentResult(matched, subjects, normalizeSchoolSettings(schoolSettings), gradeRules);
        setActiveResult(result);
        setResultSource('public');
        setViewMode('result_view');
        setIsLoading(false);
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
  // Security Mandate: Direct URL result bypass is strictly disabled.
  // Address bar (?roll=...) will NOT automatically open marksheet.
  // The user MUST enter Class, Roll No., and Captcha on the home page form.
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const roll = params.get('roll');
      const admission = params.get('admission');
      const id = params.get('id');

      const isAdminRoute =
        path.endsWith('/admin') ||
        path.endsWith('/admin/') ||
        path.includes('/admin') ||
        hash.includes('admin') ||
        viewParam === 'admin' ||
        params.has('admin') ||
        search.includes('admin');

      if (isAdminRoute) {
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
      } else {
        // Always enforce Public Search view on home page with 3 options: Class, Roll, Captcha
        setViewMode('public_search');
        setShowAdminLoginModal(false);
        // Clear any direct roll or admission query parameters from the address bar
        if (roll || admission || id) {
          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch {}
        }
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
      window.history.pushState({}, '', '/admin');
    } catch {}
  };

  // View specific student result from Admin
  const handleViewStudentResult = (studentId: string) => {
    const st = students.find((s) => s.id === studentId);
    if (st) {
      const res = calculateStudentResult(st, subjects, schoolSettings, gradeRules);
      setActiveResult(res);
      setResultSource('admin');
      setViewMode('result_view');
    }
  };

  // Admin access gatekeeper (Navigates to /admin)
  // Strict rule: EVERY visit to Admin Panel demands ID & Password. Never auto-login.
  const handleOpenAdmin = () => {
    try {
      window.history.pushState({}, '', '/admin');
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
      window.history.pushState({}, '', '/admin');
    } catch {
      window.location.hash = '#admin';
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('school_admin_auth');
    sessionStorage.removeItem('school_admin_user');
    localStorage.removeItem('school_admin_auth');
    localStorage.removeItem('school_admin_user');
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
      window.history.pushState({}, '', '/admin');
    } catch {
      window.location.hash = '#admin';
    }
    setViewMode('admin');
    if (!isAdminAuthenticated) {
      setShowAdminLoginModal(true);
    }
  };

  // Save Handlers (Local state, LocalStorage, Express API, and Firebase Realtime Database)
  const handleSaveStudents = async (newStudents: Student[]) => {
    lastLocalMutationTimeRef.current = Date.now();
    const formatted = newStudents.map((s) => ({
      ...s,
      dob: formatDisplayDate(s.dob),
      mobile: s.mobile ? String(s.mobile).trim() : '',
      aadharNo: s.aadharNo ? String(s.aadharNo).trim() : '',
    }));
    setStudents(formatted);
    localStorage.setItem('hd_pandey_students', JSON.stringify(formatted));
    try {
      await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolSettings,
          students: formatted,
          subjects,
          gradeRules,
        }),
      });
    } catch {}

    // Firebase Realtime Database: ref(db, 'students'), set(...)
    saveAllStudentsToFirebase(formatted).catch((err) => {
      console.warn('[Firebase RTDB] Error saving students to Firebase:', err);
    });
  };

  const handleSaveSubjects = async (newSubjects: SubjectConfig[]) => {
    lastLocalMutationTimeRef.current = Date.now();
    setSubjects(newSubjects);
    localStorage.setItem('hd_pandey_subjects', JSON.stringify(newSubjects));

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
    localStorage.setItem('hd_pandey_students', JSON.stringify(updatedStudents));

    try {
      await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolSettings,
          students: updatedStudents,
          subjects: newSubjects,
          gradeRules,
        }),
      });
    } catch {}

    // Firebase Realtime Database: ref(db, 'subjects'), set(...)
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
    localStorage.setItem('hd_pandey_settings', JSON.stringify(normalized));

    try {
      await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolSettings: normalized,
          students,
          subjects,
          gradeRules,
        }),
      });
    } catch (e) {
      console.warn('Backend save error:', e);
    }

    // Firebase Realtime Database: ref(db, 'school_settings'), set(...)
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
      }),
    }).catch(() => {});

    // Firebase Realtime Database: ref(db, 'grade_rules'), set(...)
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
            onSaveStudents={handleSaveStudents}
            onSaveSubjects={handleSaveSubjects}
            onSaveSchoolSettings={handleSaveSchoolSettings}
            onSaveGradeRules={handleSaveGradeRules}
            onViewStudentResult={handleViewStudentResult}
            onBackToPublic={handleBackToSearch}
            onLogout={handleAdminLogout}
            initialSelectedStudentId={selectedStudentForAdminMarks}
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
    </div>
  );
}
