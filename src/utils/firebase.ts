import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  Auth,
  User,
} from 'firebase/auth';
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
// SOLE AUTHORIZED ADMIN EMAIL
// Only this email is allowed to access and manage the Admin Panel
// ============================================================================
export const AUTHORIZED_ADMIN_EMAIL = 'kuldeeprai75220@gmail.com';

export function isAuthorizedAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();
}

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

// ============================================================================
// Your web app's Firebase configuration
// ============================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBM7gmp5C9ve0LVk8mhwh2kLw23QGv0vj0",
  authDomain: "hd-pandey-school-portal.firebaseapp.com",
  databaseURL: "https://hd-pandey-school-portal-default-rtdb.firebaseio.com",
  projectId: "hd-pandey-school-portal",
  storageBucket: "hd-pandey-school-portal.firebasestorage.app",
  messagingSenderId: "743517383647",
  appId: "1:743517383647:web:e48e48f5af62c35110b26a"
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

let authInstance: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  try {
    if (!authInstance) {
      const app = getFirebaseApp();
      if (app) {
        authInstance = getAuth(app);
      }
    }
    return authInstance;
  } catch (err) {
    console.warn('[Firebase Auth] Failed to get Auth instance:', err);
    return null;
  }
}

export const auth = getFirebaseAuth();

/**
 * Recursively removes any `undefined` properties from an object/array,
 * ensuring Firebase Realtime Database never throws:
 * "set failed: value argument contains undefined in property ...".
 */
export function cleanForFirebase<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirebase(item)) as any;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleanObj[key] = cleanForFirebase(value);
    }
  }
  return cleanObj as any;
}

/**
 * Sign in Admin using Google Account Popup via Firebase Auth.
 * STRICT SECURITY: ONLY kuldeeprai75220@gmail.com is allowed.
 * Any other Google account is immediately signed out and blocked.
 */
export async function signInAdminWithGoogle(): Promise<{ success: boolean; email?: string; error?: string }> {
  const authClient = getFirebaseAuth();
  if (!authClient) {
    return { success: false, error: 'Firebase Auth लोड नहीं हो सका। कृपया इंटरनेट जांचें।' };
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(authClient, provider);
    const user = result.user;
    const signedInEmail = user.email ? user.email.trim().toLowerCase() : '';

    if (!isAuthorizedAdmin(signedInEmail)) {
      await signOut(authClient);
      return {
        success: false,
        error: `अनधिकृत Google खाता (${user.email || 'अज्ञात'})! केवल अधिकृत व्यवस्थापक (${AUTHORIZED_ADMIN_EMAIL}) ही एडमिन पोर्टल में प्रवेश कर सकते हैं। अन्य किसी भी ईमेल को अनुमति नहीं है।`,
      };
    }

    // Successfully verified sole admin
    localStorage.setItem('school_admin_email', signedInEmail);
    localStorage.setItem('school_admin_auth_type', 'firebase_google');
    return { success: true, email: signedInEmail };
  } catch (err: any) {
    console.warn('[Firebase Auth] Google Sign-in error:', err);
    if (err.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Google लॉगिन विंडो बंद कर दी गई।' };
    }
    if (err.code === 'auth/unauthorized-domain') {
      return {
        success: false,
        error: `Google लॉगिन डोमेन अधिकृत नहीं है (${window.location.hostname})। आप नीचे अपने ईमेल और पासवर्ड से सीधे 1-क्लिक में लॉगिन कर सकते हैं!`,
      };
    }
    return { success: false, error: err.message || 'Google लॉगिन में त्रुटि हुई।' };
  }
}

/**
 * Send official Password Reset Email via Firebase directly to kuldeeprai75220@gmail.com.
 * Powered directly by Google Firebase transactional mail servers.
 */
export async function sendAdminFirebasePasswordReset(
  emailToReset?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const targetEmail = (emailToReset || AUTHORIZED_ADMIN_EMAIL).trim().toLowerCase();

  if (!isAuthorizedAdmin(targetEmail)) {
    return {
      success: false,
      error: `अनधिकृत ईमेल! केवल अधिकृत व्यवस्थापक (${AUTHORIZED_ADMIN_EMAIL}) का ही पासवर्ड रीसेट किया जा सकता है।`,
    };
  }

  const authClient = getFirebaseAuth();
  if (!authClient) {
    return { success: false, error: 'Firebase Auth लोड नहीं हो सका।' };
  }

  try {
    await sendPasswordResetEmail(authClient, targetEmail);
    return {
      success: true,
      message: `पासवर्ड रीसेट लिंक आधिकारिक रूप से आपके ईमेल (${targetEmail}) पर भेज दिया गया है! कृपया अपना Gmail इनबॉक्स अथवा स्पैम फ़ोल्डर देखें और लिंक पर क्लिक करके नया पासवर्ड सेट करें।`,
    };
  } catch (err: any) {
    console.warn('[Firebase Auth] sendPasswordResetEmail failed:', err);
    if (err.code === 'auth/user-not-found') {
      return {
        success: false,
        error: `Firebase Auth में अभी यह ईमेल (${targetEmail}) सीधे ईमेल-पासवर्ड से पंजीकृत नहीं है। आप Google Sign-in बटन से सीधे 1-क्लिक में लॉगिन कर सकते हैं या नीचे दिए गए मास्टर पासवर्ड से लॉगिन कर सकते हैं।`,
      };
    }
    return {
      success: false,
      error: `Firebase ईमेल भेजने में त्रुटि: ${err.message || 'कृपया नेटवर्क जांचें'}`,
    };
  }
}

/**
 * Sign in Admin with Email & Password via Firebase Auth
 * STRICT SECURITY: ONLY kuldeeprai75220@gmail.com is allowed.
 */
export async function signInAdminWithFirebaseEmailPassword(
  email: string,
  pass: string
): Promise<{ success: boolean; email?: string; error?: string; isNewUserCreated?: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();

  if (!isAuthorizedAdmin(cleanEmail)) {
    return {
      success: false,
      error: `अनधिकृत ईमेल! केवल अधिकृत व्यवस्थापक (${AUTHORIZED_ADMIN_EMAIL}) ही लॉगिन कर सकते हैं। कोई अन्य व्यक्ति एडमिन नहीं बन सकता।`,
    };
  }

  const authClient = getFirebaseAuth();
  if (!authClient) {
    return { success: false, error: 'Firebase Auth लोड नहीं हो सका।' };
  }

  try {
    const userCredential = await signInWithEmailAndPassword(authClient, cleanEmail, cleanPass);
    localStorage.setItem('school_admin_email', cleanEmail);
    localStorage.setItem('school_admin_auth_type', 'firebase_email');
    return { success: true, email: userCredential.user.email || cleanEmail };
  } catch (err: any) {
    // If user is not yet created in Firebase Auth, auto-provision this authorized admin
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const createResult = await createUserWithEmailAndPassword(authClient, cleanEmail, cleanPass);
        localStorage.setItem('school_admin_email', cleanEmail);
        localStorage.setItem('school_admin_auth_type', 'firebase_email');
        return {
          success: true,
          email: createResult.user.email || cleanEmail,
          isNewUserCreated: true,
        };
      } catch (createErr: any) {
        if (createErr.code === 'auth/email-already-in-use') {
          return { success: false, error: 'गलत पासवर्ड! कृपया सही पासवर्ड दर्ज करें अथवा Google से लॉगिन करें।' };
        }
        return { success: false, error: 'गलत पासवर्ड या क्रेडेंशियल! कृपया सही पासवर्ड दर्ज करें।' };
      }
    }
    if (err.code === 'auth/wrong-password') {
      return { success: false, error: 'गलत पासवर्ड! कृपया सही पासवर्ड दर्ज करें।' };
    }
    return { success: false, error: err.message || 'लॉगिन विफल रहा।' };
  }
}

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
              const safeStudents = studentList.map((st: any) => ({
                ...st,
                marks: st.marks && typeof st.marks === 'object' ? st.marks : {},
              }));
              callbacks.onStudents?.(safeStudents);
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
      let rawList: any[] = [];
      if (Array.isArray(data.students)) {
        rawList = data.students.filter(Boolean);
      } else if (typeof data.students === 'object') {
        rawList = Object.values(data.students);
      }
      students = rawList.map((st: any) => ({
        ...st,
        marks: st.marks && typeof st.marks === 'object' ? st.marks : {},
      }));
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
    await set(studentRef, cleanForFirebase(student));
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
    await set(studentsRef, cleanForFirebase(studentMap));
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
    await update(studentRef, cleanForFirebase(updates));
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

/**
 * Move student to Recycle Bin (Trash) in Firebase Realtime Database:
 * 1. Writes to ref(db, `deleted_students/${student.id}`)
 * 2. Removes from ref(db, `students/${student.id}`)
 */
export async function moveStudentToTrashInFirebase(student: Student): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    const studentWithTimestamp = {
      ...student,
      deletedAt: student.deletedAt || new Date().toISOString(),
    };
    const trashRef = ref(database, `deleted_students/${student.id}`);
    const studentRef = ref(database, `students/${student.id}`);

    await set(trashRef, cleanForFirebase(studentWithTimestamp));
    await remove(studentRef);
    console.log(`[Firebase RTDB] Student ${student.id} moved to trash.`);
    return true;
  } catch (err) {
    console.error(`[Firebase RTDB] Error moving student ${student.id} to trash:`, err);
    return false;
  }
}

/**
 * Move multiple students to Recycle Bin (Trash) in batch
 */
export async function moveBatchStudentsToTrashInFirebase(studentsList: Student[]): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database || studentsList.length === 0) return false;

  try {
    const updates: Record<string, any> = {};
    const now = new Date().toISOString();
    for (const st of studentsList) {
      const studentWithTimestamp = {
        ...st,
        deletedAt: st.deletedAt || now,
      };
      updates[`deleted_students/${st.id}`] = cleanForFirebase(studentWithTimestamp);
      updates[`students/${st.id}`] = null;
    }
    await update(ref(database), updates);
    console.log(`[Firebase RTDB] Batch ${studentsList.length} students moved to trash.`);
    return true;
  } catch (err) {
    console.error(`[Firebase RTDB] Error batch moving students to trash:`, err);
    return false;
  }
}

/**
 * Restore student from Recycle Bin back to active students list
 */
export async function restoreStudentFromTrashInFirebase(student: Student): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    const { deletedAt, ...activeStudent } = student;
    const studentRef = ref(database, `students/${student.id}`);
    const trashRef = ref(database, `deleted_students/${student.id}`);

    await set(studentRef, cleanForFirebase(activeStudent));
    await remove(trashRef);
    console.log(`[Firebase RTDB] Student ${student.id} restored from trash.`);
    return true;
  } catch (err) {
    console.error(`[Firebase RTDB] Error restoring student ${student.id}:`, err);
    return false;
  }
}

/**
 * Restore all students from Recycle Bin back to active students list
 */
export async function restoreAllStudentsFromTrashInFirebase(studentsList: Student[]): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database || studentsList.length === 0) return false;

  try {
    const updates: Record<string, any> = {};
    for (const st of studentsList) {
      const { deletedAt, ...activeStudent } = st;
      updates[`students/${st.id}`] = cleanForFirebase(activeStudent);
      updates[`deleted_students/${st.id}`] = null;
    }
    await update(ref(database), updates);
    console.log(`[Firebase RTDB] All ${studentsList.length} students restored from trash.`);
    return true;
  } catch (err) {
    console.error(`[Firebase RTDB] Error restoring all students from trash:`, err);
    return false;
  }
}

/**
 * Permanently delete student from Trash (irreversible)
 */
export async function permanentlyDeleteStudentFromTrashInFirebase(studentId: string): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    const trashRef = ref(database, `deleted_students/${studentId}`);
    await remove(trashRef);
    console.log(`[Firebase RTDB] Student ${studentId} permanently deleted from trash.`);
    return true;
  } catch (err) {
    console.error(`[Firebase RTDB] Error permanently deleting student ${studentId}:`, err);
    return false;
  }
}

/**
 * Empty entire Recycle Bin in Firebase
 */
export async function emptyTrashInFirebase(): Promise<boolean> {
  const database = getFirebaseDb();
  if (!database) return false;

  try {
    const trashRef = ref(database, 'deleted_students');
    await remove(trashRef);
    console.log(`[Firebase RTDB] Trash emptied.`);
    return true;
  } catch (err) {
    console.error(`[Firebase RTDB] Error emptying trash:`, err);
    return false;
  }
}

/**
 * Subscribe to Deleted Students (Recycle Bin) in Realtime Database
 */
export function subscribeToDeletedStudents(callback: (deletedStudents: Student[]) => void): Unsubscribe {
  const database = getFirebaseDb();
  if (!database) return () => {};

  try {
    const trashRef = ref(database, 'deleted_students');
    return onValue(trashRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        let list: Student[] = [];
        if (Array.isArray(val)) {
          list = val.filter(Boolean);
        } else if (typeof val === 'object' && val !== null) {
          list = Object.values(val);
        }
        callback(list);
      } else {
        callback([]);
      }
    });
  } catch (err) {
    console.warn('[Firebase RTDB] Error subscribing to deleted students:', err);
    return () => {};
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
    await set(subjectsRef, cleanForFirebase(subjectsMap));
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
      isMaintenanceMode: Boolean(settings.isMaintenanceMode),
      isResultLive: settings.isResultLive !== false,
    };

    const payload = cleanForFirebase({
      ...settings,
      toggles,
    });

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
    await update(togglesRef, cleanForFirebase({ [toggleKey]: value }));
    await update(settingsRef, cleanForFirebase({ [toggleKey]: value }));

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
    await set(rulesRef, cleanForFirebase(gradeRules));
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
      isMaintenanceMode: Boolean(payload.schoolSettings.isMaintenanceMode),
      isResultLive: payload.schoolSettings.isResultLive !== false,
    };

    const rootUpdates: Record<string, any> = cleanForFirebase({
      'school_settings': {
        ...payload.schoolSettings,
        toggles,
      },
      'students': studentMap,
      'subjects': subjectMap,
      'grade_rules': payload.gradeRules,
      'last_synced_at': new Date().toISOString(),
    });

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
