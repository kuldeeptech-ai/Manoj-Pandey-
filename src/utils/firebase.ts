import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  Database,
  Unsubscribe,
  DataSnapshot,
} from 'firebase/database';
import { Student, SubjectConfig, SchoolSettings, GradeRule } from '../types';

// ============================================================================
// ⚠️ PASTE YOUR FIREBASE CONFIG KEYS HERE:
// ============================================================================
// Replace the placeholder values below with your actual Firebase Project credentials.
// Where to find them:
// 1. Go to Firebase Console: https://console.firebase.google.com/
// 2. Click on your project -> Project Settings (Gear icon) -> General
// 3. Under "Your apps", select your Web app (</>) or click "Add app" -> Web.
// 4. Copy the `firebaseConfig` object and paste its values into the fields below:
// ============================================================================

export const firebaseConfig = {
  // ⬇️ Paste your apiKey here
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "YOUR_API_KEY_HERE",

  // ⬇️ Paste your authDomain here (e.g. "my-school-portal.firebaseapp.com")
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",

  // ⬇️ Paste your databaseURL here (e.g. "https://my-school-portal-default-rtdb.firebaseio.com")
  databaseURL: (import.meta as any).env?.VITE_FIREBASE_DATABASE_URL || "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",

  // ⬇️ Paste your projectId here
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",

  // ⬇️ Paste your storageBucket here
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",

  // ⬇️ Paste your messagingSenderId here
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",

  // ⬇️ Paste your appId here
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
};

// ============================================================================
// INITIALIZE FIREBASE APP & REALTIME DATABASE (v9 Modular Approach)
// ============================================================================

let appInstance: FirebaseApp | null = null;
let dbInstance: Database | null = null;

export function isFirebaseConfigured(): boolean {
  return (
    Boolean(firebaseConfig.databaseURL) &&
    !firebaseConfig.databaseURL.includes('YOUR_PROJECT_ID') &&
    firebaseConfig.databaseURL.startsWith('https://')
  );
}

export function getFirebaseApp(): FirebaseApp | null {
  try {
    if (!appInstance) {
      const existing = getApps();
      if (existing.length > 0) {
        appInstance = existing[0];
      } else {
        appInstance = initializeApp(firebaseConfig);
      }
    }
    return appInstance;
  } catch (err) {
    console.warn('[Firebase RTDB] Failed to initialize Firebase App:', err);
    return null;
  }
}

export function getFirebaseDb(): Database | null {
  try {
    if (!dbInstance) {
      const app = getFirebaseApp();
      if (app) {
        dbInstance = getDatabase(app);
      }
    }
    return dbInstance;
  } catch (err) {
    console.warn('[Firebase RTDB] Failed to get Realtime Database instance:', err);
    return null;
  }
}

// Export database reference directly
export const db = getFirebaseDb();

// ============================================================================
// CRUCIAL REAL-TIME LISTENER: school_settings/toggles node
// Whenever an admin changes a toggle (e.g. hide PDF button or Half-Yearly marks),
// this listener triggers instantly on all open marksheets without page refresh!
// ============================================================================

export function subscribeToSchoolSettingsToggles(
  onToggleUpdate: (toggles: Record<string, boolean>) => void
): Unsubscribe {
  const database = getFirebaseDb();
  if (!database) {
    return () => {};
  }

  try {
    const togglesRef = ref(database, 'school_settings/toggles');
    const unsubscribe = onValue(
      togglesRef,
      (snapshot: DataSnapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            console.log('[Firebase RTDB] Real-time toggle update received:', val);
            onToggleUpdate(val);
          }
        }
      },
      (error) => {
        console.warn('[Firebase RTDB] Toggles onValue listener error:', error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[Firebase RTDB] Could not attach toggles onValue listener:', err);
    return () => {};
  }
}

// ============================================================================
// REAL-TIME LISTENER: Full Database / School Data
// ============================================================================

export function subscribeToFirebaseData(callbacks: {
  onSettings?: (settings: Partial<SchoolSettings>) => void;
  onStudents?: (students: Student[]) => void;
  onSubjects?: (subjects: SubjectConfig[]) => void;
  onGradeRules?: (rules: GradeRule[]) => void;
}): () => void {
  const database = getFirebaseDb();
  if (!database) return () => {};

  const unsubscribers: Unsubscribe[] = [];

  try {
    // 1. Listen to school_settings node
    if (callbacks.onSettings) {
      const settingsRef = ref(database, 'school_settings');
      const unsub = onValue(
        settingsRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.val();
            if (data && typeof data === 'object') {
              callbacks.onSettings?.(data);
            }
          }
        },
        (err) => console.warn('[Firebase RTDB] settings listener error:', err)
      );
      unsubscribers.push(unsub);
    }

    // 2. Listen to students node
    if (callbacks.onStudents) {
      const studentsRef = ref(database, 'students');
      const unsub = onValue(
        studentsRef,
        (snap) => {
          if (snap.exists()) {
            const val = snap.val();
            let studentList: Student[] = [];
            if (Array.isArray(val)) {
              studentList = val.filter(Boolean);
            } else if (val && typeof val === 'object') {
              studentList = Object.values(val);
            }
            if (studentList.length > 0) {
              callbacks.onStudents?.(studentList);
            }
          }
        },
        (err) => console.warn('[Firebase RTDB] students listener error:', err)
      );
      unsubscribers.push(unsub);
    }

    // 3. Listen to subjects node
    if (callbacks.onSubjects) {
      const subjectsRef = ref(database, 'subjects');
      const unsub = onValue(
        subjectsRef,
        (snap) => {
          if (snap.exists()) {
            const val = snap.val();
            let subjectList: SubjectConfig[] = [];
            if (Array.isArray(val)) {
              subjectList = val.filter(Boolean);
            } else if (val && typeof val === 'object') {
              subjectList = Object.values(val);
            }
            if (subjectList.length > 0) {
              callbacks.onSubjects?.(subjectList);
            }
          }
        },
        (err) => console.warn('[Firebase RTDB] subjects listener error:', err)
      );
      unsubscribers.push(unsub);
    }

    // 4. Listen to grade_rules node
    if (callbacks.onGradeRules) {
      const gradeRef = ref(database, 'grade_rules');
      const unsub = onValue(
        gradeRef,
        (snap) => {
          if (snap.exists()) {
            const val = snap.val();
            let rulesList: GradeRule[] = [];
            if (Array.isArray(val)) {
              rulesList = val.filter(Boolean);
            } else if (val && typeof val === 'object') {
              rulesList = Object.values(val);
            }
            if (rulesList.length > 0) {
              callbacks.onGradeRules?.(rulesList);
            }
          }
        },
        (err) => console.warn('[Firebase RTDB] grade_rules listener error:', err)
      );
      unsubscribers.push(unsub);
    }
  } catch (err) {
    console.warn('[Firebase RTDB] Subscription error:', err);
  }

  return () => {
    unsubscribers.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };
}

// ============================================================================
// READ OPERATIONS: get()
// ============================================================================

export async function fetchAllFromFirebase(): Promise<{
  students?: Student[];
  subjects?: SubjectConfig[];
  settings?: SchoolSettings;
  gradeRules?: GradeRule[];
} | null> {
  const database = getFirebaseDb();
  if (!database) return null;

  try {
    const rootRef = ref(database);
    const snap = await get(rootRef);
    if (!snap.exists()) return null;

    const data = snap.val();
    if (!data) return null;

    // Normalize students
    let students: Student[] | undefined;
    if (data.students) {
      if (Array.isArray(data.students)) {
        students = data.students.filter(Boolean);
      } else if (typeof data.students === 'object') {
        students = Object.values(data.students);
      }
    }

    // Normalize subjects
    let subjects: SubjectConfig[] | undefined;
    if (data.subjects) {
      if (Array.isArray(data.subjects)) {
        subjects = data.subjects.filter(Boolean);
      } else if (typeof data.subjects === 'object') {
        subjects = Object.values(data.subjects);
      }
    }

    // Normalize grade rules
    let gradeRules: GradeRule[] | undefined;
    if (data.grade_rules) {
      if (Array.isArray(data.grade_rules)) {
        gradeRules = data.grade_rules.filter(Boolean);
      } else if (typeof data.grade_rules === 'object') {
        gradeRules = Object.values(data.grade_rules);
      }
    }

    return {
      students,
      subjects,
      settings: data.school_settings || undefined,
      gradeRules,
    };
  } catch (err) {
    console.warn('[Firebase RTDB] fetchAllFromFirebase failed:', err);
    return null;
  }
}

// ============================================================================
// CRUD OPERATION: STUDENTS (ref, set, update, remove)
// ============================================================================

/**
 * Add or overwrite single student in Firebase:
 * ref(db, 'students/' + student.id), set(...)
 */
export async function saveStudentToFirebase(student: Student): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    const studentRef = ref(database, `students/${student.id}`);
    await set(studentRef, student);
    console.log(`[Firebase RTDB] Student ${student.id} saved successfully.`);
    return true;
  } catch (err) {
    console.error(`[Firebase RTDB] Error saving student ${student.id}:`, err);
    return false;
  }
}

/**
 * Save / replace entire students list in Firebase Realtime Database
 */
export async function saveAllStudentsToFirebase(students: Student[]): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    const studentsRef = ref(database, 'students');
    // Store as key-value map keyed by student.id for efficient updates
    const studentMap: Record<string, Student> = {};
    students.forEach((s) => {
      studentMap[s.id] = s;
    });
    await set(studentsRef, studentMap);
    console.log(`[Firebase RTDB] All ${students.length} students saved to Firebase.`);
    return true;
  } catch (err) {
    console.error('[Firebase RTDB] Error saving students array to Firebase:', err);
    return false;
  }
}

/**
 * Update student marks and teacher remark in Firebase Realtime Database:
 * ref(db, 'students/' + studentId), update(...)
 */
export async function updateStudentMarksInFirebase(
  studentId: string,
  marks: Record<string, { halfObtained: number; annualObtained: number }>,
  teacherRemark?: string
): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    const studentRef = ref(database, `students/${studentId}`);
    const updates: Record<string, any> = { marks };
    if (teacherRemark !== undefined) {
      updates.teacherRemark = teacherRemark;
    }
    await update(studentRef, updates);
    console.log(`[Firebase RTDB] Marks for student ${studentId} updated.`);
    return true;
  } catch (err) {
    console.error(`[Firebase RTDB] Error updating marks for ${studentId}:`, err);
    return false;
  }
}

/**
 * Delete student record from Firebase Realtime Database:
 * ref(db, 'students/' + studentId), remove(...)
 */
export async function deleteStudentFromFirebase(studentId: string): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    const studentRef = ref(database, `students/${studentId}`);
    await remove(studentRef);
    console.log(`[Firebase RTDB] Student ${studentId} deleted.`);
    return true;
  } catch (err) {
    console.error(`[Firebase RTDB] Error deleting student ${studentId}:`, err);
    return false;
  }
}

// ============================================================================
// CRUD OPERATION: SUBJECTS (ref, set)
// ============================================================================

export async function saveSubjectsToFirebase(subjects: SubjectConfig[]): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    const subjectsRef = ref(database, 'subjects');
    const subjectsMap: Record<string, SubjectConfig> = {};
    subjects.forEach((s) => {
      subjectsMap[s.id] = s;
    });
    await set(subjectsRef, subjectsMap);
    console.log(`[Firebase RTDB] Subjects saved to Firebase.`);
    return true;
  } catch (err) {
    console.error('[Firebase RTDB] Error saving subjects:', err);
    return false;
  }
}

// ============================================================================
// CRUD OPERATION: SCHOOL SETTINGS & TOGGLES (ref, set, update)
// ============================================================================

export async function saveSchoolSettingsToFirebase(settings: SchoolSettings): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    // Extract toggles node so both school_settings and school_settings/toggles are in sync
    const toggles = {
      showHalfYearlyExam: settings.showHalfYearlyExam !== false,
      showAnnualExam: settings.showAnnualExam !== false,
      showTeacherRemarks: settings.showTeacherRemarks !== false,
      showStudentPhoto: settings.showStudentPhoto !== false,
      showSignatures: settings.showSignatures !== false,
      showPercentage: settings.showPercentage !== false,
      showGrade: settings.showGrade !== false,
      showProgressGraph: settings.showProgressGraph !== false,
      showStudentMobile: settings.showStudentMobile !== false,
      showStudentAadhar: settings.showStudentAadhar !== false,
      showPdfButton: settings.showPdfButton !== false,
      showPrintButton: settings.showPrintButton !== false,
      showImageButton: settings.showImageButton !== false,
      allowPublicSearch: settings.allowPublicSearch !== false,
    };

    const payload = {
      ...settings,
      toggles,
    };

    const settingsRef = ref(database, 'school_settings');
    await set(settingsRef, payload);
    console.log('[Firebase RTDB] School settings and toggles saved.');
    return true;
  } catch (err) {
    console.error('[Firebase RTDB] Error saving school settings:', err);
    return false;
  }
}

/**
 * Instantly update a single toggle in school_settings/toggles node:
 * ref(db, 'school_settings/toggles'), update(...)
 * This triggers onValue on all clients in real-time!
 */
export async function updateSchoolToggleInFirebase(
  toggleKey: string,
  value: boolean
): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    const togglesRef = ref(database, 'school_settings/toggles');
    const settingsRef = ref(database, 'school_settings');

    // Update both school_settings/toggles node and the parent school_settings property
    await update(togglesRef, { [toggleKey]: value });
    await update(settingsRef, { [toggleKey]: value });

    console.log(`[Firebase RTDB] Toggle "${toggleKey}" set to ${value} in real-time.`);
    return true;
  } catch (err) {
    console.error(`[Firebase RTDB] Error updating toggle "${toggleKey}":`, err);
    return false;
  }
}

// ============================================================================
// CRUD OPERATION: GRADE RULES (ref, set)
// ============================================================================

export async function saveGradeRulesToFirebase(gradeRules: GradeRule[]): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    const rulesRef = ref(database, 'grade_rules');
    await set(rulesRef, gradeRules);
    console.log('[Firebase RTDB] Grade rules saved.');
    return true;
  } catch (err) {
    console.error('[Firebase RTDB] Error saving grade rules:', err);
    return false;
  }
}

// ============================================================================
// FULL SYNC: Push all data to Firebase Realtime Database
// ============================================================================

export async function syncAllDataToFirebase(payload: {
  schoolSettings: SchoolSettings;
  students: Student[];
  subjects: SubjectConfig[];
  gradeRules: GradeRule[];
}): Promise<{ success: boolean; message: string }> {
  const database = getFirebaseDb();
  if (!database) {
    return {
      success: false,
      message: 'Firebase Realtime Database is not configured. Please paste your Firebase keys.',
    };
  }

  try {
    const studentMap: Record<string, Student> = {};
    payload.students.forEach((s) => {
      studentMap[s.id] = s;
    });

    const subjectMap: Record<string, SubjectConfig> = {};
    payload.subjects.forEach((sub) => {
      subjectMap[sub.id] = sub;
    });

    const toggles = {
      showHalfYearlyExam: payload.schoolSettings.showHalfYearlyExam !== false,
      showAnnualExam: payload.schoolSettings.showAnnualExam !== false,
      showTeacherRemarks: payload.schoolSettings.showTeacherRemarks !== false,
      showStudentPhoto: payload.schoolSettings.showStudentPhoto !== false,
      showSignatures: payload.schoolSettings.showSignatures !== false,
      showPercentage: payload.schoolSettings.showPercentage !== false,
      showGrade: payload.schoolSettings.showGrade !== false,
      showProgressGraph: payload.schoolSettings.showProgressGraph !== false,
      showStudentMobile: payload.schoolSettings.showStudentMobile !== false,
      showStudentAadhar: payload.schoolSettings.showStudentAadhar !== false,
      showPdfButton: payload.schoolSettings.showPdfButton !== false,
      showPrintButton: payload.schoolSettings.showPrintButton !== false,
      showImageButton: payload.schoolSettings.showImageButton !== false,
      allowPublicSearch: payload.schoolSettings.allowPublicSearch !== false,
    };

    const rootUpdates: Record<string, any> = {
      'school_settings': {
        ...payload.schoolSettings,
        toggles,
      },
      'school_settings/toggles': toggles,
      'students': studentMap,
      'subjects': subjectMap,
      'grade_rules': payload.gradeRules,
      'last_synced_at': new Date().toISOString(),
    };

    const rootRef = ref(database);
    await update(rootRef, rootUpdates);

    return {
      success: true,
      message: '✓ All data synchronized to Firebase Realtime Database successfully!',
    };
  } catch (err: any) {
    console.error('[Firebase RTDB] Full sync error:', err);
    return {
      success: false,
      message: `Firebase Sync Error: ${err.message || 'Check database permissions and rules.'}`,
    };
  }
}
