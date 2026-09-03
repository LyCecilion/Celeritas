import {
    backoffDelay,
    extractRows,
    extractSections,
    findNextCourseIndex,
    findRemaining,
    normalizeCourse,
} from "./core.js";

(function () {
    "use strict";

    // ===================== DOM Helpers =====================
    /** Get an element by id. The panel DOM is built by this script, so the element is known to exist. */
    function byId(id) {
        return /** @type {HTMLElement} */ (document.getElementById(id));
    }

    // ===================== Constants =====================
    const LS_KEY =
        "clrt_courses_" + (new URLSearchParams(location.search).get("batchId") || "default");
    // Legacy CourseChooseBoom storage key (with the batchId suffix); used only for one-time migration
    const LEGACY_LS_KEY =
        "ccb_courses_" + (new URLSearchParams(location.search).get("batchId") || "default");
    const PANEL_ID = "clrt-panel";
    const LOG_MAX = 200; // maximum number of log entries kept
    // Course types: XGKC=elective, TYKC=sports club, TJKC=recommended class (all on the "in-plan courses" page)
    const TYPE_LABELS = { XGKC: "通识选修", TYKC: "体育俱乐部", TJKC: "推荐班级课程" };
    const TYPE_PAGE_HINT = {
        XGKC: "通识选修在通识选修课程页面",
        TYKC: "体育俱乐部在方案内课程页面",
        TJKC: "推荐班级课程在方案内课程页面",
    };
    const TYPE_PLACEHOLDER = {
        XGKC: "课程号或关键词，如 24TS2244",
        TYKC: "课程名或俱乐部，如 羽毛球",
        TJKC: "课程名或关键词，如 高级写作",
    };
    const TYPE_TAG = { TYKC: "体", TJKC: "推" };
    const VOLUNTEER_NAMES = {
        1: "第一志愿",
        2: "第二志愿",
        3: "第三志愿",
        4: "第四志愿",
        5: "第五志愿",
    };

    // ===================== Style Injection =====================
    function injectStyles() {
        const css = `
#${PANEL_ID} {
    position: fixed; right: 20px; top: 100px; z-index: 99999;
    width: 340px; max-height: 85vh;
    background: #fff; border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.1);
    font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; flex-direction: column; overflow: hidden;
    user-select: none;
}
.clrt-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 14px; background: linear-gradient(135deg, #2655c8, #1a3f9e);
    color: #fff; cursor: move; font-weight: 600; font-size: 14px;
}
.clrt-hdr-btn {
    background: none; border: none; color: #fff; cursor: pointer;
    font-size: 16px; width: 24px; height: 24px; line-height: 24px;
    text-align: center; border-radius: 4px; margin-left: 2px;
}
.clrt-hdr-btn:hover { background: rgba(255,255,255,.2); }
.clrt-body { padding: 12px 14px; overflow-y: auto; flex: 1; }
.clrt-row { display: flex; gap: 6px; margin-bottom: 8px; align-items: center; }
.clrt-row-sm { margin-bottom: 6px; }
.clrt-input {
    flex: 1; padding: 6px 10px; border: 1px solid #dcdfe6; border-radius: 6px;
    font-size: 12px; outline: none; box-sizing: border-box;
}
.clrt-input:focus { border-color: #2655c8; }
.clrt-select {
    padding: 4px 8px; border: 1px solid #dcdfe6; border-radius: 6px;
    font-size: 12px; outline: none; background: #fff;
}
.clrt-btn {
    padding: 7px 14px; border: none; border-radius: 6px; cursor: pointer;
    font-size: 12px; font-weight: 600; white-space: nowrap;
    transition: all .15s;
}
.clrt-btn:hover { transform: translateY(-1px); }
.clrt-btn:active { transform: translateY(0); }
.clrt-btn-sm { padding: 6px 10px; font-size: 11px; }
.clrt-btn-go { background: #2655c8; color: #fff; }
.clrt-btn-go:hover { background: #1a3f9e; }
.clrt-btn-stop { background: #f56c6c; color: #fff; }
.clrt-btn-stop:hover { background: #e04545; }
.clrt-btn-warn { background: #e6a23c; color: #fff; }
.clrt-btn-warn:hover { background: #cf9236; }

.clrt-course-list {
    border: 1px solid #ebeef5; border-radius: 6px; margin-bottom: 8px;
    max-height: 200px; overflow-y: auto; background: #fafbfc;
}
.clrt-course-item {
    display: flex; align-items: center; padding: 7px 10px;
    border-bottom: 1px solid #ebeef5; cursor: grab; gap: 8px;
    transition: background .15s;
}
.clrt-course-item:last-child { border-bottom: none; }
.clrt-course-item:hover { background: #ecf5ff; }
.clrt-course-item.clrt-dragging { opacity: .4; background: #f0f2f5; }
.clrt-course-item.clrt-grabbed { background: #f0f9eb; color: #67c23a; }
.clrt-course-item.clrt-skipped { background: #fef7e8; color: #e6a23c; }
.clrt-course-item.clrt-active { background: #ecf5ff; border-left: 3px solid #2655c8; }
.clrt-course-code { font-weight: 700; font-family: monospace; font-size: 13px; min-width: 80px; }
.clrt-type-tag {
    background: #409eff; color: #fff; border-radius: 3px;
    font-size: 10px; padding: 1px 4px; flex-shrink: 0;
}
.clrt-course-name { flex: 1; color: #606266; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clrt-badge {
    display: inline-block; width: 18px; height: 18px; line-height: 18px;
    text-align: center; border-radius: 50%; color: #fff; font-size: 11px;
}
.clrt-badge-ok { background: #67c23a; }
.clrt-badge-skip { background: #e6a23c; }
.clrt-course-del {
    background: none; border: none; color: #c0c4cc; cursor: pointer;
    font-size: 16px; width: 22px; height: 22px; line-height: 22px; text-align: center;
    border-radius: 4px; flex-shrink: 0;
}
.clrt-course-del:hover { color: #f56c6c; background: #fef0f0; }

.clrt-progress-bar {
    width: 100%; height: 6px; background: #ebeef5; border-radius: 3px;
    margin-bottom: 4px; overflow: hidden;
}
.clrt-progress-fill {
    height: 100%; background: linear-gradient(90deg, #67c23a, #409eff);
    border-radius: 3px; transition: width .3s; width: 0%;
}
.clrt-progress-text { font-size: 11px; color: #909399; margin-bottom: 6px; }

.clrt-log {
    background: #1e1e1e; color: #d4d4d4; border-radius: 6px;
    padding: 8px 10px; font-size: 11px; font-family: monospace;
    max-height: 180px; overflow-y: auto; line-height: 1.5;
}
.clrt-search-results {
    border: 1px solid #ebeef5; border-radius: 6px; margin-bottom: 8px;
    max-height: 220px; overflow-y: auto; background: #fff;
}
.clrt-search-item {
    display: flex; align-items: center; padding: 6px 10px;
    border-bottom: 1px solid #f0f0f0; gap: 6px; font-size: 11px;
}
.clrt-search-item:last-child { border-bottom: none; }
.clrt-search-item-main { flex: 1; min-width: 0; }
.clrt-search-item-code { font-weight: 700; font-family: monospace; font-size: 12px; }
.clrt-search-item-meta { color: #909399; margin-top: 2px; }
.clrt-search-item-cap { color: #606266; white-space: nowrap; text-align: right; }
.clrt-search-item-cap .clrt-cap-left { color: #67c23a; font-weight: 600; }
.clrt-search-add {
    background: #2655c8; color: #fff; border: none; border-radius: 4px;
    padding: 3px 10px; cursor: pointer; font-size: 11px; white-space: nowrap;
}
.clrt-search-add:hover { background: #1a3f9e; }
.clrt-search-add:disabled { background: #c0c4cc; cursor: not-allowed; }
.clrt-search-empty { padding: 16px; text-align: center; color: #c0c4cc; font-size: 12px; }
.clrt-search-loading { padding: 12px; text-align: center; color: #909399; font-size: 12px; }
.clrt-search-hdr {
    display: flex; justify-content: space-between; align-items: center;
    padding: 4px 10px; font-size: 11px; color: #909399;
}
.clrt-search-close {
    background: none; border: none; color: #c0c4cc; cursor: pointer; font-size: 14px;
}
.clrt-search-close:hover { color: #f56c6c; }

.clrt-log-item { padding: 1px 0; }
.clrt-log-info  { color: #d4d4d4; }
.clrt-log-found { color: #569cd6; }
.clrt-log-success { color: #4ec9b0; }
.clrt-log-warn  { color: #ce9178; }
.clrt-log-error { color: #f44747; }

#clrt-reopen {
    position: fixed; right: 20px; bottom: 20px; z-index: 99998;
    width: 42px; height: 42px; border-radius: 50%; border: none;
    background: #2655c8; color: #fff; font-size: 18px;
    cursor: pointer; box-shadow: 0 4px 16px rgba(38,85,200,.4);
    transition: transform .15s;
}
#clrt-reopen:hover { transform: scale(1.1); }
`;
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ===================== State =====================
    let courses = []; // { code, name, note, jxbid?, secretVal?, type? }  empty jxbid = any section; type: XGKC / TYKC / TJKC
    let interval = 800;
    let concurNum = 2; // number of concurrent workers
    let courseType = "XGKC"; // current panel course type: XGKC / TYKC / TJKC
    let volunteer = 1; // volunteer grade in pre-select batches (1-5, lottery-based)
    let running = false;
    let stopped = false;
    let grabbed = []; // [code, ...] courses successfully grabbed
    let skipped = []; // [code, ...] courses marked as skipped
    let claimed = []; // [code, ...] courses claimed by a worker
    let creditsFull = false; // flag: credit/course-count limit reached
    let workerTargets = {}; // { workerId: { code, idx } }  courses being processed by each worker
    const MAX_BACKOFF = 5000; // backoff ceiling
    let audioCtx = null;

    // ===================== Audio =====================
    function initAudio() {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (_) {
            /* no audio */
        }
    }

    function beep(happy) {
        if (!audioCtx) return;
        try {
            const notes = happy ? [800, 1000, 1200, 1600] : [500, 400, 300];
            notes.forEach((f, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.connect(g);
                g.connect(audioCtx.destination);
                o.frequency.value = f;
                o.type = "square";
                g.gain.value = 0.1;
                o.start(audioCtx.currentTime + i * 0.12);
                o.stop(audioCtx.currentTime + i * 0.12 + 0.09);
            });
        } catch (_) {
            /* */
        }
    }

    // ===================== localStorage =====================
    function loadConfig() {
        try {
            let raw = localStorage.getItem(LS_KEY);
            // First load: migrate courses stored under the old ccb_courses_* key, then remove it
            if (!raw) {
                raw = localStorage.getItem(LEGACY_LS_KEY);
                if (raw) {
                    localStorage.setItem(LS_KEY, raw);
                    localStorage.removeItem(LEGACY_LS_KEY);
                }
            }
            if (raw) {
                const data = JSON.parse(raw);
                courses = (data.courses || []).map(normalizeCourse);
                interval = data.interval || 800;
                concurNum = data.concurNum || 2;
                courseType = data.courseType || "XGKC";
                volunteer = data.volunteer || 1;
                return;
            }
        } catch (_) {
            /* */
        }
        // First run: start with an empty list; courses are added via the search panel
        courses = [];
    }

    function saveConfig() {
        try {
            localStorage.setItem(
                LS_KEY,
                JSON.stringify({ courses, interval, concurNum, courseType, volunteer }),
            );
        } catch (_) {
            /* */
        }
    }

    // ===================== Logging =====================
    function log(msg, type) {
        const el = byId("clrt-log");
        if (!el) return;
        const now = new Date();
        const ts =
            String(now.getHours()).padStart(2, "0") +
            ":" +
            String(now.getMinutes()).padStart(2, "0") +
            ":" +
            String(now.getSeconds()).padStart(2, "0");
        const div = document.createElement("div");
        div.className = "clrt-log-item clrt-log-" + (type || "info");
        div.textContent = ts + " " + msg;
        el.appendChild(div);
        // cap the number of log entries
        while (el.children.length > LOG_MAX) el.firstChild.remove();
        el.scrollTop = el.scrollHeight;
    }

    // ===================== UI Updates =====================
    function renderCourseList() {
        const el = byId("clrt-course-list");
        if (!el) return;
        el.innerHTML = courses
            .map((c, i) => {
                const displayName = c.name || c.note || "";
                const sectionTag = c.jxbid
                    ? '<span style="color:#909399;font-size:11px;flex-shrink:0">' +
                      (c.note || "") +
                      "</span>"
                    : '<span style="color:#e6a23c;font-size:11px;flex-shrink:0">任意班</span>';
                const typeTag = TYPE_TAG[c.type]
                    ? '<span class="clrt-type-tag">' + TYPE_TAG[c.type] + "</span>"
                    : "";
                const isGrabbed = grabbed.includes(c.code);
                const isSkipped = skipped.includes(c.code);
                const doneClass = isGrabbed ? " clrt-grabbed" : isSkipped ? " clrt-skipped" : "";
                let activeWorker = null;
                Object.keys(workerTargets).forEach(function (wid) {
                    if (workerTargets[wid].code === c.code) activeWorker = wid;
                });
                const activeClass = activeWorker ? " clrt-active" : "";
                const workerBadge = activeWorker
                    ? '<span style="color:#2655c8;font-size:10px;flex-shrink:0">W' +
                      activeWorker +
                      "</span>"
                    : "";
                let badge = "";
                if (isGrabbed) badge = '<span class="clrt-badge clrt-badge-ok">✓</span>';
                else if (isSkipped) badge = '<span class="clrt-badge clrt-badge-skip">⏭</span>';
                return `
                <div class="clrt-course-item${doneClass}${activeClass}" draggable="true" data-idx="${i}">
                    <span class="clrt-course-code">${c.code}</span>
                    ${typeTag}
                    <span class="clrt-course-name">${displayName}</span>
                    ${sectionTag}
                    ${workerBadge}
                    ${badge}
                    <button class="clrt-course-del" data-idx="${i}" title="删除">×</button>
                </div>`;
            })
            .join("");

        // delete button handlers
        el.querySelectorAll(".clrt-course-del").forEach((btn) => {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.idx);
                const c = courses[idx];
                courses.splice(idx, 1);
                saveConfig();
                renderCourseList();
                updateProgress();
                log("已移除: " + c.code);
            });
        });

        // drag-to-reorder
        let dragIdx = -1;
        el.querySelectorAll(".clrt-course-item").forEach((item) => {
            item.addEventListener("dragstart", function () {
                dragIdx = parseInt(this.dataset.idx);
                this.classList.add("clrt-dragging");
            });
            item.addEventListener("dragend", function () {
                this.classList.remove("clrt-dragging");
            });
            item.addEventListener("dragover", function (e) {
                e.preventDefault();
            });
            item.addEventListener("drop", function () {
                const toIdx = parseInt(this.dataset.idx);
                if (dragIdx >= 0 && dragIdx !== toIdx) {
                    const [moved] = courses.splice(dragIdx, 1);
                    courses.splice(toIdx, 0, moved);
                    saveConfig();
                    renderCourseList();
                    updateProgress();
                }
                dragIdx = -1;
            });
        });
    }

    function updateProgress() {
        const el = byId("clrt-progress");
        const remainEl = byId("clrt-remaining");
        if (!el || !remainEl) return;
        const total = courses.length;
        const done = grabbed.length;
        el.style.width = total ? (done / total) * 100 + "%" : "0%";
        const remain = findRemaining(courses, grabbed, skipped);
        const skippedCount = skipped.length;
        let extra = "";
        if (skippedCount) extra += " | 跳过: " + skippedCount;
        remainEl.textContent =
            done +
            "/" +
            total +
            (remain.length ? " 剩余: " + remain.map((c) => c.code).join(", ") : " 🎉 全部完成！") +
            extra;
    }

    function updateBtnState() {
        const startBtn = byId("clrt-btn-start");
        const stopBtn = byId("clrt-btn-stop");
        const skipBtn = byId("clrt-btn-skip");
        if (startBtn) startBtn.style.display = running ? "none" : "";
        if (stopBtn) stopBtn.style.display = running ? "" : "none";
        if (skipBtn) skipBtn.style.display = running ? "" : "none";
    }

    function updateTypeHint() {
        const input = byId("clrt-input-keyword");
        const hint = byId("clrt-type-hint");
        if (input) {
            input.placeholder = TYPE_PLACEHOLDER[courseType] || TYPE_PLACEHOLDER.XGKC;
        }
        if (hint) {
            hint.textContent = TYPE_PAGE_HINT[courseType] || TYPE_PAGE_HINT.XGKC;
        }
    }

    // ===================== Grab Core =====================
    function wait(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    function getCampus() {
        try {
            if (window.grablessonsVue && window.grablessonsVue.currentCampus) {
                return window.grablessonsVue.currentCampus.code;
            }
        } catch (_) {
            /* */
        }
        return "S";
    }

    // Whether the current batch is the pre-select one (first batch: lottery-based volunteers)
    function isPreselectBatch() {
        try {
            if (
                window.grablessonsVue &&
                window.grablessonsVue.lcParam &&
                window.grablessonsVue.lcParam.currentBatch
            ) {
                return window.grablessonsVue.lcParam.currentBatch.typeCode === "01";
            }
        } catch (_) {
            /* */
        }
        return false;
    }

    // Query the volunteers available for a section (pre-select batches only)
    async function getVolunteerList(clazzType, jxbId) {
        try {
            const res = await axios.post("/volunteer/list/choose", {
                clazzType: clazzType,
                clazzId: jxbId,
            });
            if (!res || !res.data || res.data.code !== 200) return [];
            const d = res.data.data;
            return Array.isArray(d) ? d : (d && d.rows) || [];
        } catch (_) {
            return [];
        }
    }

    // Search by keyword (used by the panel; returns section rows)
    async function searchByKeyword(keyword, type) {
        type = type || courseType;
        let res;
        try {
            res = await axios.post("/elective/clazz/list", {
                teachingClassType: type,
                campus: getCampus(),
                pageNumber: 1,
                pageSize: 20,
                KEY: keyword,
                orderBy: "",
            });
        } catch (_) {
            return [];
        }
        if (!res || typeof res.data !== "object" || !res.data || res.data.code !== 200) return [];
        return extractSections(extractRows(res.data.data), type);
    }

    // Search by exact course code (used by the grab loop; returns all matching sections)
    async function searchCourse(target) {
        const code = target.code;
        const type = target.type || courseType;
        let res;
        try {
            res = await axios.post("/elective/clazz/list", {
                teachingClassType: type,
                campus: getCampus(),
                pageNumber: 1,
                pageSize: 10,
                KEY: code,
                orderBy: "",
            });
        } catch (_) {
            return []; // network-level failure
        }
        // Validate the response: the server may crash and return non-JSON
        if (!res || typeof res.data !== "object" || !res.data || !res.data.code) {
            return [];
        }
        if (res.data.code !== 200) return [];
        const rows = extractSections(extractRows(res.data.data), type);
        if (!rows || !rows.length) return [];
        return rows.filter(function (r) {
            return r.KCH === code || (target.jxbid && r.JXBID === target.jxbid);
        });
    }

    async function addCourse(courseObj, type, fallbackSecret, volunteerGrade) {
        let res;
        const clazzType = type || "XGKC";
        try {
            if (clazzType === "TYKC" || clazzType === "TJKC") {
                // In-plan courses (sports club / recommended class): same form submission as the page's "select" button
                const body = new URLSearchParams();
                body.append("clazzType", clazzType);
                body.append("clazzId", courseObj.JXBID);
                body.append("secretVal", courseObj.secretVal || fallbackSecret || "");
                res = await axios.post("/elective/clazz/add", body.toString(), {
                    timeout: 10000,
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                });
            } else {
                const payload = {
                    clazzType: clazzType,
                    clazzId: courseObj.JXBID,
                    secretVal: courseObj.secretVal,
                };
                if (volunteerGrade) payload.chooseVolunteer = volunteerGrade;
                res = await axios.post("/elective/clazz/add", payload, {
                    timeout: 10000,
                });
            }
        } catch (_) {
            return { code: -1, msg: "网络异常" };
        }
        // Validate the response
        if (!res || typeof res.data !== "object" || !res.data) {
            return { code: -1, msg: "服务端异常响应" };
        }
        return res.data;
    }

    // Verify the course was actually grabbed (query the selected list)
    async function verifyCourseGrab(code, maxRetries) {
        maxRetries = maxRetries || 4;
        for (let i = 0; i < maxRetries; i++) {
            if (i > 0) await wait(1000); // first iteration waits 0ms (already waited outside); later ones wait 1s
            let res;
            try {
                res = await axios.post("/elective/clazz/list", {
                    teachingClassType: "XGKC",
                    campus: getCampus(),
                    pageNumber: 1,
                    pageSize: 50,
                    orderBy: "",
                });
            } catch (_) {
                continue;
            }
            if (!res || typeof res.data !== "object" || !res.data || res.data.code !== 200)
                continue;

            const rows = extractRows(res.data.data);
            if (!rows || !rows.length) continue;

            const found = rows.find(function (r) {
                return r.KCH === code || (r.KCH && r.KCH.indexOf(code) !== -1);
            });
            if (found) {
                log(
                    "✔ 已验证: " + code + " 出现在已选列表（第 " + (i + 1) + " 次查询）",
                    "success",
                );
                return true;
            }

            if (i < maxRetries - 1) {
                log(
                    "⏳ " +
                        code +
                        " 未在已选列表，等待队列处理... (" +
                        (i + 1) +
                        "/" +
                        maxRetries +
                        ")",
                );
            }
        }
        return false;
    }

    // Verify in-plan courses (sports club / recommended class) against the real selected list
    async function verifyBySelect(code, jxbid, sportName, maxRetries) {
        maxRetries = maxRetries || 4;
        for (let i = 0; i < maxRetries; i++) {
            if (i > 0) await wait(1000); // first iteration waits 0ms (already waited outside); later ones wait 1s
            let res;
            try {
                res = await axios.post("/elective/select", null);
            } catch (_) {
                continue;
            }
            if (!res || typeof res.data !== "object" || !res.data || res.data.code !== 200)
                continue;

            const rows = extractRows(res.data.data);
            if (!rows || !rows.length) continue;

            const found = rows.find(function (r) {
                const jx = r.JXBID || r.jxbid || r.clazzId || "";
                const sn = r.sportName || r.sportname || "";
                if (jxbid && jx) return jx === jxbid; // specific section: exact match
                if (sportName && sn) return sn === sportName; // specific club: match by name
                const kch = r.KCH || r.kch || "";
                // any section: success if any section of the course is already selected
                return kch === code || (kch && String(kch).indexOf(code) !== -1);
            });
            if (found) {
                log(
                    "✔ 已验证: " + code + " 出现在已选列表（第 " + (i + 1) + " 次查询）",
                    "success",
                );
                return true;
            }

            if (i < maxRetries - 1) {
                log(
                    "⏳ " +
                        code +
                        " 未在已选列表，等待队列处理... (" +
                        (i + 1) +
                        "/" +
                        maxRetries +
                        ")",
                );
            }
        }
        return false;
    }

    function currentBackoff(consecutiveFails) {
        // Backoff formula: user interval * 2^consecutive failures, capped at MAX_BACKOFF
        return backoffDelay(interval, consecutiveFails, MAX_BACKOFF);
    }

    function claimNextCourse() {
        if (creditsFull) return null;
        const idx = findNextCourseIndex(courses, grabbed, skipped, claimed);
        if (idx === -1) return null;
        claimed.push(courses[idx].code);
        return { course: courses[idx], idx: idx };
    }

    function releaseClaim(code) {
        claimed = claimed.filter(function (c) {
            return c !== code;
        });
    }

    function skipRemainingCourses() {
        for (let i = 0; i < courses.length; i++) {
            const c = courses[i];
            if (!grabbed.includes(c.code) && !skipped.includes(c.code)) {
                skipped.push(c.code);
            }
        }
    }

    // Grab a single course (called inside a worker; resolves true = success or skipped)
    async function grabOneCourse(target, workerId) {
        const wTag = "[W" + workerId + "] ";
        let wFails = 0;

        while (!stopped) {
            try {
                const sections = await searchCourse(target);

                if (sections.length > 0) {
                    wFails = 0;

                    if (!target.name && sections[0].KCM) {
                        target.name = sections[0].KCM;
                        saveConfig();
                        renderCourseList();
                    }

                    let candidates;
                    if (target.jxbid) {
                        candidates = sections.filter(function (s) {
                            return s.JXBID === target.jxbid;
                        });
                        if (!candidates.length) {
                            log(wTag + "⚠️ " + target.code + " 指定教学班未找到", "warn");
                            wFails++;
                        }
                    } else {
                        candidates = sections;
                    }

                    for (let si = 0; si < candidates.length && !stopped; si++) {
                        const section = candidates[si];
                        const sectionTag =
                            candidates.length > 1
                                ? "[" + (si + 1) + "/" + candidates.length + "] "
                                : "";

                        log(
                            wTag +
                                "🎯 " +
                                sectionTag +
                                target.code +
                                " " +
                                (section.sportName || section.KCM || "") +
                                " | " +
                                section.SKJS +
                                " | " +
                                (section.YXRS || "?") +
                                "/" +
                                (section.KRL || "?"),
                            "found",
                        );

                        // Pre-select batch (first batch, lottery-based): query available volunteers first, submit with chooseVolunteer
                        let chosenVolunteer = null;
                        if (target.type === "XGKC" && isPreselectBatch()) {
                            const volList = await getVolunteerList(target.type, section.JXBID);
                            if (!volList.length) {
                                log(
                                    wTag + "⏭ " + target.code + " 志愿已满/不可选，跳过该班",
                                    "warn",
                                );
                                continue;
                            }
                            const want = target.volunteer || volunteer;
                            chosenVolunteer = volList.some(function (v) {
                                return v.grade === want;
                            })
                                ? want
                                : volList[0].grade;
                        }

                        const result = await addCourse(
                            section,
                            target.type,
                            target.secretVal,
                            chosenVolunteer,
                        );

                        if (result.code === 200) {
                            log(wTag + "📨 " + target.code + " 已提交，等待队列...");
                            await wait(1000);

                            if (chosenVolunteer) {
                                const volName =
                                    VOLUNTEER_NAMES[chosenVolunteer] ||
                                    "第 " + chosenVolunteer + " 志愿";
                                log(
                                    wTag +
                                        "✅ " +
                                        target.code +
                                        " 已提交" +
                                        volName +
                                        "，等待摇号结果",
                                    "success",
                                );
                                grabbed.push(target.code);
                                updateProgress();
                                renderCourseList();
                                saveConfig();
                                beep(true);
                                if (window.grablessonsVue) {
                                    window.grablessonsVue.$message({
                                        type: "success",
                                        message:
                                            "🎉 " +
                                            target.code +
                                            " " +
                                            (target.name || "") +
                                            " " +
                                            volName +
                                            " 已提交，等待摇号！",
                                        duration: 8000,
                                        showClose: true,
                                    });
                                }
                                return true;
                            }

                            const verified =
                                target.type === "TYKC" || target.type === "TJKC"
                                    ? await verifyBySelect(
                                          target.code,
                                          target.jxbid,
                                          target.sportName,
                                      )
                                    : await verifyCourseGrab(target.code);
                            if (verified) {
                                log(wTag + "✅ " + target.code + " 抢课成功！", "success");
                                grabbed.push(target.code);
                                updateProgress();
                                renderCourseList();
                                saveConfig();
                                beep(true);
                                if (window.grablessonsVue) {
                                    window.grablessonsVue.$message({
                                        type: "success",
                                        message:
                                            "🎉 " +
                                            target.code +
                                            " " +
                                            (target.name || "") +
                                            " 抢课成功！",
                                        duration: 8000,
                                        showClose: true,
                                    });
                                }
                                return true;
                            }
                            log(wTag + "❌ " + target.code + " 验证失败，重试中", "warn");
                            if (si < candidates.length - 1) {
                                log(wTag + "⏭ 尝试下一个教学班...");
                            }
                        } else if (
                            result.code === 500 &&
                            result.msg &&
                            (result.msg.indexOf("选课门数") !== -1 ||
                                result.msg.indexOf("学分") !== -1)
                        ) {
                            log(wTag + "⏭ " + target.code + " 门数/学分超限，跳过", "warn");
                            skipped.push(target.code);
                            creditsFull = true;
                            updateProgress();
                            renderCourseList();
                            saveConfig();
                            return true;
                        } else if (
                            result.code === 500 &&
                            result.msg &&
                            result.msg.indexOf("已在选课结果中") !== -1
                        ) {
                            log(wTag + "🎉 " + target.code + " 已在选课结果中", "success");
                            grabbed.push(target.code);
                            updateProgress();
                            renderCourseList();
                            saveConfig();
                            beep(true);
                            return true;
                        } else if (
                            result.code === 401 ||
                            result.code === 402 ||
                            result.code === 403
                        ) {
                            log(wTag + "❌ 登录已过期！", "error");
                            stopped = true;
                            return false;
                        } else {
                            log(
                                wTag +
                                    "⚠️ " +
                                    target.code +
                                    " [" +
                                    result.code +
                                    "] " +
                                    (result.msg || "未知错误"),
                                "warn",
                            );
                            if (si < candidates.length - 1) {
                                log(wTag + "⏭ 尝试下一个教学班...");
                            }
                        }
                    }

                    wFails++;
                } else {
                    log(wTag + "🔍 " + target.code + " 未搜到", "warn");
                    wFails++;
                }
            } catch (err) {
                log(
                    wTag + "💥 网络异常: " + (err && err.message ? err.message : String(err)),
                    "error",
                );
                wFails++;
            }

            const delay = currentBackoff(wFails);
            if (wFails > 2) {
                log(wTag + "⏸ 连续失败 " + wFails + " 次，退避 " + delay + "ms", "warn");
            }
            await wait(delay);
        }
        return false;
    }

    async function worker(workerId) {
        log("[W" + workerId + "] 启动", "info");
        while (!stopped) {
            if (creditsFull) {
                log("[W" + workerId + "] 学分/门数已满，退出", "warn");
                return;
            }
            const claimed_course = claimNextCourse();
            if (!claimed_course) {
                log("[W" + workerId + "] 无剩余课程，退出", "info");
                return;
            }
            const target = claimed_course.course;
            workerTargets[workerId] = { code: target.code, idx: claimed_course.idx };
            renderCourseList();

            await grabOneCourse(target, workerId);

            delete workerTargets[workerId];
            releaseClaim(target.code);
            renderCourseList();
        }
    }

    function startGrab() {
        if (running) return;
        if (!courses.length) {
            log("⚠️ 请先添加课程", "warn");
            return;
        }
        initAudio();
        stopped = false;
        running = true;
        grabbed = [];
        skipped = [];
        claimed = [];
        creditsFull = false;
        workerTargets = {};
        updateBtnState();
        updateProgress();
        renderCourseList();
        const typeCount = {};
        courses.forEach(function (c) {
            typeCount[c.type] = (typeCount[c.type] || 0) + 1;
        });
        const extra = ["TYKC", "TJKC"]
            .filter(function (t) {
                return typeCount[t];
            })
            .map(function (t) {
                return "（" + TYPE_LABELS[t] + " " + typeCount[t] + " 门）";
            })
            .join("");
        log("🚀 开始抢课，共 " + courses.length + " 门，" + concurNum + " 并发" + extra);
        beep(true);

        const workers = [];
        for (let i = 0; i < concurNum; i++) {
            workers.push(worker(i + 1));
        }
        Promise.all(workers).then(function () {
            running = false;
            updateBtnState();
            if (creditsFull) {
                skipRemainingCourses();
                renderCourseList();
                updateProgress();
            }
            if (grabbed.length + skipped.length >= courses.length) {
                log(
                    "🎉 全部课程处理完成！抢到 " +
                        grabbed.length +
                        " 门" +
                        (skipped.length ? "，跳过 " + skipped.length + " 门" : ""),
                    "success",
                );
                beep(true);
            } else if (stopped) {
                log(
                    "⏹ 已停止 | 抢到: " +
                        (grabbed.join(", ") || "无") +
                        (skipped.length ? " | 跳过: " + skipped.join(", ") : ""),
                );
            }
        });
    }

    function stopGrab() {
        if (!running) return;
        stopped = true;
        log("⏹ 正在停止...");
    }

    function skipCourse() {
        if (!running) return;
        const idx = courses.findIndex(function (c) {
            return (
                !grabbed.includes(c.code) && !skipped.includes(c.code) && !claimed.includes(c.code)
            );
        });
        if (idx >= 0) {
            const c = courses[idx];
            skipped.push(c.code);
            log("⏭ 跳过: " + c.code + " " + (c.name || c.note || ""));
            saveConfig();
            renderCourseList();
            updateProgress();
        }
    }

    // ===================== Build Panel =====================
    function buildPanel() {
        const panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.innerHTML = `
<div class="clrt-header" id="clrt-header">
    <span>⚡ Celeritas <span style="font-weight:400;font-size:11px;opacity:.7">v0.1.0</span></span>
    <span>
        <button class="clrt-hdr-btn" id="clrt-btn-min" title="最小化">−</button>
        <button class="clrt-hdr-btn" id="clrt-btn-close" title="关闭">×</button>
    </span>
</div>
<div class="clrt-body" id="clrt-body">
    <div class="clrt-row clrt-row-sm">
        <label>类型</label>
        <select id="clrt-type" class="clrt-select">
            <option value="XGKC">通识选修</option>
            <option value="TYKC">体育俱乐部</option>
            <option value="TJKC">推荐班级课程</option>
        </select>
        <span id="clrt-type-hint" style="font-size:11px;color:#909399"></span>
    </div>
    <div class="clrt-row">
        <input id="clrt-input-keyword" class="clrt-input" style="flex:2" placeholder="课程号或关键词，如 24TS2244" maxlength="40">
        <button id="clrt-btn-search" class="clrt-btn clrt-btn-sm">🔍 搜索</button>
    </div>
    <div class="clrt-search-results" id="clrt-search-results" style="display:none"></div>
    <div class="clrt-course-list" id="clrt-course-list"></div>
    <div class="clrt-row clrt-row-sm">
        <label>间隔</label>
        <select id="clrt-interval" class="clrt-select">
            <option value="400">400ms</option>
            <option value="600">600ms</option>
            <option value="800" selected>800ms</option>
            <option value="1000">1000ms</option>
            <option value="1500">1500ms</option>
            <option value="2000">2000ms</option>
        </select>
        <label style="margin-left:12px">并发</label>
        <select id="clrt-concur" class="clrt-select">
            <option value="1">1</option>
            <option value="2" selected>2</option>
            <option value="3">3</option>
        </select>
        <label style="margin-left:12px">志愿</label>
        <select id="clrt-volunteer" class="clrt-select" title="预选批次志愿（摇号制），正选批次无效">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
        </select>
    </div>
    <div class="clrt-row clrt-row-sm">
        <button id="clrt-btn-start" class="clrt-btn clrt-btn-go">▶ 开始抢课</button>
        <button id="clrt-btn-stop"  class="clrt-btn clrt-btn-stop" style="display:none">⏹ 停止</button>
        <button id="clrt-btn-skip"  class="clrt-btn clrt-btn-warn" style="display:none">⏭ 跳过当前</button>
    </div>
    <div class="clrt-progress-bar"><div class="clrt-progress-fill" id="clrt-progress"></div></div>
    <div class="clrt-progress-text" id="clrt-remaining">0/0</div>
    <div class="clrt-log" id="clrt-log"></div>
</div>`;
        document.body.appendChild(panel);
    }

    // ===================== Draggable Panel =====================
    function makeDraggable() {
        const panel = byId(PANEL_ID);
        const header = byId("clrt-header");
        if (!panel || !header) return;
        let offX = 0,
            offY = 0,
            down = false;

        header.addEventListener("mousedown", function (e) {
            if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON") return; // don't intercept button clicks
            down = true;
            offX = e.clientX - panel.offsetLeft;
            offY = e.clientY - panel.offsetTop;
            panel.style.transition = "none";
        });

        document.addEventListener("mousemove", function (e) {
            if (!down) return;
            const x = Math.max(
                0,
                Math.min(e.clientX - offX, window.innerWidth - panel.offsetWidth),
            );
            const y = Math.max(0, Math.min(e.clientY - offY, window.innerHeight - 50));
            panel.style.left = x + "px";
            panel.style.top = y + "px";
            panel.style.right = "auto";
            panel.style.bottom = "auto";
        });

        document.addEventListener("mouseup", function () {
            if (down) {
                down = false;
                panel.style.transition = "";
            }
        });
    }

    // ===================== Event Binding =====================
    function bindEvents() {
        const keywordEl = byId("clrt-input-keyword");
        const searchBtn = byId("clrt-btn-search");
        const resultsEl = byId("clrt-search-results");

        // search button
        searchBtn.addEventListener("click", function () {
            doSearch();
        });

        // Enter: search by keyword first; a pure course code quick-adds as any section
        keywordEl.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                const kw = keywordEl.value.trim().toUpperCase();
                if (!kw) return;
                // If the input is a pure course code (no spaces, length >= 6), quick-add as any section
                if (
                    /^[A-Z0-9]{6,}$/.test(kw) &&
                    courses.every(function (c) {
                        return c.code !== kw;
                    })
                ) {
                    courses.push({
                        code: kw,
                        name: "",
                        note: "",
                        jxbid: null,
                        secretVal: null,
                        sportName: "",
                        volunteer: volunteer,
                        type: courseType,
                    });
                    saveConfig();
                    renderCourseList();
                    updateProgress();
                    keywordEl.value = "";
                    hideSearchResults();
                    log("+ " + kw + " (任意班)");
                } else {
                    doSearch();
                }
            }
        });

        function doSearch() {
            const kw = keywordEl.value.trim().toUpperCase();
            if (!kw) return;

            showSearchResults('<div class="clrt-search-loading">搜索中...</div>');
            searchByKeyword(kw, courseType)
                .then(function (rows) {
                    if (!rows.length) {
                        showSearchResults('<div class="clrt-search-empty">未找到匹配课程</div>');
                        return;
                    }
                    // Extract the section number from the end of JXBID, e.g. "xxx01" -> "[01]"
                    const courseCodes = {};
                    rows.forEach(function (r) {
                        courseCodes[r.KCH] = true;
                    });
                    const courseCount = Object.keys(courseCodes).length;

                    let html =
                        '<div class="clrt-search-hdr"><span>搜到 ' +
                        courseCount +
                        " 门课程，" +
                        rows.length +
                        ' 个教学班</span><button class="clrt-search-close" id="clrt-search-close">×</button></div>';
                    rows.forEach(function (r) {
                        const sectionNum = r.KXH || (r.JXBID || "").slice(-2) || "";
                        const sectionLabel = sectionNum
                            ? " [" + sectionNum.padStart(2, "0") + "]"
                            : "";
                        const alreadyAdded = courses.some(function (c) {
                            return c.code === r.KCH && c.jxbid === r.JXBID;
                        });
                        const left = r.KRL - (r.YXRS || 0);
                        const teacherStr = Array.isArray(r.SKJS)
                            ? r.SKJS.map(function (t) {
                                  return t.XM || t.xm || t.name || "";
                              })
                                  .filter(Boolean)
                                  .join(", ")
                            : r.SKJS || "";
                        const timeInfo = r.teachingPlace || "";
                        html +=
                            '<div class="clrt-search-item">' +
                            '<div class="clrt-search-item-main">' +
                            '<span class="clrt-search-item-code">' +
                            r.KCH +
                            sectionLabel +
                            "</span>" +
                            " <span>" +
                            (r.sportName || r.KCM || "") +
                            "</span>" +
                            '<div class="clrt-search-item-meta">' +
                            (teacherStr || "") +
                            (timeInfo ? " | " + timeInfo : "") +
                            "</div>" +
                            "</div>" +
                            '<div class="clrt-search-item-cap">' +
                            '<span class="clrt-cap-left">' +
                            (left >= 0 ? left : "?") +
                            "</span>" +
                            "/" +
                            (r.KRL || "?") +
                            "</div>" +
                            '<button class="clrt-search-add" data-jxbid="' +
                            r.JXBID +
                            '" data-code="' +
                            r.KCH +
                            '" data-name="' +
                            (r.sportName || r.KCM || "").replace(/"/g, "&quot;") +
                            '" data-sport="' +
                            (r.sportName || "").replace(/"/g, "&quot;") +
                            '" data-secret="' +
                            (r.secretVal || "") +
                            '" data-teacher="' +
                            teacherStr.replace(/"/g, "&quot;") +
                            '" data-kxh="' +
                            (r.KXH || (r.JXBID || "").slice(-2) || "") +
                            '"' +
                            (alreadyAdded ? " disabled" : "") +
                            ">" +
                            (alreadyAdded ? "已添加" : "+添加") +
                            "</button>" +
                            "</div>";
                    });
                    showSearchResults(html);
                    // close button
                    document
                        .getElementById("clrt-search-close")
                        .addEventListener("click", hideSearchResults);
                    // add buttons
                    resultsEl.querySelectorAll(".clrt-search-add").forEach(function (btn) {
                        btn.addEventListener("click", function () {
                            if (this.disabled) return;
                            const code = this.dataset.code;
                            const name = this.dataset.name;
                            const jxbid = this.dataset.jxbid;
                            const secretVal = this.dataset.secret;
                            const teacher = this.dataset.teacher;
                            const kxh = this.dataset.kxh;
                            const sportName = this.dataset.sport || "";
                            const sectionTag = kxh ? "[" + kxh.padStart(2, "0") + "] " : "";
                            const note = sectionTag + teacher;
                            courses.push({
                                code: code,
                                name: name,
                                note: note,
                                jxbid: jxbid,
                                secretVal: secretVal,
                                sportName: sportName,
                                volunteer: volunteer,
                                type: courseType,
                            });
                            saveConfig();
                            renderCourseList();
                            updateProgress();
                            hideSearchResults();
                            keywordEl.value = "";
                            log(
                                "+ " +
                                    code +
                                    (kxh ? " [" + kxh.padStart(2, "0") + "]" : "") +
                                    " " +
                                    (sportName || name) +
                                    " (" +
                                    teacher +
                                    ")",
                            );
                        });
                    });
                })
                .catch(function () {
                    showSearchResults('<div class="clrt-search-empty">搜索失败，请重试</div>');
                });
        }

        function showSearchResults(html) {
            resultsEl.innerHTML = html;
            resultsEl.style.display = "";
        }

        function hideSearchResults() {
            resultsEl.style.display = "none";
            resultsEl.innerHTML = "";
        }

        byId("clrt-btn-start").addEventListener("click", startGrab);
        byId("clrt-btn-stop").addEventListener("click", stopGrab);
        byId("clrt-btn-skip").addEventListener("click", skipCourse);

        byId("clrt-interval").addEventListener("change", function () {
            interval = parseInt(this.value);
            saveConfig();
        });

        byId("clrt-concur").addEventListener("change", function () {
            concurNum = parseInt(this.value);
            saveConfig();
        });

        byId("clrt-type").addEventListener("change", function () {
            courseType = this.value;
            saveConfig();
            updateTypeHint();
            hideSearchResults();
        });

        byId("clrt-volunteer").addEventListener("change", function () {
            volunteer = parseInt(this.value);
            saveConfig();
        });

        // minimize / close
        byId("clrt-btn-min").addEventListener("click", function () {
            const body = byId("clrt-body");
            const btn = byId("clrt-btn-min");
            if (body.style.display === "none") {
                body.style.display = "";
                btn.textContent = "−";
            } else {
                body.style.display = "none";
                btn.textContent = "+";
            }
        });

        byId("clrt-btn-close").addEventListener("click", function () {
            if (running) {
                if (!confirm("正在抢课中，确定关闭面板吗？")) return;
                stopGrab();
            }
            byId(PANEL_ID).style.display = "none";
            // Add a small floating button to reopen the panel
            showReopenBtn();
        });
    }

    function showReopenBtn() {
        if (byId("clrt-reopen")) return;
        const btn = document.createElement("button");
        btn.id = "clrt-reopen";
        btn.textContent = "⚡";
        btn.title = "打开抢课助手";
        btn.addEventListener("click", function () {
            byId(PANEL_ID).style.display = "";
            this.remove();
        });
        document.body.appendChild(btn);
    }

    // ===================== Startup =====================
    function init() {
        injectStyles();
        loadConfig();
        buildPanel();
        makeDraggable();
        bindEvents();
        renderCourseList();
        updateProgress();
        updateBtnState();

        // Restore the select defaults
        const sel = byId("clrt-interval");
        if (sel) sel.value = String(interval);
        const concurSel = byId("clrt-concur");
        if (concurSel) concurSel.value = String(concurNum);
        const typeSel = byId("clrt-type");
        if (typeSel) typeSel.value = courseType;
        const volSel = byId("clrt-volunteer");
        if (volSel) volSel.value = String(volunteer);
        updateTypeHint();

        log("✅ 抢课助手已就绪 | 共 " + courses.length + " 门课程");

        // Listen for page visibility: browsers throttle setTimeout when hidden, which slows grabbing
        document.addEventListener("visibilitychange", function () {
            if (document.hidden && running) {
                log("⚠️ 页面已隐藏！浏览器可能降频定时器影响抢课速度，请保持此标签页可见", "warn");
            }
        });
    }

    // Wait until the page is ready: both axios and grablessonsVue are needed
    function waitForReady(retries) {
        retries = retries || 0;
        if (retries > 100) {
            console.warn("[Celeritas] 等待页面超时，强制初始化");
            init();
            return;
        }
        if (window.axios && window.grablessonsVue) {
            init();
        } else {
            setTimeout(function () {
                waitForReady(retries + 1);
            }, 200);
        }
    }

    // Start once the page has finished loading
    if (document.readyState === "complete") {
        waitForReady();
    } else {
        window.addEventListener("load", function () {
            waitForReady();
        });
    }
})();
