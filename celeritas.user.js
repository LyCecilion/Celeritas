// ==UserScript==
// @name         Celeritas
// @namespace    celeritas
// @version      0.1.0
// @description  On the Roche Limit.
// @author       LyCecilion
// @match        https://xk.xidian.edu.cn/xsxk/elective/grablessons*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  // src/core.js
  function extractRows(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (
      typeof data === "object" &&
      "rows" in data &&
      Array.isArray(data.rows)
    ) {
      return data.rows;
    }
    return [];
  }
  function extractSections(rows, type) {
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
  function backoffDelay(baseInterval, consecutiveFails, max) {
    const b = baseInterval * Math.pow(2, consecutiveFails);
    return Math.min(b, max);
  }
  function findNextCourseIndex(courses, grabbed, skipped, claimed) {
    return courses.findIndex(function (c) {
      return (
        !grabbed.includes(c.code) &&
        !skipped.includes(c.code) &&
        !claimed.includes(c.code)
      );
    });
  }
  function findRemaining(courses, grabbed, skipped) {
    return courses.filter(
      (c) => !grabbed.includes(c.code) && !skipped.includes(c.code),
    );
  }
  function normalizeCourse(c) {
    if (!("jxbid" in c)) {
      c.jxbid = null;
      c.secretVal = null;
    }
    c.type = c.type || "XGKC";
    c.sportName = c.sportName || "";
    c.volunteer = c.volunteer || 1;
    return c;
  }

  // src/main.js
  (function () {
    "use strict";
    function byId(id) {
      return (
        /** @type {HTMLElement} */
        document.getElementById(id)
      );
    }
    const LS_KEY =
      "clrt_courses_" +
      (new URLSearchParams(location.search).get("batchId") || "default");
    const LEGACY_LS_KEY =
      "ccb_courses_" +
      (new URLSearchParams(location.search).get("batchId") || "default");
    const PANEL_ID = "clrt-panel";
    const LOG_MAX = 200;
    const TYPE_LABELS = {
      XGKC: "\u901A\u8BC6\u9009\u4FEE",
      TYKC: "\u4F53\u80B2\u4FF1\u4E50\u90E8",
      TJKC: "\u63A8\u8350\u73ED\u7EA7\u8BFE\u7A0B",
    };
    const TYPE_PAGE_HINT = {
      XGKC: "\u901A\u8BC6\u9009\u4FEE\u5728\u901A\u8BC6\u9009\u4FEE\u8BFE\u7A0B\u9875\u9762",
      TYKC: "\u4F53\u80B2\u4FF1\u4E50\u90E8\u5728\u65B9\u6848\u5185\u8BFE\u7A0B\u9875\u9762",
      TJKC: "\u63A8\u8350\u73ED\u7EA7\u8BFE\u7A0B\u5728\u65B9\u6848\u5185\u8BFE\u7A0B\u9875\u9762",
    };
    const TYPE_PLACEHOLDER = {
      XGKC: "\u8BFE\u7A0B\u53F7\u6216\u5173\u952E\u8BCD\uFF0C\u5982 24TS2244",
      TYKC: "\u8BFE\u7A0B\u540D\u6216\u4FF1\u4E50\u90E8\uFF0C\u5982 \u7FBD\u6BDB\u7403",
      TJKC: "\u8BFE\u7A0B\u540D\u6216\u5173\u952E\u8BCD\uFF0C\u5982 \u9AD8\u7EA7\u5199\u4F5C",
    };
    const TYPE_TAG = { TYKC: "\u4F53", TJKC: "\u63A8" };
    const VOLUNTEER_NAMES = {
      1: "\u7B2C\u4E00\u5FD7\u613F",
      2: "\u7B2C\u4E8C\u5FD7\u613F",
      3: "\u7B2C\u4E09\u5FD7\u613F",
      4: "\u7B2C\u56DB\u5FD7\u613F",
      5: "\u7B2C\u4E94\u5FD7\u613F",
    };
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
    let courses = [];
    let interval = 800;
    let concurNum = 2;
    let courseType = "XGKC";
    let volunteer = 1;
    let running = false;
    let stopped = false;
    let grabbed = [];
    let skipped = [];
    let claimed = [];
    let creditsFull = false;
    let workerTargets = {};
    const MAX_BACKOFF = 5e3;
    let audioCtx = null;
    function initAudio() {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {}
    }
    function beep(happy) {
      if (!audioCtx) return;
      try {
        const notes = happy ? [800, 1e3, 1200, 1600] : [500, 400, 300];
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
      } catch (_) {}
    }
    function loadConfig() {
      try {
        let raw = localStorage.getItem(LS_KEY);
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
      } catch (_) {}
      courses = [];
    }
    function saveConfig() {
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({
            courses,
            interval,
            concurNum,
            courseType,
            volunteer,
          }),
        );
      } catch (_) {}
    }
    function log(msg, type) {
      const el = byId("clrt-log");
      if (!el) return;
      const now = /* @__PURE__ */ new Date();
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
      while (el.children.length > LOG_MAX) el.firstChild.remove();
      el.scrollTop = el.scrollHeight;
    }
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
            : '<span style="color:#e6a23c;font-size:11px;flex-shrink:0">\u4EFB\u610F\u73ED</span>';
          const typeTag = TYPE_TAG[c.type]
            ? '<span class="clrt-type-tag">' + TYPE_TAG[c.type] + "</span>"
            : "";
          const isGrabbed = grabbed.includes(c.code);
          const isSkipped = skipped.includes(c.code);
          const doneClass = isGrabbed
            ? " clrt-grabbed"
            : isSkipped
              ? " clrt-skipped"
              : "";
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
          if (isGrabbed)
            badge = '<span class="clrt-badge clrt-badge-ok">\u2713</span>';
          else if (isSkipped)
            badge = '<span class="clrt-badge clrt-badge-skip">\u23ED</span>';
          return `
                <div class="clrt-course-item${doneClass}${activeClass}" draggable="true" data-idx="${i}">
                    <span class="clrt-course-code">${c.code}</span>
                    ${typeTag}
                    <span class="clrt-course-name">${displayName}</span>
                    ${sectionTag}
                    ${workerBadge}
                    ${badge}
                    <button class="clrt-course-del" data-idx="${i}" title="\u5220\u9664">\xD7</button>
                </div>`;
        })
        .join("");
      el.querySelectorAll(".clrt-course-del").forEach((btn) => {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          const idx = parseInt(this.dataset.idx);
          const c = courses[idx];
          courses.splice(idx, 1);
          saveConfig();
          renderCourseList();
          updateProgress();
          log("\u5DF2\u79FB\u9664: " + c.code);
        });
      });
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
      if (skippedCount) extra += " | \u8DF3\u8FC7: " + skippedCount;
      remainEl.textContent =
        done +
        "/" +
        total +
        (remain.length
          ? " \u5269\u4F59: " + remain.map((c) => c.code).join(", ")
          : " \u{1F389} \u5168\u90E8\u5B8C\u6210\uFF01") +
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
        input.placeholder =
          TYPE_PLACEHOLDER[courseType] || TYPE_PLACEHOLDER.XGKC;
      }
      if (hint) {
        hint.textContent = TYPE_PAGE_HINT[courseType] || TYPE_PAGE_HINT.XGKC;
      }
    }
    function wait(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }
    function getCampus() {
      try {
        if (window.grablessonsVue && window.grablessonsVue.currentCampus) {
          return window.grablessonsVue.currentCampus.code;
        }
      } catch (_) {}
      return "S";
    }
    function isPreselectBatch() {
      try {
        if (
          window.grablessonsVue &&
          window.grablessonsVue.lcParam &&
          window.grablessonsVue.lcParam.currentBatch
        ) {
          return window.grablessonsVue.lcParam.currentBatch.typeCode === "01";
        }
      } catch (_) {}
      return false;
    }
    async function getVolunteerList(clazzType, jxbId) {
      try {
        const res = await axios.post("/volunteer/list/choose", {
          clazzType,
          clazzId: jxbId,
        });
        if (!res || !res.data || res.data.code !== 200) return [];
        const d = res.data.data;
        return Array.isArray(d) ? d : (d && d.rows) || [];
      } catch (_) {
        return [];
      }
    }
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
      if (
        !res ||
        typeof res.data !== "object" ||
        !res.data ||
        res.data.code !== 200
      )
        return [];
      return extractSections(extractRows(res.data.data), type);
    }
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
        return [];
      }
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
          const body = new URLSearchParams();
          body.append("clazzType", clazzType);
          body.append("clazzId", courseObj.JXBID);
          body.append("secretVal", courseObj.secretVal || fallbackSecret || "");
          res = await axios.post("/elective/clazz/add", body.toString(), {
            timeout: 1e4,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          });
        } else {
          const payload = {
            clazzType,
            clazzId: courseObj.JXBID,
            secretVal: courseObj.secretVal,
          };
          if (volunteerGrade) payload.chooseVolunteer = volunteerGrade;
          res = await axios.post("/elective/clazz/add", payload, {
            timeout: 1e4,
          });
        }
      } catch (_) {
        return { code: -1, msg: "\u7F51\u7EDC\u5F02\u5E38" };
      }
      if (!res || typeof res.data !== "object" || !res.data) {
        return { code: -1, msg: "\u670D\u52A1\u7AEF\u5F02\u5E38\u54CD\u5E94" };
      }
      return res.data;
    }
    async function verifyCourseGrab(code, maxRetries) {
      maxRetries = maxRetries || 4;
      for (let i = 0; i < maxRetries; i++) {
        if (i > 0) await wait(1e3);
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
        if (
          !res ||
          typeof res.data !== "object" ||
          !res.data ||
          res.data.code !== 200
        )
          continue;
        const rows = extractRows(res.data.data);
        if (!rows || !rows.length) continue;
        const found = rows.find(function (r) {
          return r.KCH === code || (r.KCH && r.KCH.indexOf(code) !== -1);
        });
        if (found) {
          log(
            "\u2714 \u5DF2\u9A8C\u8BC1: " +
              code +
              " \u51FA\u73B0\u5728\u5DF2\u9009\u5217\u8868\uFF08\u7B2C " +
              (i + 1) +
              " \u6B21\u67E5\u8BE2\uFF09",
            "success",
          );
          return true;
        }
        if (i < maxRetries - 1) {
          log(
            "\u23F3 " +
              code +
              " \u672A\u5728\u5DF2\u9009\u5217\u8868\uFF0C\u7B49\u5F85\u961F\u5217\u5904\u7406... (" +
              (i + 1) +
              "/" +
              maxRetries +
              ")",
          );
        }
      }
      return false;
    }
    async function verifyBySelect(code, jxbid, sportName, maxRetries) {
      maxRetries = maxRetries || 4;
      for (let i = 0; i < maxRetries; i++) {
        if (i > 0) await wait(1e3);
        let res;
        try {
          res = await axios.post("/elective/select", null);
        } catch (_) {
          continue;
        }
        if (
          !res ||
          typeof res.data !== "object" ||
          !res.data ||
          res.data.code !== 200
        )
          continue;
        const rows = extractRows(res.data.data);
        if (!rows || !rows.length) continue;
        const found = rows.find(function (r) {
          const jx = r.JXBID || r.jxbid || r.clazzId || "";
          const sn = r.sportName || r.sportname || "";
          if (jxbid && jx) return jx === jxbid;
          if (sportName && sn) return sn === sportName;
          const kch = r.KCH || r.kch || "";
          return kch === code || (kch && String(kch).indexOf(code) !== -1);
        });
        if (found) {
          log(
            "\u2714 \u5DF2\u9A8C\u8BC1: " +
              code +
              " \u51FA\u73B0\u5728\u5DF2\u9009\u5217\u8868\uFF08\u7B2C " +
              (i + 1) +
              " \u6B21\u67E5\u8BE2\uFF09",
            "success",
          );
          return true;
        }
        if (i < maxRetries - 1) {
          log(
            "\u23F3 " +
              code +
              " \u672A\u5728\u5DF2\u9009\u5217\u8868\uFF0C\u7B49\u5F85\u961F\u5217\u5904\u7406... (" +
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
      return backoffDelay(interval, consecutiveFails, MAX_BACKOFF);
    }
    function claimNextCourse() {
      if (creditsFull) return null;
      const idx = findNextCourseIndex(courses, grabbed, skipped, claimed);
      if (idx === -1) return null;
      claimed.push(courses[idx].code);
      return { course: courses[idx], idx };
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
                log(
                  wTag +
                    "\u26A0\uFE0F " +
                    target.code +
                    " \u6307\u5B9A\u6559\u5B66\u73ED\u672A\u627E\u5230",
                  "warn",
                );
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
                  "\u{1F3AF} " +
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
              let chosenVolunteer = null;
              if (target.type === "XGKC" && isPreselectBatch()) {
                const volList = await getVolunteerList(
                  target.type,
                  section.JXBID,
                );
                if (!volList.length) {
                  log(
                    wTag +
                      "\u23ED " +
                      target.code +
                      " \u5FD7\u613F\u5DF2\u6EE1/\u4E0D\u53EF\u9009\uFF0C\u8DF3\u8FC7\u8BE5\u73ED",
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
                log(
                  wTag +
                    "\u{1F4E8} " +
                    target.code +
                    " \u5DF2\u63D0\u4EA4\uFF0C\u7B49\u5F85\u961F\u5217...",
                );
                await wait(1e3);
                if (chosenVolunteer) {
                  const volName =
                    VOLUNTEER_NAMES[chosenVolunteer] ||
                    "\u7B2C " + chosenVolunteer + " \u5FD7\u613F";
                  log(
                    wTag +
                      "\u2705 " +
                      target.code +
                      " \u5DF2\u63D0\u4EA4" +
                      volName +
                      "\uFF0C\u7B49\u5F85\u6447\u53F7\u7ED3\u679C",
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
                        "\u{1F389} " +
                        target.code +
                        " " +
                        (target.name || "") +
                        " " +
                        volName +
                        " \u5DF2\u63D0\u4EA4\uFF0C\u7B49\u5F85\u6447\u53F7\uFF01",
                      duration: 8e3,
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
                  log(
                    wTag +
                      "\u2705 " +
                      target.code +
                      " \u62A2\u8BFE\u6210\u529F\uFF01",
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
                        "\u{1F389} " +
                        target.code +
                        " " +
                        (target.name || "") +
                        " \u62A2\u8BFE\u6210\u529F\uFF01",
                      duration: 8e3,
                      showClose: true,
                    });
                  }
                  return true;
                }
                log(
                  wTag +
                    "\u274C " +
                    target.code +
                    " \u9A8C\u8BC1\u5931\u8D25\uFF0C\u91CD\u8BD5\u4E2D",
                  "warn",
                );
                if (si < candidates.length - 1) {
                  log(
                    wTag +
                      "\u23ED \u5C1D\u8BD5\u4E0B\u4E00\u4E2A\u6559\u5B66\u73ED...",
                  );
                }
              } else if (
                result.code === 500 &&
                result.msg &&
                (result.msg.indexOf("\u9009\u8BFE\u95E8\u6570") !== -1 ||
                  result.msg.indexOf("\u5B66\u5206") !== -1)
              ) {
                log(
                  wTag +
                    "\u23ED " +
                    target.code +
                    " \u95E8\u6570/\u5B66\u5206\u8D85\u9650\uFF0C\u8DF3\u8FC7",
                  "warn",
                );
                skipped.push(target.code);
                creditsFull = true;
                updateProgress();
                renderCourseList();
                saveConfig();
                return true;
              } else if (
                result.code === 500 &&
                result.msg &&
                result.msg.indexOf(
                  "\u5DF2\u5728\u9009\u8BFE\u7ED3\u679C\u4E2D",
                ) !== -1
              ) {
                log(
                  wTag +
                    "\u{1F389} " +
                    target.code +
                    " \u5DF2\u5728\u9009\u8BFE\u7ED3\u679C\u4E2D",
                  "success",
                );
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
                log(
                  wTag + "\u274C \u767B\u5F55\u5DF2\u8FC7\u671F\uFF01",
                  "error",
                );
                stopped = true;
                return false;
              } else {
                log(
                  wTag +
                    "\u26A0\uFE0F " +
                    target.code +
                    " [" +
                    result.code +
                    "] " +
                    (result.msg || "\u672A\u77E5\u9519\u8BEF"),
                  "warn",
                );
                if (si < candidates.length - 1) {
                  log(
                    wTag +
                      "\u23ED \u5C1D\u8BD5\u4E0B\u4E00\u4E2A\u6559\u5B66\u73ED...",
                  );
                }
              }
            }
            wFails++;
          } else {
            log(
              wTag + "\u{1F50D} " + target.code + " \u672A\u641C\u5230",
              "warn",
            );
            wFails++;
          }
        } catch (err) {
          log(
            wTag +
              "\u{1F4A5} \u7F51\u7EDC\u5F02\u5E38: " +
              (err && err.message ? err.message : String(err)),
            "error",
          );
          wFails++;
        }
        const delay = currentBackoff(wFails);
        if (wFails > 2) {
          log(
            wTag +
              "\u23F8 \u8FDE\u7EED\u5931\u8D25 " +
              wFails +
              " \u6B21\uFF0C\u9000\u907F " +
              delay +
              "ms",
            "warn",
          );
        }
        await wait(delay);
      }
      return false;
    }
    async function worker(workerId) {
      log("[W" + workerId + "] \u542F\u52A8", "info");
      while (!stopped) {
        if (creditsFull) {
          log(
            "[W" +
              workerId +
              "] \u5B66\u5206/\u95E8\u6570\u5DF2\u6EE1\uFF0C\u9000\u51FA",
            "warn",
          );
          return;
        }
        const claimed_course = claimNextCourse();
        if (!claimed_course) {
          log(
            "[W" +
              workerId +
              "] \u65E0\u5269\u4F59\u8BFE\u7A0B\uFF0C\u9000\u51FA",
            "info",
          );
          return;
        }
        const target = claimed_course.course;
        workerTargets[workerId] = {
          code: target.code,
          idx: claimed_course.idx,
        };
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
        log("\u26A0\uFE0F \u8BF7\u5148\u6DFB\u52A0\u8BFE\u7A0B", "warn");
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
          return (
            "\uFF08" + TYPE_LABELS[t] + " " + typeCount[t] + " \u95E8\uFF09"
          );
        })
        .join("");
      log(
        "\u{1F680} \u5F00\u59CB\u62A2\u8BFE\uFF0C\u5171 " +
          courses.length +
          " \u95E8\uFF0C" +
          concurNum +
          " \u5E76\u53D1" +
          extra,
      );
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
            "\u{1F389} \u5168\u90E8\u8BFE\u7A0B\u5904\u7406\u5B8C\u6210\uFF01\u62A2\u5230 " +
              grabbed.length +
              " \u95E8" +
              (skipped.length
                ? "\uFF0C\u8DF3\u8FC7 " + skipped.length + " \u95E8"
                : ""),
            "success",
          );
          beep(true);
        } else if (stopped) {
          log(
            "\u23F9 \u5DF2\u505C\u6B62 | \u62A2\u5230: " +
              (grabbed.join(", ") || "\u65E0") +
              (skipped.length ? " | \u8DF3\u8FC7: " + skipped.join(", ") : ""),
          );
        }
      });
    }
    function stopGrab() {
      if (!running) return;
      stopped = true;
      log("\u23F9 \u6B63\u5728\u505C\u6B62...");
    }
    function skipCourse() {
      if (!running) return;
      const idx = courses.findIndex(function (c) {
        return (
          !grabbed.includes(c.code) &&
          !skipped.includes(c.code) &&
          !claimed.includes(c.code)
        );
      });
      if (idx >= 0) {
        const c = courses[idx];
        skipped.push(c.code);
        log("\u23ED \u8DF3\u8FC7: " + c.code + " " + (c.name || c.note || ""));
        saveConfig();
        renderCourseList();
        updateProgress();
      }
    }
    function buildPanel() {
      const panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.innerHTML = `
<div class="clrt-header" id="clrt-header">
    <span>\u26A1 Celeritas <span style="font-weight:400;font-size:11px;opacity:.7">v0.1.0</span></span>
    <span>
        <button class="clrt-hdr-btn" id="clrt-btn-min" title="\u6700\u5C0F\u5316">\u2212</button>
        <button class="clrt-hdr-btn" id="clrt-btn-close" title="\u5173\u95ED">\xD7</button>
    </span>
</div>
<div class="clrt-body" id="clrt-body">
    <div class="clrt-row clrt-row-sm">
        <label>\u7C7B\u578B</label>
        <select id="clrt-type" class="clrt-select">
            <option value="XGKC">\u901A\u8BC6\u9009\u4FEE</option>
            <option value="TYKC">\u4F53\u80B2\u4FF1\u4E50\u90E8</option>
            <option value="TJKC">\u63A8\u8350\u73ED\u7EA7\u8BFE\u7A0B</option>
        </select>
        <span id="clrt-type-hint" style="font-size:11px;color:#909399"></span>
    </div>
    <div class="clrt-row">
        <input id="clrt-input-keyword" class="clrt-input" style="flex:2" placeholder="\u8BFE\u7A0B\u53F7\u6216\u5173\u952E\u8BCD\uFF0C\u5982 24TS2244" maxlength="40">
        <button id="clrt-btn-search" class="clrt-btn clrt-btn-sm">\u{1F50D} \u641C\u7D22</button>
    </div>
    <div class="clrt-search-results" id="clrt-search-results" style="display:none"></div>
    <div class="clrt-course-list" id="clrt-course-list"></div>
    <div class="clrt-row clrt-row-sm">
        <label>\u95F4\u9694</label>
        <select id="clrt-interval" class="clrt-select">
            <option value="400">400ms</option>
            <option value="600">600ms</option>
            <option value="800" selected>800ms</option>
            <option value="1000">1000ms</option>
            <option value="1500">1500ms</option>
            <option value="2000">2000ms</option>
        </select>
        <label style="margin-left:12px">\u5E76\u53D1</label>
        <select id="clrt-concur" class="clrt-select">
            <option value="1">1</option>
            <option value="2" selected>2</option>
            <option value="3">3</option>
        </select>
        <label style="margin-left:12px">\u5FD7\u613F</label>
        <select id="clrt-volunteer" class="clrt-select" title="\u9884\u9009\u6279\u6B21\u5FD7\u613F\uFF08\u6447\u53F7\u5236\uFF09\uFF0C\u6B63\u9009\u6279\u6B21\u65E0\u6548">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
        </select>
    </div>
    <div class="clrt-row clrt-row-sm">
        <button id="clrt-btn-start" class="clrt-btn clrt-btn-go">\u25B6 \u5F00\u59CB\u62A2\u8BFE</button>
        <button id="clrt-btn-stop"  class="clrt-btn clrt-btn-stop" style="display:none">\u23F9 \u505C\u6B62</button>
        <button id="clrt-btn-skip"  class="clrt-btn clrt-btn-warn" style="display:none">\u23ED \u8DF3\u8FC7\u5F53\u524D</button>
    </div>
    <div class="clrt-progress-bar"><div class="clrt-progress-fill" id="clrt-progress"></div></div>
    <div class="clrt-progress-text" id="clrt-remaining">0/0</div>
    <div class="clrt-log" id="clrt-log"></div>
</div>`;
      document.body.appendChild(panel);
    }
    function makeDraggable() {
      const panel = byId(PANEL_ID);
      const header = byId("clrt-header");
      if (!panel || !header) return;
      let offX = 0,
        offY = 0,
        down = false;
      header.addEventListener("mousedown", function (e) {
        if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON")
          return;
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
        const y = Math.max(
          0,
          Math.min(e.clientY - offY, window.innerHeight - 50),
        );
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
    function bindEvents() {
      const keywordEl = byId("clrt-input-keyword");
      const searchBtn = byId("clrt-btn-search");
      const resultsEl = byId("clrt-search-results");
      searchBtn.addEventListener("click", function () {
        doSearch();
      });
      keywordEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          const kw = keywordEl.value.trim().toUpperCase();
          if (!kw) return;
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
              volunteer,
              type: courseType,
            });
            saveConfig();
            renderCourseList();
            updateProgress();
            keywordEl.value = "";
            hideSearchResults();
            log("+ " + kw + " (\u4EFB\u610F\u73ED)");
          } else {
            doSearch();
          }
        }
      });
      function doSearch() {
        const kw = keywordEl.value.trim().toUpperCase();
        if (!kw) return;
        showSearchResults(
          '<div class="clrt-search-loading">\u641C\u7D22\u4E2D...</div>',
        );
        searchByKeyword(kw, courseType)
          .then(function (rows) {
            if (!rows.length) {
              showSearchResults(
                '<div class="clrt-search-empty">\u672A\u627E\u5230\u5339\u914D\u8BFE\u7A0B</div>',
              );
              return;
            }
            const courseCodes = {};
            rows.forEach(function (r) {
              courseCodes[r.KCH] = true;
            });
            const courseCount = Object.keys(courseCodes).length;
            let html =
              '<div class="clrt-search-hdr"><span>\u641C\u5230 ' +
              courseCount +
              " \u95E8\u8BFE\u7A0B\uFF0C" +
              rows.length +
              ' \u4E2A\u6559\u5B66\u73ED</span><button class="clrt-search-close" id="clrt-search-close">\xD7</button></div>';
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
                '<div class="clrt-search-item"><div class="clrt-search-item-main"><span class="clrt-search-item-code">' +
                r.KCH +
                sectionLabel +
                "</span> <span>" +
                (r.sportName || r.KCM || "") +
                '</span><div class="clrt-search-item-meta">' +
                (teacherStr || "") +
                (timeInfo ? " | " + timeInfo : "") +
                '</div></div><div class="clrt-search-item-cap"><span class="clrt-cap-left">' +
                (left >= 0 ? left : "?") +
                "</span>/" +
                (r.KRL || "?") +
                '</div><button class="clrt-search-add" data-jxbid="' +
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
                (alreadyAdded ? "\u5DF2\u6DFB\u52A0" : "+\u6DFB\u52A0") +
                "</button></div>";
            });
            showSearchResults(html);
            document
              .getElementById("clrt-search-close")
              .addEventListener("click", hideSearchResults);
            resultsEl
              .querySelectorAll(".clrt-search-add")
              .forEach(function (btn) {
                btn.addEventListener("click", function () {
                  if (this.disabled) return;
                  const code = this.dataset.code;
                  const name = this.dataset.name;
                  const jxbid = this.dataset.jxbid;
                  const secretVal = this.dataset.secret;
                  const teacher = this.dataset.teacher;
                  const kxh = this.dataset.kxh;
                  const sportName = this.dataset.sport || "";
                  const sectionTag = kxh
                    ? "[" + kxh.padStart(2, "0") + "] "
                    : "";
                  const note = sectionTag + teacher;
                  courses.push({
                    code,
                    name,
                    note,
                    jxbid,
                    secretVal,
                    sportName,
                    volunteer,
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
            showSearchResults(
              '<div class="clrt-search-empty">\u641C\u7D22\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5</div>',
            );
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
      byId("clrt-btn-min").addEventListener("click", function () {
        const body = byId("clrt-body");
        const btn = byId("clrt-btn-min");
        if (body.style.display === "none") {
          body.style.display = "";
          btn.textContent = "\u2212";
        } else {
          body.style.display = "none";
          btn.textContent = "+";
        }
      });
      byId("clrt-btn-close").addEventListener("click", function () {
        if (running) {
          if (
            !confirm(
              "\u6B63\u5728\u62A2\u8BFE\u4E2D\uFF0C\u786E\u5B9A\u5173\u95ED\u9762\u677F\u5417\uFF1F",
            )
          )
            return;
          stopGrab();
        }
        byId(PANEL_ID).style.display = "none";
        showReopenBtn();
      });
    }
    function showReopenBtn() {
      if (byId("clrt-reopen")) return;
      const btn = document.createElement("button");
      btn.id = "clrt-reopen";
      btn.textContent = "\u26A1";
      btn.title = "\u6253\u5F00\u62A2\u8BFE\u52A9\u624B";
      btn.addEventListener("click", function () {
        byId(PANEL_ID).style.display = "";
        this.remove();
      });
      document.body.appendChild(btn);
    }
    function init() {
      injectStyles();
      loadConfig();
      buildPanel();
      makeDraggable();
      bindEvents();
      renderCourseList();
      updateProgress();
      updateBtnState();
      const sel = byId("clrt-interval");
      if (sel) sel.value = String(interval);
      const concurSel = byId("clrt-concur");
      if (concurSel) concurSel.value = String(concurNum);
      const typeSel = byId("clrt-type");
      if (typeSel) typeSel.value = courseType;
      const volSel = byId("clrt-volunteer");
      if (volSel) volSel.value = String(volunteer);
      updateTypeHint();
      log(
        "\u2705 \u62A2\u8BFE\u52A9\u624B\u5DF2\u5C31\u7EEA | \u5171 " +
          courses.length +
          " \u95E8\u8BFE\u7A0B",
      );
      document.addEventListener("visibilitychange", function () {
        if (document.hidden && running) {
          log(
            "\u26A0\uFE0F \u9875\u9762\u5DF2\u9690\u85CF\uFF01\u6D4F\u89C8\u5668\u53EF\u80FD\u964D\u9891\u5B9A\u65F6\u5668\u5F71\u54CD\u62A2\u8BFE\u901F\u5EA6\uFF0C\u8BF7\u4FDD\u6301\u6B64\u6807\u7B7E\u9875\u53EF\u89C1",
            "warn",
          );
        }
      });
    }
    function waitForReady(retries) {
      retries = retries || 0;
      if (retries > 100) {
        console.warn(
          "[Celeritas] \u7B49\u5F85\u9875\u9762\u8D85\u65F6\uFF0C\u5F3A\u5236\u521D\u59CB\u5316",
        );
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
    if (document.readyState === "complete") {
      waitForReady();
    } else {
      window.addEventListener("load", function () {
        waitForReady();
      });
    }
  })();
})();
