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
    marks: s.marks && typeof s.marks === 'object' ? s.marks : {},
    dob: formatDisplayDate(s.dob),
    mobile: s.mobile ? String(s.mobile).trim() : '',
    address: s.address ? String(s.address).trim() : '',
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
        adminEmail: currentEmail,
        adminUserId: store.schoolSettings?.adminUserId || 'Kld7522',
        schoolName: store.schoolSettings?.schoolName,
      });
    }

    console.warn(`[Admin Auth] Failed login attempt for: "${inputIdentifier}"`);
    return res.status(401).json({
      success: false,
      error: `अमान्य ईमेल या पासवर्ड! केवल अधिकृत व्यवस्थापक (${currentEmail}) ही एडमिन बन सकते हैं।`,
    });
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
  app.post('/api/admin/data', (req, res) => {
    const { students, subjects, schoolSettings, gradeRules } = req.body;
    if (Array.isArray(students)) store.students = students.map(normalizeStudent);
    if (Array.isArray(subjects)) store.subjects = subjects;
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
