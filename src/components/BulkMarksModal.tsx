import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Check,
  AlertCircle,
  X,
  Clipboard as ClipboardIcon,
  Copy,
  CheckCheck,
  Table as TableIcon,
  HelpCircle,
  Filter,
  Layers,
  Settings2,
} from 'lucide-react';
import { Student, SubjectConfig } from '../types';
import {
  canonicalClassName,
  isSameClass,
  sortStudentsByRoll,
  getSubjectsForClass,
  getCleanSubjectHeader,
  getSubjectMatchTokens,
  isUrduOrOptional,
} from '../utils/calculations';
import { DEFAULT_STUDENT_PHOTO_FALLBACK } from '../data/defaultData';

interface BulkMarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  subjects: SubjectConfig[];
  onSaveMarks?: (updatedStudents: Student[]) => void;
  onSaveBulkMarks?: (updatedStudents: Student[]) => void;
}

export interface ParsedMarksPreviewRow {
  studentId: string;
  rollNo: string;
  name: string;
  fatherName: string;
  motherName?: string;
  className: string;
  section: string;
  admissionNo: string;
  dob?: string;
  gender?: string;
  photoUrl?: string;
  isMatched: boolean;
  marks: Record<string, { halfObtained: number; annualObtained: number }>;
  halfTotal: number;
  annualTotal: number;
  grandTotal: number;
  status: 'PASS' | 'FAIL';
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
    const firstCls = Array.from(
      new Set(students.map((s) => canonicalClassName(s.className)).filter(Boolean))
    )[0];
    return firstCls || '8th';
  });

  const [activeInputTab, setActiveInputTab] = useState<'paste' | 'upload'>('paste');
  const [pasteContent, setPasteContent] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [updatedStudentsPreview, setUpdatedStudentsPreview] = useState<Student[]>([]);
  const [parsedPreviewRows, setParsedPreviewRows] = useState<ParsedMarksPreviewRow[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // User controls for template customization:
  // 1. Scope: 'class' (only subjects applicable to selected class) or 'all' (all school subjects)
  const [templateSubjectScope, setTemplateSubjectScope] = useState<'class' | 'all'>('class');

  // 2. Format: 'both' (Subject_Half + Subject_Annual) or 'single' (Subject only)
  const [templateFormat, setTemplateFormat] = useState<'both' | 'single'>('both');

  // 3. Single column import target: where to apply marks when only 1 column per subject is pasted
  const [singleColumnTarget, setSingleColumnTarget] = useState<'both' | 'half' | 'annual'>('half');

  const saveFn = onSaveBulkMarks || onSaveMarks;

  const filteredStudents = useMemo(() => {
    const list =
      selectedClass === 'ALL'
        ? students
        : students.filter((s) => isSameClass(s.className, selectedClass));
    return sortStudentsByRoll(list);
  }, [students, selectedClass]);

  // Active subjects for headers and template:
  // Dynamically reacts whenever a new subject is added (e.g. 'dd') or modified
  const activeSubjects = useMemo(() => {
    if (selectedClass === 'ALL' || templateSubjectScope === 'all') {
      return [...subjects].filter((s) => s.active).sort((a, b) => a.displayOrder - b.displayOrder);
    }
    const classSubs = getSubjectsForClass(subjects, selectedClass);
    return classSubs.length > 0
      ? classSubs
      : [...subjects].filter((s) => s.active).sort((a, b) => a.displayOrder - b.displayOrder);
  }, [subjects, selectedClass, templateSubjectScope]);

  // Helper to construct header column names
  const getHeaderColumns = (format: 'both' | 'single' = templateFormat) => {
    const cols = ['Roll_No', 'Student_Name', 'Class'];
    activeSubjects.forEach((sub) => {
      const cleanSub = getCleanSubjectHeader(sub);
      if (format === 'both') {
        cols.push(`${cleanSub}_Half`);
        cols.push(`${cleanSub}_Annual`);
      } else {
        cols.push(cleanSub);
      }
    });
    return cols;
  };

  // 1. COPY HEADERS BUTTON
  const handleCopyHeadersOnly = async (format: 'both' | 'single' = templateFormat) => {
    const headers = getHeaderColumns(format);
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
      setCopyFeedback(
        `✅ Excel हेडर (${headers.length} कॉलम, ${activeSubjects.length} विषय) क्लिपबोर्ड में कॉपी हो गए! अब Excel की पंक्ति 1 में पेस्ट करें।`
      );
      setTimeout(() => setCopyFeedback(null), 5000);
    } catch {
      setCopyFeedback('⚠️ क्लिपबोर्ड कॉपी में समस्या आई। नीचे दिए गए टेक्स्ट बॉक्स से हेडर कॉपी करें।');
      setPasteContent(tabHeaders);
    }
  };

  // 2. COPY FULL TEMPLATE WITH FILTERED STUDENTS
  const handleCopyFullTemplate = async (format: 'both' | 'single' = templateFormat) => {
    const headers = getHeaderColumns(format);
    const rows: string[] = [headers.join('\t')];

    filteredStudents.forEach((st) => {
      const marksMap = st.marks || {};
      const row = [st.rollNo, st.name, st.className];
      activeSubjects.forEach((sub) => {
        const m = marksMap[sub.id] || { halfObtained: 0, annualObtained: 0 };
        if (format === 'both') {
          row.push(String(m.halfObtained ?? 0));
          row.push(String(m.annualObtained ?? 0));
        } else {
          row.push(String(m.halfObtained || m.annualObtained || 0));
        }
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
      setCopyFeedback(
        `✅ ${filteredStudents.length} छात्रों व ${activeSubjects.length} विषयों सहित पूरा टेम्पलेट कॉपी हो गया! इसे सीधे Excel में पेस्ट कर नंबर भरें।`
      );
      setTimeout(() => setCopyFeedback(null), 5000);
    } catch {
      setPasteContent(fullTsv);
    }
  };

  // 3. Generate and download class marks CSV template
  const handleDownloadMarksTemplate = (format: 'both' | 'single' = templateFormat) => {
    const headers = ['Student_ID', ...getHeaderColumns(format)];
    const headerLine = headers.join(',') + '\n';

    const rowLines = filteredStudents.map((st) => {
      const row = [`"${st.id}"`, `"${st.rollNo}"`, `"${st.name}"`, `"${st.className}"`];
      const marksMap = st.marks || {};
      activeSubjects.forEach((sub) => {
        const m = (marksMap && marksMap[sub.id]) || { halfObtained: 0, annualObtained: 0 };
        if (format === 'both') {
          row.push(String(m.halfObtained ?? 0));
          row.push(String(m.annualObtained ?? 0));
        } else {
          row.push(String(m.halfObtained || m.annualObtained || 0));
        }
      });
      return row.join(',');
    });

    const csvContent = headerLine + rowLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Marks_Template_Class_${selectedClass}_${format}_${new Date().toISOString().slice(0, 10)}.csv`;
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
      setParsedPreviewRows([]);
      setHasParsed(false);
      return;
    }

    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setParseError('कम से कम 1 हेडर पंक्ति और 1 छात्र रिकॉर्ड की पंक्ति आवश्यक है।');
      setUpdatedStudentsPreview([]);
      setParsedPreviewRows([]);
      setHasParsed(false);
      return;
    }

    const isTab = lines[0].includes('\t');
    const isSemicolon = !isTab && lines[0].includes(';');
    const delimiter = isTab ? '\t' : (isSemicolon ? ';' : ',');

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

    const rawHeaders = parseLine(lines[0]);
    const normHeaders = rawHeaders.map((h) =>
      h.toLowerCase().trim().replace(/[^a-z0-9\u0900-\u097F]/g, '')
    );

    const studentMap = new Map<string, Student>();
    students.forEach((s) => {
      studentMap.set(s.id, {
        ...s,
        marks: { ...(s.marks || {}) },
        assignedSubjectIds: Array.isArray(s.assignedSubjectIds)
          ? [...s.assignedSubjectIds]
          : [],
      });
    });

    const previewRows: ParsedMarksPreviewRow[] = [];
    let matchedCount = 0;

    // Check if wide table or row-per-subject format
    const isRowPerSubject =
      normHeaders.includes('subject') &&
      (normHeaders.includes('halfobtained') || normHeaders.includes('half_obtained') || normHeaders.includes('half'));

    if (isRowPerSubject) {
      // Row-per-subject format
      const idxId = normHeaders.findIndex((h) => h === 'studentid' || h === 'id');
      const idxSub = normHeaders.findIndex((h) => h.includes('subject'));
      const idxHalf = normHeaders.findIndex((h) => h.includes('halfobtained') || h.includes('half'));
      const idxAnnual = normHeaders.findIndex((h) => h.includes('annualobtained') || h.includes('annual'));

      for (let i = 1; i < lines.length; i++) {
        const row = parseLine(lines[i]);
        if (row.length < 2) continue;

        const stId = idxId >= 0 ? row[idxId]?.trim() : '';
        const subName = idxSub >= 0 ? row[idxSub]?.trim().toLowerCase() : '';
        const half = Number(idxHalf >= 0 ? row[idxHalf] : 0);
        const annual = Number(idxAnnual >= 0 ? row[idxAnnual] : 0);

        if (!stId || !subName) continue;

        const st = studentMap.get(stId);
        if (!st) continue;

        const targetSub = subjects.find((s) => {
          const tokens = getSubjectMatchTokens(s);
          const cleanSub = subName.replace(/[^a-z0-9\u0900-\u097F]/g, '');
          const cleanHeaderName = getCleanSubjectHeader(s).toLowerCase();
          return (
            s.id.toLowerCase() === subName ||
            s.name.toLowerCase() === subName ||
            cleanHeaderName === subName ||
            subName.includes(s.name.toLowerCase()) ||
            tokens.some(
              (t) =>
                t.toLowerCase() === subName ||
                cleanSub === t.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '')
            )
          );
        });

        if (targetSub) {
          st.marks = st.marks || {};
          st.marks[targetSub.id] = {
            halfObtained: isNaN(half) ? 0 : half,
            annualObtained: isNaN(annual) ? 0 : annual,
          };
          // Ensure assignedSubjectIds includes imported subject
          if (!Array.isArray(st.assignedSubjectIds)) {
            st.assignedSubjectIds = [];
          }
          if (!st.assignedSubjectIds.includes(targetSub.id)) {
            st.assignedSubjectIds.push(targetSub.id);
          }
          matchedCount++;
        }
      }

      studentMap.forEach((st) => {
        let halfTot = 0;
        let annualTot = 0;
        Object.values(st.marks || {}).forEach((m: any) => {
          halfTot += Number(m.halfObtained || 0);
          annualTot += Number(m.annualObtained || 0);
        });
        const gTot = halfTot + annualTot;
        previewRows.push({
          studentId: st.id,
          rollNo: st.rollNo,
          name: st.name,
          fatherName: st.fatherName,
          className: st.className,
          section: st.section,
          admissionNo: st.admissionNo,
          isMatched: true,
          marks: st.marks,
          halfTotal: halfTot,
          annualTotal: annualTot,
          grandTotal: gTot,
          status: 'PASS',
        });
      });
    } else {
      // Standard Wide Table (Roll_No, Student_Name, Class, Hindi_Half, Hindi_Annual, dd_Half, dd_Annual, etc.)
      const idxId = normHeaders.findIndex((h) => h === 'studentid' || h === 'id' || h === 'stid');
      const idxRoll = normHeaders.findIndex(
        (h) =>
          h.includes('roll') ||
          h.includes('kramank') ||
          h.includes('अनुक्रमांक') ||
          h.includes('रोल') ||
          h === 'rno'
      );
      const idxClass = normHeaders.findIndex(
        (h) =>
          h.includes('class') ||
          h.includes('kaksha') ||
          h.includes('कक्षा') ||
          h === 'cls'
      );
      const idxName = normHeaders.findIndex(
        (h, i) =>
          i !== idxId &&
          (h.includes('studentname') ||
            h.includes('student_name') ||
            (h.includes('name') && !h.includes('father') && !h.includes('mother')) ||
            h.includes('chhatra') ||
            h.includes('naam') ||
            h.includes('विद्यार्थी') ||
            h.includes('नाम'))
      );

      // Map subject columns intelligently
      const subColMap: { subjectId: string; colIdx: number; type: 'half' | 'annual' }[] = [];

      // Sort subjects so specific subjects (e.g. 'Hindi ii' before 'Hindi', 'Social Science' before 'Science') match first
      const sortedSubjects = [...subjects].filter((s) => s.active).sort((a, b) => {
        const aIsSpecific =
          a.name.toLowerCase().includes('ii') ||
          a.name.includes('2') ||
          a.name.toLowerCase().includes('social') ||
          a.name.toLowerCase().includes('moral');
        const bIsSpecific =
          b.name.toLowerCase().includes('ii') ||
          b.name.includes('2') ||
          b.name.toLowerCase().includes('social') ||
          b.name.toLowerCase().includes('moral');
        if (aIsSpecific && !bIsSpecific) return -1;
        if (!aIsSpecific && bIsSpecific) return 1;
        return b.name.length - a.name.length;
      });

      rawHeaders.forEach((rawCol, colIdx) => {
        if (colIdx === idxId || colIdx === idxRoll || colIdx === idxClass || colIdx === idxName) return;

        const trimmedCol = rawCol.trim();
        if (!trimmedCol) return;
        const lowerCol = trimmedCol.toLowerCase();
        const normCol = lowerCol.replace(/[^a-z0-9\u0900-\u097F]/g, '');
        if (!normCol) return;

        // Check if this column explicitly specifies Half or Annual
        const isExplicitHalf =
          lowerCol.includes('half') ||
          lowerCol.includes('ardh') ||
          lowerCol.includes('arw') ||
          lowerCol.includes('term1') ||
          lowerCol.includes('term 1') ||
          lowerCol.includes('t1') ||
          lowerCol.includes('अर्ध') ||
          lowerCol.includes('अर्द्ध') ||
          lowerCol.includes('छमाही') ||
          lowerCol.endsWith('_h') ||
          lowerCol.endsWith('-h') ||
          lowerCol.endsWith(' h') ||
          lowerCol.endsWith('(h)');

        const isExplicitAnnual =
          lowerCol.includes('annual') ||
          lowerCol.includes('varshik') ||
          lowerCol.includes('final') ||
          lowerCol.includes('term2') ||
          lowerCol.includes('term 2') ||
          lowerCol.includes('t2') ||
          lowerCol.includes('वार्षिक') ||
          lowerCol.includes('सालाना') ||
          lowerCol.endsWith('_a') ||
          lowerCol.endsWith('-a') ||
          lowerCol.endsWith(' a') ||
          lowerCol.endsWith('(a)');

        // Safely strip exam terms from end to isolate subject name without mutilating words like "math"
        const cleanSubjectName = lowerCol
          .replace(
            /[\(\[\{]?(halfyearly|half|annual|ardhvarshik|ardh|arw|वार्षिक|सालाना|अर्ध|अर्द्ध|छमाही|term1|term2|term 1|term 2|t1|t2|final|marks|mark|obt|obtained)[\)\]\}]?/gi,
            ''
          )
          .replace(/[_\-\s]+(half|annual|h|a|obt|marks|mark)$/gi, '')
          .replace(/\([ha]\)$/gi, '')
          .trim();
        const subToken = cleanSubjectName.replace(/[^a-z0-9\u0900-\u097F]/g, '');

        let columnMatched = false;

        for (const sub of sortedSubjects) {
          const cleanHeaderName = getCleanSubjectHeader(sub).toLowerCase();
          const rawSubName = sub.name.toLowerCase().trim();
          const rawSubId = sub.id.toLowerCase().trim();

          // Priority 1: Exact match with template-generated header names
          // E.g. "dd_Half" or "dd_Annual"
          const isDirectTemplateHalf =
            lowerCol === `${cleanHeaderName}_half` ||
            lowerCol === `${cleanHeaderName} half` ||
            lowerCol === `${cleanHeaderName}-half` ||
            lowerCol === `${cleanHeaderName}_h` ||
            lowerCol === `${cleanHeaderName}(half)` ||
            lowerCol === `${rawSubName}_half` ||
            lowerCol === `${rawSubId}_half` ||
            normCol === `${cleanHeaderName}half` ||
            normCol === `${rawSubName.replace(/[^a-z0-9\u0900-\u097F]/g, '')}half`;

          const isDirectTemplateAnnual =
            lowerCol === `${cleanHeaderName}_annual` ||
            lowerCol === `${cleanHeaderName} annual` ||
            lowerCol === `${cleanHeaderName}-annual` ||
            lowerCol === `${cleanHeaderName}_a` ||
            lowerCol === `${cleanHeaderName}(annual)` ||
            lowerCol === `${rawSubName}_annual` ||
            lowerCol === `${rawSubId}_annual` ||
            normCol === `${cleanHeaderName}annual` ||
            normCol === `${rawSubName.replace(/[^a-z0-9\u0900-\u097F]/g, '')}annual`;

          if (isDirectTemplateHalf) {
            subColMap.push({ subjectId: sub.id, colIdx, type: 'half' });
            columnMatched = true;
            break;
          }
          if (isDirectTemplateAnnual) {
            subColMap.push({ subjectId: sub.id, colIdx, type: 'annual' });
            columnMatched = true;
            break;
          }

          // Priority 2: Direct match with single subject name (e.g. "dd", "Hindi", "Maths")
          const isDirectSingleSub =
            lowerCol === cleanHeaderName ||
            lowerCol === rawSubName ||
            cleanSubjectName === cleanHeaderName ||
            cleanSubjectName === rawSubName ||
            subToken === cleanHeaderName.replace(/[^a-z0-9\u0900-\u097F]/g, '') ||
            subToken === rawSubName.replace(/[^a-z0-9\u0900-\u097F]/g, '');

          // Priority 3: Token / Alias matching
          const cleanHeaderNorm = cleanHeaderName.replace(/[^a-z0-9\u0900-\u097F]/g, '');
          let tokenMatched = isDirectSingleSub;

          if (!tokenMatched) {
            if (
              subToken &&
              cleanHeaderNorm &&
              (subToken === cleanHeaderNorm ||
                subToken.startsWith(cleanHeaderNorm) ||
                cleanHeaderNorm.startsWith(subToken))
            ) {
              tokenMatched = true;
            } else {
              const tokens = getSubjectMatchTokens(sub);
              for (const token of tokens) {
                const cleanToken = token.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '');
                if (!cleanToken) continue;

                if (subToken === cleanToken || normCol === cleanToken) {
                  tokenMatched = true;
                  break;
                }
                if (subToken.length >= 2 && cleanToken.length >= 2) {
                  if (subToken === cleanToken) {
                    tokenMatched = true;
                    break;
                  }
                  if (subToken.length >= 3 && cleanToken.length >= 3) {
                    if (subToken.startsWith(cleanToken) || cleanToken.startsWith(subToken)) {
                      tokenMatched = true;
                      break;
                    }
                  }
                }
                if (normCol.includes(cleanToken) || cleanToken.includes(subToken && subToken.length >= 3 ? subToken : '_____')) {
                  tokenMatched = true;
                  break;
                }
              }
            }
          }

          // Strict negative guards against cross-subject collisions:
          const colHas2 = /\b(2|2nd|ii|second|द्वितीय)\b/i.test(lowerCol) || normCol.includes('2nd') || normCol.includes('hindi2') || normCol.includes('english2');
          const colHas1 = /\b(1|1st|i|first|प्रथम)\b/i.test(lowerCol) || normCol.includes('1st') || normCol.includes('hindi1') || normCol.includes('english1');
          const subHas2 = /\b(2|2nd|ii|second|द्वितीय)\b/i.test(sub.name) || sub.id.includes('2');
          const subHas1 = /\b(1|1st|i|first|प्रथम)\b/i.test(sub.name) || sub.id.includes('1');

          if (colHas2 && subHas1 && !subHas2) continue;
          if (colHas1 && subHas2 && !subHas1) continue;

          const colHasOral = lowerCol.includes('oral') || lowerCol.includes('moukhik') || lowerCol.includes('मौखिक');
          const colHasWriting = lowerCol.includes('writing') || lowerCol.includes('likhit') || lowerCol.includes('लिखित');
          const subHasOral = sub.name.toLowerCase().includes('oral') || sub.id.includes('oral');
          const subHasWriting = sub.name.toLowerCase().includes('writing') || sub.id.includes('writing');

          if (colHasOral && subHasWriting && !subHasOral) continue;
          if (colHasWriting && subHasOral && !subHasWriting) continue;

          const colHasSst = lowerCol.includes('sst') || lowerCol.includes('social') || lowerCol.includes('सामाजिक');
          const subIsSst = sub.id === 'sub-sst' || sub.name.toLowerCase().includes('sst') || sub.name.toLowerCase().includes('social');
          const subIsScience = (sub.id === 'sub-science' || sub.name.toLowerCase().includes('science') || sub.name.toLowerCase().includes('विज्ञान')) && !subIsSst;

          if (colHasSst && subIsScience) continue;
          if (!colHasSst && subIsSst && (lowerCol.includes('science') || lowerCol.includes('विज्ञान'))) continue;

          if (tokenMatched) {
            if (isExplicitHalf) {
              subColMap.push({ subjectId: sub.id, colIdx, type: 'half' });
              columnMatched = true;
              break;
            } else if (isExplicitAnnual) {
              subColMap.push({ subjectId: sub.id, colIdx, type: 'annual' });
              columnMatched = true;
              break;
            } else {
              // Column has only subject name without explicit _Half or _Annual
              const existingForSub = subColMap.filter((m) => m.subjectId === sub.id);
              if (existingForSub.length === 0) {
                if (singleColumnTarget === 'annual') {
                  subColMap.push({ subjectId: sub.id, colIdx, type: 'annual' });
                } else if (singleColumnTarget === 'both') {
                  subColMap.push({ subjectId: sub.id, colIdx, type: 'half' });
                  subColMap.push({ subjectId: sub.id, colIdx, type: 'annual' });
                } else {
                  subColMap.push({ subjectId: sub.id, colIdx, type: 'half' });
                }
                columnMatched = true;
                break;
              } else if (existingForSub.length === 1 && singleColumnTarget !== 'both') {
                // Second column of the same subject becomes Annual ONLY IF headers match identically
                const prevColIdx = existingForSub[0].colIdx;
                const prevHeader = (rawHeaders[prevColIdx] || '').trim().toLowerCase();
                const curHeader = trimmedCol.toLowerCase();
                if (
                  prevHeader === curHeader ||
                  prevHeader.replace(/[^a-z0-9]/g, '') === curHeader.replace(/[^a-z0-9]/g, '')
                ) {
                  subColMap.push({ subjectId: sub.id, colIdx, type: 'annual' });
                  columnMatched = true;
                  break;
                }
              }
            }
          }
        }
      });

      // Priority 4: Positional fallback if no columns matched by name
      if (subColMap.length === 0 && activeSubjects.length > 0) {
        const startIdx = Math.max(idxName, idxRoll, idxClass) + 1;
        let cIdx = startIdx > 0 ? startIdx : 3;
        activeSubjects.forEach((sub) => {
          if (cIdx < rawHeaders.length) {
            subColMap.push({ subjectId: sub.id, colIdx: cIdx, type: 'half' });
            cIdx++;
          }
          if (cIdx < rawHeaders.length) {
            subColMap.push({ subjectId: sub.id, colIdx: cIdx, type: 'annual' });
            cIdx++;
          }
        });
      }

      if (subColMap.length === 0) {
        setParseError(
          'किसी भी विषय के अंक कॉलम (जैसे Hindi_Half, Hindi_Annual, dd_Half, dd_Annual) नहीं पहचाने जा सके। कृपया ऊपर "एक्सेल हेडर कॉपी करें" बटन दबाकर उसी प्रारूप में कॉलम हेडर रखें।'
        );
        setUpdatedStudentsPreview([]);
        setParsedPreviewRows([]);
        setHasParsed(false);
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        const row = parseLine(lines[i]);
        if (row.length < 2 || row.every((c) => !c.trim())) continue;

        const stId = idxId >= 0 ? row[idxId]?.trim() : '';
        const rawRoll = idxRoll >= 0 ? row[idxRoll]?.trim() : '';
        const rawClass =
          idxClass >= 0
            ? row[idxClass]?.trim()
            : selectedClass !== 'ALL'
            ? selectedClass
            : '';
        const rawName = idxName >= 0 ? row[idxName]?.trim().toLowerCase() : '';

        // Comprehensive Student Matching:
        let targetStudent: Student | undefined;

        // 1. Direct ID Match
        if (stId && studentMap.has(stId)) {
          targetStudent = studentMap.get(stId);
        } else if (rawRoll) {
          // 2. Match by Roll No and Class
          targetStudent = Array.from(studentMap.values()).find((s) => {
            const rollClean = s.rollNo.trim();
            const rollMatch =
              rollClean === rawRoll.trim() ||
              (Number(rollClean) === Number(rawRoll) && !isNaN(Number(rawRoll)));
            const classMatch = rawClass ? isSameClass(s.className, rawClass) : true;
            return rollMatch && classMatch;
          });

          // 3. Match by Roll No and Name (in case Class column is omitted or modified)
          if (!targetStudent && rawName) {
            targetStudent = Array.from(studentMap.values()).find((s) => {
              const rollClean = s.rollNo.trim();
              const rollMatch =
                rollClean === rawRoll.trim() ||
                (Number(rollClean) === Number(rawRoll) && !isNaN(Number(rawRoll)));
              const nameMatch = s.name.trim().toLowerCase() === rawName;
              return rollMatch && nameMatch;
            });
          }

          // 4. Match within selectedClass if specific class selected
          if (!targetStudent && selectedClass !== 'ALL') {
            targetStudent = Array.from(studentMap.values()).find((s) => {
              const rollClean = s.rollNo.trim();
              const rollMatch =
                rollClean === rawRoll.trim() ||
                (Number(rollClean) === Number(rawRoll) && !isNaN(Number(rawRoll)));
              return rollMatch && isSameClass(s.className, selectedClass);
            });
          }

          // 5. Match unique roll number across whole school
          if (!targetStudent) {
            const rollMatches = Array.from(studentMap.values()).filter((s) => {
              const rollClean = s.rollNo.trim();
              return (
                rollClean === rawRoll.trim() ||
                (Number(rollClean) === Number(rawRoll) && !isNaN(Number(rawRoll)))
              );
            });
            if (rollMatches.length === 1) {
              targetStudent = rollMatches[0];
            }
          }
        }

        // 6. Match by Name + Class
        if (!targetStudent && rawName) {
          targetStudent = Array.from(studentMap.values()).find((s) => {
            const nameMatch = s.name.trim().toLowerCase() === rawName;
            const classMatch = rawClass
              ? isSameClass(s.className, rawClass)
              : selectedClass !== 'ALL'
              ? isSameClass(s.className, selectedClass)
              : true;
            return nameMatch && classMatch;
          });
        }

        if (targetStudent) {
          matchedCount++;
          targetStudent.marks = targetStudent.marks || {};
          let rowHalf = 0;
          let rowAnnual = 0;
          let totalMaxMarks = 0;

          subColMap.forEach(({ subjectId, colIdx, type }) => {
            const rawCell = row[colIdx];
            if (rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== '') {
              const val = Number(rawCell);
              if (!isNaN(val)) {
                if (!targetStudent!.marks[subjectId]) {
                  targetStudent!.marks[subjectId] = { halfObtained: 0, annualObtained: 0 };
                }
                if (type === 'half') {
                  targetStudent!.marks[subjectId].halfObtained = val;
                } else {
                  targetStudent!.marks[subjectId].annualObtained = val;
                }

                // CRUCIAL: ALWAYS ensure assignedSubjectIds includes imported subject
                // while preserving all compulsory subjects of the student's class!
                if (!Array.isArray(targetStudent!.assignedSubjectIds)) {
                  const classCompulsoryIds = getSubjectsForClass(subjects, targetStudent!.className)
                    .filter((s) => !isUrduOrOptional(s))
                    .map((s) => s.id);
                  targetStudent!.assignedSubjectIds = [...classCompulsoryIds];
                }
                if (!targetStudent!.assignedSubjectIds.includes(subjectId)) {
                  targetStudent!.assignedSubjectIds.push(subjectId);
                }
              }
            }
          });

          // Calculate preview totals
          Object.entries(targetStudent.marks).forEach(([subId, m]: [string, any]) => {
            rowHalf += Number(m.halfObtained || 0);
            rowAnnual += Number(m.annualObtained || 0);
            const foundSub = subjects.find((s) => s.id === subId);
            if (foundSub) {
              totalMaxMarks += (foundSub.halfMax || 100) + (foundSub.annualMax || 100);
            }
          });

          const gTot = rowHalf + rowAnnual;
          // 50% pass threshold per user request: >= 50% obtained is PASS
          const effectiveMax = totalMaxMarks > 0 ? totalMaxMarks : 1000;
          const status: 'PASS' | 'FAIL' = gTot >= (effectiveMax * 0.5) ? 'PASS' : 'FAIL';

          previewRows.push({
            studentId: targetStudent.id,
            rollNo: targetStudent.rollNo,
            name: targetStudent.name,
            fatherName: targetStudent.fatherName,
            motherName: targetStudent.motherName,
            className: targetStudent.className,
            section: targetStudent.section,
            admissionNo: targetStudent.admissionNo,
            dob: targetStudent.dob,
            gender: targetStudent.gender,
            photoUrl: targetStudent.photoUrl,
            isMatched: true,
            marks: { ...targetStudent.marks },
            halfTotal: rowHalf,
            annualTotal: rowAnnual,
            grandTotal: gTot,
            status,
          });
        } else {
          previewRows.push({
            studentId: `unmatched-${i}`,
            rollNo: rawRoll || `Row ${i}`,
            name: rawName || 'अज्ञात छात्र (Unknown)',
            fatherName: '—',
            motherName: '—',
            className: rawClass || selectedClass || '—',
            section: '—',
            admissionNo: '—',
            isMatched: false,
            marks: {},
            halfTotal: 0,
            annualTotal: 0,
            grandTotal: 0,
            status: 'FAIL',
          });
        }
      }
    }

    if (matchedCount === 0) {
      setParseError(
        'कोई भी छात्र या अंक मैच नहीं हुआ। कृपया सुनिश्चित करें कि रोल नंबर (Roll No) और कक्षा (Class) सही हैं।'
      );
      setUpdatedStudentsPreview([]);
      setParsedPreviewRows([]);
      setHasParsed(false);
      return;
    }

    const updatedList = Array.from(studentMap.values());
    setUpdatedStudentsPreview(updatedList);
    setParsedPreviewRows(previewRows);
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
        throw new Error('अंक सेव करने का फ़ंक्शन उपलब्ध नहीं है।');
      }
      onClose();
    } catch (err: any) {
      setParseError('अंक सुरक्षित करने में त्रुटि: ' + (err.message || 'Error'));
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[96vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0f2b48] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                बल्क अंक प्रविष्टि (Bulk Import Marks — Excel / CSV)
              </h3>
              <p className="text-[11px] text-slate-300">
                विषय जोड़ें या बदलें, हेडर तुरंत अपडेट होगा और सभी अंक एक क्लिक में लोड होंगे
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

          {/* Controls Bar: Class Selection, Subject Scope & Column Format */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Class Selection */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-700 flex items-center gap-1 text-xs">
                  <Filter className="w-3.5 h-3.5 text-blue-700" />
                  <span>कक्षा चुनें:</span>
                </span>

                <select
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    if (pasteContent.trim()) {
                      setTimeout(() => parseMarksData(pasteContent), 50);
                    }
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-[#0f2b48] shadow-2xs focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="ALL">सभी कक्षाएं (All Classes)</option>
                  {detectedClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      कक्षा {cls} ({students.filter((s) => isSameClass(s.className, cls)).length} छात्र,{' '}
                      {getSubjectsForClass(subjects, cls).length} विषय)
                    </option>
                  ))}
                </select>

                <span className="text-[11px] text-slate-500 font-medium">
                  ({filteredStudents.length} छात्र पंजीकृत • {activeSubjects.length} विषय शामिल)
                </span>
              </div>

              {/* Scope & Format Options */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {/* Subject Scope */}
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-slate-600 text-[11px]">विषय:</span>
                  <button
                    type="button"
                    onClick={() => setTemplateSubjectScope('class')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      templateSubjectScope === 'class'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    कक्षा के ({selectedClass !== 'ALL' ? getSubjectsForClass(subjects, selectedClass).length : activeSubjects.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateSubjectScope('all')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      templateSubjectScope === 'all'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    सभी ({subjects.filter((s) => s.active).length})
                  </button>
                </div>

                {/* Column Format */}
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-slate-600 text-[11px]">कॉलम प्रारूप:</span>
                  <button
                    type="button"
                    onClick={() => setTemplateFormat('both')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      templateFormat === 'both'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="प्रत्येक विषय के दो कॉलम: _Half और _Annual"
                  >
                    Half + Annual
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateFormat('single')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      templateFormat === 'single'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="प्रत्येक विषय का एक कॉलम"
                  >
                    सिंगल मार्क्स
                  </button>
                </div>
              </div>
            </div>

            {/* Dynamic Subjects Pill Display */}
            <div className="pt-2 border-t border-slate-200/80">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <span>शामिल विषय ({activeSubjects.length}):</span>
                  <span className="font-normal text-slate-500">(कोई भी विषय जोड़ने या बदलने पर यह तुरंत अपडेट होता है)</span>
                </span>
                {templateFormat === 'single' && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-600">
                    <span>सिंगल अंक लागू करें:</span>
                    <select
                      value={singleColumnTarget}
                      onChange={(e) => setSingleColumnTarget(e.target.value as any)}
                      className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="half">अर्द्धवार्षिक (Half-Yearly)</option>
                      <option value="annual">वार्षिक (Annual)</option>
                      <option value="both">दोनों में समान (Both)</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                {activeSubjects.map((sub) => {
                  const clean = getCleanSubjectHeader(sub);
                  return (
                    <span
                      key={sub.id}
                      className="bg-white border border-slate-300 text-slate-800 px-2 py-0.5 rounded-md font-mono text-[10.5px] font-medium shadow-2xs flex items-center gap-1"
                      title={`Subject: ${sub.name} (Code: ${clean})`}
                    >
                      <span className="font-bold text-[#0f2b48]">{clean}</span>
                      {templateFormat === 'both' ? (
                        <span className="text-[9px] text-emerald-700 font-sans font-bold">(_Half, _Annual)</span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Template Copy/Download Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => handleCopyHeadersOnly('both')}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-98"
                title="Excel कॉलम हेडर (Half + Annual) कॉपी करें"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-600" />
                <span>1. हेडर कॉपी करें (Half+Annual)</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyHeadersOnly('single')}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-98"
                title="Excel कॉलम हेडर (Single Column) कॉपी करें"
              >
                <Copy className="w-3.5 h-3.5 text-blue-600" />
                <span>1B. हेडर कॉपी करें (Single)</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyFullTemplate(templateFormat)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-98"
                title="छात्रों के नाम सहित पूरा TSV फॉर्मेट कॉपी करें"
              >
                <TableIcon className="w-3.5 h-3.5 text-emerald-700" />
                <span>2. पूरा टेम्पलेट कॉपी करें ({filteredStudents.length} छात्र)</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadMarksTemplate(templateFormat)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-98"
                title="CSV फ़ाइल डाउनलोड करें"
              >
                <Download className="w-3.5 h-3.5 text-blue-700" />
                <span>3. CSV डाउनलोड करें</span>
              </button>
            </div>
          </div>

          {/* Instructions Box */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-amber-950">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed space-y-0.5">
              <p className="font-bold">सरल तरीका (How to use):</p>
              <p>
                1. ऊपर <strong>"पूरा टेम्पलेट कॉपी करें"</strong> बटन दबाकर Excel में पेस्ट करें — इसमें छात्र नाम व अनुक्रमांक पहले से भरे होंगे।
              </p>
              <p>
                2. Excel में प्रत्येक विषय के <strong>_Half</strong> और <strong>_Annual</strong> अंक भरें (या सिंगल कॉलम में अंक भरें)।
              </p>
              <p>
                3. Excel के सभी सेल सेलेक्ट व कॉपी (Ctrl+C) करके नीचे दिए गए बॉक्स में पेस्ट (Ctrl+V) करें। नीचे तुरंत छात्र विवरण और अंकों का प्रीव्यू दिख जाएगा!
              </p>
              <p className="text-amber-900 font-bold bg-amber-100/70 p-1.5 rounded border border-amber-300">
                📗 <strong>उर्दू / ऐच्छिक विषय नियम:</strong> जिन छात्रों का उर्दू या ऐच्छिक विषय नहीं है, उनके कॉलम में 0 या खाली छोड़ दें। 0 रहने पर उनकी मार्कशीट पर वह विषय शामिल नहीं होगा।
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
                <ClipboardIcon className="w-3.5 h-3.5" />
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
              <div>
                <textarea
                  rows={hasParsed ? 3 : 6}
                  value={pasteContent}
                  onChange={(e) => {
                    setPasteContent(e.target.value);
                    if (e.target.value.trim()) {
                      parseMarksData(e.target.value);
                    } else {
                      setUpdatedStudentsPreview([]);
                      setParsedPreviewRows([]);
                      setHasParsed(false);
                    }
                  }}
                  placeholder={`Roll_No\tStudent_Name\tClass\tHindi_Half\tHindi_Annual\tEnglish_Half\tEnglish_Annual\tMaths_Half\tMaths_Annual\n1\tAarav Kumar\t8th\t75\t80\t70\t78\t85\t90\n2\tPriya Sharma\t8th\t82\t88\t78\t84\t90\t92`}
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl bg-slate-50/60 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f2b48] leading-relaxed"
                />
                {pasteContent.trim() && (
                  <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
                    <span>{pasteContent.trim().split(/\r?\n/).length} पंक्तियाँ दर्ज</span>
                    <button
                      type="button"
                      onClick={() => parseMarksData(pasteContent)}
                      className="text-blue-700 font-bold hover:underline cursor-pointer"
                    >
                      पुनः पार्स करें (Re-parse)
                    </button>
                  </div>
                )}
              </div>
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

          {/* PARSED PREVIEW SECTION WITH FULL STUDENT DETAILS AND MARKS TABLE */}
          {hasParsed && parsedPreviewRows.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50 border border-emerald-300 p-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-emerald-300">
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      {parsedPreviewRows.filter((r) => r.isMatched).length} छात्रों के अंक सफलतापूर्वक पहचाने गए
                    </span>
                  </span>
                  <span className="text-slate-600 text-[11px] font-medium">
                    (कुल पार्स: {parsedPreviewRows.length} रिकॉर्ड्स)
                  </span>
                </div>

                <div className="text-[11px] text-emerald-800 font-bold">
                  ✓ नीचे दिए गए विवरण को जांचें और नीचे "हाँ, सभी अंक तुरंत सुरक्षित करें" बटन दबाएं
                </div>
              </div>

              {/* Student Details & Marks Preview Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs min-w-[950px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase sticky top-0 border-b border-slate-200 text-[11px] z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-14 text-center">Roll</th>
                      <th className="py-2.5 px-3">विद्यार्थी का नाम (Student Profile)</th>
                      <th className="py-2.5 px-3 text-center w-24">Class</th>
                      <th className="py-2.5 px-3">माता/पिता का नाम (Parents)</th>
                      <th className="py-2.5 px-3 w-28">DOB / Gender</th>
                      <th className="py-2.5 px-3">विषय-वार अंक (Subject Marks)</th>
                      <th className="py-2.5 px-3 text-center w-20 bg-blue-50/70">Half Total</th>
                      <th className="py-2.5 px-3 text-center w-20 bg-emerald-50/70">Annual Total</th>
                      <th className="py-2.5 px-3 text-center w-20 bg-amber-50/70">Grand Total</th>
                      <th className="py-2.5 px-3 text-center w-24">स्थिति (Status)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {parsedPreviewRows.map((st, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50 transition-colors ${
                          !st.isMatched ? 'bg-amber-50/50' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-center font-bold text-[#0f2b48]">
                          <span className="inline-block w-7 h-7 leading-7 bg-slate-100 rounded-full font-mono text-xs">
                            {st.rollNo}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-300">
                              <img
                                src={st.photoUrl || DEFAULT_STUDENT_PHOTO_FALLBACK}
                                alt={st.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = DEFAULT_STUDENT_PHOTO_FALLBACK;
                                }}
                              />
                            </div>
                            <div>
                              <div className="font-bold text-sm uppercase text-slate-900 leading-tight">
                                {st.name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                Adm/SR: {st.admissionNo || '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="bg-blue-50 text-blue-900 font-bold px-2 py-0.5 rounded text-[11px]">
                            {st.className}{st.section ? `-${st.section}` : ''}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-700">
                          <div className="font-semibold uppercase text-slate-800">
                            P: {st.fatherName || '—'}
                          </div>
                          {st.motherName && (
                            <div className="text-slate-500 uppercase text-[10px]">
                              M: {st.motherName}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-600">
                          <div className="font-mono">{st.dob || '—'}</div>
                          {st.gender && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                st.gender === 'FEMALE' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {st.gender}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1 max-w-sm">
                            {(() => {
                              const studentSubIds = new Set([
                                ...activeSubjects.map((s) => s.id),
                                ...Object.keys(st.marks || {}),
                              ]);
                              const displaySubs = subjects.filter((s) => studentSubIds.has(s.id));
                              return displaySubs.map((sub) => {
                                const m = st.marks[sub.id];
                                const hasM = m && ((m.halfObtained || 0) > 0 || (m.annualObtained || 0) > 0);
                                return (
                                  <span
                                    key={sub.id}
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                      hasM
                                        ? 'bg-slate-100 text-slate-800 border border-slate-200'
                                        : 'bg-slate-50 text-slate-400'
                                    }`}
                                    title={`${sub.name}: Half=${m?.halfObtained || 0}, Annual=${m?.annualObtained || 0}`}
                                  >
                                    <strong>{getCleanSubjectHeader(sub).slice(0, 6)}:</strong>{' '}
                                    {m?.halfObtained || 0}/{m?.annualObtained || 0}
                                  </span>
                                );
                              });
                            })()}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-blue-900 bg-blue-50/30">
                          {st.halfTotal}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-900 bg-emerald-50/30">
                          {st.annualTotal}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-amber-900 bg-amber-50/30">
                          {st.grandTotal}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {st.isMatched ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                st.status === 'PASS'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {st.status === 'PASS' ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : null}
                              <span>{st.status}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              <span>अनमैच्ड</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            disabled={parsedPreviewRows.filter((r) => r.isMatched).length === 0 || isProcessing}
            className={`px-6 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
              parsedPreviewRows.filter((r) => r.isMatched).length > 0 && !isProcessing
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {isProcessing
                ? 'अंक सेव हो रहे हैं...'
                : `हाँ, सभी अंक तुरंत सुरक्षित करें (${parsedPreviewRows.filter((r) => r.isMatched).length} छात्र)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
