import React, { useState, useEffect } from 'react';
import { StudentResultData } from '../types';
import { AcademicMarksheet } from './AcademicMarksheet';
import { downloadMarksheetPdf, downloadMarksheetImage, printMarksheet } from '../utils/pdfGenerator';
import { isSettingEnabled } from '../utils/calculations';
import { Printer, Download, ArrowLeft, ZoomIn, ZoomOut, RotateCcw, CheckCircle2, Image, Layers } from 'lucide-react';

interface ResultViewerProps {
  resultData: StudentResultData;
  onBackToSearch: () => void;
  onBackToAdmin?: () => void;
  openedFromAdmin?: boolean;
  onOpenAdminMarks?: (studentId: string) => void;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({
  resultData,
  onBackToSearch,
  onBackToAdmin,
  openedFromAdmin = false,
}) => {
  const calculateAutoZoom = () => {
    if (typeof window === 'undefined') return 1;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const availableWidth = screenWidth - (screenWidth < 640 ? 16 : 40);
    const availableHeight = screenHeight - (screenWidth < 640 ? 120 : 90);
    const zoomW = availableWidth / 794;
    const zoomH = availableHeight / 1060;
    const fitZoom = Number(Math.min(zoomW, zoomH, 1).toFixed(2));
    return Math.min(1, Math.max(0.35, fitZoom));
  };

  const [zoomLevel, setZoomLevel] = useState<number>(() => calculateAutoZoom());
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const allowHalfYearly = isSettingEnabled(resultData.school.showHalfYearlyExam, true);
  const allowAnnual = isSettingEnabled(resultData.school.showAnnualExam, true);

  const initialMode: 'half_yearly_only' | 'annual_only' | 'combined' = 
    !allowAnnual ? 'half_yearly_only' :
    !allowHalfYearly ? 'annual_only' :
    (resultData.examMode || (resultData.school as any).examMode || 'combined');

  const [activeExamMode, setActiveExamMode] = useState<'half_yearly_only' | 'annual_only' | 'combined'>(initialMode);

  useEffect(() => {
    if (!allowAnnual && activeExamMode !== 'half_yearly_only') {
      setActiveExamMode('half_yearly_only');
    } else if (!allowHalfYearly && activeExamMode !== 'annual_only') {
      setActiveExamMode('annual_only');
    }
  }, [allowAnnual, allowHalfYearly]);

  // Adjust zoom on screen resize if on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 880) {
        setZoomLevel(calculateAutoZoom());
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setExportProgress('Starting PDF generation...');

    try {
      const modePrefix = activeExamMode === 'half_yearly_only' ? 'HalfYearly' : activeExamMode === 'annual_only' ? 'Annual' : 'Final';
      const cleanStudentName = (resultData.student.name || 'Student').replace(/\s+/g, '_');
      const fileName = `${cleanStudentName}_${modePrefix}_Result_Roll_${resultData.student.rollNo}`;

      const success = await downloadMarksheetPdf('printable-marksheet', {
        fileName,
        onProgress: (status) => setExportProgress(status),
      });

      if (success) {
        setTimeout(() => {
          setIsExporting(false);
          setExportProgress(null);
        }, 1200);
      } else {
        setIsExporting(false);
        setExportProgress(null);
        setErrorMessage('PDF generate नहीं हो सका। कृपया "PRINT" बटन दबाकर "Save as PDF" चुनें।');
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } catch (err: any) {
      console.error('PDF error in viewer:', err);
      setIsExporting(false);
      setExportProgress(null);
      setErrorMessage(err?.message || 'PDF export में त्रुटि आई। कृपया "PRINT" बटन का उपयोग करें।');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleDownloadImage = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setExportProgress('Generating HD Image (PNG)...');

    try {
      const modePrefix = activeExamMode === 'half_yearly_only' ? 'HalfYearly' : activeExamMode === 'annual_only' ? 'Annual' : 'Final';
      const cleanStudentName = (resultData.student.name || 'Student').replace(/\s+/g, '_');
      const fileName = `${cleanStudentName}_${modePrefix}_Roll_${resultData.student.rollNo}`;

      const success = await downloadMarksheetImage('printable-marksheet', {
        fileName,
        onProgress: (status) => setExportProgress(status),
      });

      if (success) {
        setTimeout(() => {
          setIsExporting(false);
          setExportProgress(null);
        }, 1000);
      } else {
        setIsExporting(false);
        setExportProgress(null);
        setErrorMessage('Image download नहीं हो सका। कृपया PRINT या PDF विकल्प का उपयोग करें।');
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } catch (err: any) {
      console.error('Image error in viewer:', err);
      setIsExporting(false);
      setExportProgress(null);
      setErrorMessage(err?.message || 'Image download में त्रुटि आई। कृपया "PRINT" बटन का उपयोग करें।');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handlePrint = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setExportProgress('Preparing A4 print document (प्रिंट तैयार हो रहा है)...');

    try {
      const modePrefix = activeExamMode === 'half_yearly_only' ? 'HalfYearly' : activeExamMode === 'annual_only' ? 'Annual' : 'Final';
      const cleanStudentName = (resultData.student.name || 'Student').replace(/\s+/g, '_');
      const fileName = `${cleanStudentName}_${modePrefix}_Roll_${resultData.student.rollNo}_A4`;

      const res = await printMarksheet('printable-marksheet', {
        fileName,
        onProgress: (status) => setExportProgress(status),
      });

      if (res.success) {
        if (res.method === 'pdf_download') {
          setExportProgress('A4 PDF downloaded for direct printing!');
        } else {
          setExportProgress('Print dialog opened!');
        }
        setTimeout(() => {
          setIsExporting(false);
          setExportProgress(null);
        }, 1500);
      } else {
        setIsExporting(false);
        setExportProgress(null);
        setErrorMessage('प्रिंट शुरू नहीं हो सका। कृपया PDF बटन का उपयोग करके डाउनलोड करें।');
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } catch (err: any) {
      console.error('Print error:', err);
      setIsExporting(false);
      setExportProgress(null);
      setErrorMessage('प्रिंट में त्रुटि आई। कृपया PDF बटन का उपयोग करके डाउनलोड करें।');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col">
      {/* Top Floating Action Bar (Hidden on Print) */}
      <nav className="no-print sticky top-0 z-30 bg-[#0f2b48] text-white px-2.5 sm:px-4 py-2 shadow-md flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#b8860b]">
        {/* Left: Back Button & Student Info */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {openedFromAdmin ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onBackToAdmin || onBackToSearch}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="वापस एडमिन पैनल पर जाएं"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>वापस एडमिन पैनल (Back to Admin)</span>
              </button>
              <button
                onClick={onBackToSearch}
                className="hidden md:flex px-2 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded text-xs font-semibold transition-all items-center gap-1 cursor-pointer"
                title="छात्र खोज पोर्टल (Public Portal)"
              >
                <span>छात्र पोर्टल</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onBackToSearch}
              className="px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Back to Student Search / वापस खोज पृष्ठ"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>BACK / वापस</span>
            </button>
          )}
          <div className="hidden sm:block text-xs font-bold text-slate-300 border-l border-white/20 pl-2.5">
            <span>Student: </span>
            <span className="text-white uppercase truncate max-w-[140px] inline-block align-bottom">{resultData.student.name}</span>
            <span className="ml-1.5 text-[#ffd54f]">Roll: {resultData.student.rollNo}</span>
          </div>
        </div>

        {/* Center: Result Exam Mode Switcher (Based on school toggles) */}
        <div className="flex items-center order-3 sm:order-2 w-full sm:w-auto justify-center">
          {allowHalfYearly && allowAnnual ? (
            <div className="flex items-center bg-black/30 p-0.5 sm:p-1 rounded-lg border border-white/15">
              <button
                onClick={() => setActiveExamMode('half_yearly_only')}
                className={`px-2.5 sm:px-3 py-1 rounded text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activeExamMode === 'half_yearly_only'
                    ? 'bg-amber-400 text-slate-900 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Show only Half-Yearly marksheet (no annual data)"
              >
                <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Half-Yearly</span>
              </button>
              <button
                onClick={() => setActiveExamMode('combined')}
                className={`px-2.5 sm:px-3 py-1 rounded text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activeExamMode === 'combined'
                    ? 'bg-amber-400 text-slate-900 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Show combined Half-Yearly + Annual marksheet"
              >
                <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Combined</span>
              </button>
            </div>
          ) : allowHalfYearly ? (
            <div className="px-2.5 py-1 bg-amber-400/90 text-slate-950 font-bold text-xs rounded-md shadow-xs flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Half-Yearly Examination</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 bg-emerald-400/90 text-slate-950 font-bold text-xs rounded-md shadow-xs flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Annual Examination</span>
            </div>
          )}
        </div>

        {/* Right: Actions (Zoom, Print, Download PDF, Download PNG) */}
        <div className="flex items-center gap-1.5 sm:gap-2 order-2 sm:order-3">
          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-black/25 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-white/10 text-xs font-semibold">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.3, Number((z - 0.05).toFixed(2))))}
              className="p-1 hover:bg-white/15 rounded text-slate-200 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
            <span className="w-9 sm:w-11 text-center text-[10px] sm:text-xs font-bold text-amber-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.4, Number((z + 0.05).toFixed(2))))}
              className="p-1 hover:bg-white/15 rounded text-slate-200 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(calculateAutoZoom())}
              className="p-1 hover:bg-white/15 rounded text-slate-400 hover:text-white cursor-pointer"
              title="Fit to screen"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {isSettingEnabled(resultData.school.showPrintButton, true) && (
            <button
              onClick={handlePrint}
              className="px-2.5 sm:px-3 py-1.5 bg-white hover:bg-slate-100 text-[#0f2b48] rounded text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              title="Print directly or save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-[#0f2b48]" />
              <span className="hidden xs:inline">PRINT</span>
            </button>
          )}

          {isSettingEnabled(resultData.school.showImageButton, true) && (
            <button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-400 text-white rounded text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              title="Download HD Image file (PNG)"
            >
              <Image className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden xs:inline">IMAGE</span>
            </button>
          )}

          {isSettingEnabled(resultData.school.showPdfButton, true) && (
            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="px-3 sm:px-3.5 py-1.5 bg-[#b8860b] hover:bg-[#996515] disabled:bg-slate-400 text-white rounded text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
              title="Download formatted A4 PDF"
            >
              {isExporting ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span className="text-[11px] sm:text-xs">DOWNLOADING...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span className="text-[11px] sm:text-xs">PDF</span>
                </>
              )}
            </button>
          )}
        </div>
      </nav>

      {/* Export progress toast if active */}
      {exportProgress && (
        <div className="no-print fixed bottom-4 right-4 z-50 bg-[#0f2b48] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xl border border-amber-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>{exportProgress}</span>
        </div>
      )}

      {/* Error message toast if active */}
      {errorMessage && (
        <div className="no-print fixed bottom-4 right-4 z-50 bg-rose-900 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xl border border-rose-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Container - Scalable A4 Preview Canvas */}
      <div className="flex-1 overflow-x-auto overflow-y-auto py-4 sm:py-6 px-1 sm:px-4 flex justify-center items-start">
        <div
          style={{
            width: `${Math.round(794 * zoomLevel)}px`,
            height: `${Math.round(1060 * zoomLevel)}px`,
            position: 'relative',
            flexShrink: 0,
            margin: '0 auto',
          }}
        >
          <div
            className="marksheet-print-container shadow-2xl origin-top-left"
            style={{
              width: '794px',
              height: '1060px',
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top left',
            }}
          >
            <AcademicMarksheet
              data={resultData}
              id="printable-marksheet"
              examMode={activeExamMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
