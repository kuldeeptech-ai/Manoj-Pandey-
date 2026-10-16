import { GradeRule, ProcessedSubjectRow, ExamSummary, CombinedSummary, Student, SubjectConfig, SchoolSettings, StudentResultData, ClassTeacherConfig } from '../types';

export const DEFAULT_GRADE_RULES: GradeRule[] = [
  { minPercentage: 90, maxPercentage: 100, grade: 'A+', description: 'Outstanding Academic Performance' },
  { minPercentage: 80, maxPercentage: 89.99, grade: 'A', description: 'Excellent Academic Performance' },
  { minPercentage: 70, maxPercentage: 79.99, grade: 'B+', description: 'Very Good Academic Performance' },
  { minPercentage: 60, maxPercentage: 69.99, grade: 'B', description: 'Good Academic Performance' },
  { minPercentage: 50, maxPercentage: 59.99, grade: 'C+', description: 'Satisfactory Academic Performance' },
  { minPercentage: 40, maxPercentage: 49.99, grade: 'C', description: 'Pass - Scope for Improvement' },
  { minPercentage: 0, maxPercentage: 39.99, grade: 'D', description: 'Needs Improvement / Practice' },
];

export function getGradeForPercentage(percentage: number, rules: GradeRule[] = DEFAULT_GRADE_RULES): string {
  // Per user instruction: "grade nhi rakho bas"
  return '';
}

export function validateMark(obtained: number, max: number): { isValid: boolean; error?: string } {
  if (isNaN(obtained) || isNaN(max)) {
    return { isValid: false, error: 'Invalid numeric value' };
  }
  if (obtained < 0) {
    return { isValid: false, error: 'Marks cannot be negative' };
  }
  if (max <= 0) {
    return { isValid: false, error: 'Maximum marks must be greater than 0' };
  }
  if (obtained > max) {
    return { isValid: false, error: `Obtained marks (${obtained}) cannot be greater than maximum marks (${max})` };
  }
  return { isValid: true };
}

export function formatDateTime(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

/**
 * Normalizes any Date representation (including Google Sheet Date objects like
 * "Wed Jun 12 2013 00:00:00 GMT+0530 (India Standard Time)", ISO dates, or timestamps)
 * into standard clean Indian School DD/MM/YYYY format (e.g. 12/06/2013).
 */
export function formatDisplayDate(val: any): string {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';

  // 1. If already DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${d}/${m}/${y}`;
  }

  // 2. If YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // 3. If JavaScript Date string (e.g. Wed Jun 12 2013 00:00:00 GMT+0530)
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1950 && parsed.getFullYear() < 2100) {
      const d = String(parsed.getDate()).padStart(2, '0');
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const y = parsed.getFullYear();
      return `${d}/${m}/${y}`;
    }
  } catch {}

  return str;
}

/**
 * Normalizes a student record to guarantee safe fields and prevents undefined marks crashes
 */
export function normalizeStudentRecord(s: any): Student {
  if (!s || typeof s !== 'object') {
    return {
      id: '',
      rollNo: '',
      name: '',
      fatherName: '',
      motherName: '',
      className: '',
      section: '',
      dob: '',
      gender: 'MALE',
      admissionNo: '',
      session: '2025–2026',
      marks: {},
    };
  }
  return {
    ...s,
    marks: s.marks && typeof s.marks === 'object' ? s.marks : {},
    dob: formatDisplayDate(s.dob),
    mobile: s.mobile ? String(s.mobile).trim() : '',
    address: s.address ? String(s.address).trim() : '',
    aadharNo: s.aadharNo ? String(s.aadharNo).trim() : '',
    aparId: s.aparId ? String(s.aparId).trim() : (s.apaarId ? String(s.apaarId).trim() : ''),
    assignedSubjectIds: Array.isArray(s.assignedSubjectIds)
      ? s.assignedSubjectIds.map(String).filter(Boolean)
      : undefined,
    className: String(s.className || '').trim(),
    rollNo: String(s.rollNo || '').trim(),
    name: String(s.name || '').trim(),
    admissionNo: String(s.admissionNo || '').trim(),
  };
}

/**
 * Universal Boolean normalizer for school settings.
 * Accurately parses boolean, string booleans ("false", "true", "FALSE"), and numbers (0, 1).
 */
export function isSettingEnabled(val: any, defaultVal: boolean = true): boolean {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (val === false || val === 'false' || val === 'FALSE' || val === 0 || val === '0' || val === 'off' || val === 'OFF') {
    return false;
  }
  if (val === true || val === 'true' || val === 'TRUE' || val === 1 || val === '1' || val === 'on' || val === 'ON') {
    return true;
  }
  return Boolean(val);
}

/**
 * Normalizes all SchoolSettings fields, ensuring strict boolean types for all customization toggles.
 */
export function normalizeSchoolSettings(settings?: Partial<SchoolSettings>): SchoolSettings {
  const s = settings || {};
  return {
    ...s,
    schoolName: s.schoolName || 'H.D.P. PUBLIC SCHOOL',
    address: s.address || 'Baurbyas, Shiv Mandir Side S.K.N. (U.P.) – 272154',
    managedBy: s.managedBy || 'Manoj Panday',
    mobile: String(s.mobile || '9838767297'),
    tagline: s.tagline || 'Discipline • Knowledge • Character • Bright Future',
    logoUrl: s.logoUrl || 'https://raw.githubusercontent.com/kuldeeptech-ai/dd/refs/heads/main/my-audio/6a50c4fb-10a6-40ae-afe0-eafeb0a5991b-removebackgrounds-ai.png',
    logoSize: s.logoSize ? Number(s.logoSize) : 100,
    marksheetSchoolNameSize: s.marksheetSchoolNameSize ? Number(s.marksheetSchoolNameSize) : 28,
    publicPortalSchoolNameSize: s.publicPortalSchoolNameSize ? Number(s.publicPortalSchoolNameSize) : 24,
    marksheetTextScale: (s.marksheetTextScale === 'large' || s.marksheetTextScale === 'extra_large' || s.marksheetTextScale === 'normal')
      ? s.marksheetTextScale
      : 'large',
    schoolBadgeType: (s.schoolBadgeType as any) || 'ACADEMIC RESULT',
    resultTitle: s.resultTitle || 'ACADEMIC RESULT — HALF-YEARLY & ANNUAL',
    resultTitleHalfYearly: s.resultTitleHalfYearly || 'ACADEMIC RESULT — HALF-YEARLY EXAMINATION',
    session: s.session || '2026–2027',
    footerText: s.footerText || 'Keep Learning • Keep Growing • Keep Shining!',
    teacherSignatureUrl: s.teacherSignatureUrl || '',
    principalSignatureUrl: s.principalSignatureUrl || '',
    principalStampUrl: s.principalStampUrl || '',
    showDigitalStamp: isSettingEnabled(s.showDigitalStamp, true),
    stampType: s.stampType || 'digital',
    defaultExamMode: s.defaultExamMode || 'half_yearly_only',
    googleSheetWebAppUrl: s.googleSheetWebAppUrl || '',
    classTeachers: Array.isArray(s.classTeachers) ? s.classTeachers : undefined,
    adminUserId: s.adminUserId && String(s.adminUserId).trim()
      ? String(s.adminUserId).trim()
      : (typeof window !== 'undefined' && window.localStorage?.getItem('school_admin_user')) || 'Kld7522',
    adminPassword: s.adminPassword && String(s.adminPassword).trim()
      ? String(s.adminPassword).trim()
      : (typeof window !== 'undefined' && window.localStorage?.getItem('school_admin_pass')) || 'Kld@2314',
    adminEmail: s.adminEmail && String(s.adminEmail).trim()
      ? String(s.adminEmail).trim()
      : (typeof window !== 'undefined' && window.localStorage?.getItem('school_admin_email')) || 'kuldeeprai75220@gmail.com',
    showHalfYearlyExam: isSettingEnabled(s.showHalfYearlyExam, true),
    showAnnualExam: isSettingEnabled(s.showAnnualExam, true),
    showTeacherRemarks: isSettingEnabled(s.showTeacherRemarks, true),
    showStudentPhoto: isSettingEnabled(s.showStudentPhoto, true),
    showSignatures: isSettingEnabled(s.showSignatures, true),
    showPercentage: isSettingEnabled(s.showPercentage, true),
    showGrade: isSettingEnabled(s.showGrade, false),
    showProgressGraph: isSettingEnabled(s.showProgressGraph, true),
    showStudentMobile: isSettingEnabled(s.showStudentMobile, true),
    showStudentAddress: isSettingEnabled(s.showStudentAddress, true),
    showStudentAadhar: isSettingEnabled(s.showStudentAadhar, true),
    allowPublicSearch: isSettingEnabled(s.allowPublicSearch, true),
    enableCaptcha: isSettingEnabled(s.enableCaptcha, true),
    enableAdminLoginCaptcha: isSettingEnabled(s.enableAdminLoginCaptcha, false),
    saveSelectedClass: isSettingEnabled(s.saveSelectedClass, true),
    saveSearchRoll: isSettingEnabled(s.saveSearchRoll, true),
    saveRecentSearches: isSettingEnabled(s.saveRecentSearches, true),
    saveLastResult: isSettingEnabled(s.saveLastResult, true),
    autoFillOnLoad: isSettingEnabled(s.autoFillOnLoad, true),
    isMaintenanceMode: isSettingEnabled(s.isMaintenanceMode, false),
    isResultLive: isSettingEnabled(s.isResultLive, true),
    maintenanceNotice: s.maintenanceNotice || '',
    maintenanceMessage: s.maintenanceMessage || 'पोर्टल पर वर्तमान में मेंटेनेंस एवं अंकपत्र अपडेट का कार्य चल रहा है। कृपया कुछ समय बाद पुनः प्रयास करें।',
    liveBannerText: s.liveBannerText || 'सत्र 2025–2026 की सभी कक्षाओं की मार्कशीट लाइव हो चुकी हैं! आप नीचे अपना रोल नंबर व कक्षा दर्ज करके रिजल्ट देख सकते हैं।',
    activeClasses: Array.isArray(s.activeClasses) && s.activeClasses.length > 0
      ? s.activeClasses.map(c => String(c).trim()).filter(Boolean)
      : ['5th', '6th', '7th', '8th'],
  } as SchoolSettings;
}

/**
 * Finds the matching Class Teacher for a given student's class name,
 * supporting exact matches, normalized matches (e.g., "8th" vs "Class 8"),
 * and individual student teacher overrides.
 */
export function findClassTeacher(
  className: string,
  classTeachers?: ClassTeacherConfig[],
  studentOverride?: { name?: string; signatureUrl?: string }
): { name?: string; signatureUrl?: string; designation: string } {
  if (studentOverride?.name || studentOverride?.signatureUrl) {
    return {
      name: studentOverride.name,
      signatureUrl: studentOverride.signatureUrl,
      designation: 'CLASS TEACHER',
    };
  }

  if (!classTeachers || !Array.isArray(classTeachers) || classTeachers.length === 0) {
    return { designation: 'CLASS TEACHER' };
  }

  const clean = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/^class\s*/i, '')
      .replace(/(\d+)(st|nd|rd|th)/i, '$1')
      .replace(/[^a-z0-9]/g, '')
      .trim();

  const targetClean = clean(className);

  // 1. Exact match
  const exact = classTeachers.find(
    (ct) => ct.className.trim().toLowerCase() === (className || '').trim().toLowerCase()
  );
  if (exact) {
    return {
      name: exact.teacherName,
      signatureUrl: exact.signatureUrl,
      designation: exact.designation || 'CLASS TEACHER',
    };
  }

  // 2. Normalized match (e.g., "8th" vs "Class 8" or "8")
  if (targetClean) {
    const normalized = classTeachers.find((ct) => clean(ct.className) === targetClean);
    if (normalized) {
      return {
        name: normalized.teacherName,
        signatureUrl: normalized.signatureUrl,
        designation: normalized.designation || 'CLASS TEACHER',
      };
    }
  }

  // 3. Substring inclusion
  if (targetClean.length >= 2) {
    const partial = classTeachers.find(
      (ct) => clean(ct.className).includes(targetClean) || targetClean.includes(clean(ct.className))
    );
    if (partial) {
      return {
        name: partial.teacherName,
        signatureUrl: partial.signatureUrl,
        designation: partial.designation || 'CLASS TEACHER',
      };
    }
  }

  return { designation: 'CLASS TEACHER' };
}

/**
 * Checks whether a subject is applicable to a specific class.
 * If applicableClasses is empty, undefined, or includes 'ALL', it applies to all classes.
 */
export function isSubjectApplicableToClass(subject: SubjectConfig, className?: string): boolean {
  if (!subject) return false;
  if (!subject.active) return false;
  if (!subject.applicableClasses || !Array.isArray(subject.applicableClasses) || subject.applicableClasses.length === 0) {
    return true;
  }
  if (subject.applicableClasses.some((c) => String(c).trim().toUpperCase() === 'ALL')) {
    return true;
  }
  if (!className) return true;
  const canonical = canonicalClassName(className);
  return subject.applicableClasses.some(
    (c) => isSameClass(c, className) || isSameClass(c, canonical)
  );
}

/**
 * Returns all active subjects applicable to a given class, sorted by displayOrder.
 * If no className is provided, returns all active subjects.
 */
export function getSubjectsForClass(subjects: SubjectConfig[], className?: string): SubjectConfig[] {
  if (!Array.isArray(subjects)) return [];
  return subjects
    .filter((s) => s.active && (!className || isSubjectApplicableToClass(s, className)))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Checks if a subject is Urdu or marked as optional (e.g. Urdu, Sanskrit, Drawing)
 */
/**
 * Extracts a clean alphanumeric English column prefix for Excel / CSV headers.
 * Strips parentheses, Devanagari text, and repeated underscores.
 * E.g., "Urdu (उर्दू)" -> "Urdu"
 * E.g., "Social Science" -> "Social_Science"
 * E.g., "Hindi ii" -> "Hindi_ii"
 */
export function getCleanSubjectHeader(sub: SubjectConfig): string {
  if (!sub || !sub.name) return 'Subject';
  const name = sub.name.trim();

  // 1. Direct handling for standard subjects to produce clean, consistent Excel headers
  const lower = name.toLowerCase();
  if (lower.startsWith('hindi writing') || lower.startsWith('hindi_writing')) return 'Hindi_Writing';
  if (lower.startsWith('hindi oral') || lower.startsWith('hindi_oral')) return 'Hindi_Oral';
  if (lower.startsWith('english writing') || lower.startsWith('english_writing')) return 'English_Writing';
  if (lower.startsWith('english oral') || lower.startsWith('english_oral')) return 'English_Oral';
  if (lower.startsWith('mathematics writing') || lower.startsWith('maths writing')) return 'Mathematics_Writing';
  if (lower.startsWith('mathematics oral') || lower.startsWith('maths oral')) return 'Mathematics_Oral';

  if (lower === 'hindi 1' || lower === 'hindi 1st' || lower === 'hindi1' || lower === 'hindi_1') return 'Hindi_1';
  if (lower === 'hindi 2' || lower === 'hindi 2nd' || lower === 'hindi2' || lower === 'hindi_2' || lower === 'hindi ii') return 'Hindi_2';
  if (lower === 'english 1' || lower === 'english 1st' || lower === 'english1' || lower === 'english_1') return 'English_1';
  if (lower === 'english 2' || lower === 'english 2nd' || lower === 'english2' || lower === 'english_2' || lower === 'english ii') return 'English_2';
  if (lower === 'mathematics' || lower === 'maths' || lower === 'math') return 'Mathematics';
  if (lower === 'computer') return 'Computer';
  if (lower === 'science') return 'Science';
  if (lower.includes('social studies') || lower.includes('sst') || lower === 'social science') return 'Social_Studies_SST';
  if (lower.includes('drawing') || lower === 'art' || lower === 'kala') return 'Drawing';
  if (lower.includes('physical training') || lower.includes('pt') || lower === 'physical') return 'Physical_Training_PT';
  if (lower.includes('general knowledge') || lower.includes('gk') || lower === 'general') return 'General_Knowledge_GK';
  if (lower.includes('sanskrit') || lower.includes('संस्कृत')) return 'Sanskrit';
  if (lower.includes('urdu') || lower.includes('उर्दू')) return 'Urdu';

  // 2. If name contains English characters: extract the clean English portion (e.g. "dd", "Hindi ii")
  const noParens = name.replace(/\([^)]*\)/g, '').trim();
  const enOnly = noParens.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  if (enOnly) {
    const cleaned = enOnly
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    if (cleaned) return cleaned;
  }

  // 3. Hindi / Devanagari common subject translations to clean headers
  if (lower.includes('चित्रकला') || lower.includes('कला') || lower.includes('आर्ट') || lower.includes('ड्राइंग')) return 'Drawing';
  if (lower.includes('गृह विज्ञान') || lower.includes('गृहविज्ञान')) return 'Home_Science';
  if (lower.includes('कंप्यूटर') || lower.includes('कम्प्यूटर')) return 'Computer';
  if (lower.includes('विज्ञान') && !lower.includes('सामाजिक')) return 'Science';
  if (lower.includes('सामाजिक') || lower.includes('भूगोल') || lower.includes('इतिहास')) return 'Social_Studies_SST';
  if (lower.includes('गणित')) return 'Mathematics';
  if (lower.includes('अंग्रेजी') || lower.includes('अंग्रेज़ी')) return 'English_1';
  if (lower.includes('हिंदी') || lower.includes('हिन्दी')) {
    if (lower.includes('द्वितीय') || lower.includes('2') || lower.includes('ii')) return 'Hindi_2';
    return 'Hindi_1';
  }
  if (lower.includes('नैतिक')) return 'Moral_Science';
  if (lower.includes('शारीरिक') || lower.includes('खेल') || lower.includes('व्यायाम')) return 'Physical_Training_PT';
  if (lower.includes('सामान्य') && lower.includes('ज्ञान')) return 'General_Knowledge_GK';

  // 4. Fallback: sanitize original Devanagari or other script name with underscores
  const cleanOther = name
    .replace(/[\(\)\[\]\{\}\/\\,;:\.]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
  if (cleanOther) return cleanOther;

  // 5. Last fallback to subject ID without prefix if not purely numbers
  const idClean = (sub.id || '').replace(/^sub-?/, '');
  if (idClean && isNaN(Number(idClean))) return idClean;

  return 'Subject';
}

/**
 * Returns a rich set of matching aliases and tokens for any subject.
 * Guarantees that bulk import matches every subject regardless of:
 * - English names / abbreviations (e.g. "Urdu", "Math", "Maths", "Eng", "SST", "Comp", "GK", "PT", "dd")
 * - Devanagari names (e.g. "उर्दू", "गणित", "विज्ञान", "सामाजिक", "संस्कृत", "कंप्यूटर", "हिंदी")
 * - Substring tokens with or without underscores, hyphens, parentheses, etc.
 */
export function getSubjectMatchTokens(sub: SubjectConfig): string[] {
  if (!sub) return [];
  const tokens = new Set<string>();

  // 1. Raw ID and ID without prefix
  const rawId = (sub.id || '').toLowerCase();
  tokens.add(rawId);
  tokens.add(rawId.replace(/[^a-z0-9]/g, ''));
  const idWithoutPrefix = rawId.replace(/^sub-?/, '').replace(/[^a-z0-9]/g, '');
  if (idWithoutPrefix) tokens.add(idWithoutPrefix);

  // 2. Clean header name (e.g. "dd", "Sanskrit", "Social_Studies_SST", "Hindi_1")
  const cleanHeader = getCleanSubjectHeader(sub).toLowerCase();
  tokens.add(cleanHeader);
  tokens.add(cleanHeader.replace(/[^a-z0-9\u0900-\u097F]/g, ''));

  // 3. Full raw name cleaned
  const rawName = (sub.name || '').toLowerCase();
  tokens.add(rawName.replace(/[^a-z0-9\u0900-\u097F]/g, ''));

  // 4. Extract English-only and Devanagari-only parts
  const words = rawName.replace(/[\(\)\[\]\{\}_,\-]/g, ' ').split(/\s+/).filter(Boolean);
  const englishWords = words.filter((w) => /^[a-z0-9]+$/i.test(w));
  const hindiWords = words.filter((w) => /^[\u0900-\u097F]+$/.test(w));

  if (englishWords.length > 0) {
    tokens.add(englishWords.join(''));
    englishWords.forEach((w) => {
      if (w.length >= 2) tokens.add(w);
    });
  }
  if (hindiWords.length > 0) {
    tokens.add(hindiWords.join(''));
    hindiWords.forEach((w) => {
      if (w.length >= 2) tokens.add(w);
    });
  }

  // 5. Domain-specific subject synonyms & aliases
  const combined = (rawName + ' ' + rawId + ' ' + cleanHeader).toLowerCase();

  // Nursery/LKG/UKG writing vs oral
  if (combined.includes('writing') || combined.includes('likhit') || combined.includes('लिखित')) {
    tokens.add('writing');
    tokens.add('likhit');
    tokens.add('लिखित');
    if (combined.includes('hindi')) tokens.add('hindiwriting');
    if (combined.includes('eng')) tokens.add('englishwriting');
    if (combined.includes('math')) tokens.add('mathswriting');
  }
  if (combined.includes('oral') || combined.includes('moukhik') || combined.includes('मौखिक')) {
    tokens.add('oral');
    tokens.add('moukhik');
    tokens.add('मौखिक');
    if (combined.includes('hindi')) tokens.add('hindioral');
    if (combined.includes('eng')) tokens.add('englishoral');
    if (combined.includes('math')) tokens.add('mathsoral');
  }

  // Urdu
  if (combined.includes('urdu') || combined.includes('उर्दू')) {
    tokens.add('urdu');
    tokens.add('उर्दू');
  }

  // Hindi 1 vs Hindi 2
  if (
    combined.includes('hindi 2') ||
    combined.includes('hindi2') ||
    combined.includes('hindi_2') ||
    combined.includes('hindi ii') ||
    combined.includes('hindiii') ||
    combined.includes('द्वितीय')
  ) {
    tokens.add('hindi2');
    tokens.add('hindi_2');
    tokens.add('hindi2nd');
    tokens.add('hindiii');
    tokens.add('द्वितीय');
  } else if (
    combined.includes('hindi 1') ||
    combined.includes('hindi1') ||
    combined.includes('hindi_1') ||
    combined.includes('hindi i') ||
    combined.includes('hindii') ||
    combined.includes('प्रथम')
  ) {
    tokens.add('hindi1');
    tokens.add('hindi_1');
    tokens.add('hindi1st');
    tokens.add('hindii');
    tokens.add('प्रथम');
  } else if (combined.includes('hindi') || combined.includes('हिंदी') || combined.includes('हिन्दी')) {
    tokens.add('hindi');
    tokens.add('हिंदी');
    tokens.add('हिन्दी');
  }

  // English 1 vs English 2
  if (
    combined.includes('english 2') ||
    combined.includes('english2') ||
    combined.includes('english_2') ||
    combined.includes('english ii') ||
    combined.includes('eng2') ||
    combined.includes('eng_2')
  ) {
    tokens.add('english2');
    tokens.add('english_2');
    tokens.add('eng2');
    tokens.add('eng_2');
    tokens.add('englishii');
  } else if (
    combined.includes('english 1') ||
    combined.includes('english1') ||
    combined.includes('english_1') ||
    combined.includes('english i') ||
    combined.includes('eng1') ||
    combined.includes('eng_1')
  ) {
    tokens.add('english1');
    tokens.add('english_1');
    tokens.add('eng1');
    tokens.add('eng_1');
    tokens.add('englishi');
  } else if (combined.includes('english') || combined.includes('अंग्रेजी') || combined.includes('अंग्रेज़ी')) {
    tokens.add('english');
    tokens.add('eng');
    tokens.add('अंग्रेजी');
    tokens.add('अंग्रेज़ी');
  }

  // Mathematics
  if (combined.includes('math') || combined.includes('ganit') || combined.includes('गणित')) {
    tokens.add('math');
    tokens.add('maths');
    tokens.add('mathematics');
    tokens.add('ganit');
    tokens.add('गणित');
  }

  // Social Studies (SST)
  if (combined.includes('social') || combined.includes('sst') || combined.includes('सामाजिक')) {
    tokens.add('social');
    tokens.add('sst');
    tokens.add('socialstudies');
    tokens.add('socialstudiessst');
    tokens.add('socialscience');
    tokens.add('samajik');
    tokens.add('सामाजिक');
    tokens.add('सामाजिकअध्ययन');
  }

  // Science (without Social)
  if ((combined.includes('science') || combined.includes('vigyan') || combined.includes('विज्ञान')) && !combined.includes('social') && !combined.includes('सामाजिक')) {
    tokens.add('science');
    tokens.add('sci');
    tokens.add('vigyan');
    tokens.add('विज्ञान');
  }

  // Sanskrit
  if (combined.includes('sanskrit') || combined.includes('संस्कृत')) {
    tokens.add('sanskrit');
    tokens.add('sans');
    tokens.add('संस्कृत');
  }

  // Computer
  if (combined.includes('computer') || combined.includes('comp') || combined.includes('कंप्यूटर')) {
    tokens.add('computer');
    tokens.add('comp');
    tokens.add('कंप्यूटर');
  }

  // PT / Physical Training
  if (combined.includes('pt') || combined.includes('physical') || combined.includes('training') || combined.includes('शारीरिक') || combined.includes('व्यायाम')) {
    tokens.add('pt');
    tokens.add('physical');
    tokens.add('physicaltraining');
    tokens.add('physicaltrainingpt');
    tokens.add('शारीरिक');
    tokens.add('व्यायाम');
  }

  // GK / General Knowledge
  if (combined.includes('gk') || combined.includes('general') || combined.includes('ज्ञान') || combined.includes('सामान्य')) {
    tokens.add('gk');
    tokens.add('generalknowledge');
    tokens.add('generalknowledgegk');
    tokens.add('general');
    tokens.add('samanyagyan');
    tokens.add('सामान्यज्ञान');
  }

  // Drawing
  if (combined.includes('draw') || combined.includes('art') || combined.includes('kala') || combined.includes('कला') || combined.includes('चित्रकला')) {
    tokens.add('drawing');
    tokens.add('art');
    tokens.add('draw');
    tokens.add('kala');
    tokens.add('कला');
    tokens.add('चित्रकला');
  }

  return Array.from(tokens).filter(Boolean);
}

/**
 * Checks if a subject is Urdu or marked as optional (e.g. Urdu)
 */
export function isUrduOrOptional(subject: SubjectConfig): boolean {
  if (!subject) return false;
  if (subject.isOptional) return true;
  const name = (subject.name || '').toLowerCase();
  return (
    subject.id === 'sub-urdu' ||
    name === 'urdu' ||
    name.includes('urdu') ||
    name.includes('उर्दू')
  );
}

/**
 * Checks if a student has any recorded marks (> 0) for a subject
 */
export function studentHasEnteredMarks(
  student?: Partial<Student> | null,
  subjectId?: string,
  examMode?: 'half_yearly_only' | 'annual_only' | 'combined'
): boolean {
  if (!student?.marks || !subjectId) return false;
  const m = student.marks[subjectId];
  if (!m) return false;
  const half = Number(m.halfObtained);
  const annual = Number(m.annualObtained);

  if (examMode === 'half_yearly_only') {
    return !isNaN(half) && half > 0;
  }
  if (examMode === 'annual_only') {
    return !isNaN(annual) && annual > 0;
  }
  return (!isNaN(half) && half > 0) || (!isNaN(annual) && annual > 0);
}

/**
 * Returns all active subjects specifically applicable to a student.
 * 
 * CORE ARCHITECTURAL RULES (User Brief Compliance):
 * 1. "alag koi subject nhu aana cghaiye kisis class mew":
 *    A subject that is NOT applicable to the student's class (via isSubjectApplicableToClass)
 *    MUST NEVER be returned for this student, under ANY condition.
 * 2. "aur subject me pure class ke liye 10 subject h lekin har bachhe ko seperate selection karna pad rha h subject fix problem":
 *    All COMPULSORY subjects of the class automatically apply to every child of the class!
 *    Teachers DO NOT have to manually configure or select subjects for each student.
 * 3. "aur urdu aiss kro ki subject ka me do lekin har class ke bachho ke liye lagu n ho kyoki har class me 1 2 bachhe hi h":
 *    Urdu is optional in classes 1st to 8th. It is ONLY included for a student if:
 *    - The student has entered marks (> 0) in Urdu, OR
 *    - The student was explicitly assigned Urdu.
 *    For all other students in the class, Urdu is NOT included.
 * 4. "aur sanskrti 6 7 8 bas h to wo bhi wiase hi rhega":
 *    Sanskrit is strictly for 6th, 7th, 8th.
 *    In 6th-8th, Sanskrit is the standard 12th subject for regular students.
 *    If an Urdu student takes Urdu, Urdu is their 12th subject (or replaces Sanskrit).
 */
export function getSubjectsForStudent(
  subjects: SubjectConfig[],
  student?: Partial<Student> | null,
  classNameFallback?: string,
  options?: {
    forMarksEntry?: boolean;
    examMode?: 'half_yearly_only' | 'annual_only' | 'combined';
  }
): SubjectConfig[] {
  if (!Array.isArray(subjects)) return [];
  const targetClass = student?.className || classNameFallback;
  const classSubjects = getSubjectsForClass(subjects, targetClass);

  if (classSubjects.length === 0) return [];

  // Check if student takes Urdu
  const urduSubject = classSubjects.find((s) => isUrduOrOptional(s));
  let studentTakesUrdu = false;
  if (urduSubject) {
    const hasUrduMarks = studentHasEnteredMarks(student, urduSubject.id, options?.examMode);
    const hasUrduAssigned =
      Array.isArray(student?.assignedSubjectIds) && student.assignedSubjectIds.includes(urduSubject.id);
    studentTakesUrdu = hasUrduMarks || hasUrduAssigned;
  }

  // Filter strictly within class subjects
  const resultSubs = classSubjects.filter((subj) => {
    // A. Urdu handling: only include if this student studies Urdu
    if (isUrduOrOptional(subj)) {
      return studentTakesUrdu;
    }

    // B. Sanskrit in 6th, 7th, 8th:
    // If student takes Urdu, check whether they also study Sanskrit.
    // If they only study Urdu and have no Sanskrit marks or assignment, Sanskrit is omitted (Urdu is their 12th subject).
    if (subj.id === 'sub-sanskrit' || subj.name.toLowerCase().includes('sanskrit')) {
      if (studentTakesUrdu) {
        const hasSanskritMarks = studentHasEnteredMarks(student, subj.id, options?.examMode);
        const hasSanskritAssigned =
          Array.isArray(student?.assignedSubjectIds) && student.assignedSubjectIds.includes(subj.id);
        if (!hasSanskritMarks && !hasSanskritAssigned) {
          return false;
        }
      }
      return true;
    }

    // C. All other subjects are compulsory for the whole class!
    return true;
  });

  return resultSubs.sort((a, b) => a.displayOrder - b.displayOrder);
}

export function calculateStudentResult(
  student: Student,
  subjects: SubjectConfig[],
  rawSchool: SchoolSettings,
  gradeRules: GradeRule[] = DEFAULT_GRADE_RULES,
  examMode?: 'half_yearly_only' | 'combined' | 'annual_only'
): StudentResultData {
  const school = normalizeSchoolSettings(rawSchool);
  const classTeacher = findClassTeacher(student.className, school.classTeachers, {
    name: student.classTeacherName,
    signatureUrl: student.classTeacherSignatureUrl,
  });

  // Determine effective exam mode from school toggles or explicit arg
  const allowHalfYearly = isSettingEnabled(school.showHalfYearlyExam, true);
  const allowAnnual = isSettingEnabled(school.showAnnualExam, true);
  let effectiveMode: 'half_yearly_only' | 'annual_only' | 'combined' = examMode || 'combined';
  if (allowHalfYearly && !allowAnnual) {
    effectiveMode = 'half_yearly_only';
  } else if (!allowHalfYearly && allowAnnual) {
    effectiveMode = 'annual_only';
  }

  // Student-specific subjects filtering: Only include subjects assigned to this student
  // and strictly exclude Urdu/optional if no marks are given in the active exam mode
  const activeSubjects = getSubjectsForStudent(subjects, student, undefined, { examMode: effectiveMode });

  const processedRows: ProcessedSubjectRow[] = [];
  const validationIssues: string[] = [];

  let halfMaxSum = 0;
  let halfObtSum = 0;
  let annualMaxSum = 0;
  let annualObtSum = 0;

  activeSubjects.forEach((subj, index) => {
    const studentMark = student.marks?.[subj.id] || { halfObtained: 0, annualObtained: 0 };
    const halfObt = Number(studentMark.halfObtained) || 0;
    const annualObt = Number(studentMark.annualObtained) || 0;
    const halfMax = Number(subj.halfMax) || 100;
    const annualMax = Number(subj.annualMax) || 100;

    const halfValidation = validateMark(halfObt, halfMax);
    const annualValidation = validateMark(annualObt, annualMax);

    let rowValid = true;
    let rowError = '';

    if (!halfValidation.isValid) {
      rowValid = false;
      rowError = `Half-Yearly: ${halfValidation.error}`;
      validationIssues.push(`${subj.name} (Half-Yearly): ${halfValidation.error}`);
    }
    if (!annualValidation.isValid) {
      rowValid = false;
      rowError = rowError ? `${rowError}; Annual: ${annualValidation.error}` : `Annual: ${annualValidation.error}`;
      validationIssues.push(`${subj.name} (Annual): ${annualValidation.error}`);
    }

    halfMaxSum += halfMax;
    halfObtSum += halfObt;
    annualMaxSum += annualMax;
    annualObtSum += annualObt;

    processedRows.push({
      sNo: index + 1,
      subjectId: subj.id,
      subjectName: subj.name,
      halfMax,
      halfObtained: halfObt,
      annualMax,
      annualObtained: annualObt,
      isValid: rowValid,
      validationError: rowError || undefined,
    });
  });

  // Has Annual exam or Half-Yearly exam been taken?
  const hasHalfMarks = halfObtSum > 0;
  const hasAnnualMarks = annualObtSum > 0;

  // Calculate Half-Yearly (Passing criteria: 50% or obtained >= 50% of maximum marks)
  const halfPctRaw = halfMaxSum > 0 ? (halfObtSum / halfMaxSum) * 100 : 0;
  const halfPct = Math.min(100, Math.max(0, Number(halfPctRaw.toFixed(2))));
  const halfStatus: 'PASS' | 'FAIL' = halfObtSum >= (halfMaxSum * 0.5) ? 'PASS' : 'FAIL';

  const halfYearly: ExamSummary = {
    maximum: halfMaxSum,
    obtained: halfObtSum,
    percentage: halfPct,
    grade: '',
    status: halfStatus,
  };

  // Calculate Annual (Passing criteria: 50% or obtained >= 50% of maximum marks)
  const annualPctRaw = annualMaxSum > 0 ? (annualObtSum / annualMaxSum) * 100 : 0;
  const annualPct = Math.min(100, Math.max(0, Number(annualPctRaw.toFixed(2))));
  const annualStatus: 'PASS' | 'FAIL' = annualObtSum >= (annualMaxSum * 0.5) ? 'PASS' : 'FAIL';

  const annual: ExamSummary = {
    maximum: annualMaxSum,
    obtained: annualObtSum,
    percentage: annualPct,
    grade: '',
    status: annualStatus,
  };

  // Combined calculations per user rule:
  // "jaise 1000 maximum marks h aur bacha usme se 500 marks obtain kiya to pass hoga aur niche gya to fail yhi procisure har subject har class me lage"
  // If only Half-Yearly exam was conducted (annual marks not yet entered / 0), do not fail the student against double maximum
  let combinedMax: number;
  let combinedObt: number;
  let combinedPct: number;
  let combinedStatus: 'PASS' | 'FAIL';

  if (hasHalfMarks && !hasAnnualMarks) {
    // Only Half-Yearly conducted
    combinedMax = halfMaxSum;
    combinedObt = halfObtSum;
    combinedPct = halfPct;
    combinedStatus = halfStatus;
  } else if (!hasHalfMarks && hasAnnualMarks) {
    // Only Annual conducted
    combinedMax = annualMaxSum;
    combinedObt = annualObtSum;
    combinedPct = annualPct;
    combinedStatus = annualStatus;
  } else {
    // Both exams conducted (or both 0)
    combinedMax = halfMaxSum + annualMaxSum;
    combinedObt = halfObtSum + annualObtSum;
    const combinedPctRaw = combinedMax > 0 ? (combinedObt / combinedMax) * 100 : 0;
    combinedPct = Math.min(100, Math.max(0, Number(combinedPctRaw.toFixed(2))));
    combinedStatus = combinedObt >= (combinedMax * 0.5) ? 'PASS' : 'FAIL';
  }

  // Progress = Annual Percentage - Half-Yearly Percentage points
  const progressPoints = Number((annualPct - halfPct).toFixed(2));

  const combined: CombinedSummary = {
    maximum: combinedMax,
    obtained: combinedObt,
    percentage: combinedPct,
    grade: '',
    status: combinedStatus,
    progressPoints,
  };

  return {
    student: {
      id: student.id,
      name: student.name,
      fatherName: student.fatherName,
      motherName: student.motherName,
      dob: formatDisplayDate(student.dob),
      gender: student.gender,
      className: student.className,
      section: student.section,
      rollNo: student.rollNo,
      admissionNo: student.admissionNo,
      photoUrl: student.photoUrl,
      session: student.session || school.session,
      mobile: student.mobile,
      address: student.address ? String(student.address).trim() : ((student as any).pata ? String((student as any).pata).trim() : ''),
      aadharNo: student.aadharNo,
      aparId: student.aparId ? String(student.aparId).trim() : ((student as any).apaarId ? String((student as any).apaarId).trim() : ''),
      classTeacherName: student.classTeacherName,
      classTeacherSignatureUrl: student.classTeacherSignatureUrl,
    },
    subjects: processedRows,
    halfYearly,
    annual,
    combined,
    progress: progressPoints,
    teacherRemark: student.teacherRemark || 'Good effort. Keep practicing regularly to achieve academic excellence.',
    school,
    classTeacher,
    generatedAt: formatDateTime(),
    validationIssues: validationIssues.length > 0 ? validationIssues : undefined,
  };
}

/**
 * Natural numerical comparison for Student Roll Numbers:
 * Ensures sequence 1, 2, 3... instead of scrambled (1, 3, 2) or lexicographical (1, 10, 2).
 */
export function compareRollNumbers(aRoll?: string | number, bRoll?: string | number): number {
  const strA = String(aRoll ?? '').trim();
  const strB = String(bRoll ?? '').trim();

  // Try extracting standard integer
  const numA = parseInt(strA.replace(/[^0-9]/g, ''), 10);
  const numB = parseInt(strB.replace(/[^0-9]/g, ''), 10);

  if (!isNaN(numA) && !isNaN(numB)) {
    if (numA !== numB) {
      return numA - numB;
    }
  }

  // Fallback to numeric-aware natural string comparison
  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Sorts students list naturally:
 * First by Class (e.g. 5th, 6th, 7th, 8th), then Section, then numerically by Roll Number (1, 2, 3, 4...)
 */
export function sortStudentsByRoll(studentsList: Student[]): Student[] {
  if (!Array.isArray(studentsList)) return [];
  return [...studentsList].sort((a, b) => {
    // 1. Compare Class (numeric aware)
    const classA = (a.className || '').trim();
    const classB = (b.className || '').trim();
    const classComp = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
    if (classComp !== 0) return classComp;

    // 2. Compare Section
    const secA = (a.section || '').trim();
    const secB = (b.section || '').trim();
    const secComp = secA.localeCompare(secB, undefined, { sensitivity: 'base' });
    if (secComp !== 0) return secComp;

    // 3. Compare Roll Number numerically (1, 2, 3...)
    return compareRollNumbers(a.rollNo, b.rollNo);
  });
}

/**
 * Normalizes class strings so '8', '8th', 'class 8', 'Class 8th' map to canonical form like '8th'
 */
export function canonicalClassName(cls?: string): string {
  if (!cls) return '';
  const trimmed = cls.trim();
  const lower = trimmed.toLowerCase().replace(/^class\s*/i, '');
  if (lower === '8' || lower === '8th') return '8th';
  if (lower === '7' || lower === '7th') return '7th';
  if (lower === '6' || lower === '6th') return '6th';
  if (lower === '5' || lower === '5th') return '5th';
  if (lower === '4' || lower === '4th') return '4th';
  if (lower === '3' || lower === '3rd') return '3rd';
  if (lower === '2' || lower === '2nd') return '2nd';
  if (lower === '1' || lower === '1st') return '1st';
  if (lower === 'kg' || lower === 'u.k.g' || lower === 'ukg') return 'UKG';
  if (lower === 'l.k.g' || lower === 'lkg') return 'LKG';
  if (lower === 'nursery' || lower === 'nur') return 'Nursery';
  return trimmed;
}

/**
 * Checks whether two class representations refer to the exact same class.
 * Handles '8' vs '8th', 'Class 8' vs '8th', case-insensitive.
 */
export function isSameClass(c1?: string, c2?: string): boolean {
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  const can1 = canonicalClassName(c1).toLowerCase();
  const can2 = canonicalClassName(c2).toLowerCase();
  if (can1 === can2) return true;
  const num1 = can1.replace(/[^0-9]/g, '');
  const num2 = can2.replace(/[^0-9]/g, '');
  if (num1 && num2 && num1 === num2) return true;
  return false;
}

