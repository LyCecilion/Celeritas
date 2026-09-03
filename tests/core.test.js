// @ts-check
import { describe, expect, it } from "vitest";
import {
    backoffDelay,
    extractRows,
    extractSections,
    findNextCourseIndex,
    findRemaining,
    normalizeCourse,
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
