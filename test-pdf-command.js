/**
 * Test PDF Command Generation
 * Run: node test-pdf-command.js
 */

const PDFDocument = require('pdfkit');

// Helper: create PDF
function createPDFDocument() {
  return new PDFDocument({
    size: 'A4',
    margin: 50,
    bufferPages: true,
  });
}

// Test: Generate simple PDF
async function generateTestPDF() {
  return new Promise((resolve, reject) => {
    const doc = createPDFDocument();
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      console.log(`✅ PDF Generated: ${pdfBuffer.length} bytes`);
      console.log(`✅ Base64 size: ${pdfBuffer.toString('base64').length} chars`);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    // Add content
    doc.fontSize(24).text('Test PDF Document', { align: 'center' });
    doc.fontSize(14).text('This is a test PDF for AutoLumiku system.');
    doc.end();
  });
}

// Test PDF command
async function testPDFCommand() {
  console.log('=== PDF Command Test ===\n');

  try {
    // Generate PDF
    const pdfBuffer = await generateTestPDF();

    // Check buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error('❌ PDF buffer is empty!');
      return;
    }

    console.log('\n✅ PDF generation successful!');
    console.log(`📊 PDF size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

    // Encode to base64
    const base64 = pdfBuffer.toString('base64');
    console.log(`📦 Base64 size: ${base64.length} chars (${(base64.length / 1024).toFixed(2)} KB)`);

    // Test decode
    const decoded = Buffer.from(base64, 'base64');
    if (decoded.length !== pdfBuffer.length) {
      console.error('❌ Base64 encode/decode failed!');
    } else {
      console.log('✅ Base64 encode/decode verified!');
    }

    console.log('\n=== Test Complete ===');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testPDFCommand();
