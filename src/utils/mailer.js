// UNUSED — email (nodemailer) utility for registration confirmations, not integrated

/* COMMENTED OUT - Email functionality disabled

const nodemailer = require('nodemailer');
const path = require('path');

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const BRAND_PRIMARY_COLOR = process.env.BRAND_PRIMARY_COLOR || '#0d9488';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// Build branded HTML email body for a registration confirmation with optional QR attachment
function buildRegistrationHtml({ event = {}, student = {}, qrUrl }) {
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());
  const normalizeDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return isValidDate(value) ? value : null;
    if (typeof value === 'number') return isValidDate(new Date(value)) ? new Date(value) : null;
    if (typeof value === 'string') {
      const v = value.trim();
      const datePart = v.split('T')[0].split(' ')[0];
      const m = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (m) {
        const dt = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
        return isValidDate(dt) ? dt : null;
      }
      const dt2 = new Date(v);
      return isValidDate(dt2) ? dt2 : null;
    }
    return null;
  };
  const formatDateHuman = (value) => {
    const d = normalizeDate(value);
    if (!d) return 'TBA';
    return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };
  const normalizeTime = (value) => {
    if (!value) return null;
    if (value instanceof Date) return { h: value.getHours(), m: value.getMinutes() };
    if (typeof value === 'number') {
      const d = new Date(value);
      return isValidDate(d) ? { h: d.getHours(), m: d.getMinutes() } : null;
    }
    if (typeof value === 'string') {
      const v = value.trim();
      const parts = v.split(':');
      if (parts.length >= 2 && /^\d{1,2}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
        return { h: parseInt(parts[0], 10), m: parseInt(parts[1], 10) };
      }
      const d = new Date(v);
      if (isValidDate(d)) return { h: d.getHours(), m: d.getMinutes() };
    }
    return null;
  };
  const formatTime12h = (value) => {
    const t = normalizeTime(value);
    if (!t) return 'TBA';
    let hh = t.h;
    const mm = String(isNaN(t.m) ? 0 : t.m).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    return `${hh}:${mm} ${ampm}`;
  };
  const { title = 'Event', location = 'TBA', start_date = '', start_time = '', end_date = '', end_time = '' } = event || {};
  const { first_name = '', last_name = '' } = student || {};
  const studentName = [first_name, last_name].filter(Boolean).join(' ').trim() || 'Participant';
  const logoCid = 'gc-logo';
  const qrCid = 'qr-code';
  const startPretty = `${formatDateHuman(start_date)} · ${formatTime12h(start_time)}`;
  const endPretty = `${formatDateHuman(end_date)} · ${formatTime12h(end_time)}`;
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  const hm = (t) => { const tt = normalizeTime(t) || { h: 9, m: 0 }; return `${pad2(tt.h)}${pad2(tt.m)}00`; };
  const sd = normalizeDate(start_date) || new Date();
  const ed = normalizeDate(end_date) || sd;
  const gcalParams = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${ymd(sd)}T${hm(start_time)}/${ymd(ed)}T${hm(end_time)}`, location: location || '' });
  const gcalUrl = `https://www.google.com/calendar/render?${gcalParams.toString()}`;

  return `
  <div style="background:#f6f9fc;padding:16px;font-family:Segoe UI, Roboto, Helvetica, Arial, sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr><td style="padding:18px 20px;background:${BRAND_PRIMARY_COLOR};color:#ffffff;">
        <table width="100%" cellspacing="0" cellpadding="0"><tr>
          <td style="vertical-align:middle;"><img src="cid:${logoCid}" alt="GC-ORGANIZE" width="40" height="40" style="display:inline-block;border-radius:6px;vertical-align:middle;margin-right:12px;"/><span style="font-size:18px;font-weight:600;vertical-align:middle;">GC-ORGANIZE</span></td>
          <td style="text-align:right;font-size:12px;opacity:0.9;">Registration Confirmation</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
          <td style="vertical-align:middle;"><h1 style="font-size:20px;margin:0;color:#111827;display:inline-block;">You're in, ${studentName}!</h1></td>
          <td style="text-align:right;vertical-align:middle;"><a href="${gcalUrl}" target="_blank" style="background:${BRAND_PRIMARY_COLOR};color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;display:inline-block;font-weight:600;font-size:14px;">Add to Google Calendar</a></td>
        </tr></table>
        <p style="margin:12px 0 16px 0;line-height:1.6;">You've successfully registered for <strong>${title}</strong>.</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:10px;margin:16px 0;"><tr><td style="padding:16px;">
          <p style="margin:0 0 8px 0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Event</p>
          <p style="margin:0 0 12px 0;font-weight:600;color:#111827;">${title}</p>
          <p style="margin:0 0 8px 0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Location</p>
          <p style="margin:0 0 12px 0;color:#111827;">${location}</p>
          <p style="margin:0 0 8px 0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Starts</p>
          <p style="margin:0 0 12px 0;color:#111827;">${startPretty}</p>
          <p style="margin:0 0 8px 0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Ends</p>
          <p style="margin:0;color:#111827;">${endPretty}</p>
        </td></tr></table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;"><tr><td style="text-align:center;">
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">Your QR Code</div>
          <div style="padding:12px;border:1px dashed #cbd5e1;border-radius:12px;display:inline-block;background:#f8fafc;"><img src="cid:${qrCid}" alt="Registration QR Code" width="160" style="display:block;max-width:100%;height:auto;"/></div>
          <div style="font-size:12px;color:#6b7280;margin-top:8px;">Show this code at check-in</div>
        </td></tr></table>
        <p style="margin:16px 0;color:#374151;line-height:1.6;">Tip: Save this email or add the event to your calendar so you don't miss it.</p>
        <p style="margin:0;color:#6b7280;font-size:12px;">If you have questions, reply to this email.</p>
      </td></tr>
      <tr><td style="padding:16px 20px;background:#f9fafb;color:#6b7280;font-size:12px;text-align:center;">
        © ${new Date().getFullYear()} GC-ORGANIZE · Generated by the Registration System.
      </td></tr>
    </table>
  </div>`;
}

// Send a branded registration confirmation email with optional QR code attachment
async function sendRegistrationEmailObject({ to, subject, text, event, student, qrUrl }) {
  const html = buildRegistrationHtml({ event, student, qrUrl });
  const attachments = [{ filename: 'logo.png', path: path.join(__dirname, '../assets/GC-Logo.png'), cid: 'gc-logo' }];
  if (qrUrl) attachments.push({ filename: 'registration-qr.png', path: qrUrl, cid: 'qr-code' });
  return transporter.sendMail({ from: SMTP_USER, to, subject, text: text || 'Registration confirmed.', html, attachments });
}

// Legacy positional-args signature: (to, subject, text, qrUrl)
function sendRegistrationEmailLegacy(to, subject, text, qrUrl) {
  return transporter.sendMail({
    from: SMTP_USER, to, subject, text,
    attachments: qrUrl ? [{ filename: 'registration-qr.png', path: qrUrl }] : undefined
  });
}

// Unified entry point: delegates to object or legacy API based on first argument type
function sendRegistrationEmail(arg1, subject, text, qrUrl) {
  return (typeof arg1 === 'object' && arg1 !== null)
    ? sendRegistrationEmailObject(arg1)
    : sendRegistrationEmailLegacy(arg1, subject, text, qrUrl);
}
*/

async function sendGenericEmail({ to, subject, text, html }) {
  const mailOptions = { from: SMTP_USER, to, subject, text: text || (html ? undefined : ''), html };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendRegistrationEmail, sendGenericEmail };