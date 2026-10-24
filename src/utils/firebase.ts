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
  getFirestore,
  Firestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import {
  Student,
  SubjectConfig,
  SchoolSettings,
  GradeRule,
  ClearedMarksBackup,
  StaffUser,
} from '../types';
import firebaseAppletConfig from '../../firebase-applet-config.json';

// ============================================================================
// SOLE AUTHORIZED ADMIN EMAIL
// Only this email is allowed to access and manage the Admin Panel
// ============================================================================
export const AUTHORIZED_ADMIN_EMAIL = 'kuldeeprai75220@gmail.com';

export function isAuthorizedAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();
}

// Active Firebase configuration provisioned for this application
export const firebaseConfig = firebaseAppletConfig;

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;

try {
  if (typeof window !== 'undefined' || typeof process !== 'undefined') {
    appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    firestoreInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);
    authInstance = getAuth(appInstance);
  }
} catch (err) {
  console.warn('[Firebase] Initialization error:', err);
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
}

export function getFirebaseApp(): FirebaseApp | null {
  return appInstance;
}

export function getFirebaseFirestore(): Firestore | null {
  return firestoreInstance;
}

export const db = firestoreInstance as Firestore;

export function getFirebaseAuth(): Auth | null {
  return authInstance;
}

export const auth = authInstance as Auth;

// Test connection on boot as mandated by the Firebase skill
if (typeof window !== 'undefined' && firestoreInstance) {
  (async () => {
    try {
      await getDocFromServer(doc(firestoreInstance, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firebase connection check: client is offline.');
      }
    }
  })();
}

// Standard Firestore error handler per skill requirements
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentAuth = getFirebaseAuth();
  const user = currentAuth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
      providerInfo:
        user?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Error: ', JSON.stringify(errInfo));
}

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

// ============================================================================
// AUTHENTICATION
// ============================================================================

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
        error: `अनधिकृत Google खाता (${user.email || 'अज्ञात'})! केवल अधिकृत व्यवस्थापक (${AUTHORIZED_ADMIN_EMAIL}) ही प्रवेश कर सकते हैं।`,
      };
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('school_admin_email', signedInEmail);
      localStorage.setItem('school_admin_auth_type', 'firebase_google');
    }
    return { success: true, email: signedInEmail };
  } catch (err: any) {
    console.warn('[Firebase Auth] Google Sign-in error:', err);
    if (err.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Google लॉगिन विंडो बंद कर दी गई।' };
    }
    return { success: false, error: err.message || 'Google लॉगिन में त्रुटि हुई।' };
  }
}

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
      message: `पासवर्ड रीसेट लिंक आधिकारिक रूप से आपके ईमेल (${targetEmail}) पर भेज दिया गया है!`,
    };
  } catch (err: any) {
    console.warn('[Firebase Auth] sendPasswordResetEmail failed:', err);
    return {
      success: false,
      error: `Firebase ईमेल भेजने में त्रुटि: ${err.message || 'नेटवर्क जांचें'}`,
    };
  }
}

export async function signInAdminWithFirebaseEmailPassword(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const targetEmail = email.trim().toLowerCase();
  const authClient = getFirebaseAuth();

  if (!authClient) {
    return { success: false, error: 'Firebase Auth लोड नहीं हो सका।' };
  }

  if (!isAuthorizedAdmin(targetEmail)) {
    return {
      success: false,
      error: `अनधिकृत ईमेल! केवल अधिकृत व्यवस्थापक (${AUTHORIZED_ADMIN_EMAIL}) ही लॉगिन कर सकते हैं।`,
    };
  }

  try {
    const cred = await signInWithEmailAndPassword(authClient, targetEmail, pass);
    return { success: true, user: cred.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'ईमेल या पासवर्ड अमान्य है।' };
  }
}

// ============================================================================
// CRUD & REAL-TIME: STUDENTS
// ============================================================================

export async function saveStudentToFirebase(student: Student): Promise<boolean> {
  if (!firestoreInstance || !student?.id) return false;
  try {
    const ref = doc(firestoreInstance, 'students', student.id);
    await setDoc(ref, cleanForFirebase(student), { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `students/${student.id}`);
    return false;
  }
}

export async function saveAllStudentsToFirebase(students: Student[]): Promise<boolean> {
  if (!firestoreInstance || !Array.isArray(students)) return false;
  try {
    if (students.length === 0) {
      const snap = await getDocs(collection(firestoreInstance, 'students'));
      if (!snap.empty) {
        const batch = writeBatch(firestoreInstance);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      return true;
    }
    // Firestore batch limit is 500 documents per batch
    const chunkSize = 400;
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      const batch = writeBatch(firestoreInstance);
      for (const st of chunk) {
        if (st && st.id) {
          const ref = doc(firestoreInstance, 'students', st.id);
          batch.set(ref, cleanForFirebase(st), { merge: true });
        }
      }
      await batch.commit();
    }
    console.log(`[Firestore] Successfully saved ${students.length} students to cloud.`);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'students');
    return false;
  }
}

export async function clearAllStudentsInFirebase(): Promise<boolean> {
  if (!firestoreInstance) return false;
  try {
    const snap = await getDocs(collection(firestoreInstance, 'students'));
    if (!snap.empty) {
      const batch = writeBatch(firestoreInstance);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    const trashSnap = await getDocs(collection(firestoreInstance, 'deleted_students'));
    if (!trashSnap.empty) {
      const batchTrash = writeBatch(firestoreInstance);
      trashSnap.forEach((d) => batchTrash.delete(d.ref));
      await batchTrash.commit();
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'students/clear-all');
    return false;
  }
}

export async function updateStudentMarksInFirebase(
  studentId: string,
  marks: Record<string, { halfObtained: number; annualObtained: number }>,
  teacherRemark?: string
): Promise<boolean> {
  if (!firestoreInstance || !studentId) return false;
  try {
    const ref = doc(firestoreInstance, 'students', studentId);
    const updates: Record<string, any> = { marks: cleanForFirebase(marks) };
    if (teacherRemark !== undefined) {
      updates.teacherRemark = teacherRemark;
    }
    await updateDoc(ref, updates);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `students/${studentId}`);
    return false;
  }
}

export async function deleteStudentFromFirebase(studentId: string): Promise<boolean> {
  if (!firestoreInstance || !studentId) return false;
  try {
    const ref = doc(firestoreInstance, 'students', studentId);
    await deleteDoc(ref);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `students/${studentId}`);
    return false;
  }
}

export async function moveStudentToTrashInFirebase(student: Student): Promise<boolean> {
  if (!firestoreInstance || !student?.id) return false;
  try {
    const batch = writeBatch(firestoreInstance);
    const trashRef = doc(firestoreInstance, 'deleted_students', student.id);
    const studentRef = doc(firestoreInstance, 'students', student.id);

    batch.set(trashRef, cleanForFirebase({ ...student, deletedAt: new Date().toISOString() }));
    batch.delete(studentRef);
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `students/${student.id}`);
    return false;
  }
}

export async function moveBatchStudentsToTrashInFirebase(studentsList: Student[]): Promise<boolean> {
  if (!firestoreInstance || !studentsList?.length) return false;
  try {
    const batch = writeBatch(firestoreInstance);
    const now = new Date().toISOString();
    for (const st of studentsList) {
      if (st && st.id) {
        const trashRef = doc(firestoreInstance, 'deleted_students', st.id);
        const studentRef = doc(firestoreInstance, 'students', st.id);
        batch.set(trashRef, cleanForFirebase({ ...st, deletedAt: st.deletedAt || now }));
        batch.delete(studentRef);
      }
    }
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'students/batch-trash');
    return false;
  }
}

export async function restoreStudentFromTrashInFirebase(student: Student): Promise<boolean> {
  if (!firestoreInstance || !student?.id) return false;
  try {
    const { deletedAt, ...activeStudent } = student;
    const batch = writeBatch(firestoreInstance);
    const studentRef = doc(firestoreInstance, 'students', student.id);
    const trashRef = doc(firestoreInstance, 'deleted_students', student.id);

    batch.set(studentRef, cleanForFirebase(activeStudent));
    batch.delete(trashRef);
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `deleted_students/${student.id}`);
    return false;
  }
}

export async function restoreAllStudentsFromTrashInFirebase(studentsList: Student[]): Promise<boolean> {
  if (!firestoreInstance || !studentsList?.length) return false;
  try {
    const batch = writeBatch(firestoreInstance);
    for (const st of studentsList) {
      if (st && st.id) {
        const { deletedAt, ...activeStudent } = st;
        const studentRef = doc(firestoreInstance, 'students', st.id);
        const trashRef = doc(firestoreInstance, 'deleted_students', st.id);
        batch.set(studentRef, cleanForFirebase(activeStudent));
        batch.delete(trashRef);
      }
    }
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'deleted_students/restore-all');
    return false;
  }
}

export async function permanentlyDeleteStudentFromTrashInFirebase(studentId: string): Promise<boolean> {
  if (!firestoreInstance || !studentId) return false;
  try {
    const ref = doc(firestoreInstance, 'deleted_students', studentId);
    await deleteDoc(ref);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `deleted_students/${studentId}`);
    return false;
  }
}

export async function emptyTrashInFirebase(): Promise<boolean> {
  if (!firestoreInstance) return false;
  try {
    const snapshot = await getDocs(collection(firestoreInstance, 'deleted_students'));
    const batch = writeBatch(firestoreInstance);
    snapshot.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'deleted_students');
    return false;
  }
}

export function subscribeToDeletedStudents(callback: (deletedStudents: Student[]) => void): Unsubscribe {
  if (!firestoreInstance) return () => {};
  try {
    return onSnapshot(
      collection(firestoreInstance, 'deleted_students'),
      (snapshot) => {
        const list: Student[] = [];
        snapshot.forEach((d) => list.push(d.data() as Student));
        callback(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'deleted_students')
    );
  } catch (err) {
    return () => {};
  }
}

// ============================================================================
// CLEARED MARKS HISTORY
// ============================================================================

export async function saveClearedMarksBackupToFirebase(backup: ClearedMarksBackup): Promise<boolean> {
  if (!firestoreInstance || !backup?.id) return false;
  try {
    const ref = doc(firestoreInstance, 'cleared_marks_history', backup.id);
    await setDoc(ref, cleanForFirebase(backup));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `cleared_marks_history/${backup.id}`);
    return false;
  }
}

export async function deleteClearedMarksBackupFromFirebase(backupId: string): Promise<boolean> {
  if (!firestoreInstance || !backupId) return false;
  try {
    await deleteDoc(doc(firestoreInstance, 'cleared_marks_history', backupId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `cleared_marks_history/${backupId}`);
    return false;
  }
}

export async function emptyClearedMarksHistoryInFirebase(): Promise<boolean> {
  if (!firestoreInstance) return false;
  try {
    const snapshot = await getDocs(collection(firestoreInstance, 'cleared_marks_history'));
    const batch = writeBatch(firestoreInstance);
    snapshot.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'cleared_marks_history');
    return false;
  }
}

export function subscribeToClearedMarksHistory(callback: (history: ClearedMarksBackup[]) => void): Unsubscribe {
  if (!firestoreInstance) return () => {};
  try {
    return onSnapshot(
      collection(firestoreInstance, 'cleared_marks_history'),
      (snapshot) => {
        const list: ClearedMarksBackup[] = [];
        snapshot.forEach((d) => list.push(d.data() as ClearedMarksBackup));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        callback(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'cleared_marks_history')
    );
  } catch (err) {
    return () => {};
  }
}

// ============================================================================
// SUBJECTS, SETTINGS, AND GRADE RULES
// ============================================================================

export async function saveSubjectsToFirebase(subjects: SubjectConfig[]): Promise<boolean> {
  if (!firestoreInstance || !Array.isArray(subjects)) return false;
  try {
    const batch = writeBatch(firestoreInstance);
    for (const sub of subjects) {
      if (sub && sub.id) {
        batch.set(doc(firestoreInstance, 'subjects', sub.id), cleanForFirebase(sub), { merge: true });
      }
    }
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'subjects');
    return false;
  }
}

export async function saveSchoolSettingsToFirebase(settings: SchoolSettings): Promise<boolean> {
  if (!firestoreInstance || !settings) return false;
  try {
    const { classTeachers, ...otherSettings } = settings;
    const cleanTeachersMeta = Array.isArray(classTeachers)
      ? classTeachers.map((t) => ({
          id: t.id || t.className,
          className: t.className,
          teacherName: t.teacherName || '',
          phone: t.phone || '',
          designation: t.designation || '',
          signatureUrl: t.signatureUrl && t.signatureUrl.length < 10000 ? t.signatureUrl : '',
        }))
      : [];

    const ref = doc(firestoreInstance, 'settings', 'main');
    await setDoc(ref, cleanForFirebase({ ...otherSettings, classTeachers: cleanTeachersMeta }), { merge: true });

    if (Array.isArray(classTeachers) && classTeachers.length > 0) {
      const batch = writeBatch(firestoreInstance);
      for (const t of classTeachers) {
        if (t && t.className) {
          const docId = (t.className || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
          const tRef = doc(firestoreInstance, 'class_teachers', docId);
          batch.set(tRef, cleanForFirebase(t), { merge: true });
        }
      }
      await batch.commit();
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/main');
    return false;
  }
}

export async function updateSchoolToggleInFirebase(key: string, value: boolean): Promise<boolean> {
  if (!firestoreInstance || !key) return false;
  try {
    const ref = doc(firestoreInstance, 'settings', 'main');
    await setDoc(
      ref,
      {
        [key]: value,
        toggles: {
          [key]: value,
        },
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'settings/main');
    return false;
  }
}

export function subscribeToSchoolSettingsToggles(callback: (toggles: Record<string, any>) => void): Unsubscribe {
  if (!firestoreInstance) return () => {};
  try {
    return onSnapshot(
      doc(firestoreInstance, 'settings', 'main'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const toggles = {
            ...(data.toggles || {}),
            showHalfYearlyExam: data.showHalfYearlyExam,
            showAnnualExam: data.showAnnualExam,
            showTeacherRemarks: data.showTeacherRemarks,
            showStudentPhoto: data.showStudentPhoto,
            showSignatures: data.showSignatures,
            showPercentage: data.showPercentage,
            showGrade: data.showGrade,
            showProgressGraph: data.showProgressGraph,
            showStudentMobile: data.showStudentMobile,
            showStudentAadhar: data.showStudentAadhar,
            showPdfButton: data.showPdfButton,
            showPrintButton: data.showPrintButton,
            showImageButton: data.showImageButton,
            allowPublicSearch: data.allowPublicSearch,
            isMaintenanceMode: data.isMaintenanceMode,
            isResultLive: data.isResultLive,
          };
          callback(cleanForFirebase(toggles));
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/main')
    );
  } catch (err) {
    return () => {};
  }
}

export async function saveGradeRulesToFirebase(gradeRules: GradeRule[]): Promise<boolean> {
  if (!firestoreInstance || !Array.isArray(gradeRules)) return false;
  try {
    const batch = writeBatch(firestoreInstance);
    gradeRules.forEach((rule, idx) => {
      const ruleId = rule.grade?.replace(/[^a-zA-Z0-9]/g, '_') || `rule_${idx}`;
      batch.set(doc(firestoreInstance, 'grade_rules', ruleId), cleanForFirebase(rule), { merge: true });
    });
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'grade_rules');
    return false;
  }
}

// ============================================================================
// FULL SYNC AND SUBSCRIPTIONS
// ============================================================================

export async function syncAllDataToFirebase(payload: {
  schoolSettings: SchoolSettings;
  students: Student[];
  subjects: SubjectConfig[];
  gradeRules: GradeRule[];
}): Promise<{ success: boolean; message: string }> {
  if (!firestoreInstance) {
    return {
      success: false,
      message: 'Firebase Firestore is not initialized.',
    };
  }

  try {
    // 1. Settings & Class Teachers
    await saveSchoolSettingsToFirebase(payload.schoolSettings);

    // 2. Subjects
    if (payload.subjects?.length) {
      const subBatch = writeBatch(firestoreInstance);
      payload.subjects.forEach((s) => {
        subBatch.set(doc(firestoreInstance!, 'subjects', s.id), cleanForFirebase(s), { merge: true });
      });
      await subBatch.commit();
    }

    // 3. Grade Rules
    if (payload.gradeRules?.length) {
      const gBatch = writeBatch(firestoreInstance);
      payload.gradeRules.forEach((r, idx) => {
        const id = r.grade?.replace(/[^a-zA-Z0-9]/g, '_') || `rule_${idx}`;
        gBatch.set(doc(firestoreInstance!, 'grade_rules', id), cleanForFirebase(r), { merge: true });
      });
      await gBatch.commit();
    }

    // 4. Students
    if (payload.students?.length) {
      await saveAllStudentsToFirebase(payload.students);
    }

    return {
      success: true,
      message: `✓ सभी ${payload.students.length} छात्र और डाटा Firebase Firestore क्लाउड में सुरक्षित हो गए!`,
    };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, 'root');
    return {
      success: false,
      message: `Firebase Sync Error: ${err.message || 'त्रुटि'}`,
    };
  }
}

export function subscribeToFirebaseData(callbacks: {
  onSettings?: (settings: SchoolSettings) => void;
  onStudents?: (students: Student[]) => void;
  onSubjects?: (subjects: SubjectConfig[]) => void;
  onGradeRules?: (gradeRules: GradeRule[]) => void;
}): () => void {
  if (!firestoreInstance) return () => {};

  const unsubs: Unsubscribe[] = [];

  // Settings
  if (callbacks.onSettings) {
    try {
      const u = onSnapshot(
        doc(firestoreInstance, 'settings', 'main'),
        async (snapshot) => {
          if (snapshot.exists()) {
            const rawSettings = snapshot.data() as SchoolSettings;
            try {
              const teachersSnap = await getDocs(collection(firestoreInstance!, 'class_teachers'));
              if (!teachersSnap.empty) {
                const teachers: any[] = [];
                teachersSnap.forEach((d) => teachers.push(d.data()));
                rawSettings.classTeachers = teachers;
              }
            } catch {}
            callbacks.onSettings!(rawSettings);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'settings/main')
      );
      unsubs.push(u);
    } catch {}
  }

  // Students
  if (callbacks.onStudents) {
    try {
      const u = onSnapshot(
        collection(firestoreInstance, 'students'),
        (snapshot) => {
          const list: Student[] = [];
          snapshot.forEach((d) => list.push(d.data() as Student));
          callbacks.onStudents!(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'students')
      );
      unsubs.push(u);
    } catch {}
  }

  // Subjects
  if (callbacks.onSubjects) {
    try {
      const u = onSnapshot(
        collection(firestoreInstance, 'subjects'),
        (snapshot) => {
          const list: SubjectConfig[] = [];
          snapshot.forEach((d) => list.push(d.data() as SubjectConfig));
          if (list.length > 0) {
            callbacks.onSubjects!(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'subjects')
      );
      unsubs.push(u);
    } catch {}
  }

  // Grade rules
  if (callbacks.onGradeRules) {
    try {
      const u = onSnapshot(
        collection(firestoreInstance, 'grade_rules'),
        (snapshot) => {
          const list: GradeRule[] = [];
          snapshot.forEach((d) => list.push(d.data() as GradeRule));
          if (list.length > 0) {
            callbacks.onGradeRules!(list);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'grade_rules')
      );
      unsubs.push(u);
    } catch {}
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function fetchAllFromFirebase(): Promise<{
  students?: Student[];
  subjects?: SubjectConfig[];
  settings?: SchoolSettings;
  gradeRules?: GradeRule[];
  staffUsers?: StaffUser[];
} | null> {
  if (!firestoreInstance) return null;
  try {
    const [stSnap, subSnap, sSnap, gSnap, staffSnap, teachersSnap] = await Promise.all([
      getDocs(collection(firestoreInstance, 'students')).catch(() => null),
      getDocs(collection(firestoreInstance, 'subjects')).catch(() => null),
      getDoc(doc(firestoreInstance, 'settings', 'main')).catch(() => null),
      getDocs(collection(firestoreInstance, 'grade_rules')).catch(() => null),
      getDocs(collection(firestoreInstance, 'staff_users')).catch(() => null),
      getDocs(collection(firestoreInstance, 'class_teachers')).catch(() => null),
    ]);

    const students: Student[] = [];
    stSnap?.forEach((d) => students.push(d.data() as Student));

    const subjects: SubjectConfig[] = [];
    subSnap?.forEach((d) => subjects.push(d.data() as SubjectConfig));

    const gradeRules: GradeRule[] = [];
    gSnap?.forEach((d) => gradeRules.push(d.data() as GradeRule));

    const staffUsers: StaffUser[] = [];
    staffSnap?.forEach((d) => staffUsers.push(d.data() as StaffUser));

    let settings = sSnap?.exists() ? (sSnap.data() as SchoolSettings) : undefined;
    if (settings && teachersSnap && !teachersSnap.empty) {
      const teachers: any[] = [];
      teachersSnap.forEach((d) => teachers.push(d.data()));
      settings.classTeachers = teachers;
    }

    return {
      students: students.length > 0 ? students : undefined,
      subjects: subjects.length > 0 ? subjects : undefined,
      settings,
      gradeRules: gradeRules.length > 0 ? gradeRules : undefined,
      staffUsers: staffUsers.length > 0 ? staffUsers : undefined,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'root');
    return null;
  }
}

// ============================================================================
// STAFF MANAGEMENT
// ============================================================================

export function subscribeToStaffUsers(callback: (staff: StaffUser[]) => void): Unsubscribe | null {
  if (!firestoreInstance) return null;
  try {
    return onSnapshot(
      collection(firestoreInstance, 'staff_users'),
      (snapshot) => {
        const list: StaffUser[] = [];
        snapshot.forEach((d) => list.push(d.data() as StaffUser));
        callback(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'staff_users')
    );
  } catch (err) {
    return null;
  }
}

export async function saveStaffUserToFirebase(staff: StaffUser): Promise<boolean> {
  if (!firestoreInstance || !staff?.id) return false;
  try {
    await setDoc(doc(firestoreInstance, 'staff_users', staff.id), cleanForFirebase(staff), { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `staff_users/${staff.id}`);
    return false;
  }
}

export async function deleteStaffUserFromFirebase(staffId: string): Promise<boolean> {
  if (!firestoreInstance || !staffId) return false;
  try {
    await deleteDoc(doc(firestoreInstance, 'staff_users', staffId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `staff_users/${staffId}`);
    return false;
  }
}

export async function saveAllStaffUsersToFirebase(staffList: StaffUser[]): Promise<boolean> {
  if (!firestoreInstance || !staffList?.length) return false;
  try {
    const batch = writeBatch(firestoreInstance);
    for (const staff of staffList) {
      if (staff && staff.id) {
        batch.set(doc(firestoreInstance, 'staff_users', staff.id), cleanForFirebase(staff), { merge: true });
      }
    }
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'staff_users');
    return false;
  }
}
