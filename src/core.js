// @ts-check
// ===================== Pure Logic (no DOM / no axios deps; unit-testable) =====================

/**
 * Extract rows from an API response (accepts an array or a { rows } object).
 * @param {unknown} data
 * @returns {Array<Record<string, unknown>>}
 */
export function extractRows(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === "object" && "rows" in data && Array.isArray(data.rows)) {
        return data.rows;
    }
    return [];
}

/**
 * Expand API rows into section rows: TYKC/TJKC are course objects with a tcList sub-array.
 * @param {Array<Record<string, unknown>> | null | undefined} rows
 * @param {string} type
 * @returns {Array<Record<string, unknown>>}
 */
export function extractSections(rows, type) {
    if (type !== "TYKC" && type !== "TJKC") return rows || [];
    const out = [];
    (rows || []).forEach(function (r) {
        if (Array.isArray(r.tcList) && r.tcList.length) {
            r.tcList.forEach(function (t) {
                out.push(t);
            });
        } else {
            out.push(r);
        }
    });
    return out;
}

/**
 * Backoff delay: base interval * 2^consecutive failures, capped at `max`.
 * @param {number} baseInterval
 * @param {number} consecutiveFails
 * @param {number} max
 * @returns {number}
 */
export function backoffDelay(baseInterval, consecutiveFails, max) {
    const b = baseInterval * Math.pow(2, consecutiveFails);
    return Math.min(b, max);
}

/**
 * Index of the next course that is neither grabbed, skipped nor claimed; -1 when nothing is left.
 * @param {Array<{ code: string }>} courses
 * @param {string[]} grabbed
 * @param {string[]} skipped
 * @param {string[]} claimed
 * @returns {number}
 */
export function findNextCourseIndex(courses, grabbed, skipped, claimed) {
    return courses.findIndex(function (c) {
        return !grabbed.includes(c.code) && !skipped.includes(c.code) && !claimed.includes(c.code);
    });
}

/**
 * Courses still pending (not grabbed and not skipped).
 * @param {Array<{ code: string }>} courses
 * @param {string[]} grabbed
 * @param {string[]} skipped
 * @returns {Array<{ code: string }>}
 */
export function findRemaining(courses, grabbed, skipped) {
    return courses.filter((c) => !grabbed.includes(c.code) && !skipped.includes(c.code));
}

/**
 * Normalize a legacy stored course: no jxbid means "any section"; fill type/sportName/volunteer defaults.
 * @param {Record<string, unknown>} c
 * @returns {Record<string, unknown>}
 */
export function normalizeCourse(c) {
    if (!("jxbid" in c)) {
        c.jxbid = null;
        c.secretVal = null;
    }
    c.type = c.type || "XGKC";
    c.sportName = c.sportName || "";
    c.volunteer = c.volunteer || 1;
    return c;
}
