// @ts-check
import { describe, expect, it } from "vitest";
import {
    backoffDelay,
    courseListed,
    courseSelected,
    effectiveConcurrency,
    extractRows,
    extractSections,
    findNextCourseIndex,
    findRemaining,
    isLotteryRound,
    markRemainingSkipped,
    normalizeCourse,
    pickVolunteer,
    releaseClaimed,
    roundFromBatchName,
} from "../src/core.js";

describe("extractRows", () => {
    it("returns [] for nullish input", () => {
        expect(extractRows(null)).toEqual([]);
        expect(extractRows(undefined)).toEqual([]);
    });

    it("passes through arrays", () => {
        const rows = [{ KCH: "24TS2244" }];
        expect(extractRows(rows)).toBe(rows);
    });

    it("unwraps { rows } objects", () => {
        const rows = [{ KCH: "A" }, { KCH: "B" }];
        expect(extractRows({ rows: rows })).toEqual(rows);
        expect(extractRows({})).toEqual([]);
    });
});

describe("extractSections", () => {
    it("returns rows unchanged for XGKC", () => {
        const rows = [{ KCH: "A" }, { KCH: "B" }];
        expect(extractSections(rows, "XGKC")).toBe(rows);
    });

    it("flattens tcList for TYKC/TJKC", () => {
        const rows = [
            { KCH: "A", tcList: [{ JXBID: "a1" }, { JXBID: "a2" }] },
            { KCH: "B", tcList: [] },
            { KCH: "C" },
        ];
        expect(extractSections(rows, "TYKC")).toEqual([
            { JXBID: "a1" },
            { JXBID: "a2" },
            { KCH: "B", tcList: [] },
            { KCH: "C" },
        ]);
    });

    it("handles null rows", () => {
        expect(extractSections(null, "TJKC")).toEqual([]);
    });
});

describe("backoffDelay", () => {
    it("grows exponentially with failure count", () => {
        expect(backoffDelay(800, 0, 5000)).toBe(800);
        expect(backoffDelay(800, 1, 5000)).toBe(1600);
        expect(backoffDelay(800, 2, 5000)).toBe(3200);
        expect(backoffDelay(400, 2, 5000)).toBe(1600);
    });

    it("caps at max backoff", () => {
        expect(backoffDelay(800, 3, 5000)).toBe(5000);
        expect(backoffDelay(800, 10, 5000)).toBe(5000);
    });
});

describe("findNextCourseIndex", () => {
    const cs = () => [{ code: "A" }, { code: "B" }, { code: "C" }];

    it("returns first unclaimed/ungrabbed/unskipped course", () => {
        expect(findNextCourseIndex(cs(), [], [], [])).toBe(0);
        expect(findNextCourseIndex(cs(), ["A"], [], [])).toBe(1);
        expect(findNextCourseIndex(cs(), [], ["A"], [])).toBe(1);
        expect(findNextCourseIndex(cs(), [], [], ["A", "B"])).toBe(2);
        expect(findNextCourseIndex(cs(), ["B"], [], ["A"])).toBe(2);
    });

    it("returns -1 when everything is done", () => {
        expect(findNextCourseIndex(cs(), ["A", "B", "C"], [], [])).toBe(-1);
        expect(findNextCourseIndex([], [], [], [])).toBe(-1);
    });
});

describe("findRemaining", () => {
    it("excludes grabbed and skipped courses", () => {
        const cs = [{ code: "A" }, { code: "B" }, { code: "C" }];
        expect(findRemaining(cs, ["B"], ["C"])).toEqual([{ code: "A" }]);
        expect(findRemaining(cs, ["A", "B", "C"], [])).toEqual([]);
    });
});

describe("normalizeCourse", () => {
    it("fills legacy defaults", () => {
        expect(normalizeCourse({ code: "A" })).toEqual({
            code: "A",
            jxbid: null,
            secretVal: null,
            type: "XGKC",
            sportName: "",
            volunteer: 1,
        });
    });

    it("keeps existing fields untouched", () => {
        const course = {
            code: "A",
            jxbid: "x",
            secretVal: "s",
            type: "TYKC",
            sportName: "羽毛球",
            volunteer: 2,
        };
        expect(normalizeCourse(course)).toBe(course);
        expect(normalizeCourse(course)).toEqual(course);
    });
});

describe("releaseClaimed", () => {
    it("removes the released code and keeps the rest", () => {
        expect(releaseClaimed(["A", "B"], "A")).toEqual(["B"]);
        expect(releaseClaimed(["A", "B"], "C")).toEqual(["A", "B"]);
    });
});

describe("markRemainingSkipped", () => {
    it("marks every pending course while keeping grabbed ones", () => {
        const courses = [{ code: "A" }, { code: "B" }, { code: "C" }];
        const skipped = [];
        markRemainingSkipped(courses, ["A"], skipped);
        expect(skipped).toEqual(["B", "C"]);
    });

    it("does not duplicate already-skipped codes", () => {
        const courses = [{ code: "A" }, { code: "B" }];
        const skipped = ["A"];
        markRemainingSkipped(courses, [], skipped);
        expect(skipped).toEqual(["A", "B"]);
    });
});

describe("pickVolunteer", () => {
    const volList = () => [{ grade: 1 }, { grade: 2 }, { grade: 3 }];

    it("returns the wanted grade when available", () => {
        expect(pickVolunteer(volList(), 2)).toBe(2);
    });

    it("falls back to the first available grade", () => {
        expect(pickVolunteer(volList(), 5)).toBe(1);
    });
});

describe("courseListed", () => {
    it("matches an exact course code", () => {
        expect(courseListed([{ KCH: "24TS2244" }], "24TS2244")).toBe(true);
    });

    it("matches by code prefix", () => {
        expect(courseListed([{ KCH: "24TS2244-01" }], "24TS2244")).toBe(true);
    });

    it("does not match unrelated rows", () => {
        expect(courseListed([{ KCH: "25TS1000" }], "24TS2244")).toBe(false);
        expect(courseListed([], "24TS2244")).toBe(false);
    });
});

describe("courseSelected", () => {
    const rows = () => [
        { KCH: "A", JXBID: "a1", sportName: "羽毛球" },
        { KCH: "B", JXBID: "b1", sportName: "乒乓球" },
    ];

    it("matches by exact section when a section is specified", () => {
        expect(courseSelected(rows(), "A", "a1", "")).toBe(true);
        expect(courseSelected(rows(), "A", "zz", "")).toBe(false);
    });

    it("matches a specific club by name", () => {
        expect(courseSelected(rows(), "A", "", "乒乓球")).toBe(true);
        expect(courseSelected(rows(), "A", "", "足球")).toBe(false);
    });

    it("falls back to any section of the course", () => {
        expect(courseSelected(rows(), "B", "", "")).toBe(true);
        expect(courseSelected(rows(), "C", "", "")).toBe(false);
    });
});

describe("roundFromBatchName", () => {
    it("detects the round from real batch names", () => {
        expect(roundFromBatchName("第一轮通识选修课程（2025级）")).toBe("first");
        expect(roundFromBatchName("第一轮方案内课程（2025级）")).toBe("first");
        expect(roundFromBatchName("第二轮通识选修课程（2025级）")).toBe("second");
        expect(roundFromBatchName("第二轮方案内课程（2025级）")).toBe("second");
    });

    it("returns null for unknown names", () => {
        expect(roundFromBatchName(undefined)).toBe(null);
        expect(roundFromBatchName("")).toBe(null);
        expect(roundFromBatchName("某批次")).toBe(null);
    });
});

describe("isLotteryRound", () => {
    it("only first-round electives are lottery-based", () => {
        expect(isLotteryRound("first", "XGKC")).toBe(true);
        expect(isLotteryRound("first", "TYKC")).toBe(false);
        expect(isLotteryRound("first", "TJKC")).toBe(false);
        expect(isLotteryRound("second", "XGKC")).toBe(false);
        expect(isLotteryRound(null, "XGKC")).toBe(false);
    });
});

describe("effectiveConcurrency", () => {
    it("fixes concurrency at 1 only for the lottery round", () => {
        expect(effectiveConcurrency("first", "XGKC", 3)).toBe(1);
        expect(effectiveConcurrency("first", "TYKC", 3)).toBe(3);
        expect(effectiveConcurrency("second", "XGKC", 3)).toBe(3);
        expect(effectiveConcurrency(null, "XGKC", 3)).toBe(3);
    });
});
