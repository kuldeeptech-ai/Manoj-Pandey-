import React, { useState, useEffect } from 'react';
import {
  Student,
  SubjectConfig,
  SchoolSettings,
  GradeRule,
  StudentResultData,
} from '../types';
import {
  calculateStudentResult,
  validateMark,
  isSettingEnabled,
  normalizeSchoolSettings,
} from '../utils/calculations';
import {
  DEFAULT_STUDENT_PHOTO_17,
  DEFAULT_STUDENT_PHOTO_18,
  DEFAULT_STUDENT_PHOTO_FALLBACK,
  DEFAULT_SCHOOL_LOGO,
} from '../data/defaultData';
import {
  GOOGLE_APPS_SCRIPT_CODE,
  saveGoogleSheetUrl,
  testGoogleSheetConnection,
  syncAllDataToGoogleSheet,
  fetchAllFromGoogleSheet,
  getGoogleSheetUrl,
  initializeOrUpgradeGoogleSheet,
  STUDENTS_SHEET_HEADER,
  STUDENTS_SHEET_SAMPLE_CSV,
} from '../utils/googleSheetSync';
import {
  db,
  isFirebaseConfigured,
  saveStudentToFirebase,
  updateStudentMarksInFirebase,
  deleteStudentFromFirebase,
  saveSchoolSettingsToFirebase,
  updateSchoolToggleInFirebase,
  saveSubjectsToFirebase,
  saveGradeRulesToFirebase,
  syncAllDataToFirebase,
  fetchAllFromFirebase,
} from '../utils/firebase';
import { ref, get, set, update, remove } from 'firebase/database';
import { formatDisplayDate } from '../utils/calculations';
import { ClassTeachersManager } from './ClassTeachersManager';
import {
  Users,
  UserCheck,
  BookOpen,
  Settings,
  Award,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Check,
  AlertTriangle,
  ArrowLeft,
  LayoutDashboard,
  Save,
  RotateCcw,
  Sparkles,
  LogOut,
  Upload,
  Image,
  RefreshCw,
  FileText,
  Layers,
  Download,
  Shield,
  AlertCircle,
  Key,
  Shuffle,
  Sliders,
  CheckCircle2,
  Cloud,
  CheckCircle,
  Copy,
  ExternalLink,
  Globe,
} from 'lucide-react';

interface AdminPanelProps {
  students: Student[];
  subjects: SubjectConfig[];
  schoolSettings: SchoolSettings;
  gradeRules: GradeRule[];
  onSaveStudents: (students: Student[]) => void;
  onSaveSubjects: (subjects: SubjectConfig[]) => void;
  onSaveSchoolSettings: (settings: SchoolSettings) => void;
  onSaveGradeRules: (rules: GradeRule[]) => void;
  onViewStudentResult: (studentId: string) => void;
  onBackToPublic: () => void;
  onLogout?: () => void;
  initialSelectedStudentId?: string;
}

type TabType = 'dashboard' | 'students' | 'marks' | 'subjects' | 'school' | 'grades' | 'sheets' | 'teachers';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  students,
  subjects,
  schoolSettings,
  gradeRules,
  onSaveStudents,
  onSaveSubjects,
  onSaveSchoolSettings,
  onSaveGradeRules,
  onViewStudentResult,
  onBackToPublic,
  onLogout,
  initialSelectedStudentId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialSelectedStudentId ? 'marks' : 'dashboard');
  const [selectedStudentIdForMarks, setSelectedStudentIdForMarks] = useState<string>(
    initialSelectedStudentId || students[0]?.id || ''
  );

  // Student Edit / Create Modal state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isNewStudent, setIsNewStudent] = useState<boolean>(false);

  // Marks editing state for selected student
  const currentStudent = students.find((s) => s.id === selectedStudentIdForMarks) || students[0];
  const [currentMarks, setCurrentMarks] = useState<Record<string, { halfObtained: number; annualObtained: number }>>(
    currentStudent?.marks || {}
  );
  const [currentRemark, setCurrentRemark] = useState<string>(currentStudent?.teacherRemark || '');
  const [marksValidationErrors, setMarksValidationErrors] = useState<Record<string, string>>({});
  const [marksSaveSuccess, setMarksSaveSuccess] = useState<boolean>(false);
  const [marksCloudStatus, setMarksCloudStatus] = useState<'synced' | 'local_only' | 'offline' | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [manualSyncMsg, setManualSyncMsg] = useState<string | null>(null);

  const handleSyncAllDevicesNow = async () => {
    setIsCloudSyncing(true);
    setManualSyncMsg(null);

    try {
      await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolSettings,
          students,
          subjects,
          gradeRules,
        }),
      });
    } catch {}

    try {
      const fbRes = await syncAllDataToFirebase({
        schoolSettings,
        students,
        subjects,
        gradeRules,
      });
      if (fbRes.success) {
        setManualSyncMsg(`✓ सफलता! कुल ${students.length} छात्रों का डाटा Firebase Realtime Database में लाइव अपडेट हो गया है!`);
      } else {
        setManualSyncMsg(`⚠️ Firebase Sync: ${fbRes.message}`);
      }
    } catch (err: any) {
      setManualSyncMsg('⚠️ Sync error: ' + (err.message || 'Check network'));
    }
    setIsCloudSyncing(false);
    setTimeout(() => setManualSyncMsg(null), 6000);
  };

  // When selected student changes in Marks tab
  const handleSelectStudentForMarks = (id: string) => {
    setSelectedStudentIdForMarks(id);
    const std = students.find((s) => s.id === id);
    if (std) {
      setCurrentMarks(std.marks || {});
      setCurrentRemark(std.teacherRemark || '');
      setMarksValidationErrors({});
      setMarksSaveSuccess(false);
      setMarksCloudStatus(null);
    }
  };

  // Mark input change with validation
  const handleMarkChange = (subjectId: string, examType: 'half' | 'annual', valueStr: string) => {
    const val = Number(valueStr);
    const subj = subjects.find((s) => s.id === subjectId);
    const max = examType === 'half' ? (subj?.halfMax || 100) : (subj?.annualMax || 100);

    const validation = validateMark(val, max);
    const errKey = `${subjectId}_${examType}`;

    if (!validation.isValid) {
      setMarksValidationErrors((prev) => ({ ...prev, [errKey]: validation.error || 'Invalid marks' }));
    } else {
      setMarksValidationErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }

    setCurrentMarks((prev) => ({
      ...prev,
      [subjectId]: {
        halfObtained: examType === 'half' ? val : (prev[subjectId]?.halfObtained ?? 0),
        annualObtained: examType === 'annual' ? val : (prev[subjectId]?.annualObtained ?? 0),
      },
    }));
    setMarksSaveSuccess(false);
    setMarksCloudStatus(null);
  };

  const handleSaveMarks = () => {
    if (Object.keys(marksValidationErrors).length > 0) {
      alert('Please fix marks validation errors before saving (Obtained cannot exceed Maximum marks).');
      return;
    }
    const updated = students.map((s) => {
      if (s.id === selectedStudentIdForMarks) {
        return {
          ...s,
          marks: currentMarks,
          teacherRemark: currentRemark,
        };
      }
      return s;
    });
    onSaveStudents(updated);
    setMarksSaveSuccess(true);
    setTimeout(() => setMarksSaveSuccess(false), 3000);

    // Realtime Database CRUD: update marks and remarks at students/{id}
    setIsCloudSyncing(true);
    updateStudentMarksInFirebase(selectedStudentIdForMarks, currentMarks, currentRemark)
      .then(() => {
        setIsCloudSyncing(false);
        setMarksCloudStatus('synced');
        setTimeout(() => setMarksCloudStatus(null), 6000);
      })
      .catch((err) => {
        console.warn('[Firebase RTDB] Error updating marks:', err);
        setIsCloudSyncing(false);
        setMarksCloudStatus('offline');
        setTimeout(() => setMarksCloudStatus(null), 6000);
      });
  };

  // Student CRUD
  const handleStartAddStudent = () => {
    setIsNewStudent(true);
    setEditingStudent({
      id: `std-${Date.now()}`,
      name: '',
      fatherName: '',
      motherName: '',
      dob: '01/01/2012',
      gender: 'FEMALE',
      className: '8th',
      section: 'A',
      rollNo: String(students.length + 1),
      admissionNo: `ADM-2024-${String(students.length + 1).padStart(4, '0')}`,
      session: schoolSettings.session,
      mobile: '',
      aadharNo: '',
      photoUrl: DEFAULT_STUDENT_PHOTO_FALLBACK,
      teacherRemark: 'Regular and disciplined student. Shows consistent academic progress.',
      marks: {},
    });
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editingStudent.name || !editingStudent.rollNo) {
      alert('Student Name and Roll Number are required.');
      return;
    }

    const sanitizedStudent: Student = {
      ...editingStudent,
      dob: formatDisplayDate(editingStudent.dob),
      mobile: editingStudent.mobile ? String(editingStudent.mobile).trim() : '',
      aadharNo: editingStudent.aadharNo ? String(editingStudent.aadharNo).trim() : '',
    };

    if (isNewStudent) {
      onSaveStudents([...students, sanitizedStudent]);
    } else {
      onSaveStudents(students.map((s) => (s.id === sanitizedStudent.id ? sanitizedStudent : s)));
    }

    // Realtime Database CRUD: set student record at students/{id}
    saveStudentToFirebase(sanitizedStudent).catch((err) => {
      console.warn('[Firebase RTDB] Error saving student:', err);
    });

    setEditingStudent(null);
  };

  const handleDeleteStudent = async (id: string) => {
    if (confirm('Are you sure you want to delete this student record?')) {
      const remaining = students.filter((s) => s.id !== id);
      onSaveStudents(remaining);
      if (selectedStudentIdForMarks === id) {
        setSelectedStudentIdForMarks(remaining[0]?.id || '');
      }

      // Realtime Database CRUD: remove student record at students/{id}
      deleteStudentFromFirebase(id).catch((err) => {
        console.warn('[Firebase RTDB] Error deleting student:', err);
      });

      try {
        await fetch(`/api/admin/student/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch {}
    }
  };

  // Subject management state
  const [editingSubjects, setEditingSubjects] = useState<SubjectConfig[]>([...subjects]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectHalfMax, setNewSubjectHalfMax] = useState<number>(100);
  const [newSubjectAnnualMax, setNewSubjectAnnualMax] = useState<number>(100);
  const [newSubjectPassingMarks, setNewSubjectPassingMarks] = useState<number>(33);
  const [subjectNotice, setSubjectNotice] = useState<string | null>(null);

  // Synchronize local subjects when parent updates
  useEffect(() => {
    setEditingSubjects([...subjects]);
  }, [subjects]);

  const handleAddSubject = () => {
    const trimmed = newSubjectName.trim();
    if (!trimmed) {
      alert('कृपया विषय का नाम दर्ज करें! (Please enter a subject name)');
      return;
    }

    const alreadyExists = editingSubjects.some(
      (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) {
      alert(`विषय "${trimmed}" पहले से सूची में मौजूद है! (Subject already exists)`);
      return;
    }

    const newSubj: SubjectConfig = {
      id: `sub-${Date.now()}`,
      name: trimmed,
      displayOrder: editingSubjects.length + 1,
      halfMax: Number(newSubjectHalfMax) || 100,
      annualMax: Number(newSubjectAnnualMax) || 100,
      passingMarks: Number(newSubjectPassingMarks) || 33,
      active: true,
    };
    const updated = [...editingSubjects, newSubj];
    setEditingSubjects(updated);
    onSaveSubjects(updated);
    setNewSubjectName('');
    setSubjectNotice(`विषय "${trimmed}" सफलतापूर्वक जोड़ दिया गया है! (Subject Added Successfully)`);
    setTimeout(() => setSubjectNotice(null), 4000);
  };

  const handleSaveAllSubjects = () => {
    onSaveSubjects(editingSubjects);
    setSubjectNotice('सभी विषय और अधिकतम अंक सफलतापूर्वक सुरक्षित कर दिए गए! (All Subjects Saved)');
    setTimeout(() => setSubjectNotice(null), 4000);
  };

  const handleSubjectChange = (id: string, field: keyof SubjectConfig, val: any) => {
    const updated = editingSubjects.map((s) => (s.id === id ? { ...s, [field]: val } : s));
    setEditingSubjects(updated);
    onSaveSubjects(updated);
  };

  const handleDeleteSubject = (id: string) => {
    const subjToDelete = editingSubjects.find((s) => s.id === id);
    const subjName = subjToDelete ? subjToDelete.name : 'this subject';
    if (confirm(`क्या आप वाकई विषय "${subjName}" को परीक्षा सूची से हटाना चाहते हैं? (Delete this subject?)`)) {
      const updated = editingSubjects.filter((s) => s.id !== id);
      setEditingSubjects(updated);
      onSaveSubjects(updated);
      setSubjectNotice(`विषय "${subjName}" हटा दिया गया है। (Subject Deleted)`);
      setTimeout(() => setSubjectNotice(null), 3000);
    }
  };

  // School settings state
  const [settingsForm, setSettingsForm] = useState<SchoolSettings>({ ...schoolSettings });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Synchronize school settings when parent updates
  useEffect(() => {
    setSettingsForm({ ...schoolSettings });
  }, [schoolSettings]);

  // Admin password random generator
  const handleGenerateRandomPassword = () => {
    const prefixes = ['HDP', 'KLD', 'SCH', 'ADM', 'SKN'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const symbols = ['@', '#', '$', '!'];
    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    const generated = `${randomPrefix}${randomSymbol}${randomNum}`;
    setSettingsForm((prev) => ({ ...prev, adminPassword: generated }));
    alert(`नया रैंडम पासवर्ड तैयार हुआ: ${generated}\n(इसे सुरक्षित करने के लिए नीचे 'पासवर्ड तुरंत सुरक्षित करें' पर क्लिक करें)`);
  };

  const [credentialsSavedToast, setCredentialsSavedToast] = useState<string | null>(null);

  // Class Management State & Handlers
  const [newClassInput, setNewClassInput] = useState<string>('');
  const [classManagementToast, setClassManagementToast] = useState<string | null>(null);

  const currentActiveClasses = React.useMemo(() => {
    return Array.isArray(settingsForm.activeClasses) && settingsForm.activeClasses.length > 0
      ? settingsForm.activeClasses
      : ['5th', '6th', '7th', '8th'];
  }, [settingsForm.activeClasses]);

  const handleAddClass = (classToAdd: string) => {
    const trimmed = (classToAdd || '').trim();
    if (!trimmed) return;
    if (currentActiveClasses.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      alert(`कक्षा "${trimmed}" पहले से ही सूची में मौजूद है!`);
      return;
    }
    const updatedClasses = [...currentActiveClasses, trimmed];
    const updatedSettings = normalizeSchoolSettings({
      ...settingsForm,
      activeClasses: updatedClasses,
    });
    setSettingsForm(updatedSettings);
    onSaveSchoolSettings(updatedSettings);
    setNewClassInput('');
    setClassManagementToast(`✓ कक्षा "${trimmed}" होमपेज पर सफलतापूर्वक जोड़ दी गई!`);
    setTimeout(() => setClassManagementToast(null), 3500);
  };

  const handleRemoveClass = (classToRemove: string) => {
    if (currentActiveClasses.length <= 1) {
      alert('कम से कम एक कक्षा सक्रिय होनी चाहिए!');
      return;
    }
    const updatedClasses = currentActiveClasses.filter((c) => c !== classToRemove);
    const updatedSettings = normalizeSchoolSettings({
      ...settingsForm,
      activeClasses: updatedClasses,
    });
    setSettingsForm(updatedSettings);
    onSaveSchoolSettings(updatedSettings);
    setClassManagementToast(`कक्षा "${classToRemove}" हटा दी गई।`);
    setTimeout(() => setClassManagementToast(null), 3500);
  };

  const handleSetClassPreset = (presetList: string[]) => {
    const updatedSettings = normalizeSchoolSettings({
      ...settingsForm,
      activeClasses: presetList,
    });
    setSettingsForm(updatedSettings);
    onSaveSchoolSettings(updatedSettings);
    setClassManagementToast(`✓ कक्षाएं अपडेट हुईं: ${presetList.join(', ')}`);
    setTimeout(() => setClassManagementToast(null), 3500);
  };

  const handleSyncClassesFromStudents = () => {
    const foundClasses = Array.from(
      new Set(students.map((s) => (s.className || '').trim()).filter(Boolean))
    );
    if (foundClasses.length === 0) {
      alert('छात्र डाटाबेस में कोई कक्षा नहीं मिली।');
      return;
    }
    const combined = Array.from(new Set([...currentActiveClasses, ...foundClasses]));
    handleSetClassPreset(combined);
  };

  const handleSaveCredentialsOnly = async () => {
    const newId = settingsForm.adminUserId?.trim();
    const newPass = settingsForm.adminPassword?.trim();

    if (!newId || !newPass) {
      alert('कृपया वैध यूज़र आईडी और पासवर्ड दर्ज करें। ये खाली नहीं हो सकते।');
      return;
    }

    // 1. Send update directly to server API
    try {
      await fetch('/api/admin/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newUserId: newId, newPassword: newPass }),
      });
    } catch (e) {
      console.warn('Backend credential save notification failed:', e);
    }

    // 2. Persist in local storage keys for instant multi-tab sync and offline mode
    localStorage.setItem('school_admin_user', newId);
    localStorage.setItem('school_admin_pass', newPass);
    sessionStorage.setItem('school_admin_user', newId);

    const updated = normalizeSchoolSettings({
      ...settingsForm,
      adminUserId: newId,
      adminPassword: newPass,
    });
    setSettingsForm(updated);
    onSaveSchoolSettings(updated);

    setCredentialsSavedToast(`नया यूजर आईडी "${newId}" और पासवर्ड सफलतापूर्वक सुरक्षित हो गया! पुराना पासवर्ड तुरंत अमान्य कर दिया गया है।`);
    setTimeout(() => setCredentialsSavedToast(null), 6000);
  };

  // Helper to convert uploaded image to Base64 data URL
  const handleImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2.5 * 1024 * 1024) {
        alert('Image file exceeds 2.5MB. Please choose a smaller image.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setter(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const [toggleSaveToast, setToggleSaveToast] = useState<string | null>(null);

  const handleToggleSetting = (key: keyof SchoolSettings, value: boolean) => {
    const updated = normalizeSchoolSettings({
      ...settingsForm,
      [key]: value,
      toggles: {
        ...(settingsForm.toggles || {}),
        [key]: value,
      },
    });
    setSettingsForm(updated);
    onSaveSchoolSettings(updated);

    // Crucial Real-time Feature:
    // Update the school_settings/toggles node in Firebase Realtime Database using ref & update.
    // This triggers onValue on all connected clients instantly!
    updateSchoolToggleInFirebase(String(key), value).catch((err) => {
      console.warn('[Firebase RTDB] Error updating toggle in Realtime Database:', err);
    });

    setToggleSaveToast('टॉगल सुरक्षित! बदलाव तुरंत सभी डिवाइसों व पोर्टल पर लाइव हो गया है।');
    setTimeout(() => setToggleSaveToast(null), 3500);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeSchoolSettings(settingsForm);
    setSettingsForm(normalized);
    onSaveSchoolSettings(normalized);

    // Firebase Realtime Database: ref(db, 'school_settings'), set(...)
    saveSchoolSettingsToFirebase(normalized).catch((err) => {
      console.warn('[Firebase RTDB] Error saving settings to Firebase:', err);
    });

    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  // Google Sheets state & helpers
  const [isTestingSheet, setIsTestingSheet] = useState(false);
  const [sheetTestStatus, setSheetTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetSyncSuccess, setSheetSyncSuccess] = useState<string | null>(null);

  const downloadCsv = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportStudentsCsv = () => {
    const headers = 'Student_ID,Student_Name,Father_Name,Mother_Name,Date_of_Birth,Gender,Class,Section,Roll_No,Admission_No,Photo_URL,Session,Teacher_Remark,Mobile,Aadhar_No\n';
    const rows = students.map((s) =>
      `"${s.id}","${s.name}","${s.fatherName}","${s.motherName}","${s.dob}","${s.gender}","${s.className}","${s.section}","${s.rollNo}","${s.admissionNo}","${s.photoUrl || ''}","${s.session}","${(s.teacherRemark || '').replace(/"/g, '""')}","${s.mobile || ''}","${s.aadharNo || ''}"`
    ).join('\n');
    downloadCsv('1_Students.csv', headers + rows);
  };

  const handleExportMarksCsv = () => {
    const headers = 'Student_ID,Subject,Half_Max,Half_Obtained,Annual_Max,Annual_Obtained\n';
    const rows: string[] = [];
    students.forEach((s) => {
      subjects.forEach((subj) => {
        const m = s.marks[subj.id] || { halfObtained: 0, annualObtained: 0 };
        rows.push(`"${s.id}","${subj.name}",${subj.halfMax},${m.halfObtained},${subj.annualMax},${m.annualObtained}`);
      });
    });
    downloadCsv('2_Marks.csv', headers + rows.join('\n'));
  };

  const handleExportSubjectsCsv = () => {
    const headers = 'Subject_ID,Subject_Name,Display_Order,Half_Max,Annual_Max,Passing_Marks,Active\n';
    const rows = subjects.map((sub) =>
      `"${sub.id}","${sub.name}",${sub.displayOrder},${sub.halfMax},${sub.annualMax},${sub.passingMarks},${sub.active ? 'TRUE' : 'FALSE'}`
    ).join('\n');
    downloadCsv('3_Subjects.csv', headers + rows);
  };

  const handleExportTeachersCsv = () => {
    const teachers = schoolSettings.classTeachers || [];
    const headers = 'Class,Teacher_Name,Designation,Mobile,Signature_URL\n';
    let rows = '';
    if (teachers.length > 0) {
      rows = teachers.map((t) =>
        `"${t.className}","${t.teacherName}","${t.designation || 'Class Teacher'}","${t.phone || ''}","${t.signatureUrl || ''}"`
      ).join('\n');
    } else {
      const detectedClasses = Array.from(new Set(students.map((s) => s.className.trim()))).filter(Boolean);
      const list = detectedClasses.length > 0 ? detectedClasses : ['NURSERY', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
      rows = list.map((cls) => `"${cls}","Class Teacher ${cls}","Class Teacher","",""`).join('\n');
    }
    downloadCsv('4_Teachers.csv', headers + rows);
  };

  const handleExportAllJson = () => {
    const fullData = {
      schoolSettings,
      students,
      subjects,
      gradeRules,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HD_Pandey_School_Data_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPortalConfig = () => {
    const targetUrl = settingsForm.googleSheetWebAppUrl?.trim() || '';
    const configData = {
      googleSheetWebAppUrl: targetUrl,
      description: "Public portal configuration for multi-device sync",
      updatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'portal-config.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [sheetFetchSuccess, setSheetFetchSuccess] = useState<string | null>(null);
  const [urlSavedNotice, setUrlSavedNotice] = useState(false);
  const [codeCopiedNotice, setCodeCopiedNotice] = useState(false);
  const [teachersCopiedNotice, setTeachersCopiedNotice] = useState(false);
  const [studentsCopiedNotice, setStudentsCopiedNotice] = useState(false);

  const handleTestGoogleSheet = async () => {
    setIsTestingSheet(true);
    setSheetTestStatus(null);
    try {
      if (isFirebaseConfigured()) {
        await get(ref(db, 'school_settings'));
        setSheetTestStatus({
          success: true,
          message: '✓ Firebase Realtime Database से लाइव कनेक्शन सक्रिय है! (Connected to Firebase Realtime Database)',
        });
      } else {
        const url = settingsForm.googleSheetWebAppUrl?.trim();
        if (url) {
          const result = await testGoogleSheetConnection(url);
          setSheetTestStatus(result);
        } else {
          setSheetTestStatus({
            success: true,
            message: 'Firebase Realtime Database मोड तैयार है। (Firebase Realtime Database mode ready)',
          });
        }
      }
    } catch (err: any) {
      setSheetTestStatus({
        success: false,
        message: 'Firebase कनेक्शन एरर: ' + (err.message || 'नेटवर्क त्रुटि'),
      });
    }
    setIsTestingSheet(false);
  };

  const handleSyncToGoogleSheet = async () => {
    setIsSyncingSheet(true);
    setSheetSyncSuccess(null);
    try {
      const res = await syncAllDataToFirebase({
        schoolSettings: settingsForm,
        students,
        subjects,
        gradeRules,
      });

      if (res.success) {
        setSheetSyncSuccess('✓ Firebase Realtime Database में सारा डाटा (छात्र, अंक, विषय, सेटिंग्स) सफलतापूर्वक सुरक्षित हो गया!');
        setTimeout(() => setSheetSyncSuccess(null), 4000);
      } else {
        setSheetTestStatus({ success: false, message: res.message });
      }
    } catch (err: any) {
      setSheetTestStatus({ success: false, message: 'Firebase Sync Error: ' + err.message });
    }
    setIsSyncingSheet(false);
  };

  const handleFetchFromGoogleSheet = async () => {
    setIsFetchingSheet(true);
    setSheetFetchSuccess(null);
    try {
      const liveData = await fetchAllFromFirebase();
      if (liveData) {
        if (liveData.students && liveData.students.length > 0) {
          onSaveStudents(liveData.students);
        }
        if (liveData.subjects && liveData.subjects.length > 0) {
          onSaveSubjects(liveData.subjects);
        }
        if (liveData.settings && Object.keys(liveData.settings).length > 0) {
          onSaveSchoolSettings({ ...settingsForm, ...liveData.settings });
          setSettingsForm((prev) => ({ ...prev, ...liveData.settings }));
        }
        if (liveData.gradeRules && liveData.gradeRules.length > 0) {
          onSaveGradeRules(liveData.gradeRules);
        }
        setSheetFetchSuccess('Firebase Realtime Database से सारा डाटा (छात्र, अंक, विषय, सेटिंग्स) सफलता के साथ लोड हो गया!');
        setTimeout(() => setSheetFetchSuccess(null), 4500);
      } else {
        setSheetTestStatus({
          success: false,
          message: 'Firebase Realtime Database से डाटा लोड नहीं हो सका। कृपया अपनी Firebase config की पुष्टि करें।',
        });
      }
    } catch (err: any) {
      setSheetTestStatus({ success: false, message: 'डाटा प्राप्त करने में एरर: ' + err.message });
    } finally {
      setIsFetchingSheet(false);
    }
  };

  const [isUpgradingSheet, setIsUpgradingSheet] = useState(false);
  const [sheetUpgradeMessage, setSheetUpgradeMessage] = useState<{ success: boolean; text: string } | null>(null);

  const handleAutoUpgradeGoogleSheet = async () => {
    const url = settingsForm.googleSheetWebAppUrl?.trim();
    if (!url) {
      setSheetUpgradeMessage({
        success: false,
        text: 'कृपया पहले Google Sheet Web App URL दर्ज करें या सुरक्षित करें!',
      });
      return;
    }
    setIsUpgradingSheet(true);
    setSheetUpgradeMessage(null);

    try {
      // Step 1: Trigger auto-creation/upgrade of all 7 sheets on the Google Apps Script side
      const upgradeRes = await initializeOrUpgradeGoogleSheet(url);

      // Step 2: Automatically push all existing students, marks, subjects, settings & teachers
      const syncRes = await syncAllDataToGoogleSheet(url, {
        schoolSettings: settingsForm,
        students,
        subjects,
        gradeRules,
        classTeachers: settingsForm.classTeachers || schoolSettings.classTeachers,
      });

      if (upgradeRes.success || syncRes.success) {
        setSheetUpgradeMessage({
          success: true,
          text: 'बधाई हो! Google Sheet के सभी 7 टैब (Students, Marks, Subjects, School_Settings, Grade_Settings, Remarks, Teachers) व सभी नए कॉलम (Mobile, Aadhar_No) स्वतः तैयार व सिंक हो गए हैं। अब आपको कभी भी शीट दोबारा नहीं बनानी पड़ेगी!',
        });
      } else {
        setSheetUpgradeMessage({
          success: false,
          text: `चेतावनी: ${upgradeRes.message || syncRes.message || 'Sheets update error'}. कृपया सुनिश्चित करें कि आपने नया Code.gs पेस्ट करके New Deployment (Access: Anyone) किया है।`,
        });
      }
    } catch (err: any) {
      setSheetUpgradeMessage({
        success: false,
        text: `त्रुटि: ${err.message || 'Network error'}. कृपया इंटरनेट और URL जांचें।`,
      });
    } finally {
      setIsUpgradingSheet(false);
    }
  };

  // Grade rules state
  const [rulesForm, setRulesForm] = useState<GradeRule[]>([...gradeRules]);
  const [gradesSaved, setGradesSaved] = useState(false);

  const handleSaveGrades = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveGradeRules(rulesForm);
    setGradesSaved(true);
    setTimeout(() => setGradesSaved(false), 2000);
  };

  // Calculate live preview for current student in marks tab
  const liveResult: StudentResultData | null = currentStudent
    ? calculateStudentResult(
        { ...currentStudent, marks: currentMarks, teacherRemark: currentRemark },
        subjects,
        schoolSettings,
        gradeRules
      )
    : null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-[#0f2b48] text-white px-3 sm:px-6 py-3 border-b-4 border-[#b8860b] shadow flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBackToPublic}
            className="px-2.5 sm:px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-[#0f2b48] rounded-md transition-all font-black flex items-center gap-1.5 text-xs cursor-pointer shadow-md border border-amber-200 active:scale-95 shrink-0"
            title="पब्लिक छात्र रिजल्ट पोर्टल पर वापस जाएं"
          >
            <ArrowLeft className="w-4 h-4 text-[#0f2b48]" />
            <Globe className="w-3.5 h-3.5 text-[#0f2b48]" />
            <span className="font-black whitespace-nowrap">छात्र पोर्टल</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs sm:text-base font-bold tracking-tight uppercase leading-tight truncate">
              School Administration Console
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-300 font-medium truncate">
              {schoolSettings.schoolName}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap shrink-0">
          <button
            onClick={handleSyncAllDevicesNow}
            disabled={isCloudSyncing}
            className="flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-md bg-[#b8860b] hover:bg-[#9a7009] text-white shadow transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="Press to instantly push all updates to Google Sheet and all student phones"
          >
            <Cloud className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
            <span>{isCloudSyncing ? 'Syncing...' : 'Sync All (लाइव)'}</span>
          </button>

          {getGoogleSheetUrl(schoolSettings) ? (
            <span
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shrink-0"
              title="Google Sheet Cloud Sync Active: Any updates you make will be live on all student phones"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Cloud Sync Active</span>
            </span>
          ) : (
            <button
              onClick={() => setActiveTab('sheets')}
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30 transition-all cursor-pointer shrink-0"
              title="Google Sheet कनेक्ट करें ताकि सभी छात्रों के फोन में रिजल्ट दिखे"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
              <span>Connect Google Sheet</span>
            </button>
          )}
          <span className="hidden lg:inline-block text-xs font-semibold px-2.5 py-1 rounded bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 shrink-0">
            ● {schoolSettings.adminUserId || 'Admin'}
          </span>
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-2.5 sm:px-3 py-1.5 bg-rose-700/80 hover:bg-rose-700 text-white rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border border-rose-500/40 shrink-0"
              title="Logout from Admin Panel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>LOGOUT</span>
            </button>
          )}
        </div>
      </header>

      {/* Manual Sync Toast / Banner */}
      {manualSyncMsg && (
        <div className="bg-emerald-700 text-white px-3 sm:px-6 py-2.5 text-xs font-bold flex items-center justify-between shadow">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="truncate">{manualSyncMsg}</span>
          </div>
          <button onClick={() => setManualSyncMsg(null)} className="text-white/80 hover:text-white cursor-pointer ml-2 shrink-0">✕</button>
        </div>
      )}

      {/* Navigation Tabs (Scrollable on mobile) */}
      <div className="bg-white border-b border-slate-200 px-2 sm:px-6 flex items-center overflow-x-auto gap-1 sm:gap-2 scrollbar-none sm:scrollbar-thin">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-3 sm:px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'dashboard'
              ? 'border-[#0f2b48] text-[#0f2b48]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-3 sm:px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'students'
              ? 'border-[#0f2b48] text-[#0f2b48]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Students ({students.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('marks')}
          className={`px-3 sm:px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'marks'
              ? 'border-[#0f2b48] text-[#0f2b48]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Edit2 className="w-4 h-4" />
          <span>Marks Management</span>
        </button>

        <button
          onClick={() => setActiveTab('subjects')}
          className={`px-3 sm:px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'subjects'
              ? 'border-[#0f2b48] text-[#0f2b48]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Subjects ({subjects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('school')}
          className={`px-3 sm:px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'school'
              ? 'border-[#0f2b48] text-[#0f2b48]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>School Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('teachers')}
          className={`px-3 sm:px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'teachers'
              ? 'border-[#0f2b48] text-[#0f2b48]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4 text-blue-700" />
          <span>Class Teachers & Signatures ({settingsForm.classTeachers?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('grades')}
          className={`px-3 sm:px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'grades'
              ? 'border-[#0f2b48] text-[#0f2b48]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Grade Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('sheets')}
          className={`px-3 sm:px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'sheets'
              ? 'border-[#0f2b48] text-[#0f2b48]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Google Sheets Sync & Export</span>
        </button>

        <button
          onClick={onBackToPublic}
          className="ml-auto my-1.5 px-3 py-1.5 bg-[#0f2b48] hover:bg-[#18426d] text-amber-300 hover:text-white text-xs font-black rounded-md flex items-center gap-1.5 shrink-0 shadow transition-all cursor-pointer border border-amber-400/40 active:scale-95 whitespace-nowrap"
          title="पब्लिक छात्र परिणाम खोज पोर्टल खोलें"
        >
          <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
          <span className="hidden sm:inline">🌐 छात्र रिजल्ट खोजें (Public Portal)</span>
          <span className="sm:hidden">🌐 पब्लिक पोर्टल</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl w-full mx-auto min-w-0 overflow-x-hidden">
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Enrolled Students</span>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">All Classes</span>
                </div>
                <p className="text-3xl font-bold text-[#0f2b48] mt-1">{students.length}</p>
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                  <span>होमपेज कक्षाएं:</span>
                  <strong className="text-indigo-700">{currentActiveClasses.join(', ')}</strong>
                </p>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-500 uppercase">Active Subjects</span>
                <p className="text-3xl font-bold text-[#1b4975] mt-1">{subjects.filter((s) => s.active).length}</p>
                <p className="text-[11px] text-slate-400 mt-1">Curriculum Assessment</p>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-500 uppercase">Examination Terms</span>
                <p className="text-3xl font-bold text-emerald-700 mt-1">2 Terms</p>
                <p className="text-[11px] text-slate-400 mt-1">Half-Yearly & Annual</p>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-500 uppercase">Official Status</span>
                <p className="text-2xl font-bold text-[#b8860b] mt-1">Published</p>
                <p className="text-[11px] text-slate-400 mt-1">Session {schoolSettings.session}</p>
              </div>
            </div>

            {/* Quick Students Table */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#0f2b48] uppercase">
                    Student Performance Overview
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click "View Result" to see the full printable A4 marksheet for any student
                  </p>
                </div>
                <button
                  onClick={handleStartAddStudent}
                  className="px-3 py-1.5 bg-[#0f2b48] hover:bg-[#1b4975] text-white text-xs font-bold rounded flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Student</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Roll</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4">Class</th>
                      <th className="py-2.5 px-4">Father Name</th>
                      <th className="py-2.5 px-4">Half %</th>
                      <th className="py-2.5 px-4">Annual %</th>
                      <th className="py-2.5 px-4">Final Grade</th>
                      <th className="py-2.5 px-4">Result</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {students.map((st) => {
                      const res = calculateStudentResult(st, subjects, schoolSettings, gradeRules);
                      return (
                        <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-[#0f2b48]">{st.rollNo}</td>
                          <td className="py-2.5 px-4 font-bold uppercase">{st.name}</td>
                          <td className="py-2.5 px-4">{st.className}-{st.section}</td>
                          <td className="py-2.5 px-4 uppercase text-slate-600">{st.fatherName}</td>
                          <td className="py-2.5 px-4 font-bold">{res.halfYearly.percentage.toFixed(2)}%</td>
                          <td className="py-2.5 px-4 font-bold text-blue-900">{res.annual.percentage.toFixed(2)}%</td>
                          <td className="py-2.5 px-4 font-bold text-[#b8860b]">{res.combined.grade}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                res.combined.status === 'PASS'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {res.combined.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right space-x-1">
                            <button
                              onClick={() => {
                                handleSelectStudentForMarks(st.id);
                                setActiveTab('marks');
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold"
                              title="Edit Marks"
                            >
                              Marks
                            </button>
                            <button
                              onClick={() => onViewStudentResult(st.id)}
                              className="px-2 py-1 bg-[#0f2b48] hover:bg-[#1b4975] text-white rounded font-bold inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Marksheet</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STUDENTS MANAGEMENT */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-[#0f2b48] uppercase">
                  Student Records Management
                </h2>
                <p className="text-xs text-slate-500">
                  Manage student profiles, registration details, photos, and academic sessions.
                </p>
              </div>
              <button
                onClick={handleStartAddStudent}
                className="px-4 py-2 bg-[#0f2b48] hover:bg-[#1b4975] text-white text-xs font-bold rounded shadow-xs flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Student</span>
              </button>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Photo</th>
                      <th className="py-3 px-4">Roll</th>
                      <th className="py-3 px-4">Admission No</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Father / Mother</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Mobile & Aadhar</th>
                      <th className="py-3 px-4">DOB</th>
                      <th className="py-3 px-4">Gender</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="w-8 h-10 border border-slate-300 rounded overflow-hidden bg-slate-100">
                            {st.photoUrl ? (
                              <img src={st.photoUrl} alt={st.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[7px] text-slate-400">
                                N/A
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-[#0f2b48]">{st.rollNo}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-700">{st.admissionNo}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 uppercase">{st.name}</td>
                        <td className="py-2.5 px-4 text-slate-600 uppercase">
                          <div>F: {st.fatherName}</div>
                          <div className="text-[10px] text-slate-400">M: {st.motherName}</div>
                        </td>
                        <td className="py-2.5 px-4 font-semibold">{st.className} - {st.section}</td>
                        <td className="py-2.5 px-4 text-[11px] text-slate-600">
                          <div><span className="font-semibold text-slate-400">Mob:</span> {st.mobile || '—'}</div>
                          <div className="font-mono text-[10px]"><span className="font-semibold text-slate-400">Aad:</span> {st.aadharNo || '—'}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 font-mono text-xs">{formatDisplayDate(st.dob)}</td>
                        <td className="py-2.5 px-4 font-medium">{st.gender}</td>
                        <td className="py-2.5 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => onViewStudentResult(st.id)}
                            className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded"
                            title="View Result Marksheet"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setIsNewStudent(false);
                              setEditingStudent(st);
                            }}
                            className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded"
                            title="Edit Student Info"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(st.id)}
                            className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded"
                            title="Delete Student"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student Edit Modal */}
            {editingStudent && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
                <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col my-auto overflow-hidden">
                  <div className="p-3 sm:p-4 bg-[#0f2b48] text-white flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-xs sm:text-sm uppercase truncate pr-2">
                      {isNewStudent ? 'Add New Student' : `Edit Student: ${editingStudent.name}`}
                    </h3>
                    <button
                      onClick={() => setEditingStudent(null)}
                      className="text-slate-300 hover:text-white text-lg font-bold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveStudent} className="p-3 sm:p-6 space-y-4 text-xs font-semibold text-slate-700 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block mb-1 text-[11px] uppercase font-bold">Student Name *</label>
                        <input
                          type="text"
                          required
                          value={editingStudent.name}
                          onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48] font-bold"
                        />
                      </div>

                      <div>
                        <label className="block mb-1 text-[11px] uppercase font-bold">Roll Number *</label>
                        <input
                          type="text"
                          required
                          value={editingStudent.rollNo}
                          onChange={(e) => setEditingStudent({ ...editingStudent, rollNo: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48] font-bold"
                        />
                      </div>

                      <div>
                        <label className="block mb-1 text-[11px] uppercase font-bold">Admission Number *</label>
                        <input
                          type="text"
                          required
                          value={editingStudent.admissionNo}
                          onChange={(e) => setEditingStudent({ ...editingStudent, admissionNo: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48]"
                        />
                      </div>

                      <div>
                        <label className="block mb-1 text-[11px] uppercase font-bold">Date of Birth (DD/MM/YYYY)</label>
                        <input
                          type="text"
                          value={editingStudent.dob}
                          onChange={(e) => setEditingStudent({ ...editingStudent, dob: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48]"
                        />
                      </div>

                      <div>
                        <label className="block mb-1 text-[11px] uppercase font-bold">Father's Name</label>
                        <input
                          type="text"
                          value={editingStudent.fatherName}
                          onChange={(e) => setEditingStudent({ ...editingStudent, fatherName: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48]"
                        />
                      </div>

                      <div>
                        <label className="block mb-1 text-[11px] uppercase font-bold">Mother's Name</label>
                        <input
                          type="text"
                          value={editingStudent.motherName}
                          onChange={(e) => setEditingStudent({ ...editingStudent, motherName: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48]"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] uppercase font-bold">Class</label>
                          <span className="text-[10px] text-slate-400">सुझाव नीचे से चुनें</span>
                        </div>
                        <input
                          type="text"
                          list="active-classes-datalist"
                          value={editingStudent.className}
                          onChange={(e) => setEditingStudent({ ...editingStudent, className: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48]"
                          placeholder="उदा. 8th, 7th, 6th, 5th"
                        />
                        <datalist id="active-classes-datalist">
                          {currentActiveClasses.map((cls) => (
                            <option key={cls} value={cls} />
                          ))}
                        </datalist>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {currentActiveClasses.map((cls) => (
                            <button
                              key={cls}
                              type="button"
                              onClick={() => setEditingStudent({ ...editingStudent, className: cls })}
                              className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
                                editingStudent.className === cls
                                  ? 'bg-[#0f2b48] text-white border-[#0f2b48]'
                                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                              }`}
                            >
                              {cls}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block mb-1 text-[11px] uppercase font-bold">Section</label>
                        <input
                          type="text"
                          value={editingStudent.section}
                          onChange={(e) => setEditingStudent({ ...editingStudent, section: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48]"
                        />
                      </div>

                      <div>
                        <label className="block mb-1 text-[11px] uppercase font-bold">Gender</label>
                        <select
                          value={editingStudent.gender}
                          onChange={(e) => setEditingStudent({ ...editingStudent, gender: e.target.value as any })}
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48]"
                        >
                          <option value="FEMALE">FEMALE</option>
                          <option value="MALE">MALE</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </div>

                      <div>
                        <label className="block mb-1 text-[11px] uppercase font-bold">Session</label>
                        <input
                          type="text"
                          value={editingStudent.session}
                          onChange={(e) => setEditingStudent({ ...editingStudent, session: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48]"
                        />
                      </div>

                      <div>
                        <label className="block mb-1 text-[11px] uppercase font-bold text-slate-800">
                          Mobile Number (मोबाइल नंबर)
                        </label>
                        <input
                          type="tel"
                          value={editingStudent.mobile || ''}
                          onChange={(e) => setEditingStudent({ ...editingStudent, mobile: e.target.value })}
                          placeholder="e.g. 9838123456"
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48] bg-slate-50 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block mb-1 text-[11px] uppercase font-bold text-slate-800">
                          Aadhaar Card No. (आधार कार्ड नंबर)
                        </label>
                        <input
                          type="text"
                          value={editingStudent.aadharNo || ''}
                          onChange={(e) => setEditingStudent({ ...editingStudent, aadharNo: e.target.value })}
                          placeholder="e.g. 7845 2310 9012"
                          className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48] bg-slate-50 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Photo Selector */}
                    <div className="pt-2 border-t border-slate-200">
                      <label className="block mb-1 text-[11px] uppercase font-bold">Student Photo Preset / URL</label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-14 border border-slate-300 rounded bg-slate-100 overflow-hidden shrink-0">
                          {editingStudent.photoUrl && (
                            <img src={editingStudent.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <input
                            type="text"
                            value={editingStudent.photoUrl || ''}
                            onChange={(e) => setEditingStudent({ ...editingStudent, photoUrl: e.target.value })}
                            placeholder="Enter image URL or choose preset below"
                            className="w-full p-1.5 border border-slate-300 rounded text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingStudent({ ...editingStudent, photoUrl: DEFAULT_STUDENT_PHOTO_17 })}
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300"
                            >
                              Photo 1 (Priya)
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStudent({ ...editingStudent, photoUrl: DEFAULT_STUDENT_PHOTO_18 })}
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300"
                            >
                              Photo 2 (Aman)
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStudent({ ...editingStudent, photoUrl: DEFAULT_STUDENT_PHOTO_FALLBACK })}
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300"
                            >
                              Generic Portrait
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 text-[11px] uppercase font-bold">Teacher's Remark</label>
                      <textarea
                        rows={2}
                        value={editingStudent.teacherRemark || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, teacherRemark: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded focus:border-[#0f2b48]"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <label className="block mb-1 text-[11px] uppercase font-bold text-slate-700">
                        Class Teacher Name (अध्यापक का नाम - यदि विशेष हो, अन्यथा कक्षा सेटिंग से स्वतः लिया जाएगा)
                      </label>
                      <input
                        type="text"
                        placeholder="जैसे: Smt. Sunita Sharma (खाली छोड़ने पर कक्षा की डिफ़ॉल्ट सेटिंग लागू होगी)"
                        value={editingStudent.classTeacherName || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, classTeacherName: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded text-xs focus:border-[#0f2b48]"
                      />
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingStudent(null)}
                        className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#0f2b48] hover:bg-[#1b4975] text-white rounded text-xs font-bold"
                      >
                        Save Student
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MARKS MANAGEMENT */}
        {activeTab === 'marks' && (
          <div className="space-y-6">
            {/* Student Picker Banner */}
            <div className="bg-white p-3 sm:p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-600 uppercase shrink-0">Select Student:</span>
                <select
                  value={selectedStudentIdForMarks}
                  onChange={(e) => handleSelectStudentForMarks(e.target.value)}
                  className="p-2 border-2 border-[#0f2b48] rounded text-xs font-bold text-[#0f2b48] bg-[#f8faff] w-full sm:w-auto"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      Roll {s.rollNo}: {s.name} ({s.className}-{s.section})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => onViewStudentResult(selectedStudentIdForMarks)}
                  className="px-3.5 py-2 bg-[#0f2b48] hover:bg-[#1b4975] text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={handleSaveMarks}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save All Marks</span>
                </button>
              </div>
            </div>

            {/* Validation Notice if any */}
            {Object.keys(marksValidationErrors).length > 0 && (
              <div className="p-3 bg-red-50 border-l-4 border-red-600 rounded text-red-800 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Validation Error: {Object.values(marksValidationErrors)[0]}</span>
              </div>
            )}

            {marksSaveSuccess && (
              <div className="p-3 bg-emerald-50 border-l-4 border-emerald-600 rounded text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Marks and Teacher Remark saved successfully!</span>
              </div>
            )}

            {/* Marks Grid */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-xs">
                <span className="font-bold text-[#0f2b48] uppercase">
                  Subject Marks Entry — {currentStudent?.name} (Roll: {currentStudent?.rollNo})
                </span>
                <span className="text-slate-500 font-medium text-[11px]">
                  Rule: Obtained Marks ≤ Maximum Marks
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[640px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">S.No.</th>
                      <th className="py-2.5 px-4">Subject Name</th>
                      <th className="py-2.5 px-4 text-center bg-blue-50/50">Half-Yearly Max</th>
                      <th className="py-2.5 px-4 text-center bg-blue-50">Half-Yearly Obtained</th>
                      <th className="py-2.5 px-4 text-center bg-emerald-50/50">Annual Max</th>
                      <th className="py-2.5 px-4 text-center bg-emerald-50">Annual Obtained</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjects.filter((s) => s.active).map((subj, idx) => {
                      const studentMark = currentMarks[subj.id] || { halfObtained: 0, annualObtained: 0 };
                      const halfErr = marksValidationErrors[`${subj.id}_half`];
                      const annualErr = marksValidationErrors[`${subj.id}_annual`];

                      return (
                        <tr key={subj.id} className="hover:bg-slate-50">
                          <td className="py-2 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-4 font-bold text-slate-900 uppercase">
                            {subj.name}
                          </td>
                          <td className="py-2 px-4 text-center font-bold text-slate-600 bg-blue-50/20">
                            {subj.halfMax}
                          </td>
                          <td className="py-2 px-4 text-center bg-blue-50/40">
                            <input
                              type="number"
                              min="0"
                              max={subj.halfMax}
                              value={studentMark.halfObtained}
                              onChange={(e) => handleMarkChange(subj.id, 'half', e.target.value)}
                              className={`w-20 text-center py-1 font-bold text-xs border rounded ${
                                halfErr ? 'border-red-500 bg-red-50 text-red-900 ring-2 ring-red-200' : 'border-slate-300'
                              }`}
                            />
                            {halfErr && <span className="text-[9px] text-red-600 block mt-0.5">{halfErr}</span>}
                          </td>
                          <td className="py-2 px-4 text-center font-bold text-slate-600 bg-emerald-50/20">
                            {subj.annualMax}
                          </td>
                          <td className="py-2 px-4 text-center bg-emerald-50/40">
                            <input
                              type="number"
                              min="0"
                              max={subj.annualMax}
                              value={studentMark.annualObtained}
                              onChange={(e) => handleMarkChange(subj.id, 'annual', e.target.value)}
                              className={`w-20 text-center py-1 font-bold text-xs border rounded ${
                                annualErr ? 'border-red-500 bg-red-50 text-red-900 ring-2 ring-red-200' : 'border-slate-300'
                              }`}
                            />
                            {annualErr && <span className="text-[9px] text-red-600 block mt-0.5">{annualErr}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Dynamic Live Totals & Percentage Summary */}
              {liveResult && (
                <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-white p-3 rounded border border-blue-200 shadow-2xs">
                    <span className="font-bold text-blue-900 block uppercase">Half-Yearly (Term I)</span>
                    <p className="mt-1 text-slate-700">
                      Total: <strong className="text-[#0f2b48]">{liveResult.halfYearly.obtained}</strong> / {liveResult.halfYearly.maximum}
                    </p>
                    <p className="text-slate-700">
                      Percentage: <strong>{liveResult.halfYearly.percentage.toFixed(2)}%</strong>
                    </p>
                    <p className="text-slate-700">
                      Grade: <strong className="text-[#b8860b]">{liveResult.halfYearly.grade}</strong> ({liveResult.halfYearly.status})
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded border border-emerald-200 shadow-2xs">
                    <span className="font-bold text-emerald-900 block uppercase">Annual (Term II)</span>
                    <p className="mt-1 text-slate-700">
                      Total: <strong className="text-[#0f2b48]">{liveResult.annual.obtained}</strong> / {liveResult.annual.maximum}
                    </p>
                    <p className="text-slate-700">
                      Percentage: <strong>{liveResult.annual.percentage.toFixed(2)}%</strong>
                    </p>
                    <p className="text-slate-700">
                      Grade: <strong className="text-[#b8860b]">{liveResult.annual.grade}</strong> ({liveResult.annual.status})
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded border border-[#0f2b48]/30 bg-[#0f2b48]/5 shadow-2xs">
                    <span className="font-bold text-[#0f2b48] block uppercase">Final Combined Aggregate</span>
                    <p className="mt-1 text-slate-700">
                      Grand Total: <strong className="text-[#0f2b48]">{liveResult.combined.obtained}</strong> / {liveResult.combined.maximum}
                    </p>
                    <p className="text-slate-700">
                      Combined %: <strong className="text-amber-700">{liveResult.combined.percentage.toFixed(2)}%</strong>
                    </p>
                    <p className="text-slate-700">
                      Progress: <strong>{liveResult.progress > 0 ? `+${liveResult.progress.toFixed(2)}%` : `${liveResult.progress.toFixed(2)}%`}</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Teacher Remark Section */}
              <div className="p-4 border-t border-slate-200 bg-white">
                <label className="block text-xs font-bold text-[#0f2b48] uppercase mb-1">
                  Teacher's Remark for this Student:
                </label>
                <textarea
                  rows={2}
                  value={currentRemark}
                  onChange={(e) => setCurrentRemark(e.target.value)}
                  placeholder="e.g. Excellent academic performance! Very attentive and sincere."
                  className="w-full p-2.5 border border-slate-300 rounded text-xs font-bold text-slate-800"
                />
                <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                  <span className="text-slate-400 font-semibold">Quick Remarks:</span>
                  <button
                    type="button"
                    onClick={() => setCurrentRemark('Excellent academic performance! Attentive, disciplined and diligent. Keep it up!')}
                    className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200"
                  >
                    Outstanding / A+
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentRemark('Good effort in practical work. Needs improvement in Mathematics and English grammar. Focus on regular practice.')}
                    className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200"
                  >
                    Needs Improvement
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentRemark('Satisfactory academic progress. Regular homework submission and active classroom participation appreciated.')}
                    className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200"
                  >
                    Satisfactory
                  </button>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="w-full sm:w-auto">
                  {isCloudSyncing && (
                    <div className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded border border-blue-200 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>Google Sheet में सिंक हो रहा है...</span>
                    </div>
                  )}
                  {marksCloudStatus === 'synced' && (
                    <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded border border-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Google Sheet में सुरक्षित हो गया! सभी छात्र अपने फोन पर यह देख सकते हैं।</span>
                    </div>
                  )}
                  {marksCloudStatus === 'local_only' && (
                    <div className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded border border-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>अंक केवल इस फोन में सेव हुए हैं! सभी छात्रों के फोन में लाइव करने के लिए 'Google Sheet Sync' टैब में URL डालें।</span>
                    </div>
                  )}
                  {marksCloudStatus === 'offline' && (
                    <div className="text-xs font-bold text-rose-800 bg-rose-50 px-3 py-1.5 rounded border border-rose-300 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>अंक स्थानीय रूप से सुरक्षित हैं, पर Google Sheet से संपर्क नहीं हुआ।</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSaveMarks}
                  disabled={isCloudSyncing}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isCloudSyncing ? 'Saving & Syncing...' : 'Save All Changes (अंक सुरक्षित करें)'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SUBJECTS MANAGEMENT */}
        {activeTab === 'subjects' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0f2b48] uppercase">
                  Curriculum Subjects Management
                </h2>
                <p className="text-xs text-slate-500">
                  Configure subjects, maximum marks for Half-Yearly & Annual terms, passing marks, and display order.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveAllSubjects}
                className="px-4 py-2 bg-[#0f2b48] hover:bg-[#1b4975] text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"
              >
                <Save className="w-3.5 h-3.5 text-[#ffd54f]" />
                <span>Save All Subjects (सभी विषय सुरक्षित करें)</span>
              </button>
            </div>

            {/* Subject Status Message */}
            {subjectNotice && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{subjectNotice}</span>
              </div>
            )}

            {/* Dedicated Add New Subject Form Box */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4 mb-5 shadow-xs">
              <h3 className="text-xs font-bold text-[#0f2b48] uppercase mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#b8860b]" />
                <span>नया विषय जोड़ें (Add New Examination Subject)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Subject Name (विषय का नाम) *
                  </label>
                  <input
                    type="text"
                    placeholder="उदा. SANSKRIT, DRAWING, COMPUTER..."
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubject();
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-bold text-slate-900 uppercase bg-white focus:outline-none focus:ring-2 focus:ring-[#0f2b48]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Half-Yearly M.M.
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={newSubjectHalfMax}
                    onChange={(e) => setNewSubjectHalfMax(Number(e.target.value))}
                    className="w-full px-2 py-2 border border-slate-300 rounded text-xs font-bold text-center bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Annual M.M.
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={newSubjectAnnualMax}
                    onChange={(e) => setNewSubjectAnnualMax(Number(e.target.value))}
                    className="w-full px-2 py-2 border border-slate-300 rounded text-xs font-bold text-center bg-white"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Pass M.
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={newSubjectPassingMarks}
                    onChange={(e) => setNewSubjectPassingMarks(Number(e.target.value))}
                    className="w-full px-2 py-2 border border-slate-300 rounded text-xs font-bold text-center bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddSubject}
                    className="w-full py-2 bg-[#0f2b48] hover:bg-[#1b4975] text-white text-xs font-bold rounded flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer h-[34px]"
                  >
                    <Plus className="w-4 h-4 text-[#ffd54f]" />
                    <span>+ Add Subject</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 w-16">Order</th>
                      <th className="py-2.5 px-4">Subject Name</th>
                      <th className="py-2.5 px-4 text-center">Half-Yearly Max</th>
                      <th className="py-2.5 px-4 text-center">Annual Max</th>
                      <th className="py-2.5 px-4 text-center">Passing Marks</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editingSubjects.map((subj) => (
                      <tr key={subj.id} className="hover:bg-slate-50">
                        <td className="py-2 px-4">
                          <input
                            type="number"
                            value={subj.displayOrder}
                            onChange={(e) => handleSubjectChange(subj.id, 'displayOrder', Number(e.target.value))}
                            className="w-12 text-center p-1 border rounded text-xs font-bold"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            value={subj.name}
                            onChange={(e) => handleSubjectChange(subj.id, 'name', e.target.value)}
                            className="p-1 border rounded text-xs font-bold w-48 uppercase"
                          />
                        </td>
                        <td className="py-2 px-4 text-center">
                          <input
                            type="number"
                            value={subj.halfMax}
                            onChange={(e) => handleSubjectChange(subj.id, 'halfMax', Number(e.target.value))}
                            className="w-16 text-center p-1 border rounded text-xs font-bold"
                          />
                        </td>
                        <td className="py-2 px-4 text-center">
                          <input
                            type="number"
                            value={subj.annualMax}
                            onChange={(e) => handleSubjectChange(subj.id, 'annualMax', Number(e.target.value))}
                            className="w-16 text-center p-1 border rounded text-xs font-bold"
                          />
                        </td>
                        <td className="py-2 px-4 text-center">
                          <input
                            type="number"
                            value={subj.passingMarks}
                            onChange={(e) => handleSubjectChange(subj.id, 'passingMarks', Number(e.target.value))}
                            className="w-16 text-center p-1 border rounded text-xs font-bold"
                          />
                        </td>
                        <td className="py-2 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleSubjectChange(subj.id, 'active', !subj.active)}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                              subj.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {subj.active ? 'ACTIVE' : 'DISABLED'}
                          </button>
                        </td>
                        <td className="py-2 px-4 text-right">
                          <button
                            onClick={() => handleDeleteSubject(subj.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SCHOOL SETTINGS */}
        {activeTab === 'school' && (
          <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200 shadow-xs max-w-4xl">
            <div className="border-b border-slate-200 pb-3 mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-[#0f2b48] uppercase">
                  School Information, Logo & Seal Customization
                </h2>
                <p className="text-xs text-slate-500">
                  Manage school details, update official crest logo, seal/stamp preference, and default examination mode.
                </p>
              </div>
              {settingsSaved && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Changes Saved!
                </span>
              )}
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6 text-xs font-semibold text-slate-700">
              {/* SECTION A: SCHOOL LOGO & OFFICIAL SEAL */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                <h3 className="text-xs font-bold text-[#0f2b48] uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Image className="w-4 h-4 text-[#0f2b48]" />
                  <span>1. Official School Logo & Crest (विद्यालय का लोगो)</span>
                </h3>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Logo Preview */}
                  <div className="w-20 h-20 rounded-lg border-2 border-slate-300 bg-white p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                    {settingsForm.logoUrl ? (
                      <img
                        src={settingsForm.logoUrl}
                        alt="School Logo"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold text-center">No Logo</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 bg-[#0f2b48] hover:bg-[#1b4975] text-white text-xs font-bold rounded cursor-pointer flex items-center gap-1.5 transition-all shadow-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo from Device</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFileUpload(e, (url) => setSettingsForm({ ...settingsForm, logoUrl: url }))}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, logoUrl: DEFAULT_SCHOOL_LOGO })}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded flex items-center gap-1 transition-all"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore Default Crest</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        या Logo URL दर्ज करें (Image Link):
                      </label>
                      <input
                        type="text"
                        value={settingsForm.logoUrl || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, logoUrl: e.target.value })}
                        placeholder="https://... or base64"
                        className="w-full p-2 border border-slate-300 rounded text-slate-900 bg-white font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: SEAL / STAMP CUSTOMIZATION */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                <h3 className="text-xs font-bold text-[#0f2b48] uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Shield className="w-4 h-4 text-[#0f2b48]" />
                  <span>2. Official Seal / Principal Stamp (विद्यालय की मुहर / सील)</span>
                </h3>

                {/* Stamp Preference Radio */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-lg border-2 flex items-start gap-3 cursor-pointer transition-all ${
                      settingsForm.showDigitalStamp
                        ? 'border-[#0f2b48] bg-blue-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="stampType"
                      checked={settingsForm.showDigitalStamp === true}
                      onChange={() => setSettingsForm({ ...settingsForm, showDigitalStamp: true, stampType: 'digital' })}
                      className="mt-0.5 text-[#0f2b48]"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">डिजिटल मुहर (Uploaded Digital Seal)</span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        अंकपत्र पर अपलोड की गई असली गोल मुहर छपेगी।
                      </span>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-lg border-2 flex items-start gap-3 cursor-pointer transition-all ${
                      !settingsForm.showDigitalStamp
                        ? 'border-[#0f2b48] bg-blue-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="stampType"
                      checked={settingsForm.showDigitalStamp === false}
                      onChange={() => setSettingsForm({ ...settingsForm, showDigitalStamp: false, stampType: 'physical' })}
                      className="mt-0.5 text-[#0f2b48]"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">भौतिक रबर स्टैम्प (Physical Ink Stamping)</span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        अंकपत्र पर खाली डॉटेड गोला छपेगा ताकि आप स्कूल की मूल स्याही वाली मुहर हाथ से लगा सकें।
                      </span>
                    </div>
                  </label>
                </div>

                {/* Digital Stamp Upload / Preview if enabled */}
                {settingsForm.showDigitalStamp && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2 border-t border-slate-200">
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-blue-400 bg-white p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                      {settingsForm.principalStampUrl ? (
                        <img
                          src={settingsForm.principalStampUrl}
                          alt="Official Seal"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-[9px] text-slate-400 font-bold text-center">No Seal</span>
                      )}
                    </div>

                    <div className="flex-1 space-y-2 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="px-3 py-1.5 bg-[#0f2b48] hover:bg-[#1b4975] text-white text-xs font-bold rounded cursor-pointer flex items-center gap-1.5 transition-all shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Original Seal Image (PNG/JPG)</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleImageFileUpload(e, (url) =>
                                setSettingsForm({ ...settingsForm, principalStampUrl: url, showDigitalStamp: true })
                              )
                            }
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => setSettingsForm({ ...settingsForm, principalStampUrl: '' })}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded border border-rose-200 transition-all"
                        >
                          मुहर हटाएं (Clear Stamp)
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          या Seal Image URL दर्ज करें:
                        </label>
                        <input
                          type="text"
                          value={settingsForm.principalStampUrl || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, principalStampUrl: e.target.value })}
                          placeholder="https://... or base64"
                          className="w-full p-2 border border-slate-300 rounded text-slate-900 bg-white font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION C: EXAM EVALUATION MODE (HALF-YEARLY VS COMBINED) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                <h3 className="text-xs font-bold text-[#0f2b48] uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Layers className="w-4 h-4 text-[#0f2b48]" />
                  <span>3. Examination Mode (परीक्षा अंकपत्र प्रकार)</span>
                </h3>

                <p className="text-[11px] text-slate-500">
                  चुनें कि छात्र पोर्टल और डिफॉल्ट अंकपत्र में केवल अर्धवार्षिक परीक्षा दिखानी है या दोनों:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-lg border-2 flex items-start gap-3 cursor-pointer transition-all ${
                      settingsForm.defaultExamMode === 'half_yearly_only'
                        ? 'border-[#0f2b48] bg-blue-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="defaultExamMode"
                      checked={settingsForm.defaultExamMode === 'half_yearly_only'}
                      onChange={() => setSettingsForm({ ...settingsForm, defaultExamMode: 'half_yearly_only' })}
                      className="mt-0.5 text-[#0f2b48]"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        केवल अर्धवार्षिक परीक्षा (Half-Yearly Only)
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        अंकपत्र पर केवल अर्धवार्षिक के अंक और ग्रेड प्रदर्शित होंगे। वार्षिक परीक्षा का कोई कॉलम नहीं आएगा।
                      </span>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-lg border-2 flex items-start gap-3 cursor-pointer transition-all ${
                      settingsForm.defaultExamMode === 'combined'
                        ? 'border-[#0f2b48] bg-blue-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="defaultExamMode"
                      checked={settingsForm.defaultExamMode === 'combined'}
                      onChange={() => setSettingsForm({ ...settingsForm, defaultExamMode: 'combined' })}
                      className="mt-0.5 text-[#0f2b48]"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        संयुक्त परीक्षा परिणाम (Combined Half-Yearly + Annual)
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        अंकपत्र पर अर्धवार्षिक, वार्षिक एवं संयुक्त योग (Grand Total) तीनों कॉलम दिखेंगे।
                      </span>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block mb-1 font-bold uppercase text-[11px]">
                      Half-Yearly Result Title (अर्धवार्षिक शीर्षक)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.resultTitleHalfYearly || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, resultTitleHalfYearly: e.target.value })}
                      placeholder="ACADEMIC RESULT — HALF-YEARLY EXAMINATION"
                      className="w-full p-2 border border-slate-300 rounded font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 font-bold uppercase text-[11px]">
                      Combined Result Title (संयुक्त शीर्षक)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.resultTitle}
                      onChange={(e) => setSettingsForm({ ...settingsForm, resultTitle: e.target.value })}
                      placeholder="ACADEMIC RESULT — HALF-YEARLY & ANNUAL"
                      className="w-full p-2 border border-slate-300 rounded font-bold bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION D: SCHOOL CONTACT & REGISTRATION DETAILS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block mb-1 font-bold uppercase text-[11px]">School Name</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.schoolName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, schoolName: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-bold text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block mb-1 font-bold uppercase text-[11px]">School Address</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.address}
                    onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-bold uppercase text-[11px]">Managed By</label>
                  <input
                    type="text"
                    value={settingsForm.managedBy}
                    onChange={(e) => setSettingsForm({ ...settingsForm, managedBy: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-bold uppercase text-[11px]">Mobile Number</label>
                  <input
                    type="text"
                    value={settingsForm.mobile}
                    onChange={(e) => setSettingsForm({ ...settingsForm, mobile: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block mb-1 font-bold uppercase text-[11px]">School Tagline</label>
                  <input
                    type="text"
                    value={settingsForm.tagline}
                    onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-bold uppercase text-[11px]">Academic Session</label>
                  <input
                    type="text"
                    value={settingsForm.session}
                    onChange={(e) => setSettingsForm({ ...settingsForm, session: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-bold"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-bold uppercase text-[11px]">Header Badge Text</label>
                  <select
                    value={settingsForm.schoolBadgeType}
                    onChange={(e) => setSettingsForm({ ...settingsForm, schoolBadgeType: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded font-bold"
                  >
                    <option value="OFFICIAL RESULT">OFFICIAL RESULT</option>
                    <option value="ACADEMIC RESULT">ACADEMIC RESULT</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block mb-1 font-bold uppercase text-[11px]">Footer Motivational Text</label>
                  <input
                    type="text"
                    value={settingsForm.footerText}
                    onChange={(e) => setSettingsForm({ ...settingsForm, footerText: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
              </div>

              {/* SECTION E: SIGNATURES */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                <h3 className="text-xs font-bold text-[#0f2b48] uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Edit2 className="w-4 h-4 text-[#0f2b48]" />
                  <span>4. Teacher & Principal Signatures (हस्ताक्षर)</span>
                </h3>

                {/* Per-Class Teacher Quick Callout Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-blue-700 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-blue-950 block">
                        हर कक्षा के लिए अलग-अलग अध्यापक व हस्ताक्षर सेट करें (Per-Class Teachers)
                      </span>
                      <span className="text-[11px] text-blue-700">
                        Class 8th, 7th, 6th आदि सभी कक्षाओं के अध्यापकों के अलग नाम व डिजिटल हस्ताक्षर जोड़ें।
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('teachers')}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>कक्षा अध्यापक सेटिंग्स ➜</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Teacher Signature */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      Class Teacher Signature (कक्षा अध्यापक हस्ताक्षर)
                    </label>
                    <div className="h-14 border border-slate-300 rounded bg-white p-1 flex items-center justify-center overflow-hidden">
                      {settingsForm.teacherSignatureUrl ? (
                        <img
                          src={settingsForm.teacherSignatureUrl}
                          alt="Teacher Signature"
                          className="h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400">No Signature</span>
                      )}
                    </div>
                    <label className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded cursor-pointer flex items-center justify-center gap-1.5 transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Teacher Signature</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleImageFileUpload(e, (url) => setSettingsForm({ ...settingsForm, teacherSignatureUrl: url }))
                        }
                      />
                    </label>
                  </div>

                  {/* Principal Signature */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      Principal Signature (प्रधानाचार्य हस्ताक्षर)
                    </label>
                    <div className="h-14 border border-slate-300 rounded bg-white p-1 flex items-center justify-center overflow-hidden">
                      {settingsForm.principalSignatureUrl ? (
                        <img
                          src={settingsForm.principalSignatureUrl}
                          alt="Principal Signature"
                          className="h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400">No Signature</span>
                      )}
                    </div>
                    <label className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded cursor-pointer flex items-center justify-center gap-1.5 transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Principal Signature</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleImageFileUpload(e, (url) => setSettingsForm({ ...settingsForm, principalSignatureUrl: url }))
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* SECTION F: RESULT MARKSHEET DISPLAY & COMPONENT TOGGLES */}
              <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-lg space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#0f2b48] uppercase tracking-wide flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-[#0f2b48]" />
                    <span>5. Result Marksheet Display Toggles (अंकपत्र कस्टमाइज़ेशन टॉगल्स)</span>
                  </h3>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    लाइव टॉगल नियंत्रण (ऑटो-सेव)
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  नीचे दिए गए टॉगल से आप तय कर सकते हैं कि अंकपत्र और रिजल्ट पोर्टल में कौन-कौन से कॉलम और तत्व दिखेंगे। किसी भी टॉगल को चालू/बंद करते ही वह <strong>तुरंत सभी फोन, कंप्यूटर और लाइव पोर्टल पर सेव व लागू</strong> हो जाता है:
                </p>

                {toggleSaveToast && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{toggleSaveToast}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {/* Half-Yearly Exam Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        अर्धवार्षिक परीक्षा कॉलम (Half-Yearly Exam)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        बंद करने पर अंकपत्र में अर्धवार्षिक के अंक व पूर्णांक नहीं दिखेंगे।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showHalfYearlyExam, true)}
                      onChange={(e) => handleToggleSetting('showHalfYearlyExam', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* Annual Exam Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        वार्षिक परीक्षा कॉलम (Annual Exam)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        बंद करने पर अंकपत्र में वार्षिक परीक्षा के अंक व पूर्णांक नहीं दिखेंगे।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showAnnualExam, true)}
                      onChange={(e) => handleToggleSetting('showAnnualExam', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* Student Photo Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        छात्र फोटो (Student Photo)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        अंकपत्र के शीर्ष पर छात्र की पासपोर्ट फोटो दिखाएं या छिपाएं।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showStudentPhoto, true)}
                      onChange={(e) => handleToggleSetting('showStudentPhoto', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* Principal Stamp Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        प्रधानाचार्य आधिकारिक मुहर (Official Stamp)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        अंकपत्र पर विद्यालय की आधिकारिक डिजिटल मुहर दिखाएं।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showDigitalStamp, true)}
                      onChange={(e) => handleToggleSetting('showDigitalStamp', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* Signatures Block Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        हस्ताक्षर ब्लॉक (Signatures Block)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        कक्षा अध्यापक और प्रधानाचार्य के हस्ताक्षर का भाग दिखाएं।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showSignatures, true)}
                      onChange={(e) => handleToggleSetting('showSignatures', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* Percentage Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        प्राप्तांक प्रतिशत (Percentage %)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        अंकपत्र सारांश में कुल प्रतिशत दिखाएं।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showPercentage, true)}
                      onChange={(e) => handleToggleSetting('showPercentage', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* Grade Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        अंतिम ग्रेड (Grade A+, A, B...)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        अंकपत्र सारांश में ग्रेड प्रदर्शित करें।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showGrade, false)}
                      onChange={(e) => handleToggleSetting('showGrade', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* Progress Graph Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        प्रगति बार ग्राफ (Progress Graph)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        अंकपत्र में विषयवार रंगीन प्रगति चार्ट प्रदर्शित करें।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showProgressGraph, true)}
                      onChange={(e) => handleToggleSetting('showProgressGraph', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* Student Mobile Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        छात्र/अभिभावक मोबाइल नंबर (Student Mobile No.)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        अंकपत्र पर छात्र जानकारी में मोबाइल नंबर प्रदर्शित करें।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showStudentMobile, true)}
                      onChange={(e) => handleToggleSetting('showStudentMobile', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* Student Aadhar Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        आधार कार्ड नंबर (Aadhaar Card No.)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        अंकपत्र पर छात्र जानकारी में आधार कार्ड नंबर प्रदर्शित करें।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showStudentAadhar, true)}
                      onChange={(e) => handleToggleSetting('showStudentAadhar', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* Teacher Remarks Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer sm:col-span-2">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        अध्यापक आधिकारिक टिप्पणी (Teacher Remarks)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        अंकपत्र पर अध्यापक की टिप्पणी बॉक्स को दिखाएं या छिपाएं।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showTeacherRemarks, true)}
                      onChange={(e) => handleToggleSetting('showTeacherRemarks', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* PDF Download Button Live Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        PDF डाउनलोड बटन (PDF Download Button)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        अंकपत्र स्क्रीन पर PDF डाउनलोड बटन दिखाएं या छिपाएं (Realtime Live Toggle)।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showPdfButton, true)}
                      onChange={(e) => handleToggleSetting('showPdfButton', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>

                  {/* Print Marksheet Button Live Toggle */}
                  <label className="flex items-start justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                    <div className="pr-3">
                      <span className="text-xs font-bold text-slate-900 block">
                        प्रिंट अंकपत्र बटन (Print Marksheet Button)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        अंकपत्र स्क्रीन पर प्रिंट बटन दिखाएं या छिपाएं।
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSettingEnabled(settingsForm.showPrintButton, true)}
                      onChange={(e) => handleToggleSetting('showPrintButton', e.target.checked)}
                      className="w-5 h-5 accent-[#0f2b48] rounded mt-0.5 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* SECTION G: ADMIN SECURITY & PASSWORD MANAGEMENT */}
              <div className="p-4 bg-amber-50/70 border-2 border-amber-300 rounded-lg space-y-4">
                <div className="border-b border-amber-200 pb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#0f2b48] uppercase tracking-wide flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-amber-700" />
                    <span>6. Admin Security & Password Management (एडमिन पासवर्ड प्रबंधन)</span>
                  </h3>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-200 px-2.5 py-0.5 rounded-full">
                    सुरक्षित क्रेडेंशियल्स
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  एडमिन पैनल का पासवर्ड आप यहीं से बदल सकते हैं। यदि आप चाहें तो <strong>रैंडम पासवर्ड बनाएं</strong> बटन दबाकर नया सुरक्षित पासवर्ड भी उत्पन्न कर सकते हैं। यह पासवर्ड गूगल शीट और सभी डिवाइसों में सुरक्षित हो जाएगा।
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-white p-3.5 rounded-lg border border-amber-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      एडमिन यूज़र आईडी (Admin User ID)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.adminUserId ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, adminUserId: e.target.value })}
                      placeholder="Admin User ID"
                      className="w-full p-2 border border-slate-300 rounded font-bold text-slate-800 bg-white text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">एडमिन लॉगिन के लिए यूज़र आईडी</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      एडमिन पासवर्ड (Admin Password)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={settingsForm.adminPassword ?? ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, adminPassword: e.target.value })}
                        placeholder="नया पासवर्ड दर्ज करें"
                        className="w-full p-2 border border-slate-300 rounded font-bold text-[#0f2b48] bg-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateRandomPassword}
                        title="नया रैंडम पासवर्ड उत्पन्न करें"
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>रैंडम पासवर्ड</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      यहाँ से आप अपना नया पासवर्ड टाइप कर सकते हैं या 'रैंडम पासवर्ड' बटन से बना सकते हैं।
                    </span>
                  </div>
                </div>

                {credentialsSavedToast && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{credentialsSavedToast}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveCredentialsOnly}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5 text-amber-200" />
                    <span>पासवर्ड तुरंत सुरक्षित करें (Save Password Now)</span>
                  </button>
                </div>
              </div>

              {/* SECTION H: HOMEPAGE CLASS MANAGEMENT */}
              <div className="p-4 bg-indigo-50/70 border-2 border-indigo-200 rounded-lg space-y-4">
                <div className="border-b border-indigo-200 pb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-[#0f2b48] uppercase tracking-wide flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-700" />
                      <span>7. Homepage Class Management (होमपेज कक्षाएं जोड़ें / हटाएं)</span>
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      होमपेज सर्च में दिखाई देने वाली कक्षाओं को यहाँ से जोड़ें, हटाएं या बदलें।
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-800 bg-indigo-100 border border-indigo-300 px-2.5 py-0.5 rounded-full">
                    कुल {currentActiveClasses.length} कक्षाएं सक्रिय
                  </span>
                </div>

                {classManagementToast && (
                  <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{classManagementToast}</span>
                  </div>
                )}

                {/* Active Class Chips */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-2">
                    वर्तमान में होमपेज पर उपलब्ध कक्षाएं (Active Classes on Homepage):
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {currentActiveClasses.map((cls) => (
                      <div
                        key={cls}
                        className="inline-flex items-center gap-1.5 bg-white border-2 border-indigo-300 text-[#0f2b48] font-bold text-xs px-3 py-1.5 rounded-full shadow-xs hover:border-indigo-500 transition-all"
                      >
                        <span className="text-indigo-900">कक्षा {cls}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveClass(cls)}
                          title={`कक्षा ${cls} हटाएं`}
                          className="w-4 h-4 rounded-full bg-slate-100 hover:bg-rose-500 hover:text-white flex items-center justify-center text-slate-500 transition-colors text-xs font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Class Form & Presets */}
                <div className="bg-white p-3.5 rounded-lg border border-indigo-200 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newClassInput}
                      onChange={(e) => setNewClassInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddClass(newClassInput);
                        }
                      }}
                      placeholder="नई कक्षा का नाम (जैसे: 9th, 10th, या Pre-Primary)..."
                      className="flex-1 p-2 border border-slate-300 rounded font-bold text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddClass(newClassInput)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ नई कक्षा जोड़ें (Add Class)</span>
                    </button>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1.5">
                      त्वरित प्रीसेट (Quick Presets):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSetClassPreset(['5th', '6th', '7th', '8th'])}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-100 border border-slate-200 hover:border-indigo-300 rounded text-[11px] font-semibold text-slate-700 transition-all cursor-pointer"
                      >
                        5वीं से 8वीं (डिफ़ॉल्ट 5th–8th)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetClassPreset(['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'])}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-100 border border-slate-200 hover:border-indigo-300 rounded text-[11px] font-semibold text-slate-700 transition-all cursor-pointer"
                      >
                        1ली से 8वीं (1st–8th)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetClassPreset(['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'])}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-100 border border-slate-200 hover:border-indigo-300 rounded text-[11px] font-semibold text-slate-700 transition-all cursor-pointer"
                      >
                        नर्सरी से 8वीं (Nursery–8th)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetClassPreset(['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'])}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-100 border border-slate-200 hover:border-indigo-300 rounded text-[11px] font-semibold text-slate-700 transition-all cursor-pointer"
                      >
                        1ली से 10वीं (1st–10th)
                      </button>
                      <button
                        type="button"
                        onClick={handleSyncClassesFromStudents}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded text-[11px] font-bold text-amber-900 transition-all cursor-pointer"
                      >
                        ⚡ छात्रों की कक्षाओं से जोड़ें (Sync From Students)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Homepage Live Dropdown Preview */}
                <div className="bg-indigo-100/50 border border-indigo-200 rounded p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-700 shrink-0" />
                    <span className="text-slate-700">
                      <strong>होमपेज लाइव प्रीव्यू:</strong> सर्च पेज पर ड्रॉपडाउन में {currentActiveClasses.join(', ')} विकल्प दिखेंगे।
                    </span>
                  </div>
                  <span className="font-bold text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200 shrink-0">
                    Live Active
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0f2b48] hover:bg-[#1b4975] text-white rounded font-bold flex items-center gap-2 shadow cursor-pointer transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Save All School Settings</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 6: GRADE RULES */}
        {activeTab === 'grades' && (
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs max-w-3xl">
            <div className="border-b border-slate-200 pb-3 mb-4 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-[#0f2b48] uppercase">
                  Academic Grade Configuration
                </h2>
                <p className="text-xs text-slate-500">
                  Grade boundaries used for Half-Yearly, Annual, and Combined percentage calculations.
                </p>
              </div>
              {gradesSaved && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Saved!
                </span>
              )}
            </div>

            <form onSubmit={handleSaveGrades} className="space-y-4">
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[500px]">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Grade</th>
                        <th className="py-2.5 px-3">Min %</th>
                        <th className="py-2.5 px-3">Max %</th>
                        <th className="py-2.5 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {rulesForm.map((rule, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={rule.grade}
                              onChange={(e) => {
                                const updated = [...rulesForm];
                                updated[idx].grade = e.target.value;
                                setRulesForm(updated);
                              }}
                              className="w-16 p-1 border rounded text-center text-[#b8860b]"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={rule.minPercentage}
                              onChange={(e) => {
                                const updated = [...rulesForm];
                                updated[idx].minPercentage = Number(e.target.value);
                                setRulesForm(updated);
                              }}
                              className="w-20 p-1 border rounded text-center"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={rule.maxPercentage}
                              onChange={(e) => {
                                const updated = [...rulesForm];
                                updated[idx].maxPercentage = Number(e.target.value);
                                setRulesForm(updated);
                              }}
                              className="w-20 p-1 border rounded text-center"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={rule.description}
                              onChange={(e) => {
                                const updated = [...rulesForm];
                                updated[idx].description = e.target.value;
                                setRulesForm(updated);
                              }}
                              className="w-full p-1 border rounded"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#0f2b48] hover:bg-[#1b4975] text-white rounded font-bold flex items-center gap-1.5 shadow"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Grade Rules</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 7: GOOGLE SHEETS SYNC & APPS SCRIPT CODE */}
        {activeTab === 'sheets' && (
          <div className="space-y-6 max-w-4xl">
            {/* Multi-Device Live Setup Alert Banner */}
            <div className="bg-gradient-to-r from-[#0f2b48] to-[#1b4975] text-white p-5 rounded-xl shadow-md border-l-4 border-amber-400">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/10 rounded-lg shrink-0 mt-0.5">
                  <Shield className="w-5 h-5 text-amber-300" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-amber-300 flex items-center gap-2">
                    <span>सभी छात्रों के फोन पर रिजल्ट लाइव दिखाने का तरीका (Multi-Device Live Sync)</span>
                  </h3>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    <strong>समस्या का समाधान:</strong> जब वेबसाइट Vercel पर होस्ट होती है, तो एडमिन द्वारा भरा गया डाटा तब तक छात्रों के फोन पर नहीं दिख सकता जब तक वह किसी क्लाउड डेटाबेस (Google Sheet) से जुड़ा न हो। नीचे दिए गए 3 आसान चरणों से आपका पूरा रिजल्ट सभी बच्चों के फोन पर तुरंत दिखने लगेगा:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                    <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                      <span className="font-bold text-amber-300 block mb-0.5">1. Google Apps Script</span>
                      <span>नीचे दिया गया Code.gs अपनी Google Sheet में पेस्ट कर Web App डिप्लॉय करें (Access: Anyone)।</span>
                    </div>
                    <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                      <span className="font-bold text-amber-300 block mb-0.5">2. URL जोड़ें & सिंक</span>
                      <span>मिलने वाला URL नीचे बॉक्स में सेव करें और 'Push All Data' दबाकर अपने सारे छात्र व अंक भेजें।</span>
                    </div>
                    <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                      <span className="font-bold text-amber-300 block mb-0.5">3. Vercel / GitHub लिंक</span>
                      <span>Vercel Environment Variables में <code>VITE_GOOGLE_SHEET_URL</code> जोड़ें या नीचे से config डाउनलोड करें।</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 1. Google Sheets Live Integration Box */}
            <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600 shrink-0" />
                  <h2 className="text-sm sm:text-base font-bold text-[#0f2b48] uppercase">
                    Google Sheets Live Integration (Google Apps Script)
                  </h2>
                </div>
                {getGoogleSheetUrl(schoolSettings) ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Live Connected</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                अपने स्कूल का पूरा डाटा Google Sheet में सुरक्षित रखने और लाइव फेच करने के लिए अपने Google Apps Script Web App का URL यहाँ जोड़ें। छात्र जब रोल नंबर या प्रवेश संख्या डालेंगे, तो पोर्टल सीधे आपके Google Sheet से नवीनतम अंक और जानकारी प्राप्त कर सकता है।
              </p>

              {/* Web App URL Input */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase">
                  Google Apps Script Web App URL (Deploy as Web App URL)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={settingsForm.googleSheetWebAppUrl || ''}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, googleSheetWebAppUrl: e.target.value })
                    }
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    className="flex-1 p-2.5 border border-slate-300 rounded font-mono text-xs bg-white text-slate-900 focus:ring-2 focus:ring-[#0f2b48]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSaveSchoolSettings(settingsForm);
                        saveGoogleSheetUrl(settingsForm.googleSheetWebAppUrl || '');
                        setUrlSavedNotice(true);
                        setTimeout(() => setUrlSavedNotice(false), 3000);
                      }}
                      className="px-4 py-2.5 bg-[#0f2b48] hover:bg-[#1b4975] text-white rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save URL (सुरक्षित करें)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTestGoogleSheet}
                      disabled={isTestingSheet}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingSheet ? 'animate-spin' : ''}`} />
                      <span>{isTestingSheet ? 'Testing...' : 'Test Connection (कनेक्शन जांचें)'}</span>
                    </button>
                  </div>
                </div>

                {/* URL Saved Notice */}
                {urlSavedNotice && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded text-xs font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-600" />
                    <span>Google Sheet Web App URL सुरक्षित कर दिया गया है!</span>
                  </div>
                )}

                {/* Connection Status Banner */}
                {sheetTestStatus && (
                  <div
                    className={`p-3 rounded text-xs font-semibold flex items-start gap-2 ${
                      sheetTestStatus.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {sheetTestStatus.success ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{sheetTestStatus.message}</span>
                  </div>
                )}

                {/* 1-Click Auto Setup & Upgrade Google Sheet (Definitive Solution) */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 rounded-xl space-y-3 mt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-700 shrink-0" />
                      <h3 className="text-sm font-bold text-emerald-950 uppercase tracking-wide">
                        1-Click Auto Setup & Upgrade (एक क्लिक में नई शीट खुद बनाएं/अपग्रेड करें)
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold bg-emerald-600 text-white px-3 py-0.5 rounded-full shadow-xs">
                      Permanent Solution (अंतिम समाधान)
                    </span>
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    <strong>हाथ से शीट बनाने की बिल्कुल ज़रूरत नहीं है!</strong> नीचे दिए गए नए <code>Code.gs</code> को अपनी गूगल शीट के Apps Script में पेस्ट करके Web App डिप्लॉय करें। फिर बस नीचे दिए गए हरे बटन पर क्लिक करें—यह सिस्टम आपके गूगल शीट में सभी 7 टैब (Students, Marks, Subjects, School_Settings, Grade_Settings, Remarks, Teachers) और नए कॉलम (Mobile, Aadhar_No) <strong>स्वतः खुद बना देगा और आपका सारा डाटा भी भर देगा</strong>।
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleAutoUpgradeGoogleSheet}
                      disabled={isUpgradingSheet}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className={`w-4 h-4 ${isUpgradingSheet ? 'animate-spin' : 'text-amber-300'}`} />
                      <span>
                        {isUpgradingSheet
                          ? 'Google Sheet तैयार व सिंक हो रही है...'
                          : '⚡ 1-Click Auto Setup & Upgrade (सभी 7 शीट स्वतः बनाएं)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
                        setCodeCopiedNotice(true);
                        setTimeout(() => setCodeCopiedNotice(false), 3000);
                      }}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{codeCopiedNotice ? '✓ Code.gs Copied!' : 'Copy Updated Code.gs (नया कोड कॉपी करें)'}</span>
                    </button>
                  </div>

                  {sheetUpgradeMessage && (
                    <div
                      className={`p-3 rounded-lg text-xs font-bold flex items-start gap-2 border ${
                        sheetUpgradeMessage.success
                          ? 'bg-white text-emerald-900 border-emerald-400 shadow-sm'
                          : 'bg-rose-50 text-rose-900 border-rose-300'
                      }`}
                    >
                      {sheetUpgradeMessage.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="leading-relaxed">{sheetUpgradeMessage.text}</div>
                    </div>
                  )}
                </div>

                {/* 2-Way Sync Actions */}
                <div className="pt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 mt-2">
                  <button
                    type="button"
                    onClick={handleSyncToGoogleSheet}
                    disabled={isSyncingSheet}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                    title="Website se sara data Google Sheet me bhejain"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isSyncingSheet ? 'Syncing...' : '1. Push All Data to Google Sheet (शीट में भेजें)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFetchFromGoogleSheet}
                    disabled={isFetchingSheet}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                    title="Google Sheet se sara data portal me load karein"
                  >
                    <Download className={`w-3.5 h-3.5 ${isFetchingSheet ? 'animate-bounce' : ''}`} />
                    <span>{isFetchingSheet ? 'Fetching...' : '2. Pull Live Data from Google Sheet (शीट से लाएं)'}</span>
                  </button>

                  {sheetSyncSuccess && (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded border border-emerald-200">
                      <Check className="w-3.5 h-3.5" /> {sheetSyncSuccess}
                    </span>
                  )}

                  {sheetFetchSuccess && (
                    <span className="text-xs text-purple-700 font-bold flex items-center gap-1 bg-purple-50 px-3 py-1.5 rounded border border-purple-200">
                      <Check className="w-3.5 h-3.5" /> {sheetFetchSuccess}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Download CSV Templates for 6 Sheets */}
            <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#0f2b48] uppercase flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Download Ready CSV Sheets (Google Sheets Templates)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    इन CSV फाइल्स को डाउनलोड कर सीधे अपने Google Drive में SpreadSheet बना कर Import करें।
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPortalConfig}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow flex items-center gap-1 transition-all cursor-pointer"
                    title="Download portal-config.json to put in public/ folder for multi-device sync"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download portal-config.json (सभी फोन हेतु)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAllJson}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-300 flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Full JSON Backup</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportStudentsCsv}
                  className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0f2b48] group-hover:text-emerald-800">
                      1. Students.csv
                    </span>
                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {students.length} छात्र रिकॉर्ड्स (Roll, Name, Class, DOB...)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleExportMarksCsv}
                  className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0f2b48] group-hover:text-emerald-800">
                      2. Marks.csv
                    </span>
                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Half-Yearly एवं Annual प्राप्तांक तालिका
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSubjectsCsv}
                  className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0f2b48] group-hover:text-emerald-800">
                      3. Subjects.csv
                    </span>
                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {subjects.length} विषय और पूर्णांक/उत्तीर्णांक सूची
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleExportTeachersCsv}
                  className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0f2b48] group-hover:text-emerald-800">
                      4. Teachers.csv (Class Teachers)
                    </span>
                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    कक्षावार शिक्षक नाम, पद व हस्ताक्षर टेम्पलेट
                  </span>
                </button>
              </div>
            </div>

            {/* Google Sheets Students Mobile & Aadhar FAQ & Guide */}
            <div className="bg-sky-50 border-2 border-sky-300 rounded-lg p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#0f2b48] text-white rounded-lg shrink-0 mt-0.5">
                  <Users className="w-5 h-5" />
                </div>
                <div className="space-y-3 w-full">
                  <div>
                    <h3 className="text-sm font-bold text-[#0f2b48] uppercase tracking-wide">
                      मार्गदर्शन: Google Sheet में आधार कार्ड व मोबाइल नंबर (Mobile & Aadhar) कैसे जोड़ें?
                    </h3>
                    <p className="text-xs text-sky-950 mt-1 leading-relaxed">
                      पोर्टल अब <strong>Mobile Number</strong> और <strong>Aadhar Card Number</strong> दोनों को सपोर्ट करता है। आपकी Google Sheet की <code>Students</code> शीट में अंत में दो नए कॉलम (Headers) होने चाहिए: <code>Mobile</code> और <code>Aadhar_No</code>।
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded border border-sky-200 text-xs space-y-2">
                    <div className="font-bold text-[#0f2b48]">
                      Students शीट में कॉलम क्रम (15 Columns):
                    </div>
                    <div className="font-mono text-[11px] text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 break-all">
                      Student_ID, Student_Name, Father_Name, Mother_Name, Date_of_Birth, Gender, Class, Section, Roll_No, Admission_No, Photo_URL, Session, Teacher_Remark, <strong className="text-emerald-700 bg-emerald-100 px-1 rounded">Mobile</strong>, <strong className="text-emerald-700 bg-emerald-100 px-1 rounded">Aadhar_No</strong>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      💡 <strong>सुझाव:</strong> यदि आपकी शीट में पहले से छात्र हैं, तो पहली पंक्ति (Row 1) के अंत में कॉलम <strong>Mobile</strong> और <strong>Aadhar_No</strong> लिख दें। नीचे छात्रों के 10-अंकीय मोबाइल नंबर व 12-अंकीय आधार नंबर दर्ज करें।
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(STUDENTS_SHEET_HEADER);
                        setStudentsCopiedNotice(true);
                        setTimeout(() => setStudentsCopiedNotice(false), 3500);
                      }}
                      className="px-3 py-1.5 bg-[#0f2b48] hover:bg-[#1b4975] text-white text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      {studentsCopiedNotice ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>हेडर कॉपी हो गया! (Google Sheet में Ctrl+V पेस्ट करें)</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>1-Click Copy: Students Sheet Header (With Mobile & Aadhar)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleExportStudentsCsv}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Updated 1_Students.csv</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Sheets Teachers FAQ & Guide */}
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="space-y-3 w-full">
                  <div>
                    <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                      मार्गदर्शन: क्या Google Sheet में भी अध्यापकों (Teachers) की एक शीट बनानी पड़ेगी?
                    </h3>
                    <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                      <strong>सरल उत्तर:</strong> यदि आप चाहें तो बना सकते हैं, और न चाहें तो <strong>पोर्टल के अंदर ही 'Class Teachers & Signatures' टैब से सीधे नाम व साइन सेट कर सकते हैं</strong>—यह अपने आप सुरक्षित रहता है। लेकिन यदि आप Google Sheet से ही शिक्षकों का डेटा मैनेज करना चाहते हैं, तो नीचे दिए अनुसार बनाएं:
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded border border-amber-200 text-xs space-y-2">
                    <div className="font-bold text-[#0f2b48]">
                      Google Sheet में नई शीट (Tab) कैसे बनाएं:
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-700">
                      <li>अपनी Google Sheet खोलें और नीचे बाएँ कोने में <strong>+ (Add Sheet)</strong> पर क्लिक करें।</li>
                      <li>उस शीट का नाम ठीक <strong>Teachers</strong> रखें (Spelling: T-e-a-c-h-e-r-s)।</li>
                      <li>पहली पंक्ति (Row 1) में ये 5 कॉलम हेडर लिखें: <code>Class</code>, <code>Teacher_Name</code>, <code>Designation</code>, <code>Mobile</code>, <code>Signature_URL</code></li>
                    </ol>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const csvHeader = 'Class\tTeacher_Name\tDesignation\tMobile\tSignature_URL\n8th\tShri Anand Sharma\tClass Teacher\t9876543220\t\n7th\tShri Dharmendra Singh\tClass Teacher\t9876543219\t\n6th\tShri Rajesh Gupta\tClass Teacher\t9876543218\t\n5th\tSmt. Kiran Yadav\tClass Teacher\t9876543217\t';
                        navigator.clipboard.writeText(csvHeader);
                        setTeachersCopiedNotice(true);
                        setTimeout(() => setTeachersCopiedNotice(false), 3500);
                      }}
                      className="px-3 py-1.5 bg-[#0f2b48] hover:bg-[#1b4975] text-white text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      {teachersCopiedNotice ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>हेडर कॉपी हो गया! (Google Sheet में Ctrl+V पेस्ट करें)</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>1-Click Copy: Teachers Sheet Header & Sample</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleExportTeachersCsv}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Ready Teachers.csv</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Official 7-Sheets Structure Specs */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-[#0f2b48] uppercase mb-3">
                Google Sheets Official 7-Tab Architecture
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-6">
                <div className="border border-slate-200 rounded p-3 bg-slate-50">
                  <span className="font-bold text-[#0f2b48] block">SHEET 1: Students</span>
                  <p className="text-slate-500 text-[11px] mt-1 font-mono">
                    Student_ID, Student_Name, Father_Name, Mother_Name, Date_of_Birth, Gender, Class, Section, Roll_No, Admission_No, Photo_URL, Session, Teacher_Remark, Mobile, Aadhar_No
                  </p>
                </div>

                <div className="border border-slate-200 rounded p-3 bg-slate-50">
                  <span className="font-bold text-[#0f2b48] block">SHEET 2: Marks</span>
                  <p className="text-slate-500 text-[11px] mt-1 font-mono">
                    Student_ID, Subject, Half_Max, Half_Obtained, Annual_Max, Annual_Obtained
                  </p>
                </div>

                <div className="border border-slate-200 rounded p-3 bg-slate-50">
                  <span className="font-bold text-[#0f2b48] block">SHEET 3: Subjects</span>
                  <p className="text-slate-500 text-[11px] mt-1 font-mono">
                    Subject_ID, Subject_Name, Display_Order, Half_Max, Annual_Max, Passing_Marks, Active
                  </p>
                </div>

                <div className="border border-slate-200 rounded p-3 bg-slate-50">
                  <span className="font-bold text-[#0f2b48] block">SHEET 4: School_Settings</span>
                  <p className="text-slate-500 text-[11px] mt-1 font-mono">
                    Setting, Value (school_name, address, managed_by, mobile, logo_url, tagline, session, defaultExamMode, etc.)
                  </p>
                </div>

                <div className="border border-slate-200 rounded p-3 bg-slate-50">
                  <span className="font-bold text-[#0f2b48] block">SHEET 5: Grade_Settings</span>
                  <p className="text-slate-500 text-[11px] mt-1 font-mono">
                    Min_Percentage, Max_Percentage, Grade, Description
                  </p>
                </div>

                <div className="border border-slate-200 rounded p-3 bg-slate-50">
                  <span className="font-bold text-[#0f2b48] block">SHEET 6: Remarks</span>
                  <p className="text-slate-500 text-[11px] mt-1 font-mono">
                    Remark_ID, Class, Performance_Level, Remark_Text
                  </p>
                </div>

                <div className="border border-emerald-300 rounded p-3 bg-emerald-50/50 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 block">
                      SHEET 7: Teachers (Class Teachers & Signatures)
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                      NEW FEATURE
                    </span>
                  </div>
                  <p className="text-emerald-900 text-[11px] mt-1 font-mono">
                    Class, Teacher_Name, Designation, Mobile, Signature_URL
                  </p>
                  <p className="text-slate-600 text-[11px] mt-1">
                    कक्षावार क्लास टीचर का नाम व डिजिटल हस्ताक्षर। यहाँ से हर क्लास के मार्क्सशीट पर उसी क्लास के टीचर का नाम व साइन दिखेगा।
                  </p>
                </div>
              </div>

              {/* Ready Google Apps Script Code */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <div className="bg-[#0f2b48] text-white px-4 py-2 flex justify-between items-center text-xs font-bold">
                  <span>Google Apps Script Backend (Code.gs) - Ready to Copy & Paste</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
                      setCodeCopiedNotice(true);
                      setTimeout(() => setCodeCopiedNotice(false), 3500);
                    }}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
                  >
                    {codeCopiedNotice ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copied to Clipboard! (कॉपी हो गया)</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Copy Complete Code.gs</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed select-all">
                  {GOOGLE_APPS_SCRIPT_CODE}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: CLASS TEACHERS & SIGNATURES */}
        {activeTab === 'teachers' && (
          <ClassTeachersManager
            schoolSettings={settingsForm}
            students={students}
            onSaveClassTeachers={(updatedTeachers) => {
              const updatedSettings: SchoolSettings = {
                ...settingsForm,
                classTeachers: updatedTeachers,
              };
              setSettingsForm(updatedSettings);
              onSaveSchoolSettings(updatedSettings);
            }}
          />
        )}
      </main>
    </div>
  );
};
