const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
// Note: no custom font registration; rely on default fonts (e.g., Arial)

// Track which font families we successfully registered, to avoid Pango warnings
const AVAILABLE_FONTS = new Set(['Arial', 'Sans', 'Serif', 'Times New Roman', 'Georgia']);

// Build a safe font string, replacing unavailable custom families with system fallbacks
function safeFont(fontStr) {
    if (!fontStr || typeof fontStr !== 'string') return fontStr;
    // Rough CSS font parser: [style]? [variant]? [weight]? <size>px <family[, fallback]*>
    const m = fontStr.match(/^\s*((?:italic|oblique)\s+)?((?:small-caps)\s+)?((?:bold|bolder|lighter|\d{3})\s+)?(\d+)px\s+(.+)$/i);
    if (!m) return fontStr; // leave unchanged if unexpected format
    const [, style = '', variant = '', weight = '', sizePx, familiesStr] = m;
    // Extract first family name
    const primary = String(familiesStr).split(',')[0].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    const famLower = primary.toLowerCase();
    const isAvailable = AVAILABLE_FONTS.has(primary);
    if (isAvailable) return fontStr;

    // Map known custom families to safe system fonts to avoid Pango warnings
    let fallbackFamily = null;
    if (famLower === 'lora') {
        fallbackFamily = 'Georgia'; // serif-like
    } else if (famLower === 'great vibes') {
        fallbackFamily = 'Arial'; // generic, widely installed
    }
    // If we don't recognize it, keep as-is (could be a system font like Segoe UI)
    if (!fallbackFamily) return fontStr;

    const rebuilt = `${style || ''}${variant || ''}${weight || ''}${sizePx}px ${fallbackFamily}`.replace(/\s+/g, ' ').trim();
    return rebuilt;
}

// Remote Google Fonts loader (downloads once and registers with node-canvas)
let FONTS_READY = false;
async function ensureRemoteFonts() {
    if (FONTS_READY) return;
    // Only attempt if explicitly enabled (default true for our sample script)
    const enabled = process.env.USE_REMOTE_FONTS
        ? (process.env.USE_REMOTE_FONTS || '').toLowerCase() === 'true'
        : true; // default ON
    if (!enabled) return;

    const debug = (process.env.DEBUG_FONTS || '').toLowerCase() === 'true';
    const cacheDir = path.join(os.tmpdir(), 'gcorg_fonts_cache');
    const fonts = [
        {
            family: 'Great Vibes',
            // Source: official Google Fonts repo (TTF). Using raw URL for online fetch.
            url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf',
            file: path.join(cacheDir, 'GreatVibes-Regular.ttf')
        },
        {
            family: 'Lora',
            url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora-Regular.ttf',
            file: path.join(cacheDir, 'Lora-Regular.ttf')
        },
        {
            family: 'Lora',
            url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora-Bold.ttf',
            file: path.join(cacheDir, 'Lora-Bold.ttf'),
            weight: 'bold'
        },
        {
            family: 'Lora',
            url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora-Italic.ttf',
            file: path.join(cacheDir, 'Lora-Italic.ttf'),
            style: 'italic'
        },
        {
            family: 'Lora',
            url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora-BoldItalic.ttf',
            file: path.join(cacheDir, 'Lora-BoldItalic.ttf'),
            style: 'italic',
            weight: 'bold'
        }
    ];

    // Helper to download a file if missing
    const downloadIfNeeded = (url, file) => new Promise((resolve) => {
        if (fs.existsSync(file) && fs.statSync(file).size > 0) return resolve(true);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const fileStream = fs.createWriteStream(file);
        if (debug) console.log('[fonts] downloading', url);
        const req = https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Handle redirect
                if (debug) console.log('[fonts] redirect to', res.headers.location);
                https.get(res.headers.location, (res2) => res2.pipe(fileStream));
            } else if (res.statusCode === 200) {
                res.pipe(fileStream);
            } else {
                if (debug) console.warn('[fonts] download failed with status', res.statusCode, url);
                fileStream.close(() => resolve(false));
                return;
            }
            fileStream.on('finish', () => fileStream.close(() => resolve(true)));
        });
        req.on('error', (err) => {
            if (debug) console.warn('[fonts] request error', err.message);
            try { fileStream.close(); } catch {}
            try { fs.unlinkSync(file); } catch {}
            resolve(false);
        });
    });

    for (const f of fonts) {
        try {
            const ok = await downloadIfNeeded(f.url, f.file);
            if (ok) {
                const reg = { family: f.family };
                if (f.weight) reg.weight = f.weight;
                if (f.style) reg.style = f.style;
                registerFont(f.file, reg);
                AVAILABLE_FONTS.add(f.family);
                if (debug) console.log('[fonts] registered', f.family);
            } else if (debug) {
                console.warn('[fonts] skip register (download failed):', f.family);
            }
        } catch (e) {
            if (debug) console.warn('[fonts] failed to setup', f.family, e.message);
        }
    }
    FONTS_READY = true;
}

// Helper to format date as "Month Day, Year"
function formatDate(dateStr) {
    if (!dateStr) return '';
    // Parse as local date
    const [year, month, day] = String(dateStr).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Helper to format date as "27th of June 2025"
function formatDateOrdinal(dateStr) {
    if (!dateStr) return '';
    // Parse as local date
    const [year, month, day] = String(dateStr).split('-').map(Number);
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return String(dateStr);
    const dayNum = d.getDate();
    const monthName = d.toLocaleDateString('en-US', { month: 'long' });
    const yearNum = d.getFullYear();
    const j = dayNum % 10, k = dayNum % 100;
    let suffix = 'th';
    if (j === 1 && k !== 11) suffix = 'st';
    else if (j === 2 && k !== 12) suffix = 'nd';
    else if (j === 3 && k !== 13) suffix = 'rd';
    return `${dayNum}${suffix} of ${monthName} ${yearNum}`;
}

// Helper: wrap text within a max width and draw centered (or given align)
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, align = 'center') {
    if (!text) return y;
    const words = String(text).split(/\s+/);
    let line = '';
    const lines = [];
    for (let n = 0; n < words.length; n++) {
        const testLine = line ? line + ' ' + words[n] : words[n];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n];
        } else {
            line = testLine;
        }
    }
    if (line) lines.push(line);

    const prevAlign = ctx.textAlign;
    ctx.textAlign = align;
    for (const ln of lines) {
        ctx.fillText(ln, x, y);
        y += lineHeight;
    }
    ctx.textAlign = prevAlign;
    return y;
}

// Helper: rich text (mixed bold/normal) with wrapping and alignment
// segments: [{ text: string, bold?: boolean }]
function drawRichTextWrapped(ctx, segments, x, y, maxWidth, lineHeight, align = 'center', normalFont = '24px Lora') {
    if (!segments || !segments.length) return y;
    // Derive a bold font from the provided normal font
    const boldFont = makeBoldFont(normalFont);

    // First pass: build lines and measure widths
    const lines = [];
    let currentLine = [];
    let currentWidth = 0;

    const measure = (text, isBold) => {
        ctx.font = safeFont(isBold ? boldFont : normalFont);
        return ctx.measureText(text).width;
    };

    // Tokenize segments into words, preserving spaces between words
    const tokens = [];
    for (const seg of segments) {
        const words = String(seg.text).split(/\s+/);
        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            if (w.length > 0) tokens.push({ text: w, bold: !!seg.bold, isSpace: false });
            if (i < words.length - 1) tokens.push({ text: ' ', bold: !!seg.bold, isSpace: true });
        }
    }

    for (const tok of tokens) {
        const tokenText = tok.text;
        const tokenWidth = measure(tokenText, tok.bold);
        const isSpace = tok.isSpace === true;

        // Avoid leading spaces on a new line
        const wouldOverflow = currentWidth + tokenWidth > maxWidth && currentLine.length > 0 && !isSpace;
        if (wouldOverflow) {
            lines.push({ runs: currentLine, width: currentWidth });
            currentLine = [];
            currentWidth = 0;
            if (isSpace) continue; // skip leading space at the beginning of new line
        }
        // If it's a leading space and line is empty, skip
        if (isSpace && currentLine.length === 0) continue;

        currentLine.push({ text: tokenText, bold: tok.bold });
        currentWidth += tokenWidth;
    }
    if (currentLine.length) lines.push({ runs: currentLine, width: currentWidth });

    // Second pass: draw each line with requested alignment
    const prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';

    for (const line of lines) {
        let startX = x;
        if (align === 'center') startX = x - line.width / 2;
        else if (align === 'right') startX = x - line.width;
        let cx = startX;
        for (const run of line.runs) {
            ctx.font = safeFont(run.bold ? boldFont : normalFont);
            ctx.fillText(run.text, cx, y);
            cx += measure(run.text, run.bold);
        }
        y += lineHeight;
    }
    ctx.textAlign = prevAlign;
    return y;
}

// Build a bold variant of a CSS font shorthand while keeping the correct order
function makeBoldFont(fontStr) {
    if (!fontStr) return 'bold 16px Arial';
    if (/\b(bold|[1-9]00)\b/i.test(fontStr)) return fontStr; // already bold or numeric weight
    const m = fontStr.match(/^\s*((?:italic|oblique)\s+)?((?:small-caps)\s+)?(?:(?:bold|bolder|lighter|\d{3})\s+)?(\d+px\s+.+)$/i);
    if (m) {
        const [, style = '', variant = '', rest] = m;
        return `${style || ''}${variant || ''}bold ${rest}`.replace(/\s+/g, ' ').trim();
    }
    return `bold ${fontStr}`;
}

// Custom font registration now uses online fonts (Great Vibes, Merriweather) when enabled

async function generateCertificate({ studentName, eventTitle, eventStartDate, eventEndDate, eventLocation, certificatePath }) {
    try {
    // Load and register remote fonts if enabled
    await ensureRemoteFonts();
        // Create canvas with A4 landscape dimensions (at 150 DPI for good quality)
        const width = 1240; // A4 landscape width at 150 DPI
        const height = 877;  // A4 landscape height at 150 DPI
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        // Try to use the OSWS e-cert template if available
        const templatePath = path.join(__dirname, '../assets/osws_e-cert.png');
        const layoutPath = path.join(__dirname, '../assets/osws_e-cert.layout.json');
        const hasTemplate = fs.existsSync(templatePath);
        const hasLayout = fs.existsSync(layoutPath);
        let layoutCfg = {};
        if (hasLayout) {
            try {
                const raw = fs.readFileSync(layoutPath, 'utf8');
                layoutCfg = JSON.parse(raw) || {};
            } catch (e) {
                console.warn('Failed to load layout JSON, using defaults:', e.message);
            }
        }

        if (hasTemplate) {
            // Draw template as full-background image (cover, keep aspect ratio)
            const templateImg = await loadImage(templatePath);
            const scale = Math.max(width / templateImg.width, height / templateImg.height);
            const drawW = templateImg.width * scale;
            const drawH = templateImg.height * scale;
            const offsetX = (width - drawW) / 2;
            const offsetY = (height - drawH) / 2;
            ctx.drawImage(templateImg, offsetX, offsetY, drawW, drawH);

            // Overlay dynamic fields at positions aligned to the template design
            // Name (prominent, centered by default; override via layout)
            const nameCfg = Object.assign({
                x: width / 2,
                y: 395, // nudged more upward to avoid descenders overlapping the line
                font: '72px Great Vibes',
                color: '#0f2632',
                maxWidth: width - 240,
                lineHeight: 72,
                align: 'center'
            }, layoutCfg.name || {});
            ctx.fillStyle = nameCfg.color;
            ctx.font = safeFont(nameCfg.font);
            ctx.textAlign = nameCfg.align;
            const afterNameY = drawWrappedText(ctx, studentName, nameCfg.x, nameCfg.y, nameCfg.maxWidth, nameCfg.lineHeight, nameCfg.align);

            // Participation sentence below the name (overridable)
            // For the invaluable participation in the “{event_title}” held on {start_date}{ to end_date} at {event_location}.
            let eventDateText = '';
            if (eventStartDate && eventEndDate) {
                const s = formatDate(eventStartDate);
                const e = formatDate(eventEndDate);
                eventDateText = s === e ? s : `${s} to ${e}`;
            } else if (eventStartDate || eventEndDate) {
                eventDateText = formatDate(eventStartDate || eventEndDate);
            }
            const quotedTitle = `“${eventTitle}”`;
            const sentenceSegments = [
                { text: 'For the invaluable participation in the ' },
                { text: '“' },
                { text: eventTitle || '', bold: true },
                { text: '” held on ' },
                { text: eventDateText || '', bold: true },
            ];
            if (eventLocation) {
                sentenceSegments.push({ text: ' at ' });
                sentenceSegments.push({ text: eventLocation, bold: true });
            }
            sentenceSegments.push({ text: '.' });
            const sentenceCfg = Object.assign({
                x: width / 2,
                // default a bit below the name block
                y: afterNameY + 36,
                font: 'italic 24px Lora',
                color: '#1f2937',
                // add more side margins so text doesn't extend too far
                maxWidth: width - 560, // squeeze the sentence a little more
                lineHeight: 32,
                align: 'center'
            }, layoutCfg.sentence || {});
            ctx.fillStyle = sentenceCfg.color;
            ctx.textAlign = sentenceCfg.align;
            const afterSentenceY = drawRichTextWrapped(ctx, sentenceSegments, sentenceCfg.x, sentenceCfg.y, sentenceCfg.maxWidth, sentenceCfg.lineHeight, sentenceCfg.align, sentenceCfg.font);

            // Second sentence: "Given this {end_date_ordinal} at Gordon College, Olongapo City."
            const givenDate = eventEndDate || eventStartDate || '';
            const ordinalText = formatDateOrdinal(givenDate);
            if (ordinalText) {
                const sentence2Cfg = Object.assign({
                    x: sentenceCfg.x,
                    y: afterSentenceY + 28,
                    font: sentenceCfg.font || 'italic 24px Lora',
                    color: sentenceCfg.color || '#1f2937',
                    maxWidth: sentenceCfg.maxWidth,
                    lineHeight: sentenceCfg.lineHeight || 32,
                    align: sentenceCfg.align || 'center'
                }, layoutCfg.sentence2 || {});
                ctx.fillStyle = sentence2Cfg.color;
                ctx.textAlign = sentence2Cfg.align;
                const sentence2Segments = [
                    { text: 'Given this ' },
                    { text: ordinalText },
                    { text: ' at ' },
                    { text: 'Gordon College, Olongapo City' },
                    { text: '.' }
                ];
                drawRichTextWrapped(ctx, sentence2Segments, sentence2Cfg.x, sentence2Cfg.y, sentence2Cfg.maxWidth, sentence2Cfg.lineHeight, sentence2Cfg.align, sentence2Cfg.font);
            }
        } else {
            // Fallback to previous programmatic layout if template is missing
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
            ctx.font = safeFont('bold 28px Arial');
            ctx.textAlign = 'center';
            ctx.fillText('GORDON COLLEGE', width / 2, headerY);

            // Office of Student Welfare and Services
            headerY += 35;
            ctx.font = safeFont('20px Arial');
            ctx.fillText('Office of Student Welfare and Services', width / 2, headerY);

            // GC-ORGANIZE
            headerY += 28;
            ctx.font = safeFont('italic 20px Arial');
            ctx.fillText('GC-ORGANIZE', width / 2, headerY);

            // Certificate Title
            let bodyY = headerY + 70;
            ctx.font = safeFont('bold 50px Lora');
            ctx.fillStyle = '#2d3748';
            ctx.fillText('Certificate of Participation', width / 2, bodyY);

            // Subtitle
            bodyY += 80;
            ctx.font = safeFont('28px Lora');
            ctx.fillStyle = '#495057';
            ctx.fillText('This is to certify that', width / 2, bodyY);

            // Student Name
            bodyY += 50;
            ctx.font = safeFont('72px Great Vibes');
            ctx.fillStyle = '#679436';
            ctx.fillText(studentName, width / 2, bodyY);

            // Event participation text
            bodyY += 50;
            ctx.font = safeFont('25px Lora');
            ctx.fillStyle = '#495057';
            ctx.fillText('has participated in', width / 2, bodyY);

            // Event Title
            bodyY += 40;
            ctx.font = safeFont('bold 30px Lora');
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
                const normalFont = '20px Lora';
                ctx.fillStyle = '#343a40';
                drawRichTextWrapped(
                    ctx,
                    [
                        { text: 'Date: ' },
                        { text: eventDateText, bold: true },
                    ],
                    width / 2,
                    bodyY,
                    width - 200,
                    28,
                    'center',
                    normalFont
                );
            }

            // Location
            if (eventLocation) {
                bodyY += 40;
                const normalFont = '20px Lora';
                ctx.fillStyle = '#343a40';
                drawRichTextWrapped(
                    ctx,
                    [
                        { text: 'Location: ' },
                        { text: eventLocation, bold: true },
                    ],
                    width / 2,
                    bodyY,
                    width - 200,
                    28,
                    'center',
                    normalFont
                );
            }

            // Signature line
            const signatureY = height - 120;
            ctx.font = safeFont('20px Lora');
            ctx.fillStyle = '#343a40';
            ctx.fillText('_________________________', width / 2, signatureY);
            ctx.fillText('Signature', width / 2, signatureY + 30);
        }

        // Save the canvas as PNG
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(certificatePath, buffer);

        return Promise.resolve();
    } catch (error) {
        return Promise.reject(error);
    }
}

module.exports = { generateCertificate };