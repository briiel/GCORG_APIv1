// Helpers to parse MySQL DATE/DATETIME/TIMESTAMP strings to JS Date objects in a deterministic way

'use strict';

// Parse a MySQL DATETIME/TIMESTAMP already expressed in UTC (e.g. '2025-11-18 11:50:00') to a JS Date
function parseMysqlUtcStringToDate(s) {
    if (s === null || s === undefined || s === '') return null;
    if (s.includes('T') || s.endsWith('Z')) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }
    const iso = s.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
}

// Parse a MySQL DATETIME local to a given offset (e.g. '+08:00') and return a UTC JS Date
function parseMysqlLocalStringToDate(s, offset = '+00:00') {
    if (s === null || s === undefined || s === '') return null;
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?$/);
    if (!m) return null;
    const isoWithOffset = `${m[1]}T${m[2]}${offset}`;
    const d = new Date(isoWithOffset);
    return isNaN(d.getTime()) ? null : d;
}

// Parse a MySQL DATE (YYYY-MM-DD) as midnight UTC
function parseMysqlDateOnlyToDate(s) {
    if (s === null || s === undefined || s === '') return null;
    const m = s.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (!m) return null;
    const d = new Date(`${m[1]}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
}

module.exports = {
    parseMysqlUtcStringToDate,
    parseMysqlLocalStringToDate,
    parseMysqlDateOnlyToDate
};
