import { SchoolSettings, SubjectConfig, Student, GradeRule, ClassTeacherConfig, StaffPermissions, StaffUser } from '../types';
import { DEFAULT_GRADE_RULES } from '../utils/calculations';

function svgUri(rawSvg: string): string {
  try {
    if (typeof btoa !== 'undefined') {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(rawSvg.trim())))}`;
    }
  } catch {
    // fallback
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg.trim())}`;
}

// Professional vector school logo as SVG Data URI
export const DEFAULT_SCHOOL_LOGO = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="crestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f2b48" />
      <stop offset="100%" stop-color="#1a4773" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d4af37" />
      <stop offset="100%" stop-color="#b8860b" />
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="95" fill="none" stroke="#0f2b48" stroke-width="4"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="#d4af37" stroke-width="2" stroke-dasharray="4,2"/>
  <circle cx="100" cy="100" r="72" fill="url(#crestGrad)"/>
  <!-- Laurel / Rays -->
  <path d="M 60 145 C 50 120 50 85 75 60 C 72 75 75 95 85 105 Z" fill="#d4af37" opacity="0.8"/>
  <path d="M 140 145 C 150 120 150 85 125 60 C 128 75 125 95 115 105 Z" fill="#d4af37" opacity="0.8"/>
  <!-- Open Book of Knowledge -->
  <path d="M 75 125 C 88 118 97 122 100 128 C 103 122 112 118 125 125 C 122 108 112 102 100 106 C 88 102 78 108 75 125 Z" fill="#ffffff" stroke="#d4af37" stroke-width="1.5"/>
  <line x1="100" y1="106" x2="100" y2="128" stroke="#0f2b48" stroke-width="2"/>
  <!-- Torch of Wisdom -->
  <polygon points="98,82 102,82 101,98 99,98" fill="#d4af37"/>
  <path d="M 100 68 C 96 74 97 78 100 82 C 103 78 104 74 100 68 Z" fill="#e65100"/>
  <circle cx="100" cy="74" r="2.5" fill="#ffd54f"/>
  <!-- Star -->
  <polygon points="100,48 102,53 107,53 103,56 105,61 100,58 95,61 97,56 93,53 98,53" fill="#d4af37"/>
  <!-- Banner / Ribbons -->
  <path d="M 45 155 Q 100 175 155 155 L 150 142 Q 100 160 50 142 Z" fill="#d4af37"/>
  <text x="100" y="153" font-family="'Roboto Condensed', sans-serif" font-size="8.5" font-weight="bold" fill="#0f2b48" text-anchor="middle" letter-spacing="1">ESTD. 2008 • SKN, UP</text>
  <!-- Text along arc -->
  <text x="100" y="34" font-family="'Roboto Condensed', sans-serif" font-size="9" font-weight="bold" fill="#0f2b48" text-anchor="middle" letter-spacing="0.5">H.D.P. PUBLIC SCHOOL</text>
</svg>`);

export const DEFAULT_TEACHER_SIGNATURE = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" width="160" height="60">
  <path d="M 20 40 Q 35 15 50 35 T 75 25 T 100 38 T 135 22" fill="none" stroke="#1a365d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 30 38 Q 60 48 120 32" fill="none" stroke="#1a365d" stroke-width="1.6" stroke-linecap="round"/>
</svg>`);

export const DEFAULT_PRINCIPAL_SIGNATURE = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" width="160" height="60">
  <path d="M 15 35 Q 25 10 40 25 T 65 15 T 85 40 T 115 18 T 145 30" fill="none" stroke="#0f2b48" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 25 32 Q 55 45 130 28" fill="none" stroke="#0f2b48" stroke-width="1.8" stroke-linecap="round"/>
</svg>`);

export const DEFAULT_PRINCIPAL_STAMP = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="46" fill="none" stroke="#1e3a8a" stroke-width="2.5" opacity="0.65" stroke-dasharray="2,1"/>
  <circle cx="50" cy="50" r="41" fill="none" stroke="#1e3a8a" stroke-width="1.5" opacity="0.65"/>
  <circle cx="50" cy="50" r="28" fill="none" stroke="#1e3a8a" stroke-width="1" opacity="0.5"/>
  <text x="50" y="32" font-family="'Roboto Condensed', sans-serif" font-size="6" font-weight="bold" fill="#1e3a8a" text-anchor="middle" opacity="0.75" letter-spacing="0.5">H.D.P. PUBLIC SCHOOL</text>
  <text x="50" y="52" font-family="'Roboto Condensed', sans-serif" font-size="7.5" font-weight="bold" fill="#1e3a8a" text-anchor="middle" opacity="0.85">★ PRINCIPAL ★</text>
  <text x="50" y="68" font-family="'Roboto Condensed', sans-serif" font-size="6" font-weight="bold" fill="#1e3a8a" text-anchor="middle" opacity="0.75">OFFICIAL SEAL</text>
</svg>`);

export const DEFAULT_STUDENT_PHOTO_17 = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">
  <rect width="120" height="150" fill="#e2e8f0"/>
  <!-- Head & Shoulders -->
  <circle cx="60" cy="55" r="28" fill="#fcd34d"/>
  <path d="M 38 48 C 38 28 82 28 82 48 C 82 56 75 58 60 58 C 45 58 38 56 38 48 Z" fill="#1e293b"/>
  <!-- School Uniform -->
  <path d="M 20 150 L 32 100 C 40 92 80 92 88 100 L 100 150 Z" fill="#1e3a8a"/>
  <!-- White Collar -->
  <polygon points="60,118 45,98 56,98 60,108 64,98 75,98" fill="#ffffff"/>
  <!-- Red Tie -->
  <polygon points="58,108 62,108 64,135 60,140 56,135" fill="#b91c1c"/>
  <!-- Text -->
  <rect x="5" y="130" width="110" height="16" fill="#0f172a" opacity="0.8" rx="2"/>
  <text x="60" y="142" font-family="'Roboto Condensed', sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">ROLL: 17 • PRIYA</text>
</svg>`);

export const DEFAULT_STUDENT_PHOTO_18 = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">
  <rect width="120" height="150" fill="#e2e8f0"/>
  <circle cx="60" cy="55" r="28" fill="#fcd34d"/>
  <path d="M 38 44 C 40 25 80 25 82 44 C 80 47 60 48 38 44 Z" fill="#334155"/>
  <path d="M 20 150 L 32 100 C 40 92 80 92 88 100 L 100 150 Z" fill="#1e3a8a"/>
  <polygon points="60,118 45,98 56,98 60,108 64,98 75,98" fill="#ffffff"/>
  <polygon points="58,108 62,108 64,135 60,140 56,135" fill="#b91c1c"/>
  <rect x="5" y="130" width="110" height="16" fill="#0f172a" opacity="0.8" rx="2"/>
  <text x="60" y="142" font-family="'Roboto Condensed', sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">ROLL: 18 • AMAN</text>
</svg>`);

export const DEFAULT_STUDENT_PHOTO_FALLBACK = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">
  <rect width="120" height="150" fill="#f1f5f9"/>
  <circle cx="60" cy="55" r="26" fill="#cbd5e1"/>
  <path d="M 25 140 C 25 105 45 95 60 95 C 75 95 95 105 95 140 Z" fill="#94a3b8"/>
  <rect x="15" y="125" width="90" height="18" fill="#475569" opacity="0.85" rx="3"/>
  <text x="60" y="138" font-family="'Roboto Condensed', sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">PASSPORT PHOTO</text>
</svg>`);


export const DEFAULT_CLASS_TEACHERS: ClassTeacherConfig[] = [
  {
    id: 'ct-8',
    className: '8th',
    teacherName: 'Mrs. Sunita Sharma',
    designation: 'Class Teacher (8th)',
    signatureUrl: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" width="160" height="60">
      <path d="M 18 38 Q 32 12 48 30 T 70 20 T 92 36 T 120 18 T 145 28" fill="none" stroke="#1e3a8a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 28 42 Q 65 52 135 34" fill="none" stroke="#1e3a8a" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`),
    phone: '9838700008',
  },
  {
    id: 'ct-7',
    className: '7th',
    teacherName: 'Shri R.K. Yadav',
    designation: 'Class Teacher (7th)',
    signatureUrl: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" width="160" height="60">
      <path d="M 15 42 Q 30 15 45 35 T 75 15 T 105 38 T 130 20" fill="none" stroke="#0f2b48" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M 25 40 Q 70 48 135 32" fill="none" stroke="#0f2b48" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`),
    phone: '9838700007',
  },
  {
    id: 'ct-6',
    className: '6th',
    teacherName: 'Smt. Rekha Gupta',
    designation: 'Class Teacher (6th)',
    signatureUrl: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" width="160" height="60">
      <path d="M 20 36 Q 38 18 55 32 T 85 22 T 115 35 T 140 24" fill="none" stroke="#1e3a8a" stroke-width="2.0" stroke-linecap="round"/>
      <path d="M 30 42 Q 60 50 125 35" fill="none" stroke="#1e3a8a" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`),
    phone: '9838700006',
  },
  {
    id: 'ct-5',
    className: '5th',
    teacherName: 'Shri Anand Singh',
    designation: 'Class Teacher (5th)',
    signatureUrl: DEFAULT_TEACHER_SIGNATURE,
    phone: '9838700005',
  },
  {
    id: 'ct-4',
    className: '4th',
    teacherName: 'Smt. Pooja Mishra',
    designation: 'Class Teacher (4th)',
    signatureUrl: DEFAULT_TEACHER_SIGNATURE,
    phone: '9838700004',
  },
  {
    id: 'ct-3',
    className: '3rd',
    teacherName: 'Shri Manoj Tiwari',
    designation: 'Class Teacher (3rd)',
    signatureUrl: DEFAULT_TEACHER_SIGNATURE,
    phone: '9838700003',
  },
  {
    id: 'ct-2',
    className: '2nd',
    teacherName: 'Smt. Anita Yadav',
    designation: 'Class Teacher (2nd)',
    signatureUrl: DEFAULT_TEACHER_SIGNATURE,
    phone: '9838700002',
  },
  {
    id: 'ct-1',
    className: '1st',
    teacherName: 'Smt. Suman Pandey',
    designation: 'Class Teacher (1st)',
    signatureUrl: DEFAULT_TEACHER_SIGNATURE,
    phone: '9838700001',
  },
  {
    id: 'ct-ukg',
    className: 'U.K.G.',
    teacherName: 'Smt. Meena Devi',
    designation: 'Class Teacher (UKG)',
    signatureUrl: DEFAULT_TEACHER_SIGNATURE,
    phone: '9838700010',
  },
  {
    id: 'ct-lkg',
    className: 'L.K.G.',
    teacherName: 'Smt. Radha Maurya',
    designation: 'Class Teacher (LKG)',
    signatureUrl: DEFAULT_TEACHER_SIGNATURE,
    phone: '9838700011',
  },
  {
    id: 'ct-nur',
    className: 'NURSERY',
    teacherName: 'Smt. Kavita Sharma',
    designation: 'Class Teacher (Nursery)',
    signatureUrl: DEFAULT_TEACHER_SIGNATURE,
    phone: '9838700012',
  },
];

export const ORIGINAL_SCHOOL_LOGO = 'https://raw.githubusercontent.com/kuldeeptech-ai/dd/refs/heads/main/my-audio/6a50c4fb-10a6-40ae-afe0-eafeb0a5991b-removebackgrounds-ai.png';

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolName: 'H.D.P. PUBLIC SCHOOL',
  address: 'Baurbyas, Shiv Mandir Side S.K.N. (U.P.) – 272154',
  managedBy: 'Manoj Panday',
  mobile: '9838767297',
  tagline: 'Discipline • Knowledge • Character • Bright Future',
  logoUrl: ORIGINAL_SCHOOL_LOGO,
  logoSize: 100,
  schoolBadgeType: 'ACADEMIC RESULT',
  resultTitle: 'ACADEMIC RESULT — HALF-YEARLY & ANNUAL',
  resultTitleHalfYearly: 'ACADEMIC RESULT — HALF-YEARLY EXAMINATION',
  session: '2026–2027',
  footerText: 'Keep Learning • Keep Growing • Keep Shining!',
  teacherSignatureUrl: DEFAULT_TEACHER_SIGNATURE,
  principalSignatureUrl: DEFAULT_PRINCIPAL_SIGNATURE,
  principalStampUrl: DEFAULT_PRINCIPAL_STAMP,
  showDigitalStamp: true,
  stampType: 'digital',
  defaultExamMode: 'half_yearly_only',
  googleSheetWebAppUrl: 'https://script.google.com/macros/s/AKfycbzItfB0hnC38GWywI4SGxay7THA3AXcuULIsWIo9Zg9GKYlIzzRAkFzTW3brKoxmmMQ/exec',
  classTeachers: DEFAULT_CLASS_TEACHERS,
  adminUserId: 'Kld7522',
  adminPassword: 'Kld@2314',
  adminEmail: 'kuldeeprai75220@gmail.com',
  showHalfYearlyExam: true,
  showAnnualExam: false,
  showTeacherRemarks: true,
  showStudentPhoto: true,
  showSignatures: true,
  showPercentage: true,
  showGrade: false,
  showProgressGraph: true,
  allowPublicSearch: true,
  enableCaptcha: true,
  enableAdminLoginCaptcha: false,
  saveSelectedClass: true,
  saveSearchRoll: true,
  saveRecentSearches: true,
  saveLastResult: true,
  autoFillOnLoad: true,
  isMaintenanceMode: false,
  isResultLive: false,
  maintenanceNotice: '',
  maintenanceMessage: 'पोर्टल पर वर्तमान में मेंटेनेंस एवं अंकपत्र अपडेट का कार्य चल रहा है। कृपया कुछ समय बाद पुनः प्रयास करें।',
  liveBannerText: 'सत्र 2026–2027 की सभी कक्षाओं की मार्कशीट लाइव हो चुकी हैं! आप नीचे अपना रोल नंबर व कक्षा दर्ज करके रिजल्ट देख सकते हैं।',
  activeClasses: ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'],
  marksheetSchoolNameSize: 28,
  publicPortalSchoolNameSize: 24,
  marksheetTextScale: 'large',
};

export const DEFAULT_SUBJECTS: SubjectConfig[] = [
  // Pre-primary (Nursery, LKG, UKG)
  { id: 'sub-hindi-writing', name: 'Hindi Writing', displayOrder: 1, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['Nursery', 'LKG', 'UKG'] },
  { id: 'sub-hindi-oral', name: 'Hindi Oral', displayOrder: 2, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['Nursery', 'LKG', 'UKG'] },
  { id: 'sub-english-writing', name: 'English Writing', displayOrder: 3, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['Nursery', 'LKG', 'UKG'] },
  { id: 'sub-english-oral', name: 'English Oral', displayOrder: 4, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['Nursery', 'LKG', 'UKG'] },
  { id: 'sub-maths-writing', name: 'Mathematics Writing', displayOrder: 5, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['Nursery', 'LKG', 'UKG'] },
  { id: 'sub-maths-oral', name: 'Mathematics Oral', displayOrder: 6, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['Nursery', 'LKG', 'UKG'] },

  // Primary & Upper Primary Core (1st to 8th)
  { id: 'sub-hindi-1', name: 'Hindi 1', displayOrder: 7, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'] },
  { id: 'sub-hindi-2', name: 'Hindi 2', displayOrder: 8, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'] },
  { id: 'sub-english-1', name: 'English 1', displayOrder: 9, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'] },
  { id: 'sub-english-2', name: 'English 2', displayOrder: 10, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'] },
  { id: 'sub-maths', name: 'Mathematics', displayOrder: 11, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'] },
  { id: 'sub-computer', name: 'Computer', displayOrder: 12, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['3rd', '4th', '5th', '6th', '7th', '8th'] },
  { id: 'sub-science', name: 'Science', displayOrder: 13, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['3rd', '4th', '5th', '6th', '7th', '8th'] },
  { id: 'sub-drawing', name: 'Drawing', displayOrder: 14, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'] },
  { id: 'sub-pt', name: 'Physical Training (PT)', displayOrder: 15, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'] },
  { id: 'sub-gk', name: 'General Knowledge (GK)', displayOrder: 16, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'] },
  { id: 'sub-sst', name: 'Social Studies (SST)', displayOrder: 17, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['UKG', '1st', '2nd', '6th', '7th', '8th'] },
  { id: 'sub-sanskrit', name: 'Sanskrit', displayOrder: 18, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['6th', '7th', '8th'] },
  { id: 'sub-urdu', name: 'Urdu', displayOrder: 19, halfMax: 100, annualMax: 100, passingMarks: 50, active: true, applicableClasses: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'], isOptional: true },
];

export const DEFAULT_STUDENTS: Student[] = [];

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
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

export const SUPER_ADMIN_PERMISSIONS: StaffPermissions = {
  canAddStudents: true,
  canEditStudents: true,
  canDeleteStudents: true,
  canEnterMarks: true,
  canBulkMarks: true,
  canExportData: true,
  canEditSchoolSettings: true,
  canManageStaff: true,
  canResetDatabase: true,
};

export const DEFAULT_STAFF_USERS: StaffUser[] = [
  {
    id: 'staff-helper-1',
    name: 'श्री रमेश कुमार (सहायक शिक्षक / डेटा एंट्री)',
    username: 'staff1',
    password: 'teacher123',
    role: 'staff',
    phone: '9838700021',
    isActive: true,
    permissions: {
      canAddStudents: true,
      canEditStudents: true,
      canDeleteStudents: false,
      canEnterMarks: true,
      canBulkMarks: true,
      canExportData: true,
      canEditSchoolSettings: false,
      canManageStaff: false,
      canResetDatabase: false,
    },
    createdAt: new Date().toISOString(),
  },
];

