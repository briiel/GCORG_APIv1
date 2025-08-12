const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// Helper to format date as "Month Day, Year"
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function generateCertificate({ studentName, eventTitle, eventStartDate, eventEndDate, certificatePath }) {
    try {
        // Create canvas with A4 landscape dimensions (at 150 DPI for good quality)
        const width = 1240; // A4 landscape width at 150 DPI
        const height = 877;  // A4 landscape height at 150 DPI
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background color
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);

        // Border
        ctx.strokeStyle = '#679436';
        ctx.lineWidth = 8;
        ctx.strokeRect(20, 20, width - 40, height - 40);

        // Load and draw logos
        try {
            const logo1Path = path.join(__dirname, '../assets/GC-Logo.png');
            const logo2Path = path.join(__dirname, '../assets/OSWS.png');
            const logoWidth = 100;
            const logoY = 40;

            if (fs.existsSync(logo1Path)) {
                const logo1 = await loadImage(logo1Path);
                ctx.drawImage(logo1, 40, logoY, logoWidth, logoWidth);
            }
            if (fs.existsSync(logo2Path)) {
                const logo2 = await loadImage(logo2Path);
                ctx.drawImage(logo2, width - logoWidth - 40, logoY, logoWidth, logoWidth);
            }
        } catch (logoError) {
            console.warn('Could not load logos:', logoError.message);
        }

        // Header Texts (centered between logos)
        let headerY = 70;
        
        // GORDON COLLEGE
        ctx.fillStyle = '#2d3748';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GORDON COLLEGE', width / 2, headerY);

        // Office of Student Welfare and Services
        headerY += 35;
        ctx.font = '20px Arial';
        ctx.fillText('Office of Student Welfare and Services', width / 2, headerY);

        // GC-ORGANIZE
        headerY += 28;
        ctx.font = 'italic 20px Arial';
        ctx.fillText('GC-ORGANIZE', width / 2, headerY);

        // Certificate Title
        let bodyY = headerY + 70;
        ctx.font = 'bold 50px Arial';
        ctx.fillStyle = '#2d3748';
        ctx.fillText('Certificate of Participation', width / 2, bodyY);

        // Subtitle
        bodyY += 80;
        ctx.font = '28px Arial';
        ctx.fillStyle = '#495057';
        ctx.fillText('This is to certify that', width / 2, bodyY);

        // Student Name
        bodyY += 50;
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#679436';
        ctx.fillText(studentName, width / 2, bodyY);

        // Event participation text
        bodyY += 50;
        ctx.font = '25px Arial';
        ctx.fillStyle = '#495057';
        ctx.fillText('has participated in', width / 2, bodyY);

        // Event Title
        bodyY += 40;
        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = '#2d3748';
        
        // Handle long event titles by wrapping text
        const maxWidth = width - 100;
        const eventTitleText = `"${eventTitle}"`;
        
        if (ctx.measureText(eventTitleText).width > maxWidth) {
            const words = eventTitleText.split(' ');
            let line = '';
            let lineHeight = 35;
            
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                
                if (testWidth > maxWidth && n > 0) {
                    ctx.fillText(line, width / 2, bodyY);
                    line = words[n] + ' ';
                    bodyY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, width / 2, bodyY);
        } else {
            ctx.fillText(eventTitleText, width / 2, bodyY);
        }

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
        }

        // Date
        if (eventDateText) {
            bodyY += 80;
            ctx.font = '20px Arial';
            ctx.fillStyle = '#343a40';
            ctx.fillText(`Date: ${eventDateText}`, width / 2, bodyY);
        }

        // Signature line
        const signatureY = height - 120;
        ctx.font = '20px Arial';
        ctx.fillStyle = '#343a40';
        ctx.fillText('_________________________', width / 2, signatureY);
        ctx.fillText('Signature', width / 2, signatureY + 30);

        // Save the canvas as PNG
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(certificatePath, buffer);

        return Promise.resolve();
    } catch (error) {
        return Promise.reject(error);
    }
}

module.exports = { generateCertificate };