import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Check,
  AlertCircle,
  X,
  Clipboard,
  Info,
  Copy,
  CheckCheck,
  HelpCircle,
} from 'lucide-react';
import { Student } from '../types';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: string;
  existingStudents: Student[];
  onImportStudents: (
    newStudents: Student[],
    importMode: 'merge' | 'append' | 'replace'
  ) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  currentSession,
  existingStudents,
  onImportStudents,
}) => {
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'paste'>('paste');
  const [pasteContent, setPasteContent] = useState('');
  const [parsedStudents, setParsedStudents] = useState<Student[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'append' | 'replace'>('merge');
  const [hasParsed, setHasParsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  // Exact headers matching all student details from the student form / photo
  const studentHeaders = [
    'Roll_No',
    'Student_Name',
    'Admission_No',
    'Date_of_Birth',
    'Father_Name',
    'Mother_Name',
    'Class',
    'Section',
    'Gender',
    'Session',
    'Mobile',
    'Aadhar_No',
    'Teacher_Remark',
    'Photo_URL',
  ];

  // 1. Prominent "Copy Headers" button for pasting directly into Excel
  const handleCopyHeadersOnly = async () => {
    const tabHeaders = studentHeaders.join('\t');

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
      setCopyFeedback('✅ छात्र विवरण के Excel हेडर कॉपी हो गए! अब Excel की पंक्ति 1 में पेस्ट करें।');
      setTimeout(() => setCopyFeedback(null), 5000);
    } catch {
      setCopyFeedback('⚠️ हेडर नीचे दिए गए टेक्स्ट बॉक्स में डाल दिए गए हैं, वहां से कॉपी करें।');
      setPasteContent(tabHeaders);
    }
  };

  // 2. Generate and download sample CSV template with complete details
  const handleDownloadTemplate = () => {
    const csvContent =
      studentHeaders.join(',') +
      '\n' +
      `"1","Aarav Kumar","SKN-101","2011-05-15","Rajesh Kumar","Sunita Devi","8th","A","MALE","${currentSession}","9838700001","123456789012","उत्कृष्ट प्रदर्शन (Excellent)","boy1"\n` +
      `"2","Priya Sharma","SKN-102","2011-08-22","Mukesh Sharma","Kavita Devi","8th","A","FEMALE","${currentSession}","9838700002","123456789013","मेहनती व अनुशासित छात्रा","girl1"\n` +
      `"3","Rohan Verma","SKN-103","2012-02-10","Sunil Verma","Pooja Verma","7th","A","MALE","${currentSession}","9838700003","123456789014","बहुत अच्छा विद्यार्थी","boy2"\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Students_Bulk_Import_Template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Robust parser handling quotes, tabs, and commas
  const parseRawText = (rawText: string) => {
    setParseError(null);
    const trimmed = rawText.trim();
    if (!trimmed) {
      setParseError('कृपया डेटा पेस्ट करें या CSV फ़ाइल चुनें।');
      setParsedStudents([]);
      setHasParsed(false);
      return;
    }

    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setParseError('कम से कम 1 हेडर पंक्ति और 1 छात्र रिकॉर्ड की पंक्ति आवश्यक है।');
      return;
    }

    // Determine delimiter (tab or comma)
    const firstLine = lines[0];
    const isTab = firstLine.includes('\t');
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

    const headerCells = parseLine(lines[0]).map((h) =>
      h.toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    // Map column indexes
    const findCol = (keys: string[]): number => {
      return headerCells.findIndex((h) => keys.some((k) => h.includes(k)));
    };

    const idxRoll = findCol(['roll', 'rollno', 'rollnumber', 'kramank']);
    const idxName = findCol(['studentname', 'name', 'student', 'shiksharthi', 'chhatra', 'naam']);
    const idxAdmission = findCol(['admission', 'admissionno', 'admissionnumber', 'srno', 'sr_no', 'pravesh', 'sr']);
    const idxDob = findCol(['dob', 'birth', 'dateofbirth', 'janmtithi']);
    const idxFather = findCol(['father', 'fathername', 'pita']);
    const idxMother = findCol(['mother', 'mothername', 'mata']);
    const idxClass = findCol(['class', 'classname', 'kaksha', 'grade']);
    const idxSection = findCol(['sec', 'section', 'varg']);
    const idxGender = findCol(['gender', 'sex', 'ling']);
    const idxSession = findCol(['session', 'satr']);
    const idxMobile = findCol(['mobile', 'phone', 'contact', 'phoneno']);
    const idxAadhar = findCol(['aadhar', 'aadhaar', 'uid', 'aadharno']);
    const idxRemark = findCol(['remark', 'teacherremark', 'tippani']);
    const idxPhoto = findCol(['photo', 'image', 'photourl']);

    if (idxName === -1 && idxRoll === -1) {
      setParseError(
        'हेडर में "Roll_No" या "Student_Name" का कॉलम नहीं मिला। कृपया ऊपर दिया गया "एक्सेल हेडर कॉपी करें" बटन दबाकर उसी प्रारूप में कॉलम रखें।'
      );
      return;
    }

    const studentsResult: Student[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      if (row.length === 0 || row.every((c) => !c.trim())) continue;

      const getVal = (idx: number, def = ''): string => {
        return idx >= 0 && idx < row.length ? row[idx].trim() : def;
      };

      const rawName = getVal(idxName);
      const rawRoll = getVal(idxRoll);
      const rawClass = getVal(idxClass, '8th');

      if (!rawName && !rawRoll) continue;

      const rawGender = getVal(idxGender).toUpperCase();
      let gender: 'MALE' | 'FEMALE' | 'OTHER' = 'MALE';
      if (
        rawGender.startsWith('F') ||
        rawGender.includes('FEMALE') ||
        rawGender.includes('महिला') ||
        rawGender.includes('लड़की')
      ) {
        gender = 'FEMALE';
      } else if (rawGender.startsWith('O') || rawGender.includes('OTHER')) {
        gender = 'OTHER';
      }

      const stdId = `st-bulk-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;

      studentsResult.push({
        id: stdId,
        rollNo: rawRoll || String(i),
        name: rawName || `Student ${i}`,
        fatherName: getVal(idxFather, 'Father Name'),
        motherName: getVal(idxMother, 'Mother Name'),
        className: rawClass,
        section: getVal(idxSection, 'A'),
        dob: getVal(idxDob, '2012-01-01'),
        gender,
        admissionNo: getVal(idxAdmission, `SKN-${rawRoll || i}`),
        mobile: getVal(idxMobile, ''),
        aadharNo: getVal(idxAadhar, ''),
        photoUrl: getVal(idxPhoto, ''),
        session: getVal(idxSession, currentSession),
        teacherRemark: getVal(idxRemark, 'Good student with positive attitude'),
        marks: {},
      });
    }

    if (studentsResult.length === 0) {
      setParseError('कोई मान्य छात्र रिकॉर्ड नहीं मिला। कृपया डेटा प्रारूप जांचें।');
      setParsedStudents([]);
      setHasParsed(false);
      return;
    }

    setParsedStudents(studentsResult);
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
        parseRawText(text);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (parsedStudents.length === 0) return;
    setIsProcessing(true);
    try {
      onImportStudents(parsedStudents, importMode);
      onClose();
    } catch (err: any) {
      setParseError('इम्पोर्ट में त्रुटि: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#0f2b48] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                छात्र थोक पंजीकरण (Bulk Import Students — Excel / CSV)
              </h3>
              <p className="text-[11px] text-slate-300">
                Excel से पूरी कक्षा के छात्रों का संपूर्ण विवरण (नाम, रोल नंबर, SR No, माता-पिता, आधार आदि) एक साथ जोड़ें
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
          {/* Copy Feedback */}
          {copyFeedback && (
            <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl text-emerald-950 font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{copyFeedback}</span>
            </div>
          )}

          {/* Top Info Banner & Action Buttons */}
          <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-emerald-950">
                <p className="font-bold text-sm">
                  Excel या Google Sheets से पूरी कक्षा का डेटा एक क्लिक में इम्पोर्ट करें
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                  सभी आवश्यक फील्ड्स (Student Name, Roll No, Admission No, DOB, Parents, Mobile, Aadhaar) समर्थित हैं।
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={handleCopyHeadersOnly}
                className="px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-98"
                title="Excel में पहली पंक्ति में पेस्ट करने के लिए सभी कॉलम हेडर कॉपी करें"
              >
                <Copy className="w-4 h-4 text-amber-300" />
                <span>1. एक्सेल हेडर कॉपी करें (Copy Headers)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
              >
                <Download className="w-3.5 h-3.5 text-blue-700" />
                <span>2. नमूना CSV डाउनलोड करें</span>
              </button>
            </div>
          </div>

          {/* Quick Help Guide */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-amber-950">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <p className="font-bold">सरल तरीका:</p>
              <p>
                1. <strong>"एक्सेल हेडर कॉपी करें"</strong> दबाएं और Excel में पहली पंक्ति (Row 1) पर पेस्ट करें।
              </p>
              <p>
                2. छात्रों का डेटा भरें, पूरी शीट को कॉपी करें और सीधे नीचे दिए गए बॉक्स में पेस्ट करें।
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
                <span>1. Excel / Sheets से डायरेक्ट कॉपी-पेस्ट (सबसे आसान)</span>
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
                <span>2. CSV फ़ाइल अपलोड करें</span>
              </button>
            </div>

            {/* TAB 1: PASTE */}
            {activeInputTab === 'paste' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>
                    Excel से हेडर सहित डेटा कॉपी (Ctrl+C) करके नीचे पेस्ट (Ctrl+V) करें:
                  </span>
                  {pasteContent && (
                    <button
                      type="button"
                      onClick={() => {
                        setPasteContent('');
                        setParsedStudents([]);
                        setHasParsed(false);
                        setParseError(null);
                      }}
                      className="text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <textarea
                  rows={6}
                  value={pasteContent}
                  onChange={(e) => {
                    setPasteContent(e.target.value);
                    if (e.target.value.trim()) {
                      parseRawText(e.target.value);
                    } else {
                      setParsedStudents([]);
                      setHasParsed(false);
                    }
                  }}
                  placeholder={`Roll_No\tStudent_Name\tAdmission_No\tDate_of_Birth\tFather_Name\tMother_Name\tClass\tSection\tGender\tMobile\tAadhar_No\n1\tAarav Kumar\tSKN-101\t2011-05-15\tRajesh Kumar\tSunita Devi\t8th\tA\tMALE\t9838700001\t123456789012\n2\tPriya Sharma\tSKN-102\t2011-08-22\tMukesh Sharma\tKavita Devi\t8th\tA\tFEMALE\t9838700002\t123456789013`}
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl bg-slate-50/60 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0f2b48] leading-relaxed"
                />
              </div>
            )}

            {/* TAB 2: UPLOAD */}
            {activeInputTab === 'upload' && (
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.txt"
                  id="csv-file-input"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="csv-file-input" className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <span className="font-bold text-slate-700 block text-sm">
                    यहाँ अपनी .csv फ़ाइल चुनें या ड्रैग करें
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Excel से सेव की गई .csv (Comma Delimited) फ़ाइल को यहाँ अपलोड करें
                  </span>
                  <span className="mt-3 inline-block px-4 py-1.5 bg-[#0f2b48] text-white rounded-lg font-bold text-xs shadow-xs">
                    फ़ाइल चुनें (Browse File)
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Parse Error Notice */}
          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {/* PARSED PREVIEW SECTION */}
          {hasParsed && parsedStudents.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    {parsedStudents.length} छात्र डेटा सफलतापूर्वक पहचाने गए
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    (वर्तमान में कुल: {existingStudents.length} छात्र)
                  </span>
                </div>

                {/* Import Mode Radio */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-[#0f2b48]"
                    />
                    <span>अपडेट व नए जोड़ें (Merge)</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-[#0f2b48]"
                    />
                    <span>केवल नए जोड़ें (Append)</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-rose-700">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-rose-600"
                    />
                    <span>पूरा बदलें (Replace)</span>
                  </label>
                </div>
              </div>

              {/* Preview Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs min-w-[750px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase sticky top-0 border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="py-2 px-3 w-14">Roll</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3 w-24">SR / Adm No</th>
                      <th className="py-2 px-3 w-20">Class</th>
                      <th className="py-2 px-3">Father Name</th>
                      <th className="py-2 px-3">Mother Name</th>
                      <th className="py-2 px-3 w-20">DOB</th>
                      <th className="py-2 px-3 w-16">Gender</th>
                      <th className="py-2 px-3">Mobile / Aadhar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {parsedStudents.slice(0, 50).map((st, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-[#0f2b48]">{st.rollNo}</td>
                        <td className="py-1.5 px-3 font-bold uppercase">{st.name}</td>
                        <td className="py-1.5 px-3 font-mono text-[11px] text-slate-600">{st.admissionNo}</td>
                        <td className="py-1.5 px-3">
                          <span className="bg-blue-50 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                            {st.className}-{st.section}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 uppercase text-slate-600">{st.fatherName}</td>
                        <td className="py-1.5 px-3 uppercase text-slate-600">{st.motherName}</td>
                        <td className="py-1.5 px-3 font-mono text-[11px]">{st.dob}</td>
                        <td className="py-1.5 px-3">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              st.gender === 'FEMALE' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {st.gender}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-[11px] text-slate-500 font-mono">
                          {st.mobile || st.aadharNo ? `${st.mobile || '-'} / ${st.aadharNo || '-'}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedStudents.length > 50 && (
                <p className="text-[11px] text-slate-400 text-center">
                  ...और अन्य {parsedStudents.length - 50} छात्र रिकॉर्ड्स (कुल {parsedStudents.length} छात्र)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
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
            onClick={handleConfirmImport}
            disabled={parsedStudents.length === 0 || isProcessing}
            className={`px-6 py-2 text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
              parsedStudents.length > 0 && !isProcessing
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {isProcessing
                ? 'इम्पोर्ट हो रहा है...'
                : `हाँ, ${parsedStudents.length} छात्रों का डेटा इम्पोर्ट करें`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
