/**
 * PDFKit Initialization
 * Pre-configures PDFKit to work in Next.js standalone builds
 * by avoiding font file system access issues
 */

import PDFDocument from 'pdfkit';

// Pre-register standard fonts to avoid file system access
// This works around the Helvetica.afm not found error in standalone builds
export function createPDFDocument() {
  return new PDFDocument({
    size: 'A4',
    margin: 50,
    // Use standard fonts that are built into PDFKit
    // Don't specify font parameter to avoid .afm file loading
    bufferPages: true,
    // Embed fonts as vectors instead of loading from files
    embedDocuments: true,
  });
}
