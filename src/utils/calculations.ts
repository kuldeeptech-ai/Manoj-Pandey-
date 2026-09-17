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
  const cleanPercentage = Math.min(100, Math.max(0, percentage));
  for (const rule of rules) {
    if (cleanPercentage >= rule.minPercentage && cleanPercentage <= rule.maxPercentage) {
      return rule.grade;
    }
  }
  return percentage >= 40 ? 'C' : 'D';
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
    schoolName: s.schoolName || 'H.D. PANDEY PUBLIC JUNIOR HIGH SCHOOL',
    address: s.address || 'Baurbyas, Shiv Mandir Side S.K.N. (U.P.) – 272154',
    managedBy: s.managedBy || 'Manoj Panday',
    mobile: String(s.mobile || '9838767297'),
    tagline: s.tagline || 'Discipline • Knowledge • Character • Bright Future',
    logoUrl: s.logoUrl,
    schoolBadgeType: (s.schoolBadgeType as any) || 'OFFICIAL RESULT',
    resultTitle: s.resultTitle || 'ACADEMIC RESULT — HALF-YEARLY & ANNUAL',
    resultTitleHalfYearly: s.resultTitleHalfYearly || 'ACADEMIC RESULT — HALF-YEARLY EXAMINATION',
    session: s.session || '2025–2026',
    footerText: s.footerText || 'Keep Learning • Keep Growing • Keep Shining!',
    teacherSignatureUrl: s.teacherSignatureUrl,
    principalSignatureUrl: s.principalSignatureUrl,
    principalStampUrl: s.principalStampUrl,
    showDigitalStamp: isSettingEnabled(s.showDigitalStamp, true),
    stampType: s.stampType || 'digital',
    defaultExamMode: s.defaultExamMode || 'half_yearly_only',
    googleSheetWebAppUrl: s.googleSheetWebAppUrl || '',
    classTeachers: Array.isArray(s.classTeachers) ? s.classTeachers : undefined,
    adminUserId: s.adminUserId && String(s.adminUserId).trim()
      ? String(s.adminUserId).trim()
      : (typeof window !== 'undefined' && window.localStorage?.getItem('school_admin_user')) || 'Kld75',
    adminPassword: s.adminPassword && String(s.adminPassword).trim()
      ? String(s.adminPassword).trim()
      : (typeof window !== 'undefined' && window.localStorage?.getItem('school_admin_pass')) || 'Kld@2314',
    showHalfYearlyExam: isSettingEnabled(s.showHalfYearlyExam, true),
    showAnnualExam: isSettingEnabled(s.showAnnualExam, true),
    showTeacherRemarks: isSettingEnabled(s.showTeacherRemarks, true),
    showStudentPhoto: isSettingEnabled(s.showStudentPhoto, true),
    showSignatures: isSettingEnabled(s.showSignatures, true),
    showPercentage: isSettingEnabled(s.showPercentage, true),
    showGrade: isSettingEnabled(s.showGrade, false),
    showProgressGraph: isSettingEnabled(s.showProgressGraph, true),
    showStudentMobile: isSettingEnabled(s.showStudentMobile, true),
    showStudentAadhar: isSettingEnabled(s.showStudentAadhar, true),
    allowPublicSearch: isSettingEnabled(s.allowPublicSearch, true),
    maintenanceNotice: s.maintenanceNotice || '',
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

export function calculateStudentResult(
  student: Student,
  subjects: SubjectConfig[],
  rawSchool: SchoolSettings,
  gradeRules: GradeRule[] = DEFAULT_GRADE_RULES
): StudentResultData {
  const school = normalizeSchoolSettings(rawSchool);
  const classTeacher = findClassTeacher(student.className, school.classTeachers, {
    name: student.classTeacherName,
    signatureUrl: student.classTeacherSignatureUrl,
  });
  const activeSubjects = subjects
    .filter((s) => s.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const processedRows: ProcessedSubjectRow[] = [];
  const validationIssues: string[] = [];

  let halfMaxSum = 0;
  let halfObtSum = 0;
  let annualMaxSum = 0;
  let annualObtSum = 0;

  let anyHalfFailed = false;
  let anyAnnualFailed = false;

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

    if (halfObt < subj.passingMarks) {
      anyHalfFailed = true;
    }
    if (annualObt < subj.passingMarks) {
      anyAnnualFailed = true;
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

  // Calculate Half-Yearly
  const halfPctRaw = halfMaxSum > 0 ? (halfObtSum / halfMaxSum) * 100 : 0;
  const halfPct = Math.min(100, Math.max(0, Number(halfPctRaw.toFixed(2))));
  const halfGrade = getGradeForPercentage(halfPct, gradeRules);
  const halfStatus: 'PASS' | 'FAIL' = halfPct >= 33 && !anyHalfFailed ? 'PASS' : 'FAIL';

  const halfYearly: ExamSummary = {
    maximum: halfMaxSum,
    obtained: halfObtSum,
    percentage: halfPct,
    grade: halfGrade,
    status: halfStatus,
  };

  // Calculate Annual
  const annualPctRaw = annualMaxSum > 0 ? (annualObtSum / annualMaxSum) * 100 : 0;
  const annualPct = Math.min(100, Math.max(0, Number(annualPctRaw.toFixed(2))));
  const annualGrade = getGradeForPercentage(annualPct, gradeRules);
  const annualStatus: 'PASS' | 'FAIL' = annualPct >= 33 && !anyAnnualFailed ? 'PASS' : 'FAIL';

  const annual: ExamSummary = {
    maximum: annualMaxSum,
    obtained: annualObtSum,
    percentage: annualPct,
    grade: annualGrade,
    status: annualStatus,
  };

  // Combined calculations
  const combinedMax = halfMaxSum + annualMaxSum;
  const combinedObt = halfObtSum + annualObtSum;
  const combinedPctRaw = combinedMax > 0 ? (combinedObt / combinedMax) * 100 : 0;
  const combinedPct = Math.min(100, Math.max(0, Number(combinedPctRaw.toFixed(2))));
  const combinedGrade = getGradeForPercentage(combinedPct, gradeRules);
  const combinedStatus: 'PASS' | 'FAIL' = annualStatus === 'PASS' && combinedPct >= 33 ? 'PASS' : 'FAIL';

  // Progress = Annual Percentage - Half-Yearly Percentage points
  const progressPoints = Number((annualPct - halfPct).toFixed(2));

  const combined: CombinedSummary = {
    maximum: combinedMax,
    obtained: combinedObt,
    percentage: combinedPct,
    grade: combinedGrade,
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
      aadharNo: student.aadharNo,
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
