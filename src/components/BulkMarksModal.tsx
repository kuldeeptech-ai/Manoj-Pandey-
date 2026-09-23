import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Check,
  AlertCircle,
  X,
  Clipboard,
  Copy,
  CheckCheck,
  Table,
  Sparkles,
  HelpCircle,
  Filter,
} from 'lucide-react';
import { Student, SubjectConfig } from '../types';
import { canonicalClassName, isSameClass, sortStudentsByRoll } from '../utils/calculations';

interface BulkMarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  subjects: SubjectConfig[];
  onSaveMarks?: (updatedStudents: Student[]) => void;
  onSaveBulkMarks?: (updatedStudents: Student[]) => void;
}

export const BulkMarksModal: React.FC<BulkMarksModalProps> = ({
  isOpen,
  onClose,
  students,
  subjects,
  onSaveBulkMarks,
  onSaveMarks,
}) => {
  const detectedClasses = useMemo(() => {
    const list = Array.from(
      new Set(students.map((s) => canonicalClassName(s.className)).filter(Boolean))
    ) as string[];
    return list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [students]);

  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('hd_admin_selected_class');
      if (saved && saved !== 'ALL') return saved;
    }
    // Default to the first detected class with students instead of ALL
    const firstCls = Array.from(
      new Set(students.map((s) => canonicalClassName(s.className)).filter(Boolean))
    )[0];
    return firstCls || '8th';
  });
  const [activeInputTab, setActiveInputTab] = useState<'paste' | 'upload'>('paste');
  const [pasteContent, setPasteContent] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [updatedStudentsPreview, setUpdatedStudentsPreview] = useState<Student[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const saveFn = onSaveBulkMarks || onSaveMarks;

  const filteredStudents = useMemo(() => {
    const list =
      selectedClass === 'ALL'
        ? students
        : students.filter((s) => isSameClass(s.className, selectedClass));
    return sortStudentsByRoll(list);
  }, [students, selectedClass]);

  // Active subjects
  const activeSubjects = subjects.filter((s) => s.active);

  // Helper to construct header column names
  const getHeaderColumns = () => {
    const cols = ['Roll_No', 'Student_Name', 'Class'];
    activeSubjects.forEach((sub) => {
      const cleanSub = sub.name.replace(/[^a-zA-Z0-9]/g, '_');
      cols.push(`${cleanSub}_Half`);
      cols.push(`${cleanSub}_Annual`);
    });
    return cols;
  };

  // 1. COPY HEADERS BUTTON (Directly requested by user for Excel copy-pasting)
  const handleCopyHeadersOnly = async () => {
    const headers = getHeaderColumns();
    // Tab-separated is best for pasting directly into Excel columns
    const tabHeaders = headers.join('\t');

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(tabHeaders);
      } else {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = tabHeaders;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
      }
      setCopyFeedback('✅ Excel हेडर क्लिपबोर्ड में कॉपी हो गए! अब Excel की पंक्ति 1 (Row 1) में पेस्ट करें।');
      setTimeout(() => setCopyFeedback(null), 5000);
    } catch {
      setCopyFeedback('⚠️ क्लिपबोर्ड कॉपी में समस्या आई। नीचे दिए गए टेक्स्ट बॉक्स से हेडर कॉपी करें।');
      setPasteContent(tabHeaders);
    }
  };

  // 2. COPY FULL TEMPLATE WITH FILTERED STUDENTS (Headers + pre-filled student rows)
  const handleCopyFullTemplate = async () => {
    const headers = getHeaderColumns();
    const rows: string[] = [headers.join('\t')];

    filteredStudents.forEach((st) => {
      const marksMap = st.marks || {};
      const row = [st.rollNo, st.name, st.className];
      activeSubjects.forEach((sub) => {
        const m = marksMap[sub.id] || { halfObtained: 0, annualObtained: 0 };
        row.push(String(m.halfObtained ?? 0));
        row.push(String(m.annualObtained ?? 0));
      });
      rows.push(row.join('\t'));
    });

    const fullTsv = rows.join('\n');

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullTsv);
      } else {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = fullTsv;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
      }
      setCopyFeedback(`✅ ${filteredStudents.length} छात्रों सहित पूरा फॉर्मेट कॉपी हो गया! इसे सीधे Excel में पेस्ट कर नंबर भरें।`);
      setTimeout(() => setCopyFeedback(null), 5000);
    } catch {
      setPasteContent(fullTsv);
    }
  };

  // 3. Generate and download class marks CSV template
  const handleDownloadMarksTemplate = () => {
    const headers = ['Student_ID', ...getHeaderColumns()];
    const headerLine = headers.join(',') + '\n';

    const rowLines = filteredStudents.map((st) => {
      const row = [`"${st.id}"`, `"${st.rollNo}"`, `"${st.name}"`, `"${st.className}"`];
      const marksMap = st.marks || {};
      activeSubjects.forEach((sub) => {
        const m = (marksMap && marksMap[sub.id]) || { halfObtained: 0, annualObtained: 0 };
        row.push(String(m.halfObtained ?? 0));
        row.push(String(m.annualObtained ?? 0));
      });
      return row.join(',');
    });

    const csvContent = headerLine + rowLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Marks_Template_Class_${selectedClass}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse raw pasted or uploaded marks
  const parseMarksData = (rawText: string) => {
    setParseError(null);
    const trimmed = rawText.trim();
    if (!trimmed) {
      setParseError('कृपया मार्क्स डेटा पेस्ट करें या CSV फ़ाइल चुनें।');
      setUpdatedStudentsPreview([]);
      setHasParsed(false);
      return;
    }

    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setParseError('कम से कम 1 हेडर पंक्ति और 1 छात्र रिकॉर्ड की पंक्ति आवश्यक है।');
      return;
    }

    const isTab = lines[0].includes('\t');
    const delimiter = isTab ? '\t' : ',';

    const parseLine = (line: string): string[] => {
      if (isTab) {
        return line.split('\t').map((f) => f.trim().replace(/^"(.*)"$/, '$1'));
      }
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^"(.*)"$/, '$1'));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"(.*)"$/, '$1'));
      return result;
    };

    const headers = parseLine(lines[0]).map((h) =>
      h.toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    const studentMap = new Map<string, Student>();
    students.forEach((s) => {
      studentMap.set(s.id, {
        ...s,
        marks: { ...(s.marks || {}) },
      });
    });

    let matchedCount = 0;

    // Check if wide table or row-per-subject format
    const isRowPerSubject =
      headers.includes('subject') &&
      (headers.includes('halfobtained') || headers.includes('half_obtained') || headers.includes('half'));

    if (isRowPerSubject) {
      // Row-per-subject format
      const idxId = headers.findIndex((h) => h.includes('studentid') || h.includes('id'));
      const idxSub = headers.findIndex((h) => h.includes('subject'));
      const idxHalf = headers.findIndex((h) => h.includes('halfobtained') || h.includes('half'));
      const idxAnnual = headers.findIndex((h) => h.includes('annualobtained') || h.includes('annual'));

      for (let i = 1; i < lines.length; i++) {
        const row = parseLine(lines[i]);
        if (row.length < 2) continue;

        const stId = row[idxId]?.trim();
        const subName = row[idxSub]?.trim().toLowerCase();
        const half = Number(row[idxHalf] || 0);
        const annual = Number(row[idxAnnual] || 0);

        if (!stId || !subName) continue;

        const st = studentMap.get(stId);
        if (!st) continue;

        const targetSub = subjects.find(
          (s) =>
            s.id.toLowerCase() === subName ||
            s.name.toLowerCase() === subName ||
            subName.includes(s.name.toLowerCase())
        );

        if (targetSub) {
          st.marks = st.marks || {};
          st.marks[targetSub.id] = {
            halfObtained: isNaN(half) ? 0 : half,
            annualObtained: isNaN(annual) ? 0 : annual,
          };
          matchedCount++;
        }
      }
    } else {
      // Standard Wide Table (Roll_No, Student_Name, Class, Hindi_Half, Hindi_Annual, etc.)
      const idxId = headers.findIndex((h) => h === 'studentid' || h === 'id');
      const idxRoll = headers.findIndex((h) => h.includes('roll'));
      const idxClass = headers.findIndex((h) => h.includes('class') || h.includes('kaksha'));
      const idxName = headers.findIndex((h) => h.includes('name') || h.includes('chhatra'));

      // Map subject columns
      const subColMap: { subjectId: string; colIdx: number; type: 'half' | 'annual' }[] = [];

      headers.forEach((h, colIdx) => {
        subjects.forEach((sub) => {
          const cleanSub = sub.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const idMatch = sub.id.toLowerCase().replace(/[^a-z0-9]/g, '');

          if (h.includes(cleanSub) || (idMatch && h.includes(idMatch))) {
            if (h.includes('half') || h.includes('arw') || h.includes('hyearly') || h.endsWith('half') || h.endsWith('h')) {
              subColMap.push({ subjectId: sub.id, colIdx, type: 'half' });
            } else if (h.includes('annual') || h.includes('varshik') || h.includes('final') || h.endsWith('annual') || h.endsWith('a')) {
              subColMap.push({ subjectId: sub.id, colIdx, type: 'annual' });
            }
          }
        });
      });

      if (subColMap.length === 0) {
        setParseError(
          'किसी भी विषय के अंक कॉलम (जैसे Hindi_Half, Hindi_Annual) नहीं पहचाने जा सके। कृपया ऊपर "एक्सेल हेडर कॉपी करें" बटन दबाकर उसी प्रारूप में कॉलम हेडर रखें।'
        );
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        const row = parseLine(lines[i]);
        if (row.length < 2) continue;

        const stId = idxId >= 0 ? row[idxId]?.trim() : '';
        const rawRoll = idxRoll >= 0 ? row[idxRoll]?.trim() : '';
        const rawClass = idxClass >= 0 ? row[idxClass]?.trim() : '';
        const rawName = idxName >= 0 ? row[idxName]?.trim().toLowerCase() : '';

        // Find target student
        let targetStudent: Student | undefined;
        if (stId && studentMap.has(stId)) {
          targetStudent = studentMap.get(stId);
        } else if (rawRoll) {
          targetStudent = Array.from(studentMap.values()).find((s) => {
            const rollMatch = s.rollNo.trim() === rawRoll.trim();
            const classMatch = rawClass ? isSameClass(s.className, rawClass) : true;
            return rollMatch && classMatch;
          });
        }

        if (!targetStudent && rawName) {
          targetStudent = Array.from(studentMap.values()).find((s) => {
            const nameMatch = s.name.trim().toLowerCase() === rawName;
            const classMatch = rawClass ? isSameClass(s.className, rawClass) : true;
            return nameMatch && classMatch;
          });
        }

        if (targetStudent) {
          matchedCount++;
          targetStudent.marks = targetStudent.marks || {};
          subColMap.forEach(({ subjectId, colIdx, type }) => {
            const val = Number(row[colIdx]);
            if (!isNaN(val)) {
              if (!targetStudent!.marks[subjectId]) {
                targetStudent!.marks[subjectId] = { halfObtained: 0, annualObtained: 0 };
              }
              if (type === 'half') {
                targetStudent!.marks[subjectId].halfObtained = val;
              } else {
                targetStudent!.marks[subjectId].annualObtained = val;
              }
            }
          });
        }
      }
    }

    if (matchedCount === 0) {
      setParseError('कोई भी छात्र या अंक मैच नहीं हुआ। कृपया रोल नंबर, कक्षा व कॉलम नाम जांचें।');
      setUpdatedStudentsPreview([]);
      setHasParsed(false);
      return;
    }

    const updatedList = Array.from(studentMap.values());
    setUpdatedStudentsPreview(updatedList);
    setHasParsed(true);
    setParseError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setPasteContent(text);
        parseMarksData(text);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmSave = () => {
    if (updatedStudentsPreview.length === 0) return;
    setIsProcessing(true);
    try {
      if (typeof saveFn === 'function') {
        saveFn(updatedStudentsPreview);
      } else {
        throw new Error('अंक सेव करने का फंक्शन उपलब्ध नहीं है।');
      }
      onClose();
    } catch (err: any) {
      setParseError('अंक सुरक्षित करने में त्रुटि: ' + (err.message || 'Error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#0f2b48] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                बल्क अंक प्रविष्टि (Bulk Import Marks — Excel / CSV)
              </h3>
              <p className="text-[11px] text-slate-300">
                Excel से पूरी कक्षा के अर्द्धवार्षिक व वार्षिक अंक सीधे कॉपी-पेस्ट करके अपलोड करें
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Feedback banner if copy action taken */}
          {copyFeedback && (
            <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl text-emerald-950 font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{copyFeedback}</span>
            </div>
          )}

          {/* Class Filter & Prominent Action Controls */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-blue-950">कक्षा चुनें (Class):</span>
                <select
                  value={selectedClass}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedClass(val);
                    if (typeof localStorage !== 'undefined') {
                      localStorage.setItem('hd_admin_selected_class', val);
                    }
                  }}
                  className="bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-xs font-bold text-blue-900 shadow-xs focus:ring-2 focus:ring-[#0f2b48]"
                >
                  <option value="ALL">सभी कक्षाएं (All Classes)</option>
                  {detectedClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls} ({students.filter((s) => isSameClass(s.className, cls)).length} छात्र)
                    </option>
                  ))}
                </select>

                {/* 1-click pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClass('ALL');
                      if (typeof localStorage !== 'undefined') localStorage.setItem('hd_admin_selected_class', 'ALL');
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer transition-all ${
                      selectedClass === 'ALL'
                        ? 'bg-[#0f2b48] text-white border-[#0f2b48]'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                    }`}
                  >
                    All ({students.length})
                  </button>
                  {detectedClasses.map((cls) => {
                    const count = students.filter((s) => isSameClass(s.className, cls)).length;
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => {
                          setSelectedClass(cls);
                          if (typeof localStorage !== 'undefined') localStorage.setItem('hd_admin_selected_class', cls);
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer transition-all ${
                          isSameClass(selectedClass, cls)
                            ? 'bg-[#0f2b48] text-white border-[#0f2b48]'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                        }`}
                      >
                        Class {cls} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-[11px] text-blue-800 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>सक्रिय विषय: {activeSubjects.map((s) => s.name).join(', ')}</span>
              </div>
            </div>

            {/* Quick Action Buttons for Excel (Explicitly Requested "Copy Headers" Button) */}
            <div className="pt-2 border-t border-blue-200/80 flex flex-wrap items-center gap-2">
              {/* BUTTON 1: Prominent COPY HEADERS BUTTON */}
              <button
                type="button"
                onClick={handleCopyHeadersOnly}
                className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-98"
                title="Excel में पहली पंक्ति में पेस्ट करने के लिए सभी कॉलम हेडर कॉपी करें"
              >
                <Copy className="w-4 h-4 text-amber-300" />
                <span>1. एक्सेल हेडर कॉपी करें (Copy Headers)</span>
              </button>

              {/* BUTTON 2: COPY FULL TEMPLATE WITH STUDENTS */}
              <button
                type="button"
                onClick={handleCopyFullTemplate}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-98"
                title="छात्रों के रोल नंबर और नाम सहित पूरी एक्सेल शीट कॉपी करें"
              >
                <Table className="w-4 h-4 text-emerald-200" />
                <span>2. छात्र सूची सहित पूरा टेम्पलेट कॉपी करें</span>
              </button>

              {/* BUTTON 3: DOWNLOAD CSV TEMPLATE */}
              <button
                type="button"
                onClick={handleDownloadMarksTemplate}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                title="CSV फ़ाइल डाउनलोड करें"
              >
                <Download className="w-3.5 h-3.5 text-blue-700" />
                <span>3. CSV डाउनलोड करें</span>
              </button>
            </div>
          </div>

          {/* Step Guide / Instructions */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-amber-950">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed space-y-0.5">
              <p className="font-bold">सरल तरीका (How to use):</p>
              <p>
                1. ऊपर <strong>"एक्सेल हेडर कॉपी करें"</strong> या <strong>"पूरा टेम्पलेट कॉपी करें"</strong> बटन दबाएं।
              </p>
              <p>
                2. Excel में नई शीट खोलकर पेस्ट करें, प्रत्येक विषय के <strong>_Half</strong> और <strong>_Annual</strong> अंक भरें।
              </p>
              <p>
                3. Excel के सभी सेल सेलेक्ट व कॉपी (Ctrl+C) करके नीचे बॉक्स में पेस्ट (Ctrl+V) करें।
              </p>
            </div>
          </div>

          {/* Input Method Switcher */}
          <div className="space-y-3">
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveInputTab('paste')}
                className={`px-4 py-2 font-bold text-xs flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                  activeInputTab === 'paste'
                    ? 'border-[#0f2b48] text-[#0f2b48] bg-slate-50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Excel से सीधे कॉपी-पेस्ट करें (Paste Here)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveInputTab('upload')}
                className={`px-4 py-2 font-bold text-xs flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                  activeInputTab === 'upload'
                    ? 'border-[#0f2b48] text-[#0f2b48] bg-slate-50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>CSV फ़ाइल अपलोड करें (Upload File)</span>
              </button>
            </div>

            {activeInputTab === 'paste' ? (
              <textarea
                rows={7}
                value={pasteContent}
                onChange={(e) => {
                  setPasteContent(e.target.value);
                  if (e.target.value.trim()) {
                    parseMarksData(e.target.value);
                  } else {
                    setUpdatedStudentsPreview([]);
                    setHasParsed(false);
                  }
                }}
                placeholder={`Roll_No\tStudent_Name\tClass\tHindi_Half\tHindi_Annual\tEnglish_Half\tEnglish_Annual\tMaths_Half\tMaths_Annual\n1\tAarav Kumar\t8th\t75\t80\t70\t78\t85\t90\n2\tPriya Sharma\t8th\t82\t88\t78\t84\t90\t92`}
                className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl bg-slate-50/60 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f2b48] leading-relaxed"
              />
            ) : (
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.txt"
                  id="csv-marks-file"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="csv-marks-file" className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <span className="font-bold text-slate-700 block text-sm">
                    यहाँ अपनी भरी हुई मार्क्स CSV फ़ाइल अपलोड करें
                  </span>
                  <span className="mt-3 inline-block px-4 py-1.5 bg-[#0f2b48] text-white rounded-lg font-bold text-xs shadow-xs">
                    फ़ाइल चुनें (Browse File)
                  </span>
                </label>
              </div>
            )}
          </div>

          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {hasParsed && updatedStudentsPreview.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-xs">
                <Check className="w-4 h-4 text-emerald-700" />
                मार्क्स डेटा सफलतापूर्वक पार्स हुआ! कुल {updatedStudentsPreview.length} छात्रों के अंक अपडेट के लिए तैयार हैं।
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            रद्द करें (Cancel)
          </button>

          <button
            type="button"
            onClick={handleConfirmSave}
            disabled={updatedStudentsPreview.length === 0 || isProcessing}
            className={`px-6 py-2 text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
              updatedStudentsPreview.length > 0 && !isProcessing
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {isProcessing
                ? 'अंक सेव हो रहे हैं...'
                : `हाँ, सभी अंक सुरक्षित करें (${updatedStudentsPreview.length} छात्र)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
