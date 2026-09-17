import React, { useState, useRef, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Trash2,
  Upload,
  PenTool,
  Sparkles,
  Save,
  Check,
  RefreshCw,
  Eye,
  AlertCircle,
  X,
  RotateCcw,
  CheckCircle2,
  Phone,
  GraduationCap,
  FileSpreadsheet,
  Copy,
  Download,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ClassTeacherConfig, SchoolSettings, Student } from '../types';

interface ClassTeachersManagerProps {
  schoolSettings: SchoolSettings;
  students: Student[];
  onSaveClassTeachers: (updatedClassTeachers: ClassTeacherConfig[]) => void;
}

// Generate realistic handwritten cursive SVG signatures based on teacher name
export function generateTeacherSvgSignature(name: string, styleIndex: number = 0): string {
  const cleanName = name.trim() || 'Class Teacher';
  const strokeColor = '#1e3a8a'; // Official blue ink

  // Distinct cursive paths & flourish geometries
  const flourishes = [
    // Style 0: Smooth flow with underline loop
    `<path d="M 16 38 Q 30 12 46 28 T 68 18 T 90 35 T 120 16 T 145 28" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M 26 42 Q 62 52 135 34" fill="none" stroke="${strokeColor}" stroke-width="1.6" stroke-linecap="round"/>`,
    // Style 1: Dynamic ascending loop
    `<path d="M 14 34 Q 24 8 38 22 T 62 12 T 82 36 T 110 15 T 142 26" fill="none" stroke="${strokeColor}" stroke-width="2.3" stroke-linecap="round"/>
     <path d="M 22 30 Q 52 42 126 26" fill="none" stroke="${strokeColor}" stroke-width="1.7" stroke-linecap="round"/>`,
    // Style 2: Elegant rhythmic signature with double loop
    `<path d="M 18 36 Q 34 16 50 30 T 78 20 T 108 32 T 132 20" fill="none" stroke="${strokeColor}" stroke-width="2.0" stroke-linecap="round"/>
     <path d="M 20 44 Q 50 48 115 36 T 140 28" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round"/>`,
    // Style 3: Compact professional initial loop
    `<path d="M 20 40 Q 32 10 44 26 T 65 18 T 88 38 T 116 16 T 140 26" fill="none" stroke="${strokeColor}" stroke-width="2.4" stroke-linecap="round"/>
     <circle cx="145" cy="27" r="1.5" fill="${strokeColor}"/>
     <path d="M 30 38 Q 70 46 130 32" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round"/>`,
  ];

  const flourish = flourishes[styleIndex % flourishes.length];
  const displayName = cleanName.length > 20 ? cleanName.substring(0, 18) + '…' : cleanName;

  const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" width="160" height="60">
    <text x="22" y="32" font-family="'Brush Script MT', 'Dancing Script', 'Caveat', 'Segoe Script', cursive, sans-serif" font-size="19" font-style="italic" fill="${strokeColor}" opacity="0.95">${displayName}</text>
    ${flourish}
  </svg>`;

  try {
    if (typeof btoa !== 'undefined') {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(rawSvg.trim())))}`;
    }
  } catch {
    // fallback
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg.trim())}`;
}

export const ClassTeachersManager: React.FC<ClassTeachersManagerProps> = ({
  schoolSettings,
  students,
  onSaveClassTeachers,
}) => {
  const [teachersList, setTeachersList] = useState<ClassTeacherConfig[]>(() => {
    return Array.isArray(schoolSettings.classTeachers) && schoolSettings.classTeachers.length > 0
      ? [...schoolSettings.classTeachers]
      : [];
  });

  const [filterQuery, setFilterQuery] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // New Class Form State
  const [newClassName, setNewClassName] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newDesignation, setNewDesignation] = useState('Class Teacher');
  const [newPhone, setNewPhone] = useState('');

  // Active modal states
  const [drawModalTeacherId, setDrawModalTeacherId] = useState<string | null>(null);
  const [presetModalTeacherId, setPresetModalTeacherId] = useState<string | null>(null);
  const [previewTeacherId, setPreviewTeacherId] = useState<string | null>(null);

  // Signature Drawing Canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#1e3a8a'); // Blue ink by default
  const [penWidth, setPenWidth] = useState(3);
  const [hasDrawnSomething, setHasDrawnSomething] = useState(false);

  // Google Sheet integration helper states
  const [showSheetGuide, setShowSheetGuide] = useState(false);
  const [copiedHeaderToast, setCopiedHeaderToast] = useState(false);

  const handleCopySheetTemplate = () => {
    const csvHeader = 'Class\tTeacher_Name\tDesignation\tMobile\tSignature_URL\nNURSERY\tSmt. Anita Sharma\tClass Teacher\t9876543210\t\nLKG\tSmt. Rekha Verma\tClass Teacher\t9876543211\t\nUKG\tSmt. Priya Singh\tClass Teacher\t9876543212\t\n1st\tSmt. Sunita Devi\tClass Teacher\t9876543213\t\n2nd\tShri Ramesh Kumar\tClass Teacher\t9876543214\t\n3rd\tSmt. Geeta Maurya\tClass Teacher\t9876543215\t\n4th\tShri Manoj Pandey\tClass Teacher\t9876543216\t\n5th\tSmt. Kiran Yadav\tClass Teacher\t9876543217\t\n6th\tShri Rajesh Gupta\tClass Teacher\t9876543218\t\n7th\tShri Dharmendra Singh\tClass Teacher\t9876543219\t\n8th\tShri Anand Sharma\tClass Teacher\t9876543220\t';
    navigator.clipboard.writeText(csvHeader);
    setCopiedHeaderToast(true);
    setTimeout(() => setCopiedHeaderToast(false), 3500);
  };

  const handleDownloadTeachersCsv = () => {
    const headers = 'Class,Teacher_Name,Designation,Mobile,Signature_URL\n';
    let rows = '';
    if (teachersList.length > 0) {
      rows = teachersList.map((t) =>
        `"${t.className}","${t.teacherName}","${t.designation || 'Class Teacher'}","${t.phone || ''}","${t.signatureUrl || ''}"`
      ).join('\n');
    } else {
      const detected = Array.from(new Set(students.map((s) => s.className.trim()))).filter(Boolean);
      const list = detected.length > 0 ? detected : ['NURSERY', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
      rows = list.map((cls) => `"${cls}","Class Teacher ${cls}","Class Teacher","",""`).join('\n');
    }
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Teachers.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Update internal state when schoolSettings change
  useEffect(() => {
    if (Array.isArray(schoolSettings.classTeachers)) {
      setTeachersList([...schoolSettings.classTeachers]);
    }
  }, [schoolSettings.classTeachers]);

  // Handle Save
  const handleSave = () => {
    onSaveClassTeachers(teachersList);
    setSaveSuccessMsg('सभी कक्षा अध्यापकों के नाम व हस्ताक्षर सुरक्षित कर दिए गए हैं! (Class teachers and signatures saved)');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Add new class teacher entry
  const handleAddNewTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !newTeacherName.trim()) {
      alert('कृपया कक्षा का नाम (Class Name) और अध्यापक का नाम (Teacher Name) दर्ज करें।');
      return;
    }

    const newId = `ct-${Date.now()}`;
    const autoSig = generateTeacherSvgSignature(newTeacherName.trim(), teachersList.length % 4);

    const newEntry: ClassTeacherConfig = {
      id: newId,
      className: newClassName.trim(),
      teacherName: newTeacherName.trim(),
      designation: newDesignation.trim() || 'Class Teacher',
      phone: newPhone.trim() || undefined,
      signatureUrl: autoSig,
    };

    const updated = [...teachersList, newEntry];
    setTeachersList(updated);
    onSaveClassTeachers(updated);

    setNewClassName('');
    setNewTeacherName('');
    setNewDesignation('Class Teacher');
    setNewPhone('');

    setSaveSuccessMsg(`कक्षा ${newEntry.className} के लिए ${newEntry.teacherName} सफलतापूर्वक जोड़े गए!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Remove teacher entry
  const handleDeleteTeacher = (id: string, className: string) => {
    if (!confirm(`क्या आप कक्षा ${className} के अध्यापक को हटाना चाहते हैं?`)) return;
    const updated = teachersList.filter((t) => t.id !== id);
    setTeachersList(updated);
    onSaveClassTeachers(updated);
  };

  // Update specific teacher field
  const handleFieldChange = (id: string, field: keyof ClassTeacherConfig, value: string) => {
    setTeachersList((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  // Auto-detect classes from students
  const handleAutoPopulateFromStudents = () => {
    const studentClasses: string[] = Array.from(
      new Set(
        students
          .map((s) => s.className?.trim())
          .filter((c): c is string => Boolean(c))
      )
    );

    if (studentClasses.length === 0) {
      alert('छात्रों के डेटाबेस में कोई कक्षा नहीं मिली। कृपया पहले छात्र जोड़ें।');
      return;
    }

    let addedCount = 0;
    const currentClasses = new Set(teachersList.map((t) => t.className.toLowerCase().trim()));

    const newTeachers: ClassTeacherConfig[] = [];
    studentClasses.forEach((cls) => {
      if (!currentClasses.has(cls.toLowerCase().trim())) {
        addedCount++;
        const defaultTeacherName = `Teacher ${cls}`;
        newTeachers.push({
          id: `ct-auto-${Date.now()}-${addedCount}`,
          className: cls,
          teacherName: defaultTeacherName,
          designation: `Class Teacher (${cls})`,
          signatureUrl: generateTeacherSvgSignature(defaultTeacherName, addedCount % 4),
        });
      }
    });

    if (addedCount === 0) {
      alert('सभी छात्र कक्षाएं पहले से ही सूची में मौजूद हैं!');
      return;
    }

    const merged = [...teachersList, ...newTeachers];
    setTeachersList(merged);
    onSaveClassTeachers(merged);
    setSaveSuccessMsg(`छात्रों के डेटा से ${addedCount} नई कक्षाएं जोड़ी गईं!`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // File Upload Helper
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, teacherId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('कृपया केवल इमेज फाइल (PNG, JPEG, WebP) अपलोड करें।');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setTeachersList((prev) =>
          prev.map((t) => (t.id === teacherId ? { ...t, signatureUrl: dataUrl } : t))
        );
        setSaveSuccessMsg('हस्ताक्षर इमेज अपलोड हो गई! नीचे "Save All Changes" पर क्लिक करें।');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  // Setup Canvas for Drawing
  useEffect(() => {
    if (!drawModalTeacherId || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSomething(false);
  }, [drawModalTeacherId]);

  // Drawing mouse/touch handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawnSomething(true);

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSomething(false);
  };

  const saveCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !drawModalTeacherId) return;

    const dataUrl = canvas.toDataURL('image/png');
    setTeachersList((prev) =>
      prev.map((t) => (t.id === drawModalTeacherId ? { ...t, signatureUrl: dataUrl } : t))
    );

    setDrawModalTeacherId(null);
    setSaveSuccessMsg('डिजिटल हस्ताक्षर तैयार और लागू हो गया!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Apply Preset Signature
  const applyPresetSignature = (teacherId: string, styleIdx: number) => {
    const target = teachersList.find((t) => t.id === teacherId);
    if (!target) return;

    const generated = generateTeacherSvgSignature(target.teacherName, styleIdx);
    setTeachersList((prev) =>
      prev.map((t) => (t.id === teacherId ? { ...t, signatureUrl: generated } : t))
    );
    setPresetModalTeacherId(null);
    setSaveSuccessMsg('स्टाइलिश डिजिटल हस्ताक्षर लागू हो गया!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Clear signature for teacher
  const handleClearSignature = (teacherId: string) => {
    setTeachersList((prev) =>
      prev.map((t) => (t.id === teacherId ? { ...t, signatureUrl: undefined } : t))
    );
  };

  // Filtered teachers
  const filteredTeachers = teachersList.filter((t) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      t.className.toLowerCase().includes(q) ||
      t.teacherName.toLowerCase().includes(q) ||
      (t.phone && t.phone.toLowerCase().includes(q))
    );
  });

  const previewTeacher = previewTeacherId ? teachersList.find((t) => t.id === previewTeacherId) : null;
  const drawTeacher = drawModalTeacherId ? teachersList.find((t) => t.id === drawModalTeacherId) : null;
  const presetTeacher = presetModalTeacherId ? teachersList.find((t) => t.id === presetModalTeacherId) : null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-100 text-blue-800 rounded-lg">
                <UserCheck className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800">
                  Class Teachers & Signatures (कक्षा अनुसार अध्यापक व हस्ताक्षर)
                </h2>
                <p className="text-xs text-slate-500">
                  प्रत्येक कक्षा के अध्यापक का नाम, पद और हस्ताक्षर सेट करें। रिजल्ट मार्कशीट पर संबंधित कक्षा का सही हस्ताक्षर व नाम स्वतः दिखेगा।
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAutoPopulateFromStudents}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
              title="छात्रों के डेटा से कक्षाएं स्वतः जोड़ें"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Auto-Sync Classes ({students.length} Students)</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Save All Changes (सुरक्षित करें)</span>
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {saveSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Google Sheet "Teachers" Tab Setup Guidance Card */}
      <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="p-2 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-2">
                <span>Google Sheet में Teachers का डेटा कैसे रखें? (अक्सर पूछे जाने वाले सवाल)</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-amber-900 mt-0.5">
                क्या Google Sheet में भी अध्यापकों की शीट बनानी पड़ेगी? उत्तर: <strong>वैकल्पिक (Optional)</strong> है। आप चाहें तो नीचे दिए फॉर्मेट में 'Teachers' शीट बना सकते हैं, या सीधे यहीं से सेव कर सकते हैं।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopySheetTemplate}
              className="px-3 py-1.5 bg-[#0f2b48] hover:bg-[#1b4975] text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
            >
              {copiedHeaderToast ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>हेडर कॉपी हो गया!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Sheet Header</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadTeachersCsv}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Teachers.csv</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSheetGuide(!showSheetGuide)}
              className="p-1.5 text-amber-900 hover:text-amber-950 rounded-lg hover:bg-amber-100 transition-colors"
              title="मार्गदर्शन देखें / छिपाएं"
            >
              {showSheetGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Detailed instruction collapse */}
        {showSheetGuide && (
          <div className="mt-4 pt-3 border-t border-amber-200 text-xs text-amber-950 space-y-2 animate-in fade-in">
            <p className="font-semibold text-slate-800">
              अपनी Google Sheet में <strong>"Teachers"</strong> नाम से नई शीट जोड़ने के चरण:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-700 ml-1">
              <li>अपनी Google Sheet खोलें और नीचे <strong>+</strong> पर क्लिक करके नई टैब बनाएं जिसका नाम <strong>Teachers</strong> रखें।</li>
              <li>पहली पंक्ति (Row 1) में ठीक ये 5 कॉलम हेडर लिखें: <code>Class</code>, <code>Teacher_Name</code>, <code>Designation</code>, <code>Mobile</code>, <code>Signature_URL</code></li>
              <li>ऊपर <strong>"Copy Sheet Header"</strong> बटन दबाकर Google Sheet के A1 सेल में Ctrl+V पेस्ट भी कर सकते हैं।</li>
              <li>जब आप एडमिन पैनल के 'Google Sheets' टैब में जाकर <strong>"Push All Data"</strong> दबाएंगे, तो आपके सभी अध्यापकों का डेटा अपने आप Google Sheet में भर जाएगा!</li>
            </ol>
          </div>
        )}
      </div>

      {/* Add New Class Teacher Form */}
      <div className="bg-linear-to-r from-blue-50/70 to-indigo-50/70 rounded-xl border border-blue-200/80 p-4 sm:p-5 shadow-xs">
        <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-blue-700" />
          <span>नई कक्षा व अध्यापक जोड़ें (Add Class Teacher)</span>
        </h3>
        <form onSubmit={handleAddNewTeacher} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Class Name (कक्षा) *
            </label>
            <input
              type="text"
              placeholder="e.g. 8th, 7th, Nursery"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Teacher Name (अध्यापक का नाम) *
            </label>
            <input
              type="text"
              placeholder="e.g. Smt. Sunita Sharma"
              value={newTeacherName}
              onChange={(e) => setNewTeacherName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Designation (पद)
            </label>
            <input
              type="text"
              placeholder="e.g. Class Teacher (8th)"
              value={newDesignation}
              onChange={(e) => setNewDesignation(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Phone / Mobile (वैकल्पिक)
            </label>
            <input
              type="text"
              placeholder="e.g. 9838700008"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>कक्षा अध्यापक जोड़ें</span>
            </button>
          </div>
        </form>
      </div>

      {/* Class Teachers Table & List */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <GraduationCap className="w-4 h-4 text-blue-700" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Configured Classes ({teachersList.length})
            </span>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="खोजें (Search class or teacher)..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-200">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 w-28">Class</th>
                <th className="py-2.5 px-3 min-w-40">Class Teacher Name</th>
                <th className="py-2.5 px-3 min-w-32 hidden md:table-cell">Designation</th>
                <th className="py-2.5 px-3 w-40 text-center">Signature & Preview</th>
                <th className="py-2.5 px-3 min-w-48 text-center">Signature Actions</th>
                <th className="py-2.5 px-3 w-16 text-center">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    {filterQuery
                      ? 'कोई कक्षा या अध्यापक नहीं मिला।'
                      : 'अभी कोई कक्षा अध्यापक नहीं जोड़ा गया है। ऊपर दिए गए फॉर्म से जोड़ें या Auto-Sync Classes पर क्लिक करें।'}
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((teacher, index) => (
                  <tr key={teacher.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-bold">
                      {index + 1}
                    </td>

                    {/* Class Name */}
                    <td className="py-2.5 px-3 font-bold">
                      <input
                        type="text"
                        value={teacher.className}
                        onChange={(e) => handleFieldChange(teacher.id, 'className', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-blue-900 text-xs focus:bg-white focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Teacher Name */}
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={teacher.teacherName}
                        onChange={(e) => handleFieldChange(teacher.id, 'teacherName', e.target.value)}
                        placeholder="Teacher Name"
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800 text-xs focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Designation */}
                    <td className="py-2.5 px-3 hidden md:table-cell">
                      <input
                        type="text"
                        value={teacher.designation || 'Class Teacher'}
                        onChange={(e) => handleFieldChange(teacher.id, 'designation', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-600 text-[11px] focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Signature Preview Thumbnail */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center">
                        <div
                          className="w-32 h-10 bg-slate-50 border border-slate-300 rounded flex items-center justify-center p-1 cursor-pointer hover:border-blue-400 group relative"
                          onClick={() => setPreviewTeacherId(teacher.id)}
                          title="Click to view marksheet preview"
                        >
                          {teacher.signatureUrl ? (
                            <img
                              src={teacher.signatureUrl}
                              alt="Teacher Sig"
                              className="max-h-8 max-w-28 object-contain"
                            />
                          ) : schoolSettings.teacherSignatureUrl ? (
                            <div className="flex flex-col items-center">
                              <img
                                src={schoolSettings.teacherSignatureUrl}
                                alt="Default Sig"
                                className="max-h-6 max-w-24 object-contain opacity-50"
                              />
                              <span className="text-[8px] text-slate-400 leading-none">Default Sig</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No Signature</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Signature Action Buttons */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* Draw Signature */}
                        <button
                          type="button"
                          onClick={() => setDrawModalTeacherId(teacher.id)}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="स्क्रीन पर उंगली या माउस से हस्ताक्षर बनाएं"
                        >
                          <PenTool className="w-3 h-3" />
                          <span>Draw (बनाएं)</span>
                        </button>

                        {/* Preset Calligraphy / Digital Sig */}
                        <button
                          type="button"
                          onClick={() => setPresetModalTeacherId(teacher.id)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="नाम से सुंदर डिजिटल हस्ताक्षर चुनें"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Styles</span>
                        </button>

                        {/* Upload Image */}
                        <label
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="हस्ताक्षर फोटो अपलोड करें"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, teacher.id)}
                            className="hidden"
                          />
                        </label>

                        {/* Clear */}
                        {teacher.signatureUrl && (
                          <button
                            type="button"
                            onClick={() => handleClearSignature(teacher.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="हस्ताक्षर हटाएं"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Delete */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteTeacher(teacher.id, teacher.className)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="हटाएं"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer save reminder */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <span>
              परिवर्तन करने के बाद ऊपर या नीचे दिए गए 'Save All Changes' बटन पर अवश्य क्लिक करें।
            </span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Save All Changes (सुरक्षित करें)</span>
          </button>
        </div>
      </div>

      {/* DRAW SIGNATURE MODAL */}
      {drawTeacher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#0f2b48] text-white px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <PenTool className="w-4 h-4 text-blue-300 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold truncate">
                    Draw Signature: {drawTeacher.teacherName} (Class {drawTeacher.className})
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 truncate">
                    नीचे बॉक्स में अपनी उंगली (Touch) या माउस से हस्ताक्षर करें
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDrawModalTeacherId(null)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer shrink-0 ml-2"
              >
                <X className="w-5 h-5 text-slate-300 hover:text-white" />
              </button>
            </div>

            {/* Drawing Surface */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Canvas Box */}
              <div className="border-2 border-dashed border-blue-400 bg-[#f8fafc] rounded-xl p-2 flex flex-col items-center">
                <canvas
                  ref={canvasRef}
                  width={420}
                  height={180}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 bg-white rounded-lg shadow-inner cursor-crosshair touch-none border border-slate-200"
                />
                <div className="w-full flex justify-between items-center px-1 mt-1 text-[10px] text-slate-400">
                  <span>Sign within the box</span>
                  <span>Signature Line ─────────────────</span>
                </div>
              </div>

              {/* Controls: Color & Stroke Width */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Ink Color:</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { color: '#1e3a8a', label: 'Blue Ink' },
                      { color: '#0f2b48', label: 'Dark Navy' },
                      { color: '#111827', label: 'Black' },
                    ].map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => setPenColor(c.color)}
                        style={{ backgroundColor: c.color }}
                        className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                          penColor === c.color ? 'border-amber-400 scale-110 shadow-xs' : 'border-transparent'
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Thickness:</span>
                  <div className="flex items-center gap-1">
                    {[2, 3, 4].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setPenWidth(w)}
                        className={`px-2 py-0.5 rounded text-xs font-bold cursor-pointer ${
                          penWidth === w ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {w === 2 ? 'Fine' : w === 3 ? 'Medium' : 'Bold'}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearCanvas}
                  className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded font-bold flex items-center gap-1 cursor-pointer transition-colors border border-rose-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear (मिटाएं)</span>
                </button>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDrawModalTeacherId(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveCanvasSignature}
                  disabled={!hasDrawnSomething}
                  className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                    hasDrawnSomething
                      ? 'bg-blue-700 hover:bg-blue-800 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>हस्ताक्षर सुरक्षित करें (Apply Signature)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRESET STYLES MODAL */}
      {presetTeacher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="bg-[#0f2b48] text-white px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold truncate">
                    Select Digital Signature Style ({presetTeacher.teacherName})
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 truncate">
                    नीचे दिए गए किसी भी एक स्टाइलिश हस्ताक्षर पर क्लिक करके तुरंत लागू करें
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPresetModalTeacherId(null)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer shrink-0 ml-2"
              >
                <X className="w-5 h-5 text-slate-300 hover:text-white" />
              </button>
            </div>

            {/* Styles Grid */}
            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
              {[0, 1, 2, 3].map((styleIdx) => {
                const sampleSig = generateTeacherSvgSignature(presetTeacher.teacherName, styleIdx);
                const styleNames = [
                  'Style 1: Smooth Flourish (क्लासिक कर्व)',
                  'Style 2: Dynamic Loop (डायनामिक लूप)',
                  'Style 3: Elegant Cursive (सुरुचिपूर्ण करसिव)',
                  'Style 4: Professional Dot (ऑफिशियल फ्लो)',
                ];

                return (
                  <div
                    key={styleIdx}
                    onClick={() => applyPresetSignature(presetTeacher.id, styleIdx)}
                    className="p-3 border border-slate-300 hover:border-blue-600 hover:bg-blue-50/50 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-700 block group-hover:text-blue-900">
                        {styleNames[styleIdx]}
                      </span>
                      <span className="text-[10px] text-slate-400">Click to apply to Class {presetTeacher.className}</span>
                    </div>

                    <div className="w-36 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center p-1 group-hover:border-blue-300 shadow-2xs">
                      <img src={sampleSig} alt="Sample" className="max-h-10 max-w-32 object-contain" />
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPresetModalTeacherId(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MARKSHEET PREVIEW MODAL */}
      {previewTeacher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
            <div className="bg-[#0f2b48] text-white px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold truncate">
                  Marksheet Footer Preview (Class {previewTeacher.className})
                </h4>
              </div>
              <button
                onClick={() => setPreviewTeacherId(null)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer shrink-0 ml-2"
              >
                <X className="w-5 h-5 text-slate-300 hover:text-white" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <p className="text-xs text-slate-600">
                कक्षा <strong className="text-blue-900">{previewTeacher.className}</strong> के छात्र की मार्कशीट पर हस्ताक्षर ब्लॉक इस प्रकार दिखाई देगा:
              </p>

              {/* Exact Marksheet Signature Block Replica */}
              <div className="p-4 bg-slate-50 border-2 border-[#0f2b48] rounded-xl flex items-center justify-center">
                <div className="text-center w-44 flex flex-col items-center">
                  <div className="h-10 mb-1 flex items-end justify-center w-full">
                    {previewTeacher.signatureUrl ? (
                      <img
                        src={previewTeacher.signatureUrl}
                        alt="Teacher Sig"
                        className="max-h-10 max-w-36 object-contain"
                      />
                    ) : schoolSettings.teacherSignatureUrl ? (
                      <img
                        src={schoolSettings.teacherSignatureUrl}
                        alt="Default Sig"
                        className="max-h-10 max-w-36 object-contain opacity-70"
                      />
                    ) : null}
                  </div>
                  <div className="w-full border-t border-[#0f2b48] pt-1">
                    <p className="text-[11px] font-bold text-[#0f2b48] uppercase tracking-wider leading-tight">
                      {previewTeacher.designation || 'CLASS TEACHER'}
                    </p>
                    <p className="text-[9.5px] font-bold text-[#1e3a8a] leading-tight mt-0.5">
                      ({previewTeacher.teacherName})
                    </p>
                    <p className="text-[8px] font-bold text-[#64748b] leading-tight mt-0.5">
                      SIGNATURE & DATE
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewTeacherId(null)}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  OK (ठीक है)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
