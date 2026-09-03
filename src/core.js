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
 * Remove a course code from a claimed list.
 * @param {string[]} claimed
 * @param {string} code
 * @returns {string[]}
 */
export function releaseClaimed(claimed, code) {
    return claimed.filter(function (c) {
        return c !== code;
    });
}

/**
 * Mark every pending course as skipped (mutates `skipped`).
 * @param {Array<{ code: string }>} courses
 * @param {string[]} grabbed
 * @param {string[]} skipped
 */
export function markRemainingSkipped(courses, grabbed, skipped) {
    for (let i = 0; i < courses.length; i++) {
        const c = courses[i];
        if (!grabbed.includes(c.code) && !skipped.includes(c.code)) {
            skipped.push(c.code);
        }
    }
}

/**
 * Choose the volunteer grade for a section: prefer the wanted grade, fall back to the first available.
 * @param {Array<Record<string, unknown>>} volList
 * @param {number} want
 * @returns {unknown}
 */
export function pickVolunteer(volList, want) {
    return volList.some(function (v) {
        return v.grade === want;
    })
        ? want
        : volList[0].grade;
}

/**
 * Whether the course already appears in a selected-list response (exact code or prefix match).
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} code
 * @returns {boolean}
 */
export function courseListed(rows, code) {
    return rows.some(function (r) {
        return r.KCH === code || (r.KCH && String(r.KCH).indexOf(code) !== -1);
    });
}

/**
 * Whether a section of the course is already selected: exact section, exact club, or any section.
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} code
 * @param {string} jxbid
 * @param {string} sportName
 * @returns {boolean}
 */
export function courseSelected(rows, code, jxbid, sportName) {
    return rows.some(function (r) {
        const jx = r.JXBID || r.jxbid || r.clazzId || "";
        const sn = r.sportName || r.sportname || "";
        if (jxbid && jx) return jx === jxbid; // specific section: exact match
        if (sportName && sn) return sn === sportName; // specific club: match by name
        const kch = r.KCH || r.kch || "";
        // any section: success if any section of the course is already selected
        return kch === code || (kch && String(kch).indexOf(code) !== -1);
    });
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
