import { Student, SubjectConfig, SchoolSettings, GradeRule } from '../types';
import { formatDisplayDate } from './calculations';

export const DEFAULT_FALLBACK_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzItfB0hnC38GWywI4SGxay7THA3AXcuULIsWIo9Zg9GKYlIzzRAkFzTW3brKoxmmMQ/exec';

/**
 * Returns the effective Google Sheet Web App URL from all potential sources:
 * 1. School Settings stored in app/database
 * 2. localStorage ('google_sheet_webapp_url')
 * 3. Vite environment variable (VITE_GOOGLE_SHEET_URL) configured in Vercel or GitHub
 * 4. Production fallback Google Sheet URL
 */
export function getGoogleSheetUrl(settings?: SchoolSettings): string {
  const isStaleUrl = (url?: string | null) => {
    if (!url) return true;
    return (
      url.includes('AKfycbwFMPA6Zf3SfRQF2eWP3zt7TjAXy47lAmP8zGlEiSmwN4ksFC-IKuyGWln3g0YEM7HRNg') ||
      url.includes('AKfycbwjEIjK4Ldc3ZAOt8ICHFBBpCdic86k50TMx5QybZRI12-4v8L1nr-b9w3BBEHjCx5H')
    );
  };

  if (settings?.googleSheetWebAppUrl && settings.googleSheetWebAppUrl.trim().startsWith('http')) {
    if (!isStaleUrl(settings.googleSheetWebAppUrl)) {
      return settings.googleSheetWebAppUrl.trim();
    }
  }
  const fromLocal = typeof localStorage !== 'undefined' ? localStorage.getItem('google_sheet_webapp_url') : null;
  if (fromLocal && fromLocal.trim().startsWith('http') && !isStaleUrl(fromLocal)) {
    return fromLocal.trim();
  }
  const fromEnv = (import.meta as any).env?.VITE_GOOGLE_SHEET_URL;
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim().startsWith('http') && !isStaleUrl(fromEnv)) {
    return fromEnv.trim();
  }
  return DEFAULT_FALLBACK_SHEET_URL;
}

export function saveGoogleSheetUrl(url: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('google_sheet_webapp_url', url.trim());
  }
}

/**
 * Test connectivity with Google Apps Script Web App
 */
export async function testGoogleSheetConnection(url: string): Promise<{ success: boolean; message: string; data?: any }> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    return { success: false, message: 'कृपया पहले Google Sheet Web App URL दर्ज करें!' };
  }

  try {
    const res = await fetch(`${cleanUrl}?action=settings`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return {
        success: false,
        message: `कनेक्शन स्टेटस: HTTP ${res.status}. सुनिश्चित करें कि Google Apps Script में "Who has access: Anyone" चुना गया है।`,
      };
    }

    const data = await res.json().catch(() => null);
    return {
      success: true,
      message: 'सफलतापूर्वक Google Sheet से कनेक्ट हो गया! (Google Sheet Live Connection Active)',
      data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `कनेक्शन एरर: ${err.message || 'नेटवर्क या CORS की समस्या'}. कृपया सुनिश्चित करें कि आपने Google Apps Script में "New Deployment" बनाया है।`,
    };
  }
}

/**
 * Fetch all students, subjects, settings, and grade rules from Google Sheet
 */
export async function fetchAllFromGoogleSheet(url: string): Promise<{
  students?: Student[];
  subjects?: SubjectConfig[];
  settings?: Partial<SchoolSettings>;
  gradeRules?: GradeRule[];
  classTeachers?: import('../types').ClassTeacherConfig[];
} | null> {
  const cleanUrl = url.trim();
  if (!cleanUrl) return null;

  try {
    const res = await fetch(`${cleanUrl}?action=allData`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (!json) return null;

    const normalizedStudents: Student[] | undefined = Array.isArray(json.students)
      ? json.students.map((s: any) => ({
          ...s,
          dob: formatDisplayDate(s.dob),
          mobile: s.mobile !== undefined && s.mobile !== null ? String(s.mobile).trim() : '',
          address: s.address !== undefined && s.address !== null ? String(s.address).trim() : '',
          aadharNo: s.aadharNo !== undefined && s.aadharNo !== null ? String(s.aadharNo).trim() : '',
          aparId: s.aparId !== undefined && s.aparId !== null ? String(s.aparId).trim() : ((s as any).apaarId ? String((s as any).apaarId).trim() : ''),
        }))
      : undefined;

    return {
      students: normalizedStudents,
      subjects: Array.isArray(json.subjects) ? json.subjects : undefined,
      settings: json.settings && typeof json.settings === 'object' ? json.settings : undefined,
      gradeRules: Array.isArray(json.gradeRules) ? json.gradeRules : undefined,
      classTeachers: Array.isArray(json.classTeachers)
        ? json.classTeachers
        : Array.isArray(json.teachers)
        ? json.teachers
        : undefined,
    };
  } catch (err) {
    console.warn('Could not fetch allData from Google Sheet:', err);
    return null;
  }
}

export interface LiveSheetSearchResult {
  student: Student;
  subjects?: SubjectConfig[];
  school?: Partial<SchoolSettings>;
}

/**
 * Search single student result from Google Sheet by Roll No or Admission No
 * Returns the student data along with live subjects and school settings from the sheet.
 */
export async function searchStudentFromGoogleSheet(url: string, query: string): Promise<LiveSheetSearchResult | null> {
  const cleanUrl = url.trim();
  const cleanQuery = query.trim();
  if (!cleanUrl || !cleanQuery) return null;

  try {
    const res = await fetch(
      `${cleanUrl}?roll=${encodeURIComponent(cleanQuery)}&admission=${encodeURIComponent(cleanQuery)}`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );

    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.student) {
      const st = json.student;
      const normalizedStudent: Student = {
        ...st,
        dob: formatDisplayDate(st.dob),
        mobile: st.mobile !== undefined && st.mobile !== null ? String(st.mobile).trim() : '',
        address: st.address !== undefined && st.address !== null ? String(st.address).trim() : '',
        aadharNo: st.aadharNo !== undefined && st.aadharNo !== null ? String(st.aadharNo).trim() : '',
        aparId: st.aparId !== undefined && st.aparId !== null ? String(st.aparId).trim() : ((st as any).apaarId ? String((st as any).apaarId).trim() : ''),
      };
      return {
        student: normalizedStudent,
        subjects: Array.isArray(json.subjects) ? json.subjects : undefined,
        school: json.school && typeof json.school === 'object' ? json.school : undefined,
      };
    }
    return null;
  } catch (err) {
    console.warn('Google Sheet student query failed:', err);
    return null;
  }
}

/**
 * Push all local data (Students, Marks, Subjects, School Settings, Grade Rules)
 * directly into Google Sheets.
 */
export async function syncAllDataToGoogleSheet(
  url: string,
  payload: {
    schoolSettings: SchoolSettings;
    students: Student[];
    subjects: SubjectConfig[];
    gradeRules: GradeRule[];
    classTeachers?: import('../types').ClassTeacherConfig[];
  }
): Promise<{ success: boolean; message: string }> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    return { success: false, message: 'Google Sheet Web App URL सेट नहीं है!' };
  }

  const syncData = {
    action: 'syncAll',
    schoolSettings: payload.schoolSettings,
    students: payload.students,
    subjects: payload.subjects,
    gradeRules: payload.gradeRules,
    classTeachers: payload.classTeachers || payload.schoolSettings.classTeachers || [],
    timestamp: new Date().toISOString(),
  };

  try {
    // Send as POST payload
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors', // Essential for Google Apps Script Web App redirects
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(syncData),
    });

    return {
      success: true,
      message: 'डाटा Google Sheet में सफलतापूर्वक भेज दिया गया है! (Synchronized to Google Sheet)',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Google Sheet में सिंक करने में त्रुटि: ${err.message}`,
    };
  }
}

/**
 * The Complete, Production-Ready Google Apps Script Backend Code
 * for Google Sheets deployment.
 */
export const GOOGLE_APPS_SCRIPT_CODE = `// ============================================================================
// Google Apps Script Backend for H.D. Pandey Public Junior High School Result Portal
// ============================================================================

/**
 * 1-CLICK ALL-SHEETS SETUP & AUTO-MIGRATION FUNCTION
 * Run this function directly from Apps Script or call via API to automatically
 * create, verify, and format all 7 sheets with all latest columns (including Mobile & Aadhar_No).
 * You never have to manually create or configure sheets again!
 */
function setupOrUpdateAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Helper: Format Header
  function formatHeader(sheet, colCount) {
    if (!sheet || colCount < 1) return;
    try {
      sheet.setFrozenRows(1);
      var headerRange = sheet.getRange(1, 1, 1, colCount);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0f2b48");
      headerRange.setFontColor("#ffffff");
    } catch (e) {}
  }

  // 1. STUDENTS SHEET
  var sHeaders = [
    "Student_ID", "Student_Name", "Father_Name", "Mother_Name", "Date_of_Birth", "Gender",
    "Class", "Section", "Roll_No", "Admission_No", "Photo_URL", "Session", "Teacher_Remark",
    "Mobile", "Address", "Aadhar_No", "APAAR_ID"
  ];
  var sSheet = ss.getSheetByName("Students");
  if (!sSheet) {
    sSheet = ss.insertSheet("Students");
    sSheet.appendRow(sHeaders);
  } else {
    var currHeaders = sSheet.getRange(1, 1, 1, Math.max(sSheet.getLastColumn(), 1)).getValues()[0];
    var hMap = {};
    for (var h = 0; h < currHeaders.length; h++) {
      hMap[String(currHeaders[h] || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")] = true;
    }
    if (!hMap["mobile"] && !hMap["phone"]) {
      sSheet.getRange(1, sSheet.getLastColumn() + 1).setValue("Mobile");
    }
    if (!hMap["address"] && !hMap["pata"]) {
      sSheet.getRange(1, sSheet.getLastColumn() + 1).setValue("Address");
    }
    if (!hMap["aadharno"] && !hMap["aadhar"] && !hMap["adhar"]) {
      sSheet.getRange(1, sSheet.getLastColumn() + 1).setValue("Aadhar_No");
    }
    if (!hMap["aparid"] && !hMap["apaarid"] && !hMap["apar"] && !hMap["apaar"]) {
      sSheet.getRange(1, sSheet.getLastColumn() + 1).setValue("APAAR_ID");
    }
  }
  formatHeader(sSheet, sSheet.getLastColumn());

  // 2. MARKS SHEET
  var mHeaders = ["Student_ID", "Subject_ID", "Subject_Name", "Half_Max", "Half_Obtained", "Annual_Max", "Annual_Obtained"];
  var mSheet = ss.getSheetByName("Marks") || ss.insertSheet("Marks");
  if (mSheet.getLastRow() === 0) {
    mSheet.appendRow(mHeaders);
  }
  formatHeader(mSheet, mHeaders.length);

  // 3. SUBJECTS SHEET
  var subHeaders = ["Subject_ID", "Subject_Name", "Display_Order", "Half_Max", "Annual_Max", "Passing_Marks", "Active"];
  var subSheet = ss.getSheetByName("Subjects") || ss.insertSheet("Subjects");
  if (subSheet.getLastRow() === 0) {
    subSheet.appendRow(subHeaders);
    var defaultSubs = [
      ["sub-hindi", "HINDI", 1, 50, 50, 33, "TRUE"],
      ["sub-english", "ENGLISH", 2, 50, 50, 33, "TRUE"],
      ["sub-maths", "MATHEMATICS", 3, 50, 50, 33, "TRUE"],
      ["sub-science", "SCIENCE", 4, 50, 50, 33, "TRUE"],
      ["sub-social", "SOCIAL SCIENCE", 5, 50, 50, 33, "TRUE"],
      ["sub-sanskrit", "SANSKRIT", 6, 50, 50, 33, "TRUE"],
      ["sub-computer", "COMPUTER / ART", 7, 50, 50, 33, "TRUE"]
    ];
    subSheet.getRange(2, 1, defaultSubs.length, subHeaders.length).setValues(defaultSubs);
  }
  formatHeader(subSheet, subHeaders.length);

  // 4. SCHOOL_SETTINGS SHEET
  var setHeaders = ["Setting", "Value"];
  var setSheet = ss.getSheetByName("School_Settings") || ss.insertSheet("School_Settings");
  if (setSheet.getLastRow() === 0) {
    setSheet.appendRow(setHeaders);
    var defaultSettings = [
      ["school_name", "H.D. PANDEY PUBLIC JUNIOR HIGH SCHOOL"],
      ["address", "KUSHMAHA, SANT KABIR NAGAR, U.P."],
      ["managed_by", "H.D. Pandey Shikshan Sansthan"],
      ["mobile", "9838123456"],
      ["tagline", "Estd. 2005 • Affiliated to UP Basic Shiksha Parishad"],
      ["session", "2025–2026"],
      ["activeClasses", "5th,6th,7th,8th"],
      ["defaultExamMode", "combined"],
      ["showHalfYearlyExam", "true"],
      ["showAnnualExam", "true"],
      ["showStudentMobile", "true"],
      ["showStudentAadhar", "true"],
      ["showTeacherRemarks", "true"],
      ["showSignatures", "true"]
    ];
    setSheet.getRange(2, 1, defaultSettings.length, 2).setValues(defaultSettings);
  }
  formatHeader(setSheet, 2);

  // 5. GRADE_SETTINGS SHEET
  var gHeaders = ["Min_Percentage", "Max_Percentage", "Grade", "Description"];
  var gSheet = ss.getSheetByName("Grade_Settings") || ss.insertSheet("Grade_Settings");
  if (gSheet.getLastRow() === 0) {
    gSheet.appendRow(gHeaders);
    var defaultGrades = [
      [91, 100, "A1", "Outstanding"],
      [81, 90, "A2", "Excellent"],
      [71, 80, "B1", "Very Good"],
      [61, 70, "B2", "Good"],
      [51, 60, "C1", "Above Average"],
      [41, 50, "C2", "Average"],
      [33, 40, "D", "Passed"],
      [0, 32, "E", "Needs Improvement"]
    ];
    gSheet.getRange(2, 1, defaultGrades.length, 4).setValues(defaultGrades);
  }
  formatHeader(gSheet, 4);

  // 6. REMARKS SHEET
  var rHeaders = ["Remark_ID", "Class", "Performance_Level", "Remark_Text"];
  var rSheet = ss.getSheetByName("Remarks") || ss.insertSheet("Remarks");
  if (rSheet.getLastRow() === 0) {
    rSheet.appendRow(rHeaders);
    var defaultRemarks = [
      ["rem-1", "ALL", "EXCELLENT", "Outstanding academic performance and conduct throughout the year!"],
      ["rem-2", "ALL", "GOOD", "Very good academic effort and regular attendance."],
      ["rem-3", "ALL", "AVERAGE", "Satisfactory progress, need more practice in core subjects."]
    ];
    rSheet.getRange(2, 1, defaultRemarks.length, 4).setValues(defaultRemarks);
  }
  formatHeader(rSheet, 4);

  // 7. TEACHERS SHEET
  var tHeaders = ["Class", "Teacher_Name", "Designation", "Mobile", "Signature_URL"];
  var tSheet = ss.getSheetByName("Teachers") || ss.insertSheet("Teachers");
  if (tSheet.getLastRow() === 0) {
    tSheet.appendRow(tHeaders);
    var defaultTeachers = [
      ["NURSERY", "Smt. Anita Sharma", "Class Teacher", "9876543210", ""],
      ["LKG", "Smt. Rekha Verma", "Class Teacher", "9876543211", ""],
      ["UKG", "Smt. Priya Singh", "Class Teacher", "9876543212", ""],
      ["1st", "Smt. Sunita Devi", "Class Teacher", "9876543213", ""],
      ["2nd", "Shri Ramesh Kumar", "Class Teacher", "9876543214", ""],
      ["3rd", "Smt. Geeta Maurya", "Class Teacher", "9876543215", ""],
      ["4th", "Shri Manoj Pandey", "Class Teacher", "9876543216", ""],
      ["5th", "Smt. Kiran Yadav", "Class Teacher", "9876543217", ""],
      ["6th", "Shri Rajesh Gupta", "Class Teacher", "9876543218", ""],
      ["7th", "Shri Dharmendra Singh", "Class Teacher", "9876543219", ""],
      ["8th", "Shri Anand Sharma", "Class Teacher", "9876543220", ""]
    ];
    tSheet.getRange(2, 1, defaultTeachers.length, 5).setValues(defaultTeachers);
  }
  formatHeader(tSheet, 5);

  return {
    status: "success",
    message: "All 7 Sheets (Students, Marks, Subjects, School_Settings, Grade_Settings, Remarks, Teachers) successfully verified & updated!"
  };
}

function doGet(e) {
  var roll = e.parameter ? e.parameter.roll : null;
  var admission = e.parameter ? e.parameter.admission : null;
  var action = e.parameter ? e.parameter.action : null;

  // 0. Auto-initialize or upgrade all sheets structure
  if (action === "initSheets" || action === "setup") {
    var setupRes = setupOrUpdateAllSheets();
    return ContentService.createTextOutput(JSON.stringify(setupRes))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 1. Return School Settings
  if (action === "settings") {
    return ContentService.createTextOutput(JSON.stringify(getSchoolSettings()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Return All Students, Marks, Subjects & Settings for Full Portal Sync
  if (action === "allData") {
    var fullData = {
      students: getAllStudentsWithMarks(),
      subjects: getAllSubjects(),
      settings: getSchoolSettings(),
      gradeRules: getGradeSettings(),
      classTeachers: getAllTeachers()
    };
    return ContentService.createTextOutput(JSON.stringify(fullData))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Search and Calculate Result by Roll or Admission No
  if (roll || admission) {
    var studentResult = calculateResult(roll, admission);
    return ContentService.createTextOutput(JSON.stringify(studentResult))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    app: "H.D. Pandey Public Junior High School Portal",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = e.postData.contents;
    var data = JSON.parse(contents);

    // Auto-ensure all sheets exist before writing
    setupOrUpdateAllSheets();

    if (data.action === "syncAll") {
      saveAllDataToSheets(data);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "All data successfully synchronized to Google Sheets"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "sendOtpEmail") {
      var to = data.toEmail || "kuldeeprai75220@gmail.com";
      var otpCode = data.otp;
      var schName = data.schoolName || "H.D. PANDEY PUBLIC J.H.S.";
      var subj = data.subject || (schName + " - व्यवस्थापक पासवर्ड रीसेट OTP");
      var html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">' +
        '<div style="text-align:center;border-bottom:2px solid #0f2b48;padding-bottom:12px;margin-bottom:20px;">' +
        '<h2 style="color:#0f2b48;margin:0;">' + schName + '</h2>' +
        '<p style="color:#64748b;font-size:13px;margin:4px 0 0 0;">प्रशासनिक पोर्टल सुरक्षा सत्यापन (Admin Portal Security Verification)</p>' +
        '</div>' +
        '<p style="font-size:15px;color:#1e293b;">नमस्ते व्यवस्थापक,</p>' +
        '<p style="font-size:14px;color:#334155;line-height:1.6;">आपके व्यवस्थापक खाते का पासवर्ड रीसेट करने के लिए सत्यापन कोड (OTP) का अनुरोध प्राप्त हुआ है। पासवर्ड रीसेट करने के लिए नीचे दिए गए 6-अंकीय कोड का उपयोग करें:</p>' +
        '<div style="text-align:center;margin:24px 0;padding:16px;background:#f8fafc;border:2px dashed #0f2b48;border-radius:10px;">' +
        '<span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0f2b48;font-family:monospace;">' + otpCode + '</span>' +
        '<p style="font-size:12px;color:#64748b;margin:8px 0 0 0;">यह कोड केवल 15 मिनट के लिए मान्य है।</p>' +
        '</div>' +
        '<p style="font-size:13px;color:#ef4444;">⚠️ यदि आपने पासवर्ड रीसेट का अनुरोध नहीं किया है, तो इस ईमेल को अनदेखा करें। आपके खाते की सुरक्षा सुरक्षित रहेगी।</p>' +
        '<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />' +
        '<p style="font-size:11px;color:#94a3b8;text-align:center;">यह एक स्वचालित संदेश है। कृपया इस ईमेल का उत्तर न दें।</p>' +
        '</div>';

      try {
        MailApp.sendEmail({
          to: to,
          subject: subj,
          htmlBody: html
        });
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "OTP email successfully dispatched to " + to
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (mailErr) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          error: mailErr.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ignored" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ----------------------------------------------------------------------------
// DATA READING FUNCTIONS
// ----------------------------------------------------------------------------

function getOrCreateSheet(name, defaultHeaders) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (defaultHeaders && defaultHeaders.length > 0) {
      sheet.appendRow(defaultHeaders);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight("bold").setBackground("#e2e8f0");
    }
  }
  return sheet;
}

function getSchoolSettings() {
  var sheet = getOrCreateSheet("School_Settings", ["Setting", "Value"]);
  var data = sheet.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < data.length; i++) {
    var key = data[i][0];
    var val = data[i][1];
    if (key) {
      settings[key] = val;
    }
  }
  return settings;
}

function getAllSubjects() {
  var sheet = getOrCreateSheet("Subjects", [
    "Subject_ID", "Subject_Name", "Display_Order", "Half_Max", "Annual_Max", "Passing_Marks", "Active"
  ]);
  var data = sheet.getDataRange().getValues();
  var subjects = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      subjects.push({
        id: String(data[i][0]),
        name: String(data[i][1]),
        displayOrder: Number(data[i][2]) || (i),
        halfMax: Number(data[i][3]) || 100,
        annualMax: Number(data[i][4]) || 100,
        passingMarks: Number(data[i][5]) || 33,
        active: data[i][6] === true || String(data[i][6]).toUpperCase() === "TRUE"
      });
    }
  }
  return subjects;
}

function getGradeSettings() {
  var sheet = getOrCreateSheet("Grade_Settings", ["Min_Percentage", "Max_Percentage", "Grade", "Description"]);
  var data = sheet.getDataRange().getValues();
  var rules = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][2]) {
      rules.push({
        minPercentage: Number(data[i][0]) || 0,
        maxPercentage: Number(data[i][1]) || 100,
        grade: String(data[i][2]),
        description: String(data[i][3] || "")
      });
    }
  }
  return rules;
}

function getAllTeachers() {
  var sheet = getOrCreateSheet("Teachers", [
    "Class", "Teacher_Name", "Designation", "Mobile", "Signature_URL"
  ]);
  var data = sheet.getDataRange().getValues();
  var teachers = [];
  for (var i = 1; i < data.length; i++) {
    var cls = String(data[i][0] || "").trim();
    var name = String(data[i][1] || "").trim();
    if (cls && name) {
      teachers.push({
        id: "teacher-" + cls.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        className: cls,
        teacherName: name,
        designation: String(data[i][2] || "Class Teacher").trim(),
        phone: String(data[i][3] || "").trim(),
        signatureUrl: String(data[i][4] || "").trim()
      });
    }
  }
  return teachers;
}

// Helper to format Date of Birth into DD/MM/YYYY
function formatDobCell(val, displayVal) {
  if (val instanceof Date) {
    var d = ("0" + val.getDate()).slice(-2);
    var m = ("0" + (val.getMonth() + 1)).slice(-2);
    var y = val.getFullYear();
    return d + "/" + m + "/" + y;
  }
  var str = (displayVal !== undefined && displayVal !== null && String(displayVal).trim() !== "")
    ? String(displayVal).trim()
    : (val !== undefined && val !== null ? String(val).trim() : "");
  if (!str) return "01/01/2012";

  // Check DD/MM/YYYY or DD-MM-YYYY
  var dmy = str.match(/^(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{4})$/);
  if (dmy) {
    return ("0" + dmy[1]).slice(-2) + "/" + ("0" + dmy[2]).slice(-2) + "/" + dmy[3];
  }

  // Check YYYY-MM-DD
  var ymd = str.match(/^(\\d{4})[\\/\\-](\\d{1,2})[\\/\\-](\\d{1,2})/);
  if (ymd) {
    return ("0" + ymd[3]).slice(-2) + "/" + ("0" + ymd[2]).slice(-2) + "/" + ymd[1];
  }

  // Parse Date string (e.g. Wed Jun 12 2013 00:00:00 GMT+0530)
  try {
    var parsed = new Date(str);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1950 && parsed.getFullYear() < 2100) {
      var d2 = ("0" + parsed.getDate()).slice(-2);
      var m2 = ("0" + (parsed.getMonth() + 1)).slice(-2);
      var y2 = parsed.getFullYear();
      return d2 + "/" + m2 + "/" + y2;
    }
  } catch (e) {}

  return str;
}

// Clean phone number or Aadhar to prevent scientific notation and preserve formatting
function cleanPhoneOrAadhar(val, displayVal) {
  var disp = (displayVal !== undefined && displayVal !== null) ? String(displayVal).trim() : "";
  if (disp !== "") {
    if (disp.charAt(0) === "'") disp = disp.substring(1).trim();
    return disp;
  }
  if (val === undefined || val === null) return "";
  if (typeof val === "number") {
    return val.toLocaleString("fullwide", { useGrouping: false });
  }
  var sVal = String(val).trim();
  if (sVal.charAt(0) === "'") sVal = sVal.substring(1).trim();
  return sVal;
}

function getAllStudentsWithMarks() {
  var studentsSheet = getOrCreateSheet("Students", [
    "Student_ID", "Student_Name", "Father_Name", "Mother_Name", "Date_of_Birth", "Gender",
    "Class", "Section", "Roll_No", "Admission_No", "Photo_URL", "Session", "Teacher_Remark",
    "Mobile", "Aadhar_No"
  ]);
  var marksSheet = getOrCreateSheet("Marks", [
    "Student_ID", "Subject_ID", "Subject_Name", "Half_Max", "Half_Obtained", "Annual_Max", "Annual_Obtained"
  ]);

  var sData = studentsSheet.getDataRange().getValues();
  var sDisplay = studentsSheet.getDataRange().getDisplayValues();
  var mData = marksSheet.getDataRange().getValues();

  // Index marks by Student_ID -> Subject_ID
  var marksMap = {};
  for (var m = 1; m < mData.length; m++) {
    var sId = String(mData[m][0] || "").trim();
    var subId = String(mData[m][1] || "").trim();
    if (sId) {
      if (!marksMap[sId]) marksMap[sId] = {};
      marksMap[sId][subId] = {
        halfObtained: Number(mData[m][4]) || 0,
        annualObtained: Number(mData[m][6]) || 0
      };
    }
  }

  // Header indexing with multi-keyword and substring support
  var sHeaders = sData.length > 0 ? sData[0] : [];
  function findColIndex(keywords, defaultIdx) {
    // 1. Exact match
    for (var h = 0; h < sHeaders.length; h++) {
      var hClean = String(sHeaders[h] || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      for (var k = 0; k < keywords.length; k++) {
        var kClean = keywords[k].toLowerCase().replace(/[^a-z0-9]/g, "");
        if (hClean === kClean) return h;
      }
    }
    // 2. Substring match (e.g., 'adhar card' contains 'adhar')
    for (var h2 = 0; h2 < sHeaders.length; h2++) {
      var hClean2 = String(sHeaders[h2] || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      for (var k2 = 0; k2 < keywords.length; k2++) {
        var kClean2 = keywords[k2].toLowerCase().replace(/[^a-z0-9]/g, "");
        if (hClean2.indexOf(kClean2) !== -1 || kClean2.indexOf(hClean2) !== -1) {
          return h2;
        }
      }
    }
    return (defaultIdx !== undefined && defaultIdx < sHeaders.length) ? defaultIdx : -1;
  }

  var colId = findColIndex(["studentid", "id", "srno", "sno"], 0);
  var colName = findColIndex(["studentname", "name", "candidate", "student", "vidyarthi", "chhatra"], 1);
  var colFather = findColIndex(["fathername", "father", "guardian", "pita"], 2);
  var colMother = findColIndex(["mothername", "mother", "mata"], 3);
  var colDob = findColIndex(["dateofbirth", "dob", "birthdate", "birth", "janamtithi"], 4);
  var colGender = findColIndex(["gender", "sex", "ling"], 5);
  var colClass = findColIndex(["class", "classname", "standard", "grade", "kaksha"], 6);
  var colSec = findColIndex(["section", "sec", "vibhag", "varg"], 7);
  var colRoll = findColIndex(["rollno", "roll", "rollnumber", "kramank", "anukramank"], 8);
  var colAdm = findColIndex(["admissionno", "admission", "admno", "scholar", "scholarno", "pravesh"], 9);
  var colPhoto = findColIndex(["photourl", "photo", "image", "pic"], 10);
  var colSession = findColIndex(["session", "academicsession", "year", "satr"], 11);
  var colRemark = findColIndex(["teacherremark", "remark", "remarks", "comment"], 12);
  var colMobile = findColIndex(["mobile", "mobileno", "mobilenumber", "phone", "phoneno", "phonenumber", "contact", "contactno", "cell", "mob", "whatsapp"], 13);
  var colAddress = findColIndex(["address", "pata", "studentaddress", "addr", "village", "gram", "city"], 14);
  var colAadhar = findColIndex(["aadharno", "aadhar", "aadharnumber", "aadhaarno", "aadhaarnumber", "aadhaar", "adharno", "adharnumber", "adhar", "uidai", "uid", "aadharcard", "adharcard", "adharcardno"], 15);
  var colApar = findColIndex(["aparid", "apaarid", "apar", "apaar", "onenationid"], 16);

  function getCellVal(rowVals, rowDisplays, idx, def) {
    if (idx < 0 || !rowVals || idx >= rowVals.length) return def || "";
    var disp = (rowDisplays && idx < rowDisplays.length) ? String(rowDisplays[idx] || "").trim() : "";
    if (disp !== "") return disp;
    var raw = rowVals[idx];
    if (raw !== undefined && raw !== null) return String(raw).trim();
    return def || "";
  }

  var students = [];
  for (var i = 1; i < sData.length; i++) {
    var row = sData[i];
    var rowDisplays = (sDisplay && i < sDisplay.length) ? sDisplay[i] : [];

    var id = getCellVal(row, rowDisplays, colId, "");
    var roll = getCellVal(row, rowDisplays, colRoll, "");
    var adm = getCellVal(row, rowDisplays, colAdm, "");
    var name = getCellVal(row, rowDisplays, colName, "");

    // Auto-generate ID if empty so row is not skipped
    if (!id) {
      if (roll) id = "std-" + roll;
      else if (adm) id = "std-" + adm;
      else id = "std-" + i;
    }

    if (name || roll || adm || id) {
      students.push({
        id: id,
        name: name,
        fatherName: getCellVal(row, rowDisplays, colFather, ""),
        motherName: getCellVal(row, rowDisplays, colMother, ""),
        dob: formatDobCell(colDob >= 0 ? row[colDob] : null, colDob >= 0 && rowDisplays ? rowDisplays[colDob] : null),
        gender: getCellVal(row, rowDisplays, colGender, "MALE"),
        className: getCellVal(row, rowDisplays, colClass, "8th"),
        section: getCellVal(row, rowDisplays, colSec, "A"),
        rollNo: roll || String(i),
        admissionNo: adm || ("ADM-" + id),
        photoUrl: getCellVal(row, rowDisplays, colPhoto, ""),
        session: getCellVal(row, rowDisplays, colSession, "2026–2027"),
        teacherRemark: getCellVal(row, rowDisplays, colRemark, ""),
        mobile: cleanPhoneOrAadhar(colMobile >= 0 ? row[colMobile] : "", colMobile >= 0 && rowDisplays ? rowDisplays[colMobile] : ""),
        address: getCellVal(row, rowDisplays, colAddress, ""),
        aadharNo: cleanPhoneOrAadhar(colAadhar >= 0 ? row[colAadhar] : "", colAadhar >= 0 && rowDisplays ? rowDisplays[colAadhar] : ""),
        aparId: cleanPhoneOrAadhar(colApar >= 0 ? row[colApar] : "", colApar >= 0 && rowDisplays ? rowDisplays[colApar] : ""),
        marks: marksMap[id] || {}
      });
    }
  }
  return students;
}

function calculateResult(rollNo, admissionNo) {
  var students = getAllStudentsWithMarks();
  var matched = null;
  var q = (rollNo || admissionNo || "").toString().trim().toLowerCase();
  var qClean = q.replace(/[^a-z0-9]/g, "");

  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    var r = String(s.rollNo || "").trim().toLowerCase();
    var a = String(s.admissionNo || "").trim().toLowerCase();
    var m = String(s.mobile || "").replace(/[^0-9]/g, "");
    var aad = String(s.aadharNo || "").replace(/[^0-9]/g, "");

    if (q && (r === q || a === q)) {
      matched = s;
      break;
    }
    // Also match mobile (10 digits) or aadhar (12 digits) if entered
    if (qClean && qClean.length >= 10 && (m === qClean || aad === qClean)) {
      matched = s;
      break;
    }
  }

  if (!matched) {
    return { status: "not_found", message: "Student record not found" };
  }

  return {
    status: "found",
    student: matched,
    subjects: getAllSubjects(),
    school: getSchoolSettings()
  };
}

// ----------------------------------------------------------------------------
// DATA WRITING FUNCTIONS (CALLED BY syncAll)
// ----------------------------------------------------------------------------

function saveAllDataToSheets(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Save Students (Including Mobile and Aadhar_No)
  if (payload.students && payload.students.length > 0) {
    var sSheet = getOrCreateSheet("Students", [
      "Student_ID", "Student_Name", "Father_Name", "Mother_Name", "Date_of_Birth", "Gender",
      "Class", "Section", "Roll_No", "Admission_No", "Photo_URL", "Session", "Teacher_Remark",
      "Mobile", "Aadhar_No"
    ]);
    // Clear existing data rows
    var lastRow = sSheet.getLastRow();
    if (lastRow > 1) {
      sSheet.getRange(2, 1, lastRow - 1, sSheet.getLastColumn()).clearContent();
    }
    var sRows = [];
    for (var i = 0; i < payload.students.length; i++) {
      var s = payload.students[i];
      var mob = s.mobile ? String(s.mobile).trim() : "";
      var addr = s.address ? String(s.address).trim() : ((s as any).pata ? String((s as any).pata).trim() : "");
      var aad = s.aadharNo ? String(s.aadharNo).trim() : "";
      var apr = s.aparId ? String(s.aparId).trim() : ((s as any).apaarId ? String((s as any).apaarId).trim() : "");
      sRows.push([
        s.id,
        s.name,
        s.fatherName,
        s.motherName,
        formatDobCell(s.dob, s.dob),
        s.gender || "MALE",
        s.className,
        s.section,
        s.rollNo,
        s.admissionNo,
        s.photoUrl || "",
        s.session || "",
        s.teacherRemark || "",
        mob ? ("'" + mob) : "",
        addr || "",
        aad ? ("'" + aad) : "",
        apr ? ("'" + apr) : ""
      ]);
    }
    if (sRows.length > 0) {
      sSheet.getRange(2, 1, sRows.length, sRows[0].length).setValues(sRows);
    }
  }

  // 2. Save Marks
  if (payload.students && payload.subjects) {
    var mSheet = getOrCreateSheet("Marks", [
      "Student_ID", "Subject_ID", "Subject_Name", "Half_Max", "Half_Obtained", "Annual_Max", "Annual_Obtained"
    ]);
    var mLastRow = mSheet.getLastRow();
    if (mLastRow > 1) {
      mSheet.getRange(2, 1, mLastRow - 1, mSheet.getLastColumn()).clearContent();
    }

    var mRows = [];
    for (var j = 0; j < payload.students.length; j++) {
      var st = payload.students[j];
      for (var k = 0; k < payload.subjects.length; k++) {
        var sub = payload.subjects[k];
        var marks = (st.marks && st.marks[sub.id]) ? st.marks[sub.id] : { halfObtained: 0, annualObtained: 0 };
        mRows.push([
          st.id, sub.id, sub.name, sub.halfMax, marks.halfObtained, sub.annualMax, marks.annualObtained
        ]);
      }
    }
    if (mRows.length > 0) {
      mSheet.getRange(2, 1, mRows.length, mRows[0].length).setValues(mRows);
    }
  }

  // 3. Save Subjects
  if (payload.subjects && payload.subjects.length > 0) {
    var subSheet = getOrCreateSheet("Subjects", [
      "Subject_ID", "Subject_Name", "Display_Order", "Half_Max", "Annual_Max", "Passing_Marks", "Active"
    ]);
    var subLastRow = subSheet.getLastRow();
    if (subLastRow > 1) {
      subSheet.getRange(2, 1, subLastRow - 1, subSheet.getLastColumn()).clearContent();
    }
    var subRows = [];
    for (var l = 0; l < payload.subjects.length; l++) {
      var sb = payload.subjects[l];
      subRows.push([
        sb.id, sb.name, sb.displayOrder, sb.halfMax, sb.annualMax, sb.passingMarks, sb.active ? "TRUE" : "FALSE"
      ]);
    }
    if (subRows.length > 0) {
      subSheet.getRange(2, 1, subRows.length, subRows[0].length).setValues(subRows);
    }
  }

  // 4. Save School Settings
  if (payload.schoolSettings) {
    var setSheet = getOrCreateSheet("School_Settings", ["Setting", "Value"]);
    var setLastRow = setSheet.getLastRow();
    if (setLastRow > 1) {
      setSheet.getRange(2, 1, setLastRow - 1, setSheet.getLastColumn()).clearContent();
    }
    var setRows = [];
    var keys = Object.keys(payload.schoolSettings);
    for (var mKey = 0; mKey < keys.length; mKey++) {
      var kName = keys[mKey];
      var kVal = payload.schoolSettings[kName];
      if (typeof kVal !== "undefined" && kVal !== null) {
        setRows.push([kName, String(kVal)]);
      }
    }
    if (setRows.length > 0) {
      setSheet.getRange(2, 1, setRows.length, 2).setValues(setRows);
    }
  }

  // 5. Save Grade Rules
  if (payload.gradeRules && payload.gradeRules.length > 0) {
    var gSheet = getOrCreateSheet("Grade_Settings", ["Min_Percentage", "Max_Percentage", "Grade", "Description"]);
    var gLastRow = gSheet.getLastRow();
    if (gLastRow > 1) {
      gSheet.getRange(2, 1, gLastRow - 1, gSheet.getLastColumn()).clearContent();
    }
    var gRows = [];
    for (var g = 0; g < payload.gradeRules.length; g++) {
      var gr = payload.gradeRules[g];
      gRows.push([gr.minPercentage, gr.maxPercentage, gr.grade, gr.description || ""]);
    }
    if (gRows.length > 0) {
      gSheet.getRange(2, 1, gRows.length, 4).setValues(gRows);
    }
  }

  // 6. Save Teachers
  var teachersToSave = payload.classTeachers || (payload.schoolSettings && payload.schoolSettings.classTeachers);
  if (teachersToSave && teachersToSave.length > 0) {
    var tSheet = getOrCreateSheet("Teachers", [
      "Class", "Teacher_Name", "Designation", "Mobile", "Signature_URL"
    ]);
    var tLastRow = tSheet.getLastRow();
    if (tLastRow > 1) {
      tSheet.getRange(2, 1, tLastRow - 1, tSheet.getLastColumn()).clearContent();
    }
    var tRows = [];
    for (var ti = 0; ti < teachersToSave.length; ti++) {
      var t = teachersToSave[ti];
      tRows.push([
        t.className || "",
        t.teacherName || t.name || "",
        t.designation || "Class Teacher",
        t.phone || "",
        t.signatureUrl || ""
      ]);
    }
    if (tRows.length > 0) {
      tSheet.getRange(2, 1, tRows.length, tRows[0].length).setValues(tRows);
    }
  }
}
`;

export const TEACHERS_SHEET_SAMPLE_CSV = `Class,Teacher_Name,Designation,Mobile,Signature_URL
NURSERY,Smt. Anita Sharma,Class Teacher,9876543210,
LKG,Smt. Rekha Verma,Class Teacher,9876543211,
UKG,Smt. Priya Singh,Class Teacher,9876543212,
1st,Smt. Sunita Devi,Class Teacher,9876543213,
2nd,Shri Ramesh Kumar,Class Teacher,9876543214,
3rd,Smt. Geeta Maurya,Class Teacher,9876543215,
4th,Shri Manoj Pandey,Class Teacher,9876543216,
5th,Smt. Kiran Yadav,Class Teacher,9876543217,
6th,Shri Rajesh Gupta,Class Teacher,9876543218,
7th,Shri Dharmendra Singh,Class Teacher,9876543219,
8th,Shri Anand Sharma,Class Teacher,9876543220,`;

export const STUDENTS_SHEET_HEADER = `Student_ID	Student_Name	Father_Name	Mother_Name	Date_of_Birth	Gender	Class	Section	Roll_No	Admission_No	Photo_URL	Session	Teacher_Remark	Mobile	Address	Aadhar_No`;

export const STUDENTS_SHEET_SAMPLE_CSV = `Student_ID,Student_Name,Father_Name,Mother_Name,Date_of_Birth,Gender,Class,Section,Roll_No,Admission_No,Photo_URL,Session,Teacher_Remark,Mobile,Address,Aadhar_No
std-17,PRIYA SHARMA,RAMESH SHARMA,SUNITA SHARMA,15/07/2012,FEMALE,8th,A,17,ADM-2024-0017,,2026–2027,Excellent academic performance!,9838123456,Gram - Baurbyas Sant Kabir Nagar (U.P.),7845 2310 9012
std-18,AMAN VERMA,RAJESH VERMA,POOJA VERMA,04/11/2011,MALE,8th,A,18,ADM-2024-0018,,2026–2027,Good effort in practical subjects.,9838123457,Gram - Rampur Sant Kabir Nagar (U.P.),6789 1234 5678
std-21,SNEHA GUPTA,VINOD GUPTA,REKHA GUPTA,22/02/2012,FEMALE,8th,A,21,ADM-2024-0021,,2026–2027,Outstanding performance across all terms!,9838123458,Gram - Maghar Sant Kabir Nagar (U.P.),9012 3456 7890`;

/**
 * Trigger remote 1-Click Auto Setup & Upgrade on the Google Apps Script Web App
 */
export async function initializeOrUpgradeGoogleSheet(
  apiUrl: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUrl = (apiUrl || '').trim();
    if (!cleanUrl) {
      return { success: false, message: 'Google Sheet Web App URL is required' };
    }
    const url = new URL(cleanUrl);
    url.searchParams.set('action', 'initSheets');
    const res = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
    const data = await res.json();
    return {
      success: data.status === 'success' || data.status === 'ok',
      message: data.message || 'Google Sheet structure verified and updated successfully!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to initialize Google Sheet structure',
    };
  }
}



