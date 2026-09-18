export interface SubjectConfig {
  id: string;
  name: string;
  displayOrder: number;
  halfMax: number;
  annualMax: number;
  passingMarks: number;
  active: boolean;
}

export interface StudentMarkItem {
  subjectId: string;
  subjectName: string;
  halfMax: number;
  halfObtained: number;
  annualMax: number;
  annualObtained: number;
}

export interface ClassTeacherConfig {
  id: string;
  className: string;
  teacherName: string;
  signatureUrl?: string;
  phone?: string;
  designation?: string;
}

export interface Student {
  id: string;
  name: string;
  fatherName: string;
  motherName: string;
  dob: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  className: string;
  section: string;
  rollNo: string;
  admissionNo: string;
  photoUrl?: string;
  session: string;
  mobile?: string;
  address?: string;
  aadharNo?: string;
  teacherRemark?: string;
  classTeacherName?: string;
  classTeacherSignatureUrl?: string;
  marks: Record<string, {
    halfObtained: number;
    annualObtained: number;
  }>;
}

export interface SchoolSettings {
  schoolName: string;
  address: string;
  managedBy: string;
  mobile: string;
  tagline: string;
  logoUrl?: string;
  logoSize?: number; // Custom marksheet logo size in px (e.g. 50 - 130px, default 85px)
  marksheetSchoolNameSize?: number; // Custom font size for school name in marksheet header (in px, e.g. 16 - 32px, default 20px)
  publicPortalSchoolNameSize?: number; // Custom font size for school name on public search portal header (in px, e.g. 16 - 32px, default 20px)
  schoolBadgeType: 'OFFICIAL RESULT' | 'ACADEMIC RESULT';
  resultTitle: string;
  resultTitleHalfYearly?: string;
  session: string;
  footerText: string;
  teacherSignatureUrl?: string;
  principalSignatureUrl?: string;
  principalStampUrl?: string;
  showDigitalStamp?: boolean;
  stampType?: 'digital' | 'physical';
  defaultExamMode?: 'half_yearly_only' | 'combined' | 'annual_only';
  googleSheetWebAppUrl?: string;
  firebaseDatabaseUrl?: string;

  // Class Teachers configuration
  classTeachers?: ClassTeacherConfig[];

  // Dynamic Admin Authentication
  adminUserId?: string;
  adminPassword?: string;
  adminEmail?: string;

  // Master Customization Toggles
  showHalfYearlyExam?: boolean;
  showAnnualExam?: boolean;
  showTeacherRemarks?: boolean;
  showStudentPhoto?: boolean;
  showSignatures?: boolean;
  showPercentage?: boolean;
  showGrade?: boolean;
  showProgressGraph?: boolean;
  showStudentMobile?: boolean;
  showStudentAddress?: boolean;
  showStudentAadhar?: boolean;
  showPdfButton?: boolean;
  showPrintButton?: boolean;
  showImageButton?: boolean;
  allowPublicSearch?: boolean;
  isMaintenanceMode?: boolean;
  isResultLive?: boolean;
  maintenanceNotice?: string;
  maintenanceMessage?: string;
  liveBannerText?: string;
  activeClasses?: string[];
  toggles?: Record<string, boolean>;
}

export interface GradeRule {
  minPercentage: number;
  maxPercentage: number;
  grade: string;
  description: string;
}

export interface ExamSummary {
  maximum: number;
  obtained: number;
  percentage: number;
  grade: string;
  status: 'PASS' | 'FAIL';
}

export interface CombinedSummary {
  maximum: number;
  obtained: number;
  percentage: number;
  grade: string;
  status: 'PASS' | 'FAIL';
  progressPoints: number; // Annual % - Half %
}

export interface ProcessedSubjectRow {
  sNo: number;
  subjectId: string;
  subjectName: string;
  halfMax: number;
  halfObtained: number;
  annualMax: number;
  annualObtained: number;
  isValid: boolean;
  validationError?: string;
}

export interface StudentResultData {
  student: {
    id: string;
    name: string;
    fatherName: string;
    motherName: string;
    dob: string;
    gender: string;
    className: string;
    section: string;
    rollNo: string;
    admissionNo: string;
    photoUrl?: string;
    session: string;
    mobile?: string;
    aadharNo?: string;
    classTeacherName?: string;
    classTeacherSignatureUrl?: string;
  };
  subjects: ProcessedSubjectRow[];
  halfYearly: ExamSummary;
  annual: ExamSummary;
  combined: CombinedSummary;
  progress: number;
  teacherRemark: string;
  school: SchoolSettings;
  classTeacher?: {
    name?: string;
    signatureUrl?: string;
    designation?: string;
  };
  generatedAt: string;
  validationIssues?: string[];
  examMode?: 'half_yearly_only' | 'combined';
}
