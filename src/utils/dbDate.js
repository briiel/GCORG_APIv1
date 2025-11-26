// Small helpers to parse MySQL DATE/DATETIME/TIMESTAMP strings deterministically.
// When `dateStrings: true` is enabled in the DB pool, the driver returns
// these types as plain strings (e.g. '2025-11-18 11:50:00'). These helpers
// convert those strings into JS Date objects in a predictable way.

'use strict';

// Parse a MySQL DATETIME/TIMESTAMP string that represents UTC, returning a JS Date.
// Example input: '2025-11-18 11:50:00' (assumed to already be UTC if produced by CONVERT_TZ(..., ..., '+00:00')).
function parseMysqlUtcStringToDate(s) {
    if (s === null || s === undefined || s === '') return null;
    // If string already contains 'T' or 'Z', try Date directly
    if (s.includes('T') || s.endsWith('Z')) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }
    // Convert 'YYYY-MM-DD HH:mm:ss' -> 'YYYY-MM-DDTHH:mm:ssZ' (UTC)
    const iso = s.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
}

// Parse a MySQL DATETIME string that is local to an EVENT_TZ_OFFSET.
// This will treat the input as occurring in the given offset and return a JS Date in UTC.
// Example: parseMysqlLocalStringToDate('2025-11-18 19:50:00', '+08:00') => Date for 2025-11-18T11:50:00Z
function parseMysqlLocalStringToDate(s, offset = '+00:00') {
    if (s === null || s === undefined || s === '') return null;
    // Normalize input
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?$/);
    if (!m) return null;
    const datePart = m[1];
    const timePart = m[2];
    // Build an ISO string with the given offset and parse
    // 'YYYY-MM-DDTHH:mm:ss+08:00' -> Date
    const isoWithOffset = `${datePart}T${timePart}${offset}`;
    const d = new Date(isoWithOffset);
    return isNaN(d.getTime()) ? null : d;
}

// Parse a MySQL DATE only (YYYY-MM-DD) as midnight UTC
function parseMysqlDateOnlyToDate(s) {
    if (s === null || s === undefined || s === '') return null;
    const m = s.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (!m) return null;
    const iso = `${m[1]}T00:00:00Z`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
}

module.exports = {
    parseMysqlUtcStringToDate,
    parseMysqlLocalStringToDate,
    parseMysqlDateOnlyToDate
};
