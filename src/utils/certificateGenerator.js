const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper to format date as "Month Day, Year"
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function generateCertificate({ studentName, eventTitle, eventStartDate, eventEndDate, certificatePath }) {
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
            .strokeColor('#679436')
            .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
            .stroke()
            .restore();

        // Two Logos (left and right)
        const logo1Path = path.join(__dirname, '../assets/GC-Logo.png');
        const logo2Path = path.join(__dirname, '../assets/OSWS.png');
        const logoWidth = 100;
        const logoY = 40;
        if (fs.existsSync(logo1Path)) {
            doc.image(logo1Path, 40, logoY, { width: logoWidth });
        }
        if (fs.existsSync(logo2Path)) {
            doc.image(logo2Path, doc.page.width - logoWidth - 40, logoY, { width: logoWidth });
        }

        // Header Texts (centered between logos)
        let headerY = logoY + 10;
        doc.font('Helvetica-Bold')
            .fontSize(22)
            .fillColor('#2d3748')
            .text('GORDON COLLEGE', 0, headerY, {
                width: doc.page.width,
                align: 'center'
            });
        headerY += 28;
        doc.font('Helvetica')
            .fontSize(16)
            .fillColor('#2d3748')
            .text('Office of Student Welfare and Services', 0, headerY, {
                width: doc.page.width,
                align: 'center'
            });
        headerY += 22;
        doc.font('Helvetica-Oblique')
            .fontSize(16)
            .fillColor('#2d3748')
            .text('GC-ORGANIZE', 0, headerY, {
                width: doc.page.width,
                align: 'center'
            });

        // Move down to start certificate body
        let bodyY = headerY + 50;

        // Certificate Title
        doc.font('Helvetica-Bold')
            .fontSize(40)
            .fillColor('#2d3748')
            .text('Certificate of Participation', 0, bodyY, {
                width: doc.page.width,
                align: 'center'
            });

        // Subtitle
        bodyY += 60;
        doc.font('Helvetica')
            .fontSize(22)
            .fillColor('#495057')
            .text('This is to certify that', 0, bodyY, {
                width: doc.page.width,
                align: 'center'
            });

        // Student Name
        bodyY += 40;
        doc.font('Helvetica-Bold')
            .fontSize(32)
            .fillColor('#679436')
            .text(studentName, 0, bodyY, {
                width: doc.page.width,
                align: 'center'
            });

        // Event Title
        bodyY += 40;
        doc.font('Helvetica')
            .fontSize(20)
            .fillColor('#495057')
            .text('has participated in', 0, bodyY, {
                width: doc.page.width,
                align: 'center'
            });
        bodyY += 30;
        doc.font('Helvetica-Bold')
            .fontSize(24)
            .fillColor('#2d3748')
            .text(`"${eventTitle}"`, 0, bodyY, {
                width: doc.page.width,
                align: 'center'
            });

        // Format event date(s)
        let eventDateText = '';
        if (eventStartDate && eventEndDate) {
            const formattedStart = formatDate(eventStartDate);
            const formattedEnd = formatDate(eventEndDate);
            eventDateText = (formattedStart === formattedEnd)
                ? formattedStart
                : `${formattedStart} - ${formattedEnd}`;
        } else if (eventStartDate) {
            eventDateText = formatDate(eventStartDate);
        } else if (eventEndDate) {
            eventDateText = formatDate(eventEndDate);
        } else {
            eventDateText = '';
        }

        // Date (event date)
        bodyY += 60;
        doc.font('Helvetica')
            .fontSize(16)
            .fillColor('#343a40')
            .text(eventDateText ? `Date: ${eventDateText}` : '', 0, bodyY, {
                width: doc.page.width,
                align: 'center'
            });

        // Signature line (centered at the bottom)
        const signatureY = doc.page.height - 120;
        doc.font('Helvetica')
            .fontSize(16)
            .fillColor('#343a40')
            .text('_________________________', 0, signatureY, {
                width: doc.page.width,
                align: 'center'
            })
            .text('Signature', 0, signatureY + 20, {
                width: doc.page.width,
                align: 'center'
            });

        doc.end();

        stream.on('finish', resolve);
        stream.on('error', reject);
    });
}

module.exports = { generateCertificate };