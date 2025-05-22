const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function generateCertificate({ studentName, eventTitle, certificatePath }) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margin: 50
        });

        const stream = fs.createWriteStream(certificatePath);
        doc.pipe(stream);

        // Background color
        doc.rect(0, 0, doc.page.width, doc.page.height)
            .fill('#f8f9fa');

        // Border
        doc.save()
            .lineWidth(8)
            .strokeColor('#007bff')
            .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
            .stroke()
            .restore();

        // Logo (optional)
        const logoPath = path.join(__dirname, '../../assets/logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, doc.page.width / 2 - 60, 60, { width: 120 });
        }

        // Title
        doc.font('Helvetica-Bold')
            .fontSize(38)
            .fillColor('#343a40')
            .text('Certificate of Participation', {
                align: 'center',
                valign: 'center'
            });

        // Subtitle
        doc.moveDown(1);
        doc.font('Helvetica')
            .fontSize(20)
            .fillColor('#495057')
            .text('This is to certify that', {
                align: 'center'
            });

        // Student Name
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold')
            .fontSize(32)
            .fillColor('#007bff')
            .text(studentName, {
                align: 'center'
            });

        // Event Title
        doc.moveDown(0.5);
        doc.font('Helvetica')
            .fontSize(20)
            .fillColor('#495057')
            .text(`has participated in "${eventTitle}"`, {
                align: 'center'
            });

        // Date
        doc.moveDown(2);
        doc.font('Helvetica')
            .fontSize(16)
            .fillColor('#343a40')
            .text(`Date: ${new Date().toLocaleDateString()}`, {
                align: 'center'
            });

        // Signature line
        doc.moveDown(3);
        doc.font('Helvetica')
            .fontSize(16)
            .fillColor('#343a40')
            .text('_________________________', {
                align: 'right',
                continued: true
            })
            .text('\nSignature', {
                align: 'right'
            });

        doc.end();

        stream.on('finish', resolve);
        stream.on('error', reject);
    });
}

module.exports = { generateCertificate };