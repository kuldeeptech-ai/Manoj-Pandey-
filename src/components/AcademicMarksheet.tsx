import React from 'react';
import { StudentResultData } from '../types';
import { isSettingEnabled, findClassTeacher, formatDisplayDate } from '../utils/calculations';

interface AcademicMarksheetProps {
  data: StudentResultData;
  id?: string;
  examMode?: 'half_yearly_only' | 'combined' | 'annual_only';
}

export const AcademicMarksheet: React.FC<AcademicMarksheetProps> = ({
  data,
  id = 'printable-marksheet',
  examMode,
}) => {
  const { student, subjects, halfYearly, annual, combined, progress, teacherRemark, school, generatedAt, validationIssues } = data;

  // Resolve Class-specific teacher info
  const classTeacherInfo = data.classTeacher || findClassTeacher(
    student.className,
    school.classTeachers,
    { name: student.classTeacherName, signatureUrl: student.classTeacherSignatureUrl }
  );
  const teacherSigUrl = classTeacherInfo?.signatureUrl || school.teacherSignatureUrl;
  const teacherName = classTeacherInfo?.name;
  const teacherTitle = classTeacherInfo?.designation || 'CLASS TEACHER';

  // Toggle checks requested by user:
  // "admin panel me itna customizetion dena ki sab toggle pr ho hlaf annual toggle band karne se result me n show ho"
  const allowHalfYearly = isSettingEnabled(school.showHalfYearlyExam, true);
  const allowAnnual = isSettingEnabled(school.showAnnualExam, true);

  // Determine effective view mode
  let effectiveMode: 'half_yearly_only' | 'annual_only' | 'combined' = 'combined';
  if (allowHalfYearly && !allowAnnual) {
    // If annual is disabled, ALWAYS force half_yearly_only regardless of examMode prop!
    effectiveMode = 'half_yearly_only';
  } else if (!allowHalfYearly && allowAnnual) {
    effectiveMode = 'annual_only';
  } else if (allowHalfYearly && allowAnnual) {
    if (examMode && (examMode === 'half_yearly_only' || examMode === 'annual_only' || examMode === 'combined')) {
      effectiveMode = examMode;
    } else if (school.defaultExamMode === 'annual_only') {
      effectiveMode = 'annual_only';
    } else if (school.defaultExamMode === 'half_yearly_only') {
      effectiveMode = 'half_yearly_only';
    } else {
      effectiveMode = 'combined';
    }
  }

  const isHalfOnly = effectiveMode === 'half_yearly_only';
  const isAnnualOnly = effectiveMode === 'annual_only';
  const isCombined = effectiveMode === 'combined';

  let displayTitle = school.resultTitle || 'ACADEMIC RESULT — HALF-YEARLY & ANNUAL';
  if (isHalfOnly) {
    displayTitle = school.resultTitleHalfYearly || 'ACADEMIC RESULT — HALF-YEARLY EXAMINATION';
  } else if (isAnnualOnly) {
    displayTitle = 'ACADEMIC RESULT — ANNUAL EXAMINATION';
  }

  const showPhoto = isSettingEnabled(school.showStudentPhoto, true);
  const showRemarks = isSettingEnabled(school.showTeacherRemarks, true) && Boolean(teacherRemark);
  const showSignatures = isSettingEnabled(school.showSignatures, true);
  const showStamp = isSettingEnabled(school.showDigitalStamp, true);
  const showPercentage = isSettingEnabled(school.showPercentage, true);
  const showGrade = isSettingEnabled(school.showGrade, false);
  const showProgress = isSettingEnabled(school.showProgressGraph, true);

  // Dynamic density calculation to guarantee 100% perfect fit on exact A4 paper
  const isDense = subjects.length >= 8;
  const isVeryDense = subjects.length >= 11;
  const pagePadding = isVeryDense ? '2mm 4mm 1.5mm 4mm' : isDense ? '2.5mm 4.5mm 2mm 4.5mm' : '3mm 5mm 2.5mm 5mm';
  const rowHeight = isVeryDense ? '16px' : isDense ? '17px' : '18.5px';
  const configuredLogoSize = typeof school.logoSize === 'number' && school.logoSize >= 40 && school.logoSize <= 160 ? school.logoSize : 66;
  const headerLogoSizePx = isVeryDense
    ? Math.max(46, Math.round(configuredLogoSize * 0.74))
    : isDense
    ? Math.max(52, Math.round(configuredLogoSize * 0.82))
    : Math.min(configuredLogoSize, 66);
  const headerLogoSize = `${headerLogoSizePx}px`;
  const photoW = isVeryDense ? '62px' : '68px';
  const photoH = isVeryDense ? '76px' : '82px';

  // Helper to strictly sanitize any Hindi/Devanagari characters to pure English
  const stripHindi = (val: string | undefined | null, fallback: string = ''): string => {
    if (!val) return fallback;
    const cleaned = val.replace(/[\u0900-\u097F]/g, '').replace(/\s{2,}/g, ' ').trim();
    return cleaned.length > 0 ? cleaned : fallback;
  };

  const safeSchoolName = stripHindi(school.schoolName, 'H.D. PANDEY PUBLIC JUNIOR HIGH SCHOOL');
  const safeAddress = stripHindi(school.address, 'Baurbyas, Shiv Mandir Side S.K.N. (U.P.) – 272154');
  const safeManagedBy = stripHindi(school.managedBy, 'Manoj Panday');
  const safeTagline = stripHindi(school.tagline, 'DISCIPLINE • KNOWLEDGE • CHARACTER • BRIGHT FUTURE');

  return (
    <div
      id={id}
      className="marksheet-document marksheet-a4-page select-none print:shadow-none print:border-0"
      style={{
        width: '794px',
        maxWidth: '794px',
        minWidth: '794px',
        height: '1060px',
        minHeight: '1060px',
        maxHeight: '1062px',
        padding: pagePadding,
        backgroundColor: '#ffffff',
        color: '#0f172a',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        margin: '0 auto',
      }}
    >
      {/* Outer Double Certificate Border with Sarkari Navy & Royal Gold Accent */}
      <div
        className="w-full h-full flex flex-col justify-between relative"
        style={{
          border: '2.5px solid #0f2b48',
          padding: '1mm',
          backgroundColor: '#ffffff',
          boxSizing: 'border-box',
        }}
      >
        {/* Inner Gold Certificate Accent Border */}
        <div
          className="w-full h-full flex flex-col justify-between relative"
          style={{
            border: '1px solid #b8860b',
            padding: '1.2mm',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box',
          }}
        >
          {/* Subtle Institutional Watermark for authentic Sarkari Certificate look */}
          <div
            className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.035] select-none overflow-hidden z-0"
            aria-hidden="true"
          >
            {school.logoUrl ? (
              <img
                src={school.logoUrl}
                alt=""
                className="w-[260px] h-[260px] object-contain grayscale"
              />
            ) : (
              <div className="w-[250px] h-[250px] rounded-full border-[8px] border-[#0f2b48] flex items-center justify-center text-center p-4">
                <span className="font-sarkari-title font-extrabold text-[22px] uppercase text-[#0f2b48]">
                  {safeSchoolName}
                </span>
              </div>
            )}
          </div>

          {/* TOP HEADER SECTION */}
          <div className="relative z-10">
            {/* TOP EMBLEM & ACADEMIC BANNER */}
            <div
              className="flex items-center justify-between px-2.5 py-0.5 text-[8.5px] font-bold tracking-wider"
              style={{
                backgroundColor: '#0f2b48',
                color: '#ffffff',
                borderBottom: '1px solid #b8860b',
              }}
            >
              <span className="text-amber-300 font-semibold tracking-wide">ACADEMIC PERFORMANCE REPORT</span>
              <span className="tracking-widest uppercase">ANNUAL ACADEMIC EVALUATION SYSTEM</span>
              <span className="text-amber-300">SESSION: {student.session || school.session}</span>
            </div>

            <div
              className="flex items-center justify-between gap-2 pt-1 pb-1 px-1"
              style={{ borderBottom: '2px solid #0f2b48' }}
            >
              {/* Left: School Logo with strict bounds */}
              <div
                className="shrink-0 flex items-center justify-center overflow-hidden marksheet-logo-box p-0.5"
                style={{
                  width: headerLogoSize,
                  height: headerLogoSize,
                  minWidth: headerLogoSize,
                  minHeight: headerLogoSize,
                  maxWidth: headerLogoSize,
                  maxHeight: headerLogoSize,
                  border: '1.5px solid #0f2b48',
                  borderRadius: '3px',
                  backgroundColor: '#ffffff',
                }}
              >
                {school.logoUrl ? (
                  <img
                    src={school.logoUrl}
                    alt={school.schoolName}
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: '100%', maxWidth: headerLogoSize, maxHeight: headerLogoSize, objectFit: 'contain', display: 'block' }}
                    className="marksheet-logo-img max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center text-[7.5px] font-bold text-center"
                    style={{ border: '1px dashed #0f2b48', color: '#0f2b48' }}
                  >
                    <span>SCHOOL</span>
                    <span>LOGO</span>
                  </div>
                )}
              </div>

              {/* Center: School Branding with Sarkari Serif Typography */}
              <div className="flex-1 text-center px-1">
                <h1
                  className="font-sarkari-title marksheet-sarkari-title leading-tight font-extrabold uppercase"
                  style={{
                    color: '#0a1d30',
                    fontSize: school.marksheetSchoolNameSize
                      ? `${school.marksheetSchoolNameSize}px`
                      : (isVeryDense ? '15.5px' : isDense ? '17px' : '18.5px'),
                    letterSpacing: '0.04em',
                  }}
                >
                  {safeSchoolName}
                </h1>

                <p
                  className="font-sarkari-serif text-[9.5px] leading-tight font-semibold mt-1"
                  style={{ color: '#334155' }}
                >
                  {safeAddress}
                </p>

                <p
                  className="text-[8.5px] leading-tight text-slate-600 mt-0.5 font-medium"
                >
                  <span className="font-semibold text-slate-700">Manager: {safeManagedBy}</span>
                  <span className="mx-2 font-bold text-amber-600">•</span>
                  <span className="font-semibold text-slate-700">Helpline: {school.mobile}</span>
                </p>

                <div
                  className="mt-0.5 inline-block px-3 py-0.5 rounded-xs"
                  style={{ backgroundColor: '#f4f8fc', border: '1px solid #b8860b' }}
                >
                  <p
                    className="text-[8px] leading-none font-bold tracking-wider font-sarkari-serif uppercase"
                    style={{ color: '#0f2b48' }}
                  >
                    ★ {safeTagline} ★
                  </p>
                </div>
              </div>

              {/* Right: Academic Result Verification Medal */}
              <div
                className="shrink-0 flex flex-col items-center justify-center rounded p-1 text-center"
                style={{
                  width: headerLogoSize,
                  height: headerLogoSize,
                  minWidth: headerLogoSize,
                  minHeight: headerLogoSize,
                  border: '2px solid #b8860b',
                  backgroundColor: '#fbfcf8',
                  boxShadow: 'inset 0 0 0 1px #0f2b48',
                }}
              >
                <span
                  className="text-[7.5px] font-extrabold uppercase tracking-wider"
                  style={{ color: '#b8860b' }}
                >
                  ★ ACADEMIC ★
                </span>
                <span
                  className="font-sarkari-title text-[9px] leading-tight font-extrabold tracking-tight uppercase"
                  style={{ color: '#0f2b48' }}
                >
                  EVALUATION
                </span>
                <span
                  className="font-sarkari-title text-[8.5px] leading-none font-bold uppercase"
                  style={{ color: '#0f2b48' }}
                >
                  RESULT
                </span>
                <span
                  className="text-[6.5px] font-extrabold mt-0.5 uppercase tracking-tight"
                  style={{ color: '#047857' }}
                >
                  ✓ VERIFIED
                </span>
              </div>
            </div>

            {/* RESULT TITLE & SESSION (Certificate Ribbon) */}
            <div
              className="text-center py-1 mt-0.5 flex items-center justify-between px-2"
              style={{
                backgroundColor: '#f8fafc',
                borderTop: '1px solid #b8860b',
                borderBottom: '2px solid #0f2b48',
              }}
            >
              <div className="text-[8.5px] font-extrabold uppercase flex items-center gap-1" style={{ color: '#0f2b48' }}>
                <span className="px-1.5 py-0.5 rounded-xs bg-[#e8f0fe] text-[#0f2b48] border border-[#1b4975]">
                  {isHalfOnly ? 'TERM I' : isAnnualOnly ? 'TERM II' : 'FINAL EXAM'}
                </span>
              </div>
              <div className="text-center">
                <h2
                  className={`font-sarkari-title ${isVeryDense ? 'text-[11px]' : 'text-[12px]'} font-extrabold tracking-wider uppercase leading-tight`}
                  style={{ color: '#0a1d30' }}
                >
                  {isHalfOnly ? 'HALF-YEARLY EXAMINATION REPORT & MARKSHEET' : isAnnualOnly ? 'ANNUAL EXAMINATION REPORT & MARKSHEET' : 'ANNUAL PROGRESS REPORT & MARKSHEET'}
                </h2>
                <div
                  className="font-sarkari-serif text-[8.5px] font-bold tracking-wider mt-0.5 uppercase"
                  style={{ color: '#334155' }}
                >
                  <span>CUMULATIVE ACADEMIC PERFORMANCE REPORT</span>
                  <span className="mx-1.5 text-amber-700">•</span>
                  SESSION: <span className="font-extrabold text-[#0f2b48] underline">{student.session || school.session}</span>
                  {isHalfOnly && (
                    <span
                      className="ml-2 px-1.5 py-0.2 text-[8px] rounded font-bold"
                      style={{ backgroundColor: '#0f2b48', color: '#ffd54f' }}
                    >
                      HALF-YEARLY
                    </span>
                  )}
                  {isAnnualOnly && (
                    <span
                      className="ml-2 px-1.5 py-0.2 text-[8px] rounded font-bold"
                      style={{ backgroundColor: '#1b4975', color: '#ffd54f' }}
                    >
                      ANNUAL
                    </span>
                  )}
                </div>
              </div>
              <div className="text-[8.5px] font-bold uppercase" style={{ color: '#0f2b48' }}>
                <span className="px-2 py-0.5 rounded-xs bg-amber-100 text-amber-950 border border-amber-400 font-extrabold">
                  CLASS: {student.className} ({student.section || 'A'})
                </span>
              </div>
            </div>

            {/* DATA INCONSISTENCY NOTICE IF ANY */}
            {validationIssues && validationIssues.length > 0 && (
              <div
                className="my-0.5 px-2 py-0.5 text-[8.5px] font-bold"
                style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fcd34d',
                  color: '#78350f',
                }}
              >
                ⚠️ Result data requires verification: {validationIssues.join(' • ')}
              </div>
            )}

            {/* STUDENT INFORMATION SECTION */}
            <div className="mt-1" style={{ border: '1.5px solid #0f2b48' }}>
              {/* Dark Brand Bar */}
              <div
                className="px-2 py-0.5 flex justify-between items-center"
                style={{ backgroundColor: '#0f2b48', color: '#ffffff' }}
              >
                <span className="font-sarkari-title text-[9.5px] font-bold uppercase tracking-wider">
                  STUDENT PARTICULARS
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[8.5px] font-bold tracking-tight" style={{ color: '#ffd54f' }}>
                    ADM NO: <span className="font-mono text-white text-[9px]">{student.admissionNo || '—'}</span>
                  </span>
                </div>
              </div>

              <div className="p-1 flex gap-2 items-stretch" style={{ backgroundColor: '#ffffff' }}>
                {/* 2-Column Info Flexbox (Mathematically aligned 5 rows each side + full-width address row matching photo height) */}
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex gap-2.5">
                    {/* Left Column (5 balanced rows) */}
                    <div className={`w-1/2 flex flex-col ${isVeryDense ? 'gap-y-0.5 text-[8.5px]' : 'gap-y-0.5 text-[9px]'}`}>
                      <div className="flex items-baseline pb-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <span className="w-[84px] shrink-0 font-semibold uppercase whitespace-nowrap text-[8.5px]" style={{ color: '#475569' }}>Student Name:</span>
                        <span className="flex-1 font-bold uppercase truncate" style={{ color: '#0f2b48' }}>{student.name || '—'}</span>
                      </div>

                      <div className="flex items-baseline pb-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <span className="w-[84px] shrink-0 font-semibold uppercase whitespace-nowrap text-[8.5px]" style={{ color: '#475569' }}>Father's Name:</span>
                        <span className="flex-1 font-bold uppercase truncate" style={{ color: '#0f172a' }}>{student.fatherName || '—'}</span>
                      </div>

                      <div className="flex items-baseline pb-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <span className="w-[84px] shrink-0 font-semibold uppercase whitespace-nowrap text-[8.5px]" style={{ color: '#475569' }}>Mother's Name:</span>
                        <span className="flex-1 font-bold uppercase truncate" style={{ color: '#0f172a' }}>{student.motherName || '—'}</span>
                      </div>

                      <div className="flex items-baseline pb-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <span className="w-[84px] shrink-0 font-semibold uppercase whitespace-nowrap text-[8.5px]" style={{ color: '#475569' }}>Admission No:</span>
                        <span className="flex-1 font-bold font-mono" style={{ color: '#0f172a' }}>{student.admissionNo || '—'}</span>
                      </div>

                      {isSettingEnabled(school.showStudentAadhar, true) ? (
                        <div className="flex items-baseline pb-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <span className="w-[84px] shrink-0 font-semibold uppercase whitespace-nowrap text-[8.5px]" style={{ color: '#475569' }}>Aadhaar No:</span>
                          <span className="flex-1 font-bold font-mono tracking-tight" style={{ color: '#0f172a' }}>{student.aadharNo || '—'}</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline pb-0.5 opacity-0 pointer-events-none">
                          <span className="w-[84px] shrink-0 font-bold">&nbsp;</span>
                          <span className="flex-1 font-bold">&nbsp;</span>
                        </div>
                      )}
                    </div>

                    {/* Right Column (5 balanced rows matching Left Column exactly) */}
                    <div className={`w-1/2 flex flex-col ${isVeryDense ? 'gap-y-0.5 text-[8.5px]' : 'gap-y-0.5 text-[9px]'}`}>
                      <div className="flex items-baseline pb-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <span className="w-[82px] shrink-0 font-semibold uppercase whitespace-nowrap text-[8.5px]" style={{ color: '#475569' }}>Roll Number:</span>
                        <span className="flex-1 font-bold text-[10px]" style={{ color: '#0f2b48' }}>{student.rollNo || '—'}</span>
                      </div>

                      <div className="flex items-baseline pb-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <span className="w-[82px] shrink-0 font-semibold uppercase whitespace-nowrap text-[8.5px]" style={{ color: '#475569' }}>Class & Sec:</span>
                        <span className="flex-1 font-bold" style={{ color: '#0f172a' }}>{student.className} - {student.section}</span>
                      </div>

                      <div className="flex items-baseline pb-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <span className="w-[82px] shrink-0 font-semibold uppercase whitespace-nowrap text-[8.5px]" style={{ color: '#475569' }}>Date of Birth:</span>
                        <span className="flex-1 font-bold" style={{ color: '#0f172a' }}>{formatDisplayDate(student.dob) || '—'}</span>
                      </div>

                      <div className="flex items-baseline pb-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <span className="w-[82px] shrink-0 font-semibold uppercase whitespace-nowrap text-[8.5px]" style={{ color: '#475569' }}>Gender:</span>
                        <span className="flex-1 font-bold uppercase" style={{ color: '#0f172a' }}>{student.gender || '—'}</span>
                      </div>

                      {isSettingEnabled(school.showStudentMobile, true) ? (
                        <div className="flex items-baseline pb-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <span className="w-[82px] shrink-0 font-semibold uppercase whitespace-nowrap text-[8.5px]" style={{ color: '#475569' }}>Contact No:</span>
                          <span className="flex-1 font-bold font-mono tracking-tight" style={{ color: '#0f172a' }}>{student.mobile || '—'}</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline pb-0.5 opacity-0 pointer-events-none">
                          <span className="w-[82px] shrink-0 font-bold">&nbsp;</span>
                          <span className="flex-1 font-bold">&nbsp;</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Full-width Address Row */}
                  {isSettingEnabled(school.showStudentAddress, true) ? (
                    <div className="flex items-baseline pt-0.5 pb-0.5" style={{ borderTop: '1px solid #e2e8f0' }}>
                      <span className="w-[84px] shrink-0 font-semibold uppercase whitespace-nowrap text-[8.5px]" style={{ color: '#475569' }}>Address:</span>
                      <span className="flex-1 font-bold truncate leading-tight text-[9.5px]" style={{ color: '#0f172a' }} title={student.address || (student as any).pata || '—'}>
                        {student.address || (student as any).pata || '—'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-baseline pt-0.5 pb-0.5 opacity-0 pointer-events-none">
                      <span className="w-[84px] shrink-0 font-bold">&nbsp;</span>
                      <span className="flex-1 font-bold">&nbsp;</span>
                    </div>
                  )}
                </div>

                {/* Right: Fixed Student Portrait Photo (Guarded by showPhoto toggle) */}
                {showPhoto && (
                  <div
                    className="shrink-0 p-0.5 flex flex-col items-center justify-center overflow-hidden relative marksheet-photo-box"
                    style={{
                      width: photoW,
                      height: photoH,
                      minWidth: photoW,
                      minHeight: photoH,
                      maxWidth: photoW,
                      maxHeight: photoH,
                      border: '1.5px solid #0f2b48',
                      backgroundColor: '#f1f5f9',
                    }}
                  >
                    {student.photoUrl ? (
                      <img
                        src={student.photoUrl}
                        alt={student.name}
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        style={{ width: '100%', height: '100%', maxWidth: photoW, maxHeight: photoH, objectFit: 'cover', display: 'block' }}
                        className="marksheet-photo-img w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center text-[7px] text-center p-1"
                        style={{ backgroundColor: '#e2e8f0', color: '#64748b' }}
                      >
                        <span className="font-bold">STUDENT</span>
                        <span>PHOTO</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ACADEMIC PERFORMANCE TABLE */}
            <div className="mt-1">
              <div
                className="px-2 py-0.5 flex justify-between items-center"
                style={{
                  backgroundColor: '#0f2b48',
                  color: '#ffffff',
                  border: '1px solid #0f2b48',
                  borderBottom: 'none',
                }}
              >
                <span className="font-sarkari-title text-[9.5px] font-bold uppercase tracking-wider">
                  {isHalfOnly ? 'HALF-YEARLY EXAMINATION MARKS' : isAnnualOnly ? 'ANNUAL EXAMINATION MARKS' : 'ACADEMIC MARKS DETAILS'}
                </span>
                <span className="text-[8.5px] font-semibold text-slate-200">
                  {isHalfOnly ? 'TERM I EVALUATION (MAX MARKS • PASS CRITERIA: 33%)' : isAnnualOnly ? 'TERM II EVALUATION (MAX MARKS • PASS CRITERIA: 33%)' : 'MAX MARKS (M.M.) • PASS CRITERIA: 33%'}
                </span>
              </div>

              {isHalfOnly ? (
                /* HALF-YEARLY ONLY 4-COLUMN TABLE */
                <table
                  className="academic-table w-full text-center"
                  style={{
                    border: '1.5px solid #0f2b48',
                    borderCollapse: 'collapse',
                    backgroundColor: '#ffffff',
                    width: '100%',
                  }}
                >
                  <thead>
                    <tr className="text-[9.5px]">
                      <th className="w-[8%] py-0.5 font-bold text-center" style={{ backgroundColor: '#0f2b48', color: '#ffffff', border: '1px solid #0f2b48' }}>S.NO.</th>
                      <th className="w-[46%] py-0.5 font-bold text-left px-2" style={{ backgroundColor: '#0f2b48', color: '#ffffff', border: '1px solid #0f2b48' }}>SUBJECT NAME</th>
                      <th className="w-[23%] py-0.5 font-bold" style={{ backgroundColor: '#1a4773', color: '#ffffff', border: '1px solid #0f2b48' }}>
                        MAX MARKS (M.M.)
                      </th>
                      <th className="w-[23%] py-0.5 font-bold" style={{ backgroundColor: '#23588e', color: '#ffffff', border: '1px solid #0f2b48' }}>
                        OBTAINED MARKS
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`${isVeryDense ? 'text-[9.5px]' : isDense ? 'text-[10px]' : 'text-[11px]'}`}>
                    {subjects.map((row) => (
                      <tr
                        key={row.subjectId}
                        style={{ height: rowHeight, backgroundColor: '#ffffff' }}
                      >
                        <td className="font-bold py-0.2" style={{ color: '#334155', border: '1px solid #0f2b48' }}>{row.sNo}</td>
                        <td className="font-bold text-left px-2 uppercase" style={{ color: '#0f172a', border: '1px solid #0f2b48' }}>
                          {row.subjectName}
                          {row.validationError && (
                            <span className="text-[7.5px] block leading-none font-normal" style={{ color: '#dc2626' }}>
                              {row.validationError}
                            </span>
                          )}
                        </td>
                        <td className="font-bold py-0.2" style={{ backgroundColor: '#f0f7ff', color: '#334155', border: '1px solid #0f2b48' }}>{row.halfMax}</td>
                        <td className="font-bold py-0.2 text-[11.5px]" style={{ backgroundColor: '#dbeafe', color: '#0f2b48', border: '1px solid #0f2b48' }}>{row.halfObtained}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : isAnnualOnly ? (
                /* ANNUAL ONLY 4-COLUMN TABLE */
                <table
                  className="academic-table w-full text-center"
                  style={{
                    border: '1.5px solid #0f2b48',
                    borderCollapse: 'collapse',
                    backgroundColor: '#ffffff',
                    width: '100%',
                  }}
                >
                  <thead>
                    <tr className="text-[9.5px]">
                      <th className="w-[8%] py-0.5 font-bold text-center" style={{ backgroundColor: '#0f2b48', color: '#ffffff', border: '1px solid #0f2b48' }}>S.NO.</th>
                      <th className="w-[46%] py-0.5 font-bold text-left px-2" style={{ backgroundColor: '#0f2b48', color: '#ffffff', border: '1px solid #0f2b48' }}>SUBJECT NAME</th>
                      <th className="w-[23%] py-0.5 font-bold" style={{ backgroundColor: '#1a4773', color: '#ffffff', border: '1px solid #0f2b48' }}>
                        MAX MARKS (M.M.)
                      </th>
                      <th className="w-[23%] py-0.5 font-bold" style={{ backgroundColor: '#1b4975', color: '#ffffff', border: '1px solid #0f2b48' }}>
                        OBTAINED MARKS
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`${isVeryDense ? 'text-[9.5px]' : isDense ? 'text-[10px]' : 'text-[11px]'}`}>
                    {subjects.map((row) => (
                      <tr
                        key={row.subjectId}
                        style={{ height: rowHeight, backgroundColor: '#ffffff' }}
                      >
                        <td className="font-bold py-0.2" style={{ color: '#334155', border: '1px solid #0f2b48' }}>{row.sNo}</td>
                        <td className="font-bold text-left px-2 uppercase" style={{ color: '#0f172a', border: '1px solid #0f2b48' }}>
                          {row.subjectName}
                          {row.validationError && (
                            <span className="text-[7.5px] block leading-none font-normal" style={{ color: '#dc2626' }}>
                              {row.validationError}
                            </span>
                          )}
                        </td>
                        <td className="font-bold py-0.2" style={{ backgroundColor: '#f0fdf4', color: '#334155', border: '1px solid #0f2b48' }}>{row.annualMax}</td>
                        <td className="font-bold py-0.2 text-[11.5px]" style={{ backgroundColor: '#dcfce7', color: '#0f2b48', border: '1px solid #0f2b48' }}>{row.annualObtained}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* COMBINED 6-COLUMN TABLE (HALF-YEARLY + ANNUAL) */
                <table
                  className="academic-table w-full text-center"
                  style={{
                    border: '1.5px solid #0f2b48',
                    borderCollapse: 'collapse',
                    backgroundColor: '#ffffff',
                    width: '100%',
                  }}
                >
                  <thead>
                    <tr className="text-[9.5px]" style={{ backgroundColor: '#f0f4f9', color: '#0f2b48' }}>
                      <th rowSpan={2} className="w-[6%] py-0.5 font-bold text-center" style={{ border: '1px solid #0f2b48', backgroundColor: '#f0f4f9', color: '#0f2b48' }}>
                        S.NO.
                      </th>
                      <th rowSpan={2} className="w-[36%] py-0.5 font-bold text-left px-2" style={{ border: '1px solid #0f2b48', backgroundColor: '#f0f4f9', color: '#0f2b48' }}>
                        SUBJECT NAME
                      </th>
                      <th colSpan={2} className="w-[29%] py-0.5 font-bold" style={{ border: '1px solid #0f2b48', backgroundColor: '#e8f0fe', color: '#0f2b48' }}>
                        HALF-YEARLY EXAMINATION (TERM I)
                      </th>
                      <th colSpan={2} className="w-[29%] py-0.5 font-bold" style={{ border: '1px solid #0f2b48', backgroundColor: '#f0fdf4', color: '#0f2b48' }}>
                        ANNUAL EXAMINATION (TERM II)
                      </th>
                    </tr>
                    <tr className="text-[9px]">
                      <th className="w-[14.5%] py-0.5 font-bold" style={{ border: '1px solid #0f2b48', backgroundColor: '#e8f0fe', color: '#0f2b48' }}>MAX MARKS</th>
                      <th className="w-[14.5%] py-0.5 font-bold" style={{ border: '1px solid #0f2b48', backgroundColor: '#e8f0fe', color: '#0f2b48' }}>OBT. MARKS</th>
                      <th className="w-[14.5%] py-0.5 font-bold" style={{ border: '1px solid #0f2b48', backgroundColor: '#f0fdf4', color: '#0f2b48' }}>MAX MARKS</th>
                      <th className="w-[14.5%] py-0.5 font-bold" style={{ border: '1px solid #0f2b48', backgroundColor: '#f0fdf4', color: '#0f2b48' }}>OBT. MARKS</th>
                    </tr>
                  </thead>
                  <tbody className={`${isVeryDense ? 'text-[8.5px]' : isDense ? 'text-[9px]' : 'text-[9.5px]'}`}>
                    {subjects.map((row) => (
                      <tr
                        key={row.subjectId}
                        style={{ height: rowHeight, backgroundColor: '#ffffff' }}
                      >
                        <td className="font-bold py-0.2" style={{ border: '1px solid #0f2b48', color: '#334155' }}>{row.sNo}</td>
                        <td className="font-bold text-left px-2 uppercase" style={{ border: '1px solid #0f2b48', color: '#0f172a' }}>
                          {row.subjectName}
                          {row.validationError && (
                            <span className="text-[7.5px] block leading-none font-normal" style={{ color: '#dc2626' }}>
                              {row.validationError}
                            </span>
                          )}
                        </td>
                        <td className="font-bold py-0.2" style={{ border: '1px solid #0f2b48', backgroundColor: '#f0f7ff', color: '#334155' }}>{row.halfMax}</td>
                        <td className="font-bold py-0.2 text-[10px]" style={{ border: '1px solid #0f2b48', backgroundColor: '#e0effe', color: '#0f2b48' }}>{row.halfObtained}</td>
                        <td className="font-bold py-0.2" style={{ border: '1px solid #0f2b48', backgroundColor: '#f0fdf4', color: '#334155' }}>{row.annualMax}</td>
                        <td className="font-bold py-0.2 text-[10px]" style={{ border: '1px solid #0f2b48', backgroundColor: '#dcfce7', color: '#0f2b48' }}>{row.annualObtained}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* DEDICATED SUMMARY SECTION */}
              <div
                className="text-[9.5px] leading-normal font-bold"
                style={{
                  border: '1.5px solid #0f2b48',
                  borderTop: 'none',
                }}
              >
                {isHalfOnly ? (
                  /* HALF-YEARLY ONLY SUMMARY ROW */
                  <div
                    className={`flex ${isVeryDense ? 'py-0.5' : 'py-1'}`}
                    style={{ backgroundColor: '#0f2b48', color: '#ffffff' }}
                  >
                    <div
                      className="w-[52%] px-2.5 font-bold uppercase flex items-center justify-between"
                      style={{ backgroundColor: '#0f2b48', color: '#ffffff', borderRight: '1px solid rgba(255,255,255,0.3)' }}
                    >
                      <span className="text-[10px] font-sarkari-title">HALF-YEARLY SUMMARY (TERM I)</span>
                      <span className="text-[8.5px]" style={{ color: '#ffd54f' }}>TERM I RESULT</span>
                    </div>
                    <div
                      className="flex-1 flex text-center items-center"
                      style={{ color: '#ffffff' }}
                    >
                      <div className="w-1/4 shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                        <span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>TOTAL M.M.</span>
                        <span className="text-[11px]" style={{ color: '#ffffff' }}>{halfYearly.maximum}</span>
                      </div>
                      <div className="w-1/4 shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                        <span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>TOTAL RESULT</span>
                        <span className="font-bold text-[12px]" style={{ color: '#ffd54f' }}>{halfYearly.obtained}</span>
                      </div>
                      {showPercentage && (
                        <div className="w-1/4 shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                          <span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>PERCENTAGE</span>
                          <span className="text-[11px]" style={{ color: '#ffffff' }}>{halfYearly.percentage.toFixed(2)}%</span>
                        </div>
                      )}
                      <div className="w-1/4 shrink-0">
                        <span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>
                          {showGrade ? 'GRADE / STATUS' : 'STATUS'}
                        </span>
                        <span className="font-bold text-[11px]" style={{ color: '#ffd54f' }}>
                          {showGrade ? `${halfYearly.grade} (${halfYearly.status})` : halfYearly.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : isAnnualOnly ? (
                  /* ANNUAL ONLY SUMMARY ROW */
                  <div
                    className={`flex ${isVeryDense ? 'py-0.5' : 'py-1'}`}
                    style={{ backgroundColor: '#0f2b48', color: '#ffffff' }}
                  >
                    <div
                      className="w-[52%] px-2.5 font-bold uppercase flex items-center justify-between"
                      style={{ backgroundColor: '#0f2b48', color: '#ffffff', borderRight: '1px solid rgba(255,255,255,0.3)' }}
                    >
                      <span className="text-[10px] font-sarkari-title">ANNUAL SUMMARY (TERM II)</span>
                      <span className="text-[8.5px]" style={{ color: '#ffd54f' }}>TERM II RESULT</span>
                    </div>
                    <div
                      className="flex-1 flex text-center items-center"
                      style={{ color: '#ffffff' }}
                    >
                      <div className="w-1/4 shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                        <span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>TOTAL M.M.</span>
                        <span className="text-[11px]" style={{ color: '#ffffff' }}>{annual.maximum}</span>
                      </div>
                      <div className="w-1/4 shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                        <span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>TOTAL RESULT</span>
                        <span className="font-bold text-[12px]" style={{ color: '#ffd54f' }}>{annual.obtained}</span>
                      </div>
                      {showPercentage && (
                        <div className="w-1/4 shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                          <span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>PERCENTAGE</span>
                          <span className="text-[11px]" style={{ color: '#ffffff' }}>{annual.percentage.toFixed(2)}%</span>
                        </div>
                      )}
                      <div className="w-1/4 shrink-0">
                        <span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>
                          {showGrade ? 'GRADE / STATUS' : 'STATUS'}
                        </span>
                        <span className="font-bold text-[11px]" style={{ color: '#ffd54f' }}>
                          {showGrade ? `${annual.grade} (${annual.status})` : annual.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 3-ROW SUMMARY: HALF-YEARLY, ANNUAL, COMBINED */
                  <>
                    {/* ROW 1: HALF-YEARLY */}
                    <div className="flex" style={{ backgroundColor: '#f8faff', borderBottom: '1px solid #0f2b48' }}>
                      <div
                        className="w-[42%] px-2 py-0.5 font-bold uppercase flex items-center justify-between"
                        style={{ backgroundColor: '#e8f0fe', color: '#0f2b48', borderRight: '1px solid #0f2b48' }}
                      >
                        <span className="text-[9px]">HALF-YEARLY SUMMARY (TERM I)</span>
                        <span className="text-[8.5px] font-normal" style={{ color: '#1e3a8a' }}>EVALUATION</span>
                      </div>
                      <div className="flex-1 flex text-center items-center py-0.5">
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid #0f2b48' }}><span className="font-bold text-[8.5px] block" style={{ color: '#475569' }}>M.M.</span><span style={{ color: '#0f172a' }}>{halfYearly.maximum}</span></div>
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid #0f2b48' }}><span className="font-bold text-[8.5px] block" style={{ color: '#475569' }}>RESULT</span><span className="font-bold text-[10.5px]" style={{ color: '#0f2b48' }}>{halfYearly.obtained}</span></div>
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid #0f2b48' }}><span className="font-bold text-[8.5px] block" style={{ color: '#475569' }}>PERCENTAGE</span><span style={{ color: '#0f2b48' }}>{showPercentage ? `${halfYearly.percentage.toFixed(2)}%` : '—'}</span></div>
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid #0f2b48' }}><span className="font-bold text-[8.5px] block" style={{ color: '#475569' }}>GRADE</span><span className="font-bold" style={{ color: '#b8860b' }}>{showGrade ? halfYearly.grade : '—'}</span></div>
                        <div className="w-1/5 shrink-0"><span className="font-bold text-[8.5px] block" style={{ color: '#475569' }}>STATUS</span><span className="font-bold" style={{ color: halfYearly.status === 'PASS' ? '#047857' : '#be123c' }}>{halfYearly.status}</span></div>
                      </div>
                    </div>

                    {/* ROW 2: ANNUAL */}
                    <div className="flex" style={{ backgroundColor: '#fafffa', borderBottom: '1px solid #0f2b48' }}>
                      <div
                        className="w-[42%] px-2 py-0.5 font-bold uppercase flex items-center justify-between"
                        style={{ backgroundColor: '#e6f4ea', color: '#0f2b48', borderRight: '1px solid #0f2b48' }}
                      >
                        <span className="text-[9px]">ANNUAL SUMMARY (TERM II)</span>
                        <span className="text-[8.5px] font-normal" style={{ color: '#166534' }}>EVALUATION</span>
                      </div>
                      <div className="flex-1 flex text-center items-center py-0.5">
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid #0f2b48' }}><span className="font-bold text-[8.5px] block" style={{ color: '#475569' }}>M.M.</span><span style={{ color: '#0f172a' }}>{annual.maximum}</span></div>
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid #0f2b48' }}><span className="font-bold text-[8.5px] block" style={{ color: '#475569' }}>RESULT</span><span className="font-bold text-[10.5px]" style={{ color: '#0f2b48' }}>{annual.obtained}</span></div>
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid #0f2b48' }}><span className="font-bold text-[8.5px] block" style={{ color: '#475569' }}>PERCENTAGE</span><span style={{ color: '#0f2b48' }}>{showPercentage ? `${annual.percentage.toFixed(2)}%` : '—'}</span></div>
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid #0f2b48' }}><span className="font-bold text-[8.5px] block" style={{ color: '#475569' }}>GRADE</span><span className="font-bold" style={{ color: '#b8860b' }}>{showGrade ? annual.grade : '—'}</span></div>
                        <div className="w-1/5 shrink-0"><span className="font-bold text-[8.5px] block" style={{ color: '#475569' }}>STATUS</span><span className="font-bold" style={{ color: annual.status === 'PASS' ? '#047857' : '#be123c' }}>{annual.status}</span></div>
                      </div>
                    </div>

                    {/* ROW 3: COMBINED TOTAL */}
                    <div className="flex" style={{ backgroundColor: '#0f2b48', color: '#ffffff' }}>
                      <div
                        className="w-[42%] px-2 py-0.5 font-bold uppercase flex items-center justify-between"
                        style={{ backgroundColor: '#0f2b48', color: '#ffffff', borderRight: '1px solid #cbd5e1' }}
                      >
                        <span className="text-[9px] font-sarkari-title">FINAL AGGREGATE SUMMARY</span>
                        <span className="text-[8.5px]" style={{ color: '#ffd54f' }}>FINAL RESULT</span>
                      </div>
                      <div className="flex-1 flex text-center items-center py-0.5" style={{ color: '#ffffff' }}>
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}><span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>TOTAL M.M.</span><span className="text-[10px]" style={{ color: '#ffffff' }}>{combined.maximum}</span></div>
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}><span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>TOTAL RESULT</span><span className="font-bold text-[11px]" style={{ color: '#ffd54f' }}>{combined.obtained}</span></div>
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}><span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>COMBINED %</span><span className="text-[10px]" style={{ color: '#ffffff' }}>{showPercentage ? `${combined.percentage.toFixed(2)}%` : '—'}</span></div>
                        <div className="w-1/5 shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.2)' }}><span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>FINAL GRADE</span><span className="font-bold text-[10.5px]" style={{ color: '#ffd54f' }}>{showGrade ? combined.grade : '—'}</span></div>
                        <div className="w-1/5 shrink-0">
                          <span className="font-bold text-[8px] block" style={{ color: '#cbd5e1' }}>PROGRESS</span>
                          {showProgress ? (
                            <span className="text-[9px] font-bold" style={{ color: progress >= 0 ? '#6ee7b7' : '#fda4af' }}>
                              {progress > 0 ? `+${progress.toFixed(2)}%` : `${progress.toFixed(2)}%`}
                            </span>
                          ) : (
                            <span className="text-[9px]" style={{ color: '#cbd5e1' }}>—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* TEACHER'S REMARK (Guarded by showRemarks toggle) */}
            {showRemarks && (
              <div
                className={`${isVeryDense ? 'mt-0.5 p-1' : 'mt-1 p-1'}`}
                style={{ border: '1px solid #0f2b48', backgroundColor: '#fcfdff' }}
              >
                <div className="flex items-start gap-1 text-[9.5px]">
                  <span className="font-bold font-sarkari-serif uppercase shrink-0 tracking-wide" style={{ color: '#0f2b48' }}>
                    CLASS TEACHER'S REMARK:
                  </span>
                  <span className="font-bold italic flex-1 break-words text-[9px]" style={{ color: '#1e293b' }}>
                    "{teacherRemark}"
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM SECTION: SIGNATURES & FOOTER */}
          <div className="mt-0.5">
            {/* SIGNATURES SECTION (Guarded by showSignatures toggle) */}
            {showSignatures && (
              <div className="flex justify-between items-end px-3 pt-0.5 pb-0.5">
                {/* Class Teacher Signature */}
                <div className="text-center w-36 flex flex-col items-center">
                  <div className={`${isVeryDense ? 'h-6 mb-0.5' : 'h-7 mb-0.5'} flex items-end justify-center w-full`}>
                    {teacherSigUrl && (
                      <img
                        src={teacherSigUrl}
                        alt="Class Teacher Signature"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        style={{ maxHeight: isVeryDense ? '24px' : '30px', maxWidth: '130px', objectFit: 'contain', display: 'block' }}
                        className="marksheet-sig-img max-h-7 object-contain"
                      />
                    )}
                  </div>
                  <div className="w-full pt-0.5" style={{ borderTop: '1px solid #0f2b48' }}>
                    <p className="font-sarkari-serif text-[9.5px] font-bold uppercase tracking-wider leading-tight" style={{ color: '#0f2b48' }}>
                      {teacherTitle}
                    </p>
                    {teacherName && (
                      <p className="text-[8px] font-bold leading-tight mt-0.5 tracking-tight truncate max-w-full" style={{ color: '#1e3a8a' }}>
                        ({teacherName})
                      </p>
                    )}
                    <p className="text-[7px] font-semibold leading-tight" style={{ color: '#64748b' }}>SIGNATURE & DATE</p>
                  </div>
                </div>

                {/* Official Seal / Stamp (Guarded by showStamp toggle) */}
                <div
                  className="shrink-0 flex items-center justify-center -mb-0.5 overflow-hidden marksheet-stamp-box"
                  style={{ width: isVeryDense ? '58px' : '66px', height: isVeryDense ? '58px' : '66px' }}
                >
                  {showStamp && school.principalStampUrl ? (
                    <img
                      src={school.principalStampUrl}
                      alt="School Seal"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                      className="marksheet-stamp-img max-w-full max-h-full object-contain opacity-90"
                    />
                  ) : (
                    <div
                      className="w-13 h-13 rounded-full flex flex-col items-center justify-center p-0.5 text-center"
                      style={{ border: '1.5px dashed rgba(15,43,72,0.5)', backgroundColor: '#f8fafc' }}
                    >
                      <span className="text-[6.5px] font-bold uppercase tracking-tight leading-tight" style={{ color: 'rgba(15,43,72,0.8)' }}>
                        ACADEMIC SEAL
                      </span>
                      <span className="text-[5.5px] font-bold uppercase leading-none mt-0.5" style={{ color: '#64748b' }}>
                        OFFICIAL STAMP
                      </span>
                    </div>
                  )}
                </div>

                {/* Principal Signature */}
                <div className="text-center w-36 flex flex-col items-center">
                  <div className={`${isVeryDense ? 'h-6 mb-0.5' : 'h-7 mb-0.5'} flex items-end justify-center w-full`}>
                    {school.principalSignatureUrl && (
                      <img
                        src={school.principalSignatureUrl}
                        alt="Principal Signature"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        style={{ maxHeight: isVeryDense ? '24px' : '30px', maxWidth: '130px', objectFit: 'contain', display: 'block' }}
                        className="marksheet-sig-img max-h-7 object-contain"
                      />
                    )}
                  </div>
                  <div className="w-full pt-0.5" style={{ borderTop: '1px solid #0f2b48' }}>
                    <p className="font-sarkari-serif text-[9.5px] font-bold uppercase tracking-wider leading-tight" style={{ color: '#0f2b48' }}>
                      PRINCIPAL
                    </p>
                    <p className="text-[7px] font-semibold leading-tight" style={{ color: '#64748b' }}>SIGNATURE & SEAL</p>
                  </div>
                </div>
              </div>
            )}

            {/* BOTTOM FOOTER BAR */}
            <div
              className="mt-0.5 pt-0.5 flex justify-between items-center text-[7.5px] font-bold px-1"
              style={{ borderTop: '1px solid #0f2b48', color: '#334155', backgroundColor: '#ffffff' }}
            >
              <div>
                <span>DATE: </span>
                <span style={{ color: '#0f172a' }}>{generatedAt}</span>
              </div>
              <div className="tracking-wide font-bold uppercase" style={{ color: '#0f2b48' }}>
                {school.footerText && !/[\u0900-\u097F]/.test(school.footerText)
                  ? school.footerText
                  : '★ DISCIPLINE • DEDICATION • KNOWLEDGE • SUCCESS ★'}
              </div>
              <div>
                <span>SESSION: </span>
                <span style={{ color: '#0f172a' }}>{student.session || school.session}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
