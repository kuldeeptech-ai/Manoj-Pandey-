import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_SCHOOL_SETTINGS,
  DEFAULT_SUBJECTS,
  DEFAULT_STUDENTS,
} from './src/data/defaultData';
import {
  DEFAULT_GRADE_RULES,
  calculateStudentResult,
  normalizeSchoolSettings,
  formatDisplayDate,
} from './src/utils/calculations';

function normalizeStudent(s: any): any {
  if (!s || typeof s !== 'object') return s;
  return {
    ...s,
    dob: formatDisplayDate(s.dob),
    mobile: s.mobile ? String(s.mobile).trim() : '',
    aadharNo: s.aadharNo ? String(s.aadharNo).trim() : '',
  };
}

const DATA_FILE = path.join(process.cwd(), 'data-store.json');

// In-memory data store
let store = {
  schoolSettings: normalizeSchoolSettings({ ...DEFAULT_SCHOOL_SETTINGS }),
  subjects: [...DEFAULT_SUBJECTS],
  students: [...DEFAULT_STUDENTS],
  gradeRules: [...DEFAULT_GRADE_RULES],
  lastUpdated: new Date().toISOString(),
};

// Try loading persisted data
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.schoolSettings) store.schoolSettings = normalizeSchoolSettings(parsed.schoolSettings);
    if (parsed.subjects) store.subjects = parsed.subjects;
    if (parsed.students) store.students = parsed.students;
    if (parsed.gradeRules) store.gradeRules = parsed.gradeRules;
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

// Background sync function (Google Sheets API calls removed in favor of Firebase Realtime Database)
function syncToGoogleSheetInBackground() {
  // No-op: Data is synced in real-time via Firebase Realtime Database
}

async function startServer() {
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
              matched = liveStudent;
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

  // Strict Admin Login Verification Endpoint
  // Always verifies against currently persisted active credentials in store/data-store.json
  // Old credentials will NEVER be accepted once changed!
  app.post('/api/admin/login', (req, res) => {
    const { userId, password } = req.body || {};
    if (!userId || !password) {
      return res.status(400).json({ success: false, error: 'User ID and Password are required.' });
    }

    const currentUserId = (store.schoolSettings?.adminUserId || 'Kld75').trim();
    const currentPassword = (store.schoolSettings?.adminPassword || 'Kld@2314').trim();

    const userMatches = String(userId).trim().toLowerCase() === currentUserId.toLowerCase();
    const passMatches = String(password).trim() === currentPassword;

    if (userMatches && passMatches) {
      const token = `adm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[Admin Auth] Successful login for: ${currentUserId}`);
      return res.json({
        success: true,
        token,
        adminUserId: currentUserId,
        schoolName: store.schoolSettings?.schoolName,
      });
    }

    console.warn(`[Admin Auth] Failed login attempt for user: "${userId}". Current active user is: "${currentUserId}"`);
    return res.status(401).json({
      success: false,
      error: 'अमान्य यूज़र आईडी या पासवर्ड! यदि आपने हाल ही में क्रेडेंशियल्स बदले हैं, तो कृपया नए आईडी और पासवर्ड का ही उपयोग करें। पुराना पासवर्ड अमान्य है।',
    });
  });

  // Dedicated Change Credentials Endpoint
  // Immediately writes new credentials to data-store.json and store in memory
  app.post('/api/admin/change-credentials', (req, res) => {
    const { newUserId, newPassword } = req.body || {};
    const cleanId = String(newUserId || '').trim();
    const cleanPass = String(newPassword || '').trim();

    if (!cleanId || !cleanPass) {
      return res.status(400).json({ success: false, error: 'User ID and Password cannot be blank.' });
    }

    store.schoolSettings.adminUserId = cleanId;
    store.schoolSettings.adminPassword = cleanPass;
    store.lastUpdated = new Date().toISOString();
    saveStore();

    console.log(`[Admin Auth] Admin credentials successfully changed! Active User ID: "${cleanId}"`);
    return res.json({
      success: true,
      adminUserId: cleanId,
      message: 'नया एडमिन यूजर आईडी और पासवर्ड सफलतापूर्वक सुरक्षित हो गया। पुराना पासवर्ड तुरंत निरस्त कर दिया गया है।',
    });
  });

  // Save full state (Students, Subjects, Settings, Grade Rules)
  app.post('/api/admin/data', (req, res) => {
    const { students, subjects, schoolSettings, gradeRules } = req.body;
    if (Array.isArray(students)) store.students = students.map(normalizeStudent);
    if (Array.isArray(subjects)) store.subjects = subjects;
    if (schoolSettings && typeof schoolSettings === 'object') {
      // Retain active credentials if incoming object omits or leaves them blank
      const preservedUserId = schoolSettings.adminUserId?.trim() || store.schoolSettings.adminUserId || 'Kld75';
      const preservedPassword = schoolSettings.adminPassword?.trim() || store.schoolSettings.adminPassword || 'Kld@2314';
      store.schoolSettings = normalizeSchoolSettings({
        ...store.schoolSettings,
        ...schoolSettings,
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

  app.post('/api/admin/student', (req, res) => {
    if (Array.isArray(req.body)) {
      store.students = req.body.map(normalizeStudent);
      store.lastUpdated = new Date().toISOString();
      saveStore();
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
    store.students = store.students.filter((s) => s.id !== id);
    store.lastUpdated = new Date().toISOString();
    saveStore();
    res.json({ success: true, students: store.students });
    syncToGoogleSheetInBackground();
  });

  app.post('/api/admin/marks', (req, res) => {
    const { studentId, marks, teacherRemark } = req.body;
    const student = store.students.find((s) => s.id === studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    if (marks) student.marks = marks;
    if (teacherRemark !== undefined) student.teacherRemark = teacherRemark;
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
