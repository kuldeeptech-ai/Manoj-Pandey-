import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import {
  DEFAULT_SCHOOL_SETTINGS,
  DEFAULT_SUBJECTS,
  DEFAULT_STUDENTS,
  DEFAULT_STAFF_USERS,
} from './src/data/defaultData';
import {
  DEFAULT_GRADE_RULES,
  calculateStudentResult,
  normalizeSchoolSettings,
  formatDisplayDate,
} from './src/utils/calculations';

let firestoreDb: any = null;
try {
  const fbApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  firestoreDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
} catch (err) {
  console.warn('[Server] Firestore init error:', err);
}

function cleanForDb(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.filter((x) => x !== undefined).map(cleanForDb);
  const res: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) res[k] = cleanForDb(v);
  }
  return res;
}

function normalizeStudent(s: any): any {
  if (!s || typeof s !== 'object') return s;
  return {
    ...s,
    session: (s.session && String(s.session).trim()) || store.schoolSettings?.session || '2026–2027',
    marks: s.marks && typeof s.marks === 'object' ? s.marks : {},
    dob: formatDisplayDate(s.dob),
    mobile: s.mobile ? String(s.mobile).trim() : '',
    address: s.address ? String(s.address).trim() : (s.pata ? String(s.pata).trim() : ''),
    aadharNo: s.aadharNo ? String(s.aadharNo).trim() : '',
    aparId: s.aparId ? String(s.aparId).trim() : (s.apaarId ? String(s.apaarId).trim() : (s.apar ? String(s.apar).trim() : '')),
    assignedSubjectIds: Array.isArray(s.assignedSubjectIds)
      ? s.assignedSubjectIds.map(String).filter(Boolean)
      : undefined,
  };
}

const DATA_FILE = path.join(process.cwd(), 'data-store.json');

// In-memory data store
let store = {
  schoolSettings: normalizeSchoolSettings({ ...DEFAULT_SCHOOL_SETTINGS }),
  subjects: [...DEFAULT_SUBJECTS],
  students: [...DEFAULT_STUDENTS],
  gradeRules: [...DEFAULT_GRADE_RULES],
  staffUsers: [...DEFAULT_STAFF_USERS] as any[],
  deletedStudents: [] as any[],
  clearedMarksHistory: [] as any[],
  lastUpdated: new Date().toISOString(),
};

// Try loading persisted data
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.schoolSettings) store.schoolSettings = normalizeSchoolSettings(parsed.schoolSettings);
    if (parsed.subjects && Array.isArray(parsed.subjects) && parsed.subjects.length >= DEFAULT_SUBJECTS.length) {
      store.subjects = parsed.subjects;
    } else {
      store.subjects = [...DEFAULT_SUBJECTS];
    }
    if (parsed.students) store.students = parsed.students;
    if (parsed.gradeRules) store.gradeRules = parsed.gradeRules;
    if (Array.isArray(parsed.staffUsers) && parsed.staffUsers.length > 0) {
      store.staffUsers = parsed.staffUsers;
    } else {
      store.staffUsers = [...DEFAULT_STAFF_USERS];
    }
    if (parsed.deletedStudents) store.deletedStudents = parsed.deletedStudents;
    if (parsed.clearedMarksHistory) store.clearedMarksHistory = parsed.clearedMarksHistory;
    if (parsed.lastUpdated) store.lastUpdated = parsed.lastUpdated;
  }
} catch (e) {
  console.warn('Failed to load data-store.json, using defaults', e);
}

function saveStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save data-store.json', e);
  }
}

// Background sync function: keep official Firestore Database in sync with backend store
async function syncToFirebaseInBackground() {
  if (!firestoreDb) return;
  try {
    // 1. Settings & Class Teachers
    const { classTeachers, ...otherSettings } = store.schoolSettings || {};
    const cleanTeachersMeta = Array.isArray(classTeachers)
      ? classTeachers.map((t: any) => ({
          id: t.id || t.className,
          className: t.className,
          teacherName: t.teacherName || '',
          phone: t.phone || '',
          designation: t.designation || '',
          signatureUrl: t.signatureUrl && t.signatureUrl.length < 10000 ? t.signatureUrl : '',
        }))
      : [];

    await setDoc(
      doc(firestoreDb, 'settings', 'main'),
      cleanForDb({ ...otherSettings, classTeachers: cleanTeachersMeta }),
      { merge: true }
    );

    if (Array.isArray(classTeachers) && classTeachers.length > 0) {
      const batch = writeBatch(firestoreDb);
      for (const t of classTeachers) {
        if (t && t.className) {
          const docId = (t.className || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
          batch.set(doc(firestoreDb, 'class_teachers', docId), cleanForDb(t), { merge: true });
        }
      }
      await batch.commit();
    }

    // 2. Students in batches + prune orphaned or deleted from Firestore
    if (Array.isArray(store.students)) {
      if (store.students.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < store.students.length; i += chunkSize) {
          const chunk = store.students.slice(i, i + chunkSize);
          const batch = writeBatch(firestoreDb);
          for (const s of chunk) {
            if (s && s.id) {
              batch.set(doc(firestoreDb, 'students', s.id), cleanForDb(s), { merge: true });
            }
          }
          await batch.commit();
        }
      }
    }

    // Prune deleted students from Firestore's students collection
    if (Array.isArray(store.deletedStudents) && store.deletedStudents.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < store.deletedStudents.length; i += chunkSize) {
        const chunk = store.deletedStudents.slice(i, i + chunkSize);
        const batch = writeBatch(firestoreDb);
        for (const ds of chunk) {
          if (ds && ds.id) {
            batch.delete(doc(firestoreDb, 'students', ds.id));
            batch.set(doc(firestoreDb, 'deleted_students', ds.id), cleanForDb(ds), { merge: true });
          }
        }
        await batch.commit().catch(() => {});
      }
    }

    // 3. Subjects
    if (Array.isArray(store.subjects) && store.subjects.length > 0) {
      const batch = writeBatch(firestoreDb);
      for (const sub of store.subjects) {
        if (sub && sub.id) {
          batch.set(doc(firestoreDb, 'subjects', sub.id), cleanForDb(sub), { merge: true });
        }
      }
      await batch.commit();
    }

    // 4. Grade Rules
    if (Array.isArray(store.gradeRules) && store.gradeRules.length > 0) {
      const batch = writeBatch(firestoreDb);
      store.gradeRules.forEach((r: any, idx: number) => {
        const id = r.grade ? r.grade.replace(/[^a-zA-Z0-9_-]/g, '_') : `rule_${idx}`;
        batch.set(doc(firestoreDb, 'grade_rules', id), cleanForDb(r), { merge: true });
      });
      await batch.commit();
    }

    // 5. Staff Users
    if (Array.isArray(store.staffUsers) && store.staffUsers.length > 0) {
      const batch = writeBatch(firestoreDb);
      for (const u of store.staffUsers) {
        if (u && u.id) {
          batch.set(doc(firestoreDb, 'staff_users', u.id), cleanForDb(u), { merge: true });
        }
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn('[Server] Error syncing to Firestore in background:', err);
  }
}

async function syncFromFirebaseOnStart() {
  if (!firestoreDb) return;
  try {
    const [stSnap, sSnap, subSnap, gSnap, staffSnap, teachersSnap] = await Promise.all([
      getDocs(collection(firestoreDb, 'students')).catch(() => null),
      getDoc(doc(firestoreDb, 'settings', 'main')).catch(() => null),
      getDocs(collection(firestoreDb, 'subjects')).catch(() => null),
      getDocs(collection(firestoreDb, 'grade_rules')).catch(() => null),
      getDocs(collection(firestoreDb, 'staff_users')).catch(() => null),
      getDocs(collection(firestoreDb, 'class_teachers')).catch(() => null),
    ]);

    // If data-store.json was loaded with students, sync those to Firestore
    // If data-store.json is empty and Firestore has students, load them only if not in deletedStudents
    if (stSnap && stSnap.size > 0) {
      const deletedIds = new Set((store.deletedStudents || []).map((s: any) => s.id));
      const loadedStudents: any[] = [];
      stSnap.forEach((d) => {
        const data = d.data();
        if (data && data.id && !deletedIds.has(data.id)) {
          loadedStudents.push(data);
        }
      });
      if (store.students.length === 0 && !fs.existsSync(DATA_FILE)) {
        store.students = loadedStudents.map(normalizeStudent);
      }
    }

    if (sSnap && sSnap.exists()) {
      const settings = sSnap.data() as any;
      if (teachersSnap && !teachersSnap.empty) {
        const teachers: any[] = [];
        teachersSnap.forEach((d) => teachers.push(d.data()));
        settings.classTeachers = teachers;
      }
      store.schoolSettings = normalizeSchoolSettings({ ...store.schoolSettings, ...settings });
    }

    if (subSnap && subSnap.size >= DEFAULT_SUBJECTS.length) {
      const subs: any[] = [];
      subSnap.forEach((d) => subs.push(d.data()));
      store.subjects = subs;
    }

    if (gSnap && gSnap.size > 0) {
      const grades: any[] = [];
      gSnap.forEach((d) => grades.push(d.data()));
      store.gradeRules = grades;
    }

    if (staffSnap && staffSnap.size > 0) {
      const staff: any[] = [];
      staffSnap.forEach((d) => staff.push(d.data()));
      store.staffUsers = staff;
    }

    store.lastUpdated = new Date().toISOString();
    saveStore();
    console.log(`[Server] Synced on startup from Firestore: ${store.students.length} students loaded.`);
  } catch (err) {
    console.warn('[Server] Could not sync from Firestore on startup:', err);
  }
}

let sheetSyncTimer: NodeJS.Timeout | null = null;

function syncToGoogleSheetInBackground() {
  // Attempt Firebase RTDB sync if configured
  syncToFirebaseInBackground();

  // Debounced background push to Google Sheet Web App (2-second debounce for batch safety)
  if (sheetSyncTimer) clearTimeout(sheetSyncTimer);
  sheetSyncTimer = setTimeout(async () => {
    try {
      const sheetUrl = store.schoolSettings?.googleSheetWebAppUrl?.trim() || process.env.VITE_GOOGLE_SHEET_URL;
      if (!sheetUrl || !sheetUrl.startsWith('http') || sheetUrl.includes('AKfycbzItfB0hnC38GWywI4SGxay7THA3AXcuULIsWIo9Zg9GKYlIzzRAkFzTW3brKoxmmMQ')) return;

      console.log(`[Server] Syncing ${store.students.length} students to Google Sheet in background...`);
      const response = await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncAll',
          schoolSettings: store.schoolSettings,
          students: store.students,
          subjects: store.subjects,
          gradeRules: store.gradeRules,
          classTeachers: store.schoolSettings?.classTeachers || [],
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(35000),
      });
      const data = await response.json().catch(() => null);
      console.log('[Server] Google Sheet background sync completed:', data?.status || 'ok');
    } catch (err: any) {
      console.warn('[Server] Google Sheet background sync error:', err.message);
    }
  }, 2000);
}

async function syncFromGoogleSheetOnStart() {
  // Do NOT auto-restore students from demo or unconfigured sheets on start
  // Only explicitly configured custom URLs
  try {
    const sheetUrl = store.schoolSettings?.googleSheetWebAppUrl?.trim() || process.env.VITE_GOOGLE_SHEET_URL;
    if (!sheetUrl || !sheetUrl.startsWith('http') || sheetUrl.includes('AKfycbzItfB0hnC38GWywI4SGxay7THA3AXcuULIsWIo9Zg9GKYlIzzRAkFzTW3brKoxmmMQ')) return;

    // Only if explicitly configured and store.students has not been saved
    if (store.students.length === 0 && !fs.existsSync(DATA_FILE)) {
      console.log('[Server] Checking configured Google Sheet...');
      const res = await fetch(`${sheetUrl}?action=allData`, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.students) && data.students.length > 0) {
          store.students = data.students.map(normalizeStudent);
          if (data.settings) store.schoolSettings = normalizeSchoolSettings({ ...store.schoolSettings, ...data.settings });
          if (Array.isArray(data.subjects) && data.subjects.length > 0) store.subjects = data.subjects;
          if (Array.isArray(data.gradeRules) && data.gradeRules.length > 0) store.gradeRules = data.gradeRules;
          saveStore();
        }
      }
    }
  } catch (err: any) {
    console.warn('[Server] Google Sheet recovery error on start:', err.message);
  }
}

async function startServer() {
  syncFromFirebaseOnStart().catch(() => {});
  syncFromGoogleSheetOnStart().catch(() => {});

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Prevent caching for all API responses so multiple devices always get fresh live data
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.post('/api/client-error', (_req, res) => {
    res.status(204).end();
  });

  // Public School Settings
  app.get('/api/settings', (req, res) => {
    res.json(normalizeSchoolSettings(store.schoolSettings));
  });

  // Public Result Search
  // Searches by Roll No or Admission No or ID, validated against Class
  // Prompt Section 31: "Backend must return only the matching student's data. Never send all students' records to the browser."
  app.get('/api/result', async (req, res) => {
    const roll = (req.query.roll as string)?.trim().toLowerCase();
    const admission = (req.query.admission as string)?.trim().toLowerCase();
    const studentId = (req.query.id as string)?.trim().toLowerCase();
    const className = (req.query.className as string)?.trim().toLowerCase();
    const cleanClass = className ? className.replace(/[^a-z0-9]/g, '') : '';

    if (!roll && !admission && !studentId) {
      return res.status(400).json({ error: 'Please enter Roll Number or Admission Number.' });
    }

    const cleanQuery = (roll || admission || studentId || '').replace(/[^0-9]/g, '');

    const checkClassMatch = (studentClass?: string) => {
      if (!cleanClass) return true;
      if (!studentClass) return false;
      const sc = studentClass.toLowerCase().replace(/[^a-z0-9]/g, '');
      return sc === cleanClass || sc.includes(cleanClass) || cleanClass.includes(sc);
    };

    let matched = store.students.find((s) => {
      if (!checkClassMatch(s.className)) return false;
      if (roll && s.rollNo.trim().toLowerCase() === roll) return true;
      if (admission && s.admissionNo.trim().toLowerCase() === admission) return true;
      if (studentId && s.id.trim().toLowerCase() === studentId) return true;
      if (cleanQuery && cleanQuery.length >= 10) {
        if (s.mobile && s.mobile.replace(/[^0-9]/g, '') === cleanQuery) return true;
        if (s.aadharNo && s.aadharNo.replace(/[^0-9]/g, '') === cleanQuery) return true;
        if (s.aparId && s.aparId.replace(/[^0-9]/g, '') === cleanQuery) return true;
      }
      return false;
    });

    // Try live fetch from Google Sheet so admin updates on another phone/device reflect immediately
    const sheetUrl = store.schoolSettings?.googleSheetWebAppUrl?.trim() || process.env.VITE_GOOGLE_SHEET_URL;
    const queryTerm = roll || admission || studentId;
    if (sheetUrl && sheetUrl.startsWith('http') && queryTerm) {
      try {
        const sheetRes = await fetch(
          `${sheetUrl}?roll=${encodeURIComponent(queryTerm)}&admission=${encodeURIComponent(queryTerm)}`,
          { signal: AbortSignal.timeout(3500) }
        );
        if (sheetRes.ok) {
          const sheetJson = await sheetRes.json();
          if (sheetJson?.student) {
            const liveStudent = normalizeStudent(sheetJson.student);
            if (checkClassMatch(liveStudent.className)) {
              matched = {
                ...(matched || {}),
                ...liveStudent,
                address: liveStudent.address || matched?.address || '',
                aparId: liveStudent.aparId || matched?.aparId || '',
                aadharNo: liveStudent.aadharNo || matched?.aadharNo || '',
                mobile: liveStudent.mobile || matched?.mobile || '',
                session: liveStudent.session || matched?.session || store.schoolSettings?.session || '2026–2027',
              };
            }
          }
        }
      } catch (err: any) {
        // Timeout or network glitch: gracefully fall back to in-memory store
      }
    }

    if (!matched) {
      // Check if student exists in another class
      const otherClassStudent = store.students.find((s) => {
        if (roll && s.rollNo.trim().toLowerCase() === roll) return true;
        if (admission && s.admissionNo.trim().toLowerCase() === admission) return true;
        return false;
      });

      if (otherClassStudent && req.query.className) {
        return res.status(404).json({
          error: 'CLASS MISMATCH',
          message: `अनुक्रमांक ${roll || admission} कक्षा ${otherClassStudent.className} में पंजीकृत है, जबकि आपने कक्षा ${req.query.className} चुनी है। कृपया सही कक्षा चुनें।`,
        });
      }

      return res.status(404).json({
        error: 'RESULT NOT FOUND',
        message: 'कृपया अपना अनुक्रमांक / प्रवेश संख्या तथा कक्षा जांचें या विद्यालय से संपर्क करें।',
      });
    }

    const result = calculateStudentResult(
      matched,
      store.subjects,
      store.schoolSettings,
      store.gradeRules
    );

    res.json(result);
  });

  // Admin APIs
  app.get('/api/admin/data', (req, res) => {
    res.json(store);
  });

  const PRIMARY_ADMIN_EMAIL = 'kuldeeprai75220@gmail.com';

  // Strict Single-Credential Admin Login Verification Endpoint
  // Supports Login via Admin Email (kuldeeprai75220@gmail.com) as well as Admin User ID
  app.post('/api/admin/login', (req, res) => {
    const { userId, email, password } = req.body || {};
    const inputIdentifier = String(email || userId || '').trim().toLowerCase();
    const inputPass = String(password || '').trim();

    if (!inputIdentifier || !inputPass) {
      return res.status(400).json({ success: false, error: 'व्यवस्थापक ईमेल और पासवर्ड आवश्यक हैं।' });
    }

    const currentEmail = (store.schoolSettings?.adminEmail || PRIMARY_ADMIN_EMAIL).trim().toLowerCase();
    const currentUserId = (store.schoolSettings?.adminUserId || 'Kld7522').trim().toLowerCase();
    const currentPassword = (store.schoolSettings?.adminPassword || 'Kld@2314').trim();

    // Verification check against Admin Email or configured User ID
    const isIdentifierValid =
      inputIdentifier === currentEmail ||
      inputIdentifier === PRIMARY_ADMIN_EMAIL ||
      inputIdentifier === currentUserId;

    const isPasswordValid = inputPass === currentPassword;

    if (isIdentifierValid && isPasswordValid) {
      const token = `adm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[Admin Auth] Successful login for admin: ${currentEmail}`);
      return res.json({
        success: true,
        token,
        role: 'admin',
        adminEmail: currentEmail,
        adminUserId: store.schoolSettings?.adminUserId || 'Kld7522',
        name: 'मुख्य व्यवस्थापक (Super Admin)',
        schoolName: store.schoolSettings?.schoolName,
      });
    }

    // Check if matching Staff user is attempting login
    const matchingStaff = (store.staffUsers || []).find((u: any) => {
      const uName = String(u.username || '').trim().toLowerCase();
      return uName === inputIdentifier;
    });

    if (matchingStaff) {
      if (matchingStaff.isActive === false) {
        return res.status(403).json({
          success: false,
          error: 'यह सहायक खाता वर्तमान में निष्क्रिय (Deactivated) है। कृपया मुख्य व्यवस्थापक से संपर्क करें।',
        });
      }
      if (String(matchingStaff.password || '').trim() === inputPass) {
        const token = `staff_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        console.log(`[Staff Auth] Successful login for staff: ${matchingStaff.username} (${matchingStaff.name})`);
        return res.json({
          success: true,
          token,
          role: 'staff',
          staffUser: matchingStaff,
          name: matchingStaff.name,
          username: matchingStaff.username,
          permissions: matchingStaff.permissions,
          schoolName: store.schoolSettings?.schoolName,
        });
      } else {
        return res.status(401).json({
          success: false,
          error: 'गलत पासवर्ड! कृपया सहायक खाते का सही पासवर्ड दर्ज करें।',
        });
      }
    }

    console.warn(`[Admin Auth] Failed login attempt for: "${inputIdentifier}"`);
    return res.status(401).json({
      success: false,
      error: `अमान्य क्रेडेंशियल! केवल अधिकृत व्यवस्थापक (${currentEmail}) अथवा मान्य सहायक स्टाफ ही लॉगिन कर सकते हैं।`,
    });
  });

  // Dedicated Staff Login Endpoint
  app.post('/api/staff/login', (req, res) => {
    const { username, password } = req.body || {};
    const inputUser = String(username || '').trim().toLowerCase();
    const inputPass = String(password || '').trim();

    if (!inputUser || !inputPass) {
      return res.status(400).json({ success: false, error: 'यूजरनेम और पासवर्ड आवश्यक हैं।' });
    }

    const staff = (store.staffUsers || []).find((u: any) => {
      return String(u.username || '').trim().toLowerCase() === inputUser;
    });

    if (!staff) {
      return res.status(404).json({ success: false, error: 'यह सहायक यूजरनेम मौजूद नहीं है।' });
    }

    if (staff.isActive === false) {
      return res.status(403).json({
        success: false,
        error: 'यह सहायक खाता वर्तमान में व्यवस्थापक द्वारा निष्क्रिय (Deactivated) कर दिया गया है।',
      });
    }

    if (String(staff.password || '').trim() !== inputPass) {
      return res.status(401).json({ success: false, error: 'गलत पासवर्ड! कृपया सही पासवर्ड दर्ज करें।' });
    }

    const token = `staff_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return res.json({
      success: true,
      token,
      role: 'staff',
      staffUser: staff,
      name: staff.name,
      username: staff.username,
      permissions: staff.permissions,
      schoolName: store.schoolSettings?.schoolName,
    });
  });

  // Staff Management Endpoints (CRUD)
  app.get('/api/admin/staff', (req, res) => {
    res.json({ success: true, staffUsers: store.staffUsers || [] });
  });

  app.post('/api/admin/staff', (req, res) => {
    const staffData = req.body;
    if (!staffData || !staffData.name || !staffData.username || !staffData.password) {
      return res.status(400).json({ error: 'नाम, यूजरनेम और पासवर्ड अनिवार्य हैं।' });
    }

    store.staffUsers = store.staffUsers || [];
    const cleanUsername = String(staffData.username).trim().toLowerCase();
    const existingIndex = store.staffUsers.findIndex(
      (u: any) => u.id === staffData.id || String(u.username).trim().toLowerCase() === cleanUsername
    );

    const defaultPerms = {
      canAddStudents: true,
      canEditStudents: true,
      canDeleteStudents: false,
      canEnterMarks: true,
      canBulkMarks: true,
      canExportData: true,
      canEditSchoolSettings: false,
      canManageStaff: false,
      canResetDatabase: false,
    };

    const finalStaff: any = {
      id: staffData.id || `staff-${Date.now()}`,
      name: String(staffData.name).trim(),
      username: cleanUsername,
      password: String(staffData.password).trim(),
      role: 'staff',
      phone: staffData.phone ? String(staffData.phone).trim() : '',
      isActive: staffData.isActive !== false,
      permissions: {
        ...defaultPerms,
        ...(staffData.permissions || {}),
      },
      createdAt: staffData.createdAt || new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      store.staffUsers[existingIndex] = { ...store.staffUsers[existingIndex], ...finalStaff };
    } else {
      store.staffUsers.push(finalStaff);
    }

    store.lastUpdated = new Date().toISOString();
    saveStore();
    syncToFirebaseInBackground();

    res.json({ success: true, staffUsers: store.staffUsers, savedStaff: finalStaff });
  });

  app.delete('/api/admin/staff/:id', (req, res) => {
    const { id } = req.params;
    store.staffUsers = (store.staffUsers || []).filter((u: any) => u.id !== id);
    store.lastUpdated = new Date().toISOString();
    saveStore();
    syncToFirebaseInBackground();
    res.json({ success: true, staffUsers: store.staffUsers });
  });

  // Firebase Authentication Verification Endpoint
  // STRICT SECURITY: Only PRIMARY_ADMIN_EMAIL (kuldeeprai75220@gmail.com) is accepted.
  app.post('/api/admin/firebase-auth-success', (req, res) => {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const primaryAdmin = (store.schoolSettings?.adminEmail || PRIMARY_ADMIN_EMAIL).trim().toLowerCase();

    if (cleanEmail === primaryAdmin || cleanEmail === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      const token = `adm_fb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[Admin Auth] Verified sole admin via Firebase: ${cleanEmail}`);
      return res.json({
        success: true,
        token,
        adminEmail: cleanEmail,
        schoolName: store.schoolSettings?.schoolName,
      });
    }

    console.warn(`[Admin Auth] Unauthorized Firebase login attempt: "${cleanEmail}"`);
    return res.status(403).json({
      success: false,
      error: `अनधिकृत खाता (${cleanEmail || 'अज्ञात'})! केवल अधिकृत व्यवस्थापक (${primaryAdmin}) ही एडमिन पोर्टल में प्रवेश कर सकते हैं। अन्य किसी को अनुमति नहीं है।`,
    });
  });

  // In-Memory OTP Store for Admin Password Recovery
  const recoveryOtpStore: Record<string, { otp: string; expiresAt: number }> = {};

  // Helper to asynchronously send OTP via Google Apps Script (which triggers Google MailApp/Gmail)
  async function dispatchOtpEmailToAdmin(toEmail: string, otpCode: string, schoolName: string) {
    const sheetUrl = store.schoolSettings?.googleSheetWebAppUrl?.trim() || process.env.VITE_GOOGLE_SHEET_URL;
    if (sheetUrl && sheetUrl.startsWith('http')) {
      try {
        const resp = await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sendOtpEmail',
            toEmail: toEmail,
            otp: otpCode,
            schoolName: schoolName,
            subject: `${schoolName} - व्यवस्थापक पासवर्ड रीसेट OTP (${otpCode})`,
          }),
          signal: AbortSignal.timeout(7000),
        });
        if (resp.ok) {
          console.log(`[Admin OTP] Real email dispatched successfully via Google Apps Script to: ${toEmail}`);
          return true;
        }
      } catch (err: any) {
        console.warn(`[Admin OTP] Google Apps Script email dispatch note: ${err.message}`);
      }
    }
    return false;
  }

  // Request Forgot Password OTP Endpoint
  // Generates 6-digit OTP and dispatches directly to kuldeeprai75220@gmail.com
  // NEVER returns the OTP in client response
  app.post('/api/admin/forgot-password/request-otp', async (req, res) => {
    const { email } = req.body || {};
    const inputEmail = String(email || '').trim().toLowerCase();

    const registeredEmail = (store.schoolSettings?.adminEmail || PRIMARY_ADMIN_EMAIL).trim().toLowerCase();

    // Verify authorized email (allow empty so default registered email is used, or must match)
    if (inputEmail && inputEmail !== registeredEmail && inputEmail !== PRIMARY_ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        error: `यह ईमेल दर्ज नहीं है। पासवर्ड रीसेट केवल अधिकृत ईमेल (${registeredEmail}) पर ही भेजा जा सकता है।`,
      });
    }

    const targetEmail = registeredEmail || PRIMARY_ADMIN_EMAIL;

    // Generate secure 6-digit verification code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    recoveryOtpStore[targetEmail] = {
      otp,
      expiresAt: Date.now() + 15 * 60 * 1000, // Valid for 15 minutes
    };

    console.log(`[Admin Security] OTP successfully generated for admin email: ${targetEmail}`);

    // Asynchronously dispatch OTP email through Google Apps Script
    const schoolName = store.schoolSettings?.schoolName || 'H.D.P. PUBLIC SCHOOL';
    dispatchOtpEmailToAdmin(targetEmail, otp, schoolName).catch(() => {});

    // Note: Do NOT send otp in response! User must get it from their actual email inbox
    return res.json({
      success: true,
      message: `सत्यापन कोड (OTP) आपके अधिकृत व्यवस्थापक ईमेल (${targetEmail}) पर भेज दिया गया है। कृपया अपना इनबॉक्स और स्पैम फ़ोल्डर देखें और 6-अंकीय कोड दर्ज करें।`,
      expiresInMinutes: 15,
      targetEmail,
    });
  });

  // Verify OTP and Reset Admin Password Endpoint
  app.post('/api/admin/forgot-password/verify-reset', (req, res) => {
    const { email, otp, newPassword, newUserId } = req.body || {};
    const inputEmail = String(email || '').trim().toLowerCase();
    const inputOtp = String(otp || '').trim();
    const cleanPass = String(newPassword || '').trim();
    const cleanUser = String(newUserId || '').trim();

    if (!inputEmail || !inputOtp || !cleanPass) {
      return res.status(400).json({ success: false, error: 'ईमेल, OTP और नया पासवर्ड आवश्यक हैं।' });
    }

    const record = recoveryOtpStore[inputEmail];
    if (!record) {
      return res.status(400).json({ success: false, error: 'इस ईमेल के लिए कोई OTP अनुरोध नहीं मिला। कृपया पुनः OTP भेजें।' });
    }

    if (Date.now() > record.expiresAt) {
      delete recoveryOtpStore[inputEmail];
      return res.status(400).json({ success: false, error: 'OTP की समय सीमा समाप्त (Expired) हो चुकी है। कृपया नया OTP अनुरोध करें।' });
    }

    if (record.otp !== inputOtp) {
      return res.status(400).json({ success: false, error: 'गलत OTP कोड! कृपया ईमेल में आया 6-अंकीय कोड सही दर्ज करें।' });
    }

    // OTP verified successfully! Clear OTP
    delete recoveryOtpStore[inputEmail];

    // Update credentials
    if (cleanUser) {
      store.schoolSettings.adminUserId = cleanUser;
    }
    store.schoolSettings.adminPassword = cleanPass;
    store.lastUpdated = new Date().toISOString();
    saveStore();

    console.log(`[Admin Forgot-Password] Password successfully reset for admin: "${store.schoolSettings.adminUserId}"`);
    return res.json({
      success: true,
      adminUserId: store.schoolSettings.adminUserId,
      message: 'एडमिन पासवर्ड सफलतापूर्वक रीसेट कर दिया गया है! अब आप नए पासवर्ड से लॉगिन कर सकते हैं।',
    });
  });

  // Dedicated Change Credentials Endpoint
  // Immediately writes new credentials to data-store.json and store in memory
  app.post('/api/admin/change-credentials', (req, res) => {
    const { newUserId, newPassword, newEmail } = req.body || {};
    const cleanId = String(newUserId || '').trim() || 'Kld7522';
    const cleanPass = String(newPassword || '').trim();
    const cleanEmail = String(newEmail || '').trim() || 'kuldeeprai75220@gmail.com';

    if (!cleanPass) {
      return res.status(400).json({ success: false, error: 'पासवर्ड खाली नहीं हो सकता।' });
    }

    store.schoolSettings.adminUserId = cleanId;
    store.schoolSettings.adminPassword = cleanPass;
    store.schoolSettings.adminEmail = cleanEmail;
    store.lastUpdated = new Date().toISOString();
    saveStore();

    console.log(`[Admin Auth] Admin credentials successfully changed! Email: "${cleanEmail}", User ID: "${cleanId}"`);
    return res.json({
      success: true,
      adminEmail: cleanEmail,
      adminUserId: cleanId,
      message: 'नया एडमिन ईमेल और पासवर्ड सफलतापूर्वक सुरक्षित हो गया। केवल यही नया क्रेडेंशियल मान्य रहेगा।',
    });
  });

  // Save full state (Students, Subjects, Settings, Grade Rules)
  app.post('/api/admin/data', async (req, res) => {
    const { students, subjects, schoolSettings, gradeRules, deletedStudents, clearedMarksHistory, staffUsers } = req.body;
    if (Array.isArray(students)) {
      store.students = students.map(normalizeStudent);
      if (students.length === 0 && firestoreDb) {
        try {
          const snap = await getDocs(collection(firestoreDb, 'students'));
          if (!snap.empty) {
            const batch = writeBatch(firestoreDb);
            snap.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        } catch (e) {
          console.warn('[Firestore] Error clearing students on save:', e);
        }
      }
    }
    if (Array.isArray(subjects) && subjects.length > 0) store.subjects = subjects;
    if (Array.isArray(deletedStudents)) store.deletedStudents = deletedStudents;
    if (Array.isArray(clearedMarksHistory)) store.clearedMarksHistory = clearedMarksHistory;
    if (Array.isArray(staffUsers)) store.staffUsers = staffUsers;
    if (schoolSettings && typeof schoolSettings === 'object') {
      // Retain active credentials if incoming object omits or leaves them blank
      const preservedEmail = schoolSettings.adminEmail?.trim() || store.schoolSettings.adminEmail || 'kuldeeprai75220@gmail.com';
      const preservedUserId = schoolSettings.adminUserId?.trim() || store.schoolSettings.adminUserId || 'Kld7522';
      const preservedPassword = schoolSettings.adminPassword?.trim() || store.schoolSettings.adminPassword || 'Kld@2314';
      store.schoolSettings = normalizeSchoolSettings({
        ...store.schoolSettings,
        ...schoolSettings,
        adminEmail: preservedEmail,
        adminUserId: preservedUserId,
        adminPassword: preservedPassword,
      });
    }
    if (Array.isArray(gradeRules)) store.gradeRules = gradeRules;
    store.lastUpdated = new Date().toISOString();
    saveStore();

    if (store.schoolSettings?.googleSheetWebAppUrl) {
      try {
        const portalConfigFile = path.join(process.cwd(), 'public', 'portal-config.json');
        fs.writeFileSync(
          portalConfigFile,
          JSON.stringify({
            googleSheetWebAppUrl: store.schoolSettings.googleSheetWebAppUrl,
            description: "Public portal configuration for multi-device sync",
            updatedAt: new Date().toISOString()
          }, null, 2),
          'utf-8'
        );
      } catch (e) {
        console.warn('Failed to update portal-config.json:', e);
      }
    }

    res.json({ success: true, store });
    syncToGoogleSheetInBackground();
  });

  // Dedicated Clear All Students Endpoint (Wipes all students and trash permanently from DB & Firestore)
  app.post(['/api/admin/student/clear-all', '/api/admin/clear-all-students'], async (req, res) => {
    store.students = [];
    store.deletedStudents = [];
    store.lastUpdated = new Date().toISOString();
    saveStore();

    if (firestoreDb) {
      try {
        const snap = await getDocs(collection(firestoreDb, 'students'));
        if (!snap.empty) {
          const batch = writeBatch(firestoreDb);
          snap.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        const trashSnap = await getDocs(collection(firestoreDb, 'deleted_students'));
        if (!trashSnap.empty) {
          const batchTrash = writeBatch(firestoreDb);
          trashSnap.forEach((d) => batchTrash.delete(d.ref));
          await batchTrash.commit();
        }
      } catch (err) {
        console.warn('[Firestore] clear-all error:', err);
      }
    }

    console.log('[Server] Successfully cleared all students and trash.');
    res.json({ success: true, students: [], deletedStudents: [] });
  });

  app.post('/api/admin/student', async (req, res) => {
    if (Array.isArray(req.body)) {
      store.students = req.body.map(normalizeStudent);
      store.lastUpdated = new Date().toISOString();
      saveStore();
      if (store.students.length === 0 && firestoreDb) {
        try {
          const snap = await getDocs(collection(firestoreDb, 'students'));
          if (!snap.empty) {
            const batch = writeBatch(firestoreDb);
            snap.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        } catch (e) {}
      }
      res.json({ success: true, students: store.students });
      syncToGoogleSheetInBackground();
      return;
    }

    const studentData = req.body;
    if (!studentData.name || !studentData.rollNo) {
      return res.status(400).json({ error: 'Student Name and Roll Number are required.' });
    }

    const normalized = normalizeStudent(studentData);
    const existingIndex = store.students.findIndex((s) => s.id === normalized.id);
    if (existingIndex >= 0) {
      store.students[existingIndex] = { ...store.students[existingIndex], ...normalized };
    } else {
      const newId = normalized.id || `std-${Date.now()}`;
      store.students.push({ ...normalized, id: newId });
    }
    store.lastUpdated = new Date().toISOString();
    saveStore();
    res.json({ success: true, students: store.students });
    syncToGoogleSheetInBackground();
  });

  app.delete('/api/admin/student/:id', (req, res) => {
    const { id } = req.params;
    const toDelete = store.students.find((s) => s.id === id);
    const now = new Date().toISOString();
    if (toDelete) {
      store.deletedStudents = store.deletedStudents || [];
      store.deletedStudents = [
        { ...toDelete, deletedAt: now },
        ...store.deletedStudents.filter((s) => s.id !== id),
      ];
    }
    store.students = store.students.filter((s) => s.id !== id);
    store.lastUpdated = now;
    saveStore();

    // Directly delete from Firestore students and mirror into deleted_students
    if (firestoreDb && id) {
      deleteDoc(doc(firestoreDb, 'students', id)).catch((e) => console.warn('[Firestore] Delete student error:', e));
      if (toDelete) {
        setDoc(doc(firestoreDb, 'deleted_students', id), cleanForDb({ ...toDelete, deletedAt: now }), { merge: true }).catch(() => {});
      }
    }

    res.json({ success: true, students: store.students, deletedStudents: store.deletedStudents });
    syncToGoogleSheetInBackground();
  });

  app.post('/api/admin/student/batch-delete', (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of student IDs required' });
    }
    const idSet = new Set(ids);
    const toDeleteList = store.students.filter((s) => idSet.has(s.id));
    const now = new Date().toISOString();
    store.deletedStudents = store.deletedStudents || [];
    const newDeleted = toDeleteList.map((s) => ({ ...s, deletedAt: now }));
    store.deletedStudents = [...newDeleted, ...store.deletedStudents.filter((s) => !idSet.has(s.id))];
    store.students = store.students.filter((s) => !idSet.has(s.id));
    store.lastUpdated = now;
    saveStore();

    // Directly execute batch delete in Firestore
    if (firestoreDb && ids.length > 0) {
      (async () => {
        try {
          const chunkSize = 200;
          for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const batch = writeBatch(firestoreDb);
            for (const id of chunk) {
              batch.delete(doc(firestoreDb, 'students', id));
              const std = toDeleteList.find((s) => s.id === id);
              if (std) {
                batch.set(doc(firestoreDb, 'deleted_students', id), cleanForDb({ ...std, deletedAt: now }), { merge: true });
              }
            }
            await batch.commit();
          }
        } catch (err) {
          console.warn('[Firestore] Batch delete error:', err);
        }
      })();
    }

    res.json({ success: true, students: store.students, deletedStudents: store.deletedStudents });
    syncToGoogleSheetInBackground();
  });

  app.get('/api/admin/trash', (req, res) => {
    res.json({ success: true, deletedStudents: store.deletedStudents || [] });
  });

  app.post('/api/admin/trash/restore/:id', (req, res) => {
    const { id } = req.params;
    store.deletedStudents = store.deletedStudents || [];
    const toRestore = store.deletedStudents.find((s) => s.id === id);
    if (toRestore) {
      const { deletedAt, ...active } = toRestore;
      store.students.push(active);
      store.deletedStudents = store.deletedStudents.filter((s) => s.id !== id);
      store.lastUpdated = new Date().toISOString();
      saveStore();

      // Mirror restore in Firestore
      if (firestoreDb) {
        const batch = writeBatch(firestoreDb);
        batch.set(doc(firestoreDb, 'students', id), cleanForDb(active), { merge: true });
        batch.delete(doc(firestoreDb, 'deleted_students', id));
        batch.commit().catch(() => {});
      }
    }
    res.json({ success: true, students: store.students, deletedStudents: store.deletedStudents });
    syncToGoogleSheetInBackground();
  });

  app.post('/api/admin/trash/restore-all', (req, res) => {
    store.deletedStudents = store.deletedStudents || [];
    const restored = store.deletedStudents.map((s) => {
      const { deletedAt, ...active } = s;
      return active;
    });
    store.students.push(...restored);
    const restoredIds = store.deletedStudents.map((s) => s.id);
    store.deletedStudents = [];
    store.lastUpdated = new Date().toISOString();
    saveStore();

    if (firestoreDb && restored.length > 0) {
      (async () => {
        try {
          const chunkSize = 200;
          for (let i = 0; i < restored.length; i += chunkSize) {
            const chunk = restored.slice(i, i + chunkSize);
            const batch = writeBatch(firestoreDb);
            for (const st of chunk) {
              if (st && st.id) {
                batch.set(doc(firestoreDb, 'students', st.id), cleanForDb(st), { merge: true });
                batch.delete(doc(firestoreDb, 'deleted_students', st.id));
              }
            }
            await batch.commit();
          }
        } catch (err) {
          console.warn('[Firestore] Restore all error:', err);
        }
      })();
    }

    res.json({ success: true, students: store.students, deletedStudents: store.deletedStudents });
    syncToGoogleSheetInBackground();
  });

  // Permanently delete a single student from Recycle Bin
  app.delete('/api/admin/trash/:id', (req, res) => {
    const { id } = req.params;
    store.deletedStudents = store.deletedStudents || [];
    store.deletedStudents = store.deletedStudents.filter((s) => s.id !== id);
    store.lastUpdated = new Date().toISOString();
    saveStore();

    // Permanently remove document from Firestore deleted_students collection
    if (firestoreDb && id) {
      deleteDoc(doc(firestoreDb, 'deleted_students', id)).catch((err) =>
        console.warn('[Firestore] Permanent delete trash error:', err)
      );
    }

    res.json({ success: true, deletedStudents: store.deletedStudents });
  });

  // Permanently empty entire Recycle Bin
  app.delete('/api/admin/trash', async (req, res) => {
    store.deletedStudents = [];
    store.lastUpdated = new Date().toISOString();
    saveStore();

    // Permanently purge all documents in Firestore deleted_students collection
    if (firestoreDb) {
      try {
        const snap = await getDocs(collection(firestoreDb, 'deleted_students'));
        if (!snap.empty) {
          const batch = writeBatch(firestoreDb);
          snap.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        console.warn('[Firestore] Empty trash error:', err);
      }
    }

    res.json({ success: true, deletedStudents: [] });
  });

  // Fetch Link Endpoint (For Bulk Import from Google Sheets link or web CSV link without CORS)
  app.post('/api/admin/fetch-link', async (req, res) => {
    let { url } = req.body || {};
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: 'कृपया एक मान्य URL (जैसे Google Sheet लिंक या CSV लिंक) दर्ज करें।',
      });
    }

    url = url.trim();
    // Auto-convert standard Google Sheets edit/view URLs to direct CSV export format
    if (url.includes('docs.google.com/spreadsheets/d/')) {
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        const sheetId = match[1];
        let gid = '0';
        const gidMatch = url.match(/gid=([0-9]+)/);
        if (gidMatch && gidMatch[1]) gid = gidMatch[1];
        url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      }
    }

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        return res.status(400).json({
          success: false,
          error: `गूगल शीट/लिंक लोड नहीं हो सका (HTTP ${response.status})। कृपया सुनिश्चित करें कि गूगल शीट 'Anyone with the link can view' पर सेट है।`,
        });
      }

      const content = await response.text();
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'लिंक से प्राप्त डेटा खाली है।' });
      }

      res.json({ success: true, content });
    } catch (err: any) {
      console.warn('[Fetch Link Error]:', err);
      res.status(500).json({
        success: false,
        error: `लिंक लोड करने में समस्या: ${err.message || 'नेटवर्क समस्या'}। कृपया लिंक जांचें या CSV फ़ाइल अपलोड करें।`,
      });
    }
  });

  // Cleared Marks Backups (Recycle Bin for Marks)
  app.get('/api/admin/cleared-marks', (req, res) => {
    res.json({ success: true, clearedMarksHistory: store.clearedMarksHistory || [] });
  });

  app.post('/api/admin/cleared-marks', (req, res) => {
    const backup = req.body;
    if (!backup || !backup.id) {
      return res.status(400).json({ error: 'Valid backup object required.' });
    }
    store.clearedMarksHistory = store.clearedMarksHistory || [];
    // Prepend to history
    store.clearedMarksHistory = [backup, ...store.clearedMarksHistory.filter((b: any) => b.id !== backup.id)];
    store.lastUpdated = new Date().toISOString();
    saveStore();
    res.json({ success: true, clearedMarksHistory: store.clearedMarksHistory });
  });

  app.delete('/api/admin/cleared-marks/:id', (req, res) => {
    const { id } = req.params;
    store.clearedMarksHistory = store.clearedMarksHistory || [];
    store.clearedMarksHistory = store.clearedMarksHistory.filter((b: any) => b.id !== id);
    store.lastUpdated = new Date().toISOString();
    saveStore();
    res.json({ success: true, clearedMarksHistory: store.clearedMarksHistory });
  });

  app.delete('/api/admin/cleared-marks', (req, res) => {
    store.clearedMarksHistory = [];
    store.lastUpdated = new Date().toISOString();
    saveStore();
    res.json({ success: true, clearedMarksHistory: [] });
  });

  app.post('/api/admin/marks', (req, res) => {
    const { studentId, marks, teacherRemark, assignedSubjectIds } = req.body;
    const student = store.students.find((s) => s.id === studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    if (marks && typeof marks === 'object') student.marks = marks;
    if (teacherRemark !== undefined) student.teacherRemark = teacherRemark;
    if (Array.isArray(assignedSubjectIds)) {
      student.assignedSubjectIds = assignedSubjectIds.map(String).filter(Boolean);
    }
    store.lastUpdated = new Date().toISOString();
    saveStore();
    res.json({ success: true, student });
    syncToGoogleSheetInBackground();
  });

  app.post('/api/admin/subjects', (req, res) => {
    const { subjects } = req.body;
    if (Array.isArray(subjects)) {
      store.subjects = subjects;
      saveStore();
      res.json({ success: true, subjects: store.subjects });
      syncToGoogleSheetInBackground();
    } else {
      res.status(400).json({ error: 'Invalid subjects array' });
    }
  });

  app.post('/api/admin/settings', (req, res) => {
    const newSettings = req.body;
    store.schoolSettings = { ...store.schoolSettings, ...newSettings };
    saveStore();
    res.json({ success: true, schoolSettings: store.schoolSettings });
    syncToGoogleSheetInBackground();
  });

  app.post('/api/admin/grades', (req, res) => {
    const { gradeRules } = req.body;
    if (Array.isArray(gradeRules)) {
      store.gradeRules = gradeRules;
      saveStore();
      res.json({ success: true, gradeRules: store.gradeRules });
      syncToGoogleSheetInBackground();
    } else {
      res.status(400).json({ error: 'Invalid gradeRules array' });
    }
  });

  app.post('/api/admin/sync-sheet', async (req, res) => {
    const sheetUrl = req.body?.url || store.schoolSettings?.googleSheetWebAppUrl;
    if (!sheetUrl || !sheetUrl.startsWith('http')) {
      return res.status(400).json({ error: 'Valid Google Sheet URL is required' });
    }
    try {
      const response = await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncAll',
          schoolSettings: store.schoolSettings,
          students: store.students,
          subjects: store.subjects,
          gradeRules: store.gradeRules,
        }),
        signal: AbortSignal.timeout(45000),
      });
      const data = await response.json();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Sync failed' });
    }
  });

  // Seamless Admin URL Handling: Redirect /admin to /?admin to prevent 404 on Back button / refresh
  app.get(['/admin', '/admin/'], (req, res) => {
    res.redirect(302, '/?admin');
  });

  // Vite middleware in dev or static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const indexPath = path.join(process.cwd(), 'index.html');
        let html = fs.readFileSync(indexPath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        if (vite && typeof vite.ssrFixStacktrace === 'function') {
          vite.ssrFixStacktrace(err as Error);
        }
        next(err);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Result Portal server running on http://localhost:${PORT}`);
  });
}

startServer();
