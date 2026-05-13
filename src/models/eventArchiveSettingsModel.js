const db = require('../config/db');

const DEFAULT_RETENTION_DAYS = Math.min(365, Math.max(1, parseInt(process.env.DEFAULT_EVENT_TRASH_RETENTION_DAYS || '30', 10) || 30));

/** Days after end_date that events still appear on the public Home feed (end_date >= today − N). */
const DEFAULT_HOME_VISIBILITY_DAYS = Math.min(365, Math.max(0, (() => {
    const v = parseInt(process.env.DEFAULT_EVENT_HOME_VISIBILITY_DAYS || '14', 10);
    return Number.isNaN(v) ? 14 : v;
})()));

const clampRetention = (n) => {
    if (n === null || n === undefined || n === '') return null;
    const v = parseInt(String(n), 10);
    if (Number.isNaN(v)) return null;
    return Math.min(365, Math.max(1, v));
};

const clampHomeVisibility = (n) => {
    if (n === null || n === undefined || n === '') return null;
    const v = parseInt(String(n), 10);
    if (Number.isNaN(v)) return null;
    return Math.min(365, Math.max(0, v));
};

const ensureEventArchiveSettingsColumns = async () => {
    const tables = [
        {
            table: 'student_organizations',
            cols: [
                "ADD COLUMN event_trash_retention_days INT NULL DEFAULT NULL COMMENT 'Days events stay in archive before purge; NULL uses system default'",
                "ADD COLUMN event_auto_trash_on_conclude TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = move concluded events to archive automatically'",
                "ADD COLUMN event_home_visibility_days INT NULL DEFAULT NULL COMMENT 'Days after end_date events stay on Home; NULL uses system default'"
            ]
        },
        {
            table: 'osws_admins',
            cols: [
                "ADD COLUMN event_trash_retention_days INT NULL DEFAULT NULL COMMENT 'Days events stay in archive before purge; NULL uses system default'",
                "ADD COLUMN event_auto_trash_on_conclude TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = move concluded events to archive automatically'",
                "ADD COLUMN event_home_visibility_days INT NULL DEFAULT NULL COMMENT 'Days after end_date events stay on Home; NULL uses system default'"
            ]
        }
    ];
    for (const { table, cols } of tables) {
        for (const ddl of cols) {
            const colName = ddl.match(/ADD COLUMN (\w+)/)?.[1];
            if (!colName) continue;
            try {
                const [exists] = await db.query(
                    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                    [table, colName]
                );
                if (!Array.isArray(exists) || exists.length === 0) {
                    await db.query(`ALTER TABLE ${table} ${ddl}`);
                }
            } catch (e) {
                console.warn(`[DB] ensureEventArchiveSettingsColumns ${table}.${colName}:`, e.message || e);
            }
        }
    }
};

const getOrgEventArchiveSettings = async (orgId) => {
    const [rows] = await db.query(
        `SELECT id, event_trash_retention_days, event_auto_trash_on_conclude, event_home_visibility_days FROM student_organizations WHERE id = ? LIMIT 1`,
        [orgId]
    );
    const row = rows[0];
    if (!row) return null;
    const effective = row.event_trash_retention_days != null ? row.event_trash_retention_days : DEFAULT_RETENTION_DAYS;
    const effHome = row.event_home_visibility_days != null ? row.event_home_visibility_days : DEFAULT_HOME_VISIBILITY_DAYS;
    return {
        scope: 'organization',
        event_trash_retention_days: row.event_trash_retention_days,
        event_auto_trash_on_conclude: !!row.event_auto_trash_on_conclude,
        effective_trash_retention_days: effective,
        default_trash_retention_days: DEFAULT_RETENTION_DAYS,
        event_home_visibility_days: row.event_home_visibility_days,
        effective_home_visibility_days: effHome,
        default_home_visibility_days: DEFAULT_HOME_VISIBILITY_DAYS
    };
};

const getOswsEventArchiveSettings = async (adminId) => {
    const [rows] = await db.query(
        `SELECT id, event_trash_retention_days, event_auto_trash_on_conclude, event_home_visibility_days FROM osws_admins WHERE id = ? LIMIT 1`,
        [adminId]
    );
    const row = rows[0];
    if (!row) return null;
    const effective = row.event_trash_retention_days != null ? row.event_trash_retention_days : DEFAULT_RETENTION_DAYS;
    const effHome = row.event_home_visibility_days != null ? row.event_home_visibility_days : DEFAULT_HOME_VISIBILITY_DAYS;
    return {
        scope: 'osws',
        event_trash_retention_days: row.event_trash_retention_days,
        event_auto_trash_on_conclude: !!row.event_auto_trash_on_conclude,
        effective_trash_retention_days: effective,
        default_trash_retention_days: DEFAULT_RETENTION_DAYS,
        event_home_visibility_days: row.event_home_visibility_days,
        effective_home_visibility_days: effHome,
        default_home_visibility_days: DEFAULT_HOME_VISIBILITY_DAYS
    };
};

const updateOrgEventArchiveSettings = async (orgId, { event_trash_retention_days, event_auto_trash_on_conclude, event_home_visibility_days }) => {
    const days = clampRetention(event_trash_retention_days);
    const homeDays = clampHomeVisibility(event_home_visibility_days);
    const auto = event_auto_trash_on_conclude === undefined ? undefined : (event_auto_trash_on_conclude ? 1 : 0);
    const sets = [];
    const params = [];
    if (event_trash_retention_days !== undefined) {
        sets.push('event_trash_retention_days = ?');
        params.push(days);
    }
    if (event_auto_trash_on_conclude !== undefined) {
        sets.push('event_auto_trash_on_conclude = ?');
        params.push(auto);
    }
    if (event_home_visibility_days !== undefined) {
        sets.push('event_home_visibility_days = ?');
        params.push(homeDays);
    }
    if (sets.length === 0) return false;
    params.push(orgId);
    const [res] = await db.query(`UPDATE student_organizations SET ${sets.join(', ')} WHERE id = ?`, params);
    return res.affectedRows > 0;
};

const updateOswsEventArchiveSettings = async (adminId, { event_trash_retention_days, event_auto_trash_on_conclude, event_home_visibility_days }) => {
    const days = clampRetention(event_trash_retention_days);
    const homeDays = clampHomeVisibility(event_home_visibility_days);
    const auto = event_auto_trash_on_conclude === undefined ? undefined : (event_auto_trash_on_conclude ? 1 : 0);
    const sets = [];
    const params = [];
    if (event_trash_retention_days !== undefined) {
        sets.push('event_trash_retention_days = ?');
        params.push(days);
    }
    if (event_auto_trash_on_conclude !== undefined) {
        sets.push('event_auto_trash_on_conclude = ?');
        params.push(auto);
    }
    if (event_home_visibility_days !== undefined) {
        sets.push('event_home_visibility_days = ?');
        params.push(homeDays);
    }
    if (sets.length === 0) return false;
    params.push(adminId);
    const [res] = await db.query(`UPDATE osws_admins SET ${sets.join(', ')} WHERE id = ?`, params);
    return res.affectedRows > 0;
};

module.exports = {
    DEFAULT_RETENTION_DAYS,
    DEFAULT_HOME_VISIBILITY_DAYS,
    ensureEventArchiveSettingsColumns,
    getOrgEventArchiveSettings,
    getOswsEventArchiveSettings,
    updateOrgEventArchiveSettings,
    updateOswsEventArchiveSettings,
    clampRetention,
    clampHomeVisibility
};
