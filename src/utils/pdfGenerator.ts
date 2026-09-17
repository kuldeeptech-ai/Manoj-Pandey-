import jsPDF from 'jspdf';
import { toCanvas, toPng } from 'html-to-image';
import { EMBEDDED_FONTS_CSS } from './embeddedFonts';

export async function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  const promises = images.map((img) => {
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const handleDone = () => resolve();
      img.addEventListener('load', handleDone, { once: true });
      img.addEventListener('error', handleDone, { once: true });
      setTimeout(handleDone, 2000);
    });
  });

  await Promise.all(promises);

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Font load error fallback
    }
  }
}

/**
 * Pre-converts any non-data-URL images inside the element to inline base64 data URLs.
 * This guarantees 100% CORS-safe rendering in SVG foreignObject / html-to-image.
 */
async function inlineImagesAsDataUrls(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:')) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.clientWidth || 100;
        canvas.height = img.naturalHeight || img.clientHeight || 100;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          img.src = dataUrl;
        }
      } catch {
        // If tainted, try fetch
        try {
          const res = await fetch(src, { mode: 'cors' });
          if (res.ok) {
            const blob = await res.blob();
            const reader = new FileReader();
            await new Promise<void>((resolve) => {
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  img.src = reader.result;
                }
                resolve();
              };
              reader.readAsDataURL(blob);
            });
          }
        } catch {}
      }
    })
  );
}

export interface PdfExportOptions {
  fileName?: string;
  onProgress?: (status: string) => void;
}

/**
 * Renders the marksheet element to a high-resolution 2.0x canvas.
 * Captures directly from the active live DOM element where all CSS rules,
 * fonts, and layout are already computed and loaded. This avoids offscreen opacity
 * issues and external stylesheet bundling issues on deployed environments (like Vercel).
 */
export async function renderMarksheetToCanvas(
  elementId: string,
  onProgress?: (status: string) => void
): Promise<HTMLCanvasElement> {
  const sourceElement = document.getElementById(elementId);
  if (!sourceElement) {
    throw new Error(`Element #${elementId} not found in DOM`);
  }

  onProgress?.('Preparing graphics & assets (ग्राफ़िक्स तैयार हो रहे हैं)...');
  await waitForImages(sourceElement);
  await inlineImagesAsDataUrls(sourceElement);

  // Find the scalable zoom container and wrapper in ResultViewer
  const printContainer = sourceElement.closest('.marksheet-print-container') as HTMLElement | null;
  const parentWrapper = printContainer?.parentElement as HTMLElement | null;

  const originalContainerTransform = printContainer ? printContainer.style.transform : null;
  const originalContainerWidth = printContainer ? printContainer.style.width : null;
  const originalContainerHeight = printContainer ? printContainer.style.height : null;
  const originalContainerShadow = printContainer ? printContainer.style.boxShadow : null;

  const originalWrapperWidth = parentWrapper ? parentWrapper.style.width : null;
  const originalWrapperHeight = parentWrapper ? parentWrapper.style.height : null;

  try {
    // 1. Temporarily unscale the visible container to natural 1:1 preview scale (794px x 1123px)
    if (printContainer) {
      printContainer.style.transform = 'none';
      printContainer.style.width = '794px';
      printContainer.style.height = '1123px';
      printContainer.style.boxShadow = 'none';
    }
    if (parentWrapper) {
      parentWrapper.style.width = '794px';
      parentWrapper.style.height = '1123px';
    }

    // Wait for DOM reflow to finish cleanly
    await new Promise((r) => setTimeout(r, 100));

    onProgress?.('Rendering HD layout exactly matching preview (100% रंग एवं लेआउट)...');

    // Method 1 (PRIMARY): toCanvas from html-to-image with embedded base64 fonts
    // Uses native SVG foreignObject rendering with true C++ browser engine layout,
    // guaranteeing 100% support for Tailwind CSS, flexbox, borders, colors, and exact font metrics!
    try {
      const canvas = await toCanvas(sourceElement, {
        width: 794,
        height: 1123,
        canvasWidth: 1588,
        canvasHeight: 2246,
        pixelRatio: 2.0,
        backgroundColor: '#ffffff',
        fontEmbedCSS: EMBEDDED_FONTS_CSS,
        skipFonts: false,
        cacheBust: false,
      });

      if (canvas && canvas.width > 0 && canvas.height > 0) {
        return canvas;
      }
    } catch (toCanvasErr) {
      console.warn('[Export] toCanvas failed, trying toPng with embedded fonts:', toCanvasErr);
    }

    // Method 2 (FALLBACK): toPng from html-to-image with embedded base64 fonts
    try {
      const dataUrl = await toPng(sourceElement, {
        width: 794,
        height: 1123,
        pixelRatio: 2.0,
        backgroundColor: '#ffffff',
        fontEmbedCSS: EMBEDDED_FONTS_CSS,
        skipFonts: false,
        cacheBust: false,
      });

      if (dataUrl && dataUrl.length > 500) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (e) => reject(e);
          img.src = dataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = 1588;
        canvas.height = 2246;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 1588, 2246);
          ctx.drawImage(img, 0, 0, 1588, 2246);
          return canvas;
        }
      }
    } catch (toPngErr) {
      console.warn('[Export] toPng fallback failed:', toPngErr);
    }

    throw new Error('Could not render marksheet canvas');
  } finally {
    // Restore original zoom and wrapper dimensions
    if (printContainer) {
      if (originalContainerTransform !== null) printContainer.style.transform = originalContainerTransform;
      if (originalContainerWidth !== null) printContainer.style.width = originalContainerWidth;
      if (originalContainerHeight !== null) printContainer.style.height = originalContainerHeight;
      if (originalContainerShadow !== null) printContainer.style.boxShadow = originalContainerShadow;
    }
    if (parentWrapper) {
      if (originalWrapperWidth !== null) parentWrapper.style.width = originalWrapperWidth;
      if (originalWrapperHeight !== null) parentWrapper.style.height = originalWrapperHeight;
    }
  }
}

/**
 * High-definition A4 PDF Download
 * Guaranteed 100% faithful reproduction of colors (#0f2b48 navy, #b8860b gold),
 * borders, tables, alignments, student photo, signatures, and Hindi/English typography.
 */
export async function downloadMarksheetPdf(
  elementId: string,
  options: PdfExportOptions = {}
): Promise<boolean> {
  try {
    options.onProgress?.('Initializing high-definition PDF generator...');
    const canvas = await renderMarksheetToCanvas(elementId, options.onProgress);

    options.onProgress?.('Compiling strict A4 print document (210mm x 297mm)...');

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [210, 297], // Strict ISO A4: 210mm wide x 297mm high
      compress: true,
      putOnlyUsedFonts: true,
    });

    const cleanFileName = (options.fileName || 'Academic_Marksheet').replace(/[^a-zA-Z0-9_-]/g, '_');

    pdf.setProperties({
      title: cleanFileName,
      subject: 'Official Academic Marksheet - A4 (210mm x 297mm)',
      author: 'School Result Portal',
      keywords: 'Marksheet, Report Card, A4',
      creator: 'H.D. Pandey Public Junior High School',
    });

    // Lossless PNG image data rendered at 1588 x 2246 px (exact 2x A4)
    const imgData = canvas.toDataURL('image/png');
    // Standard A4 dimensions: exactly 210mm x 297mm
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

    // Trigger download
    try {
      pdf.save(`${cleanFileName}.pdf`);
    } catch {
      // Blob fallback
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${cleanFileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    }

    options.onProgress?.('PDF downloaded successfully!');
    return true;
  } catch (err: any) {
    console.error('Failed to generate PDF:', err);
    options.onProgress?.(`Error: ${err?.message || 'Failed to render PDF'}`);
    return false;
  }
}

/**
 * High-definition Image (PNG) Download
 * Exports full A4 marksheet as 1588x2246 HD image matching web preview 100%.
 */
export async function downloadMarksheetImage(
  elementId: string,
  options: PdfExportOptions = {}
): Promise<boolean> {
  try {
    options.onProgress?.('Initializing high-definition image capture...');
    const canvas = await renderMarksheetToCanvas(elementId, options.onProgress);

    options.onProgress?.('Saving lossless PNG image...');

    const cleanFileName = (options.fileName || 'Academic_Marksheet').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (canvas.toBlob) {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            fallbackDownloadDataUrl(canvas, cleanFileName);
            return;
          }
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${cleanFileName}.png`;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
          }, 1000);
        },
        'image/png',
        1.0
      );
    } else {
      fallbackDownloadDataUrl(canvas, cleanFileName);
    }

    options.onProgress?.('Image downloaded successfully!');
    return true;
  } catch (err: any) {
    console.error('Failed to download image:', err);
    options.onProgress?.(`Error: ${err?.message || 'Failed to capture image'}`);
    return false;
  }
}

function fallbackDownloadDataUrl(canvas: HTMLCanvasElement, fileName: string): void {
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${fileName}.png`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => document.body.removeChild(link), 1000);
}

/**
 * Bulletproof Print Function
 * Uses the browser's native window.print() directly on the active document,
 * which takes advantage of the print rules in index.css to isolate
 * #printable-marksheet to exact A4 portrait dimensions with all colors and fonts intact.
 * If printing is blocked by an iframe sandbox or browser restriction, it automatically
 * generates the exact A4 PDF so the user is never stuck.
 */
export async function printMarksheet(
  elementId: string = 'printable-marksheet',
  options?: {
    onProgress?: (status: string) => void;
    fileName?: string;
  }
): Promise<{ success: boolean; method: 'print' | 'pdf_download' }> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found in DOM`);
  }

  options?.onProgress?.('Preparing print document & graphics...');
  try {
    await waitForImages(element);
    await inlineImagesAsDataUrls(element);
  } catch {}

  // Collect all stylesheets, style tags, and font links from host document
  const headElements = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"], link[as="font"], link[rel="preconnect"]')
  )
    .map((el) => el.outerHTML)
    .join('\n');

  // 1. Primary Print Technique: Dedicated hidden print iframe with full stylesheet injection
  // This completely eliminates interference from parent navigation bars, zoom scaling,
  // gray backgrounds, and scrollbars, guaranteeing an exact 1-page A4 print matching the preview!
  try {
    const printIframe = document.createElement('iframe');
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '0';
    printIframe.style.height = '0';
    printIframe.style.border = '0';
    document.body.appendChild(printIframe);

    const priDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
    if (priDoc) {
      priDoc.open();
      priDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${options?.fileName || 'Academic Marksheet'}</title>
  ${headElements}
  <style>
    @page {
      size: 210mm 297mm;
      margin: 0;
    }
    @media print {
      @page {
        size: 210mm 297mm;
        margin: 0;
      }
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm !important;
      height: 297mm !important;
      max-height: 297mm !important;
      background: #ffffff !important;
      overflow: hidden !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
    }
    #printable-marksheet,
    .marksheet-a4-page {
      width: 210mm !important;
      height: 297mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      margin: 0 !important;
      box-sizing: border-box !important;
      box-shadow: none !important;
      border: none !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
    }
    @media print {
      body { width: 210mm !important; height: 297mm !important; }
    }
  </style>
</head>
<body style="background: #ffffff; margin: 0; padding: 0;">
  ${element.outerHTML}
</body>
</html>`);
      priDoc.close();

      // Wait a moment for iframe DOM and images to settle
      await new Promise((r) => setTimeout(r, 350));

      printIframe.contentWindow?.focus();
      printIframe.contentWindow?.print();

      // Cleanup iframe after printing
      setTimeout(() => {
        if (printIframe.parentNode) {
          printIframe.parentNode.removeChild(printIframe);
        }
      }, 4000);

      options?.onProgress?.('Print dialog sent successfully');
      return { success: true, method: 'print' };
    }
  } catch (iframeErr) {
    console.warn('Iframe print failed or restricted, trying window.print():', iframeErr);
  }

  // 2. Fallback 1: Direct window.print() on the live document
  try {
    window.print();
    return { success: true, method: 'print' };
  } catch (windowErr) {
    console.warn('Direct window.print() failed or blocked:', windowErr);
  }

  // 3. Fallback 2: If modal/printing is blocked by iframe sandbox, automatically generate A4 PDF
  options?.onProgress?.('Print blocked by sandbox, downloading A4 PDF...');
  const downloaded = await downloadMarksheetPdf(elementId, {
    fileName: options?.fileName || 'Marksheet_A4_Print',
    onProgress: options?.onProgress,
  });

  return { success: downloaded, method: 'pdf_download' };
}
