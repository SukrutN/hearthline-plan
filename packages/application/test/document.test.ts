import { describe, expect, it } from "vitest";
import { parseFloor, solveDocument } from "@hearthline/application";

describe("floor documents", () => {
  it("rejects an empty object, a shared goal, and a walled start", () => {
    expect(parseFloor({}).ok).toBe(false);
    expect(parseFloor({ travelers: [] }).ok).toBe(false);

    const shared = parseFloor({
      width: 3,
      height: 1,
      rows: ["..."],
      travelers: [
        { name: "Ada", start: [0, 0], goal: [1, 0] },
        { name: "Bo", start: [2, 0], goal: [1, 0] },
      ],
    });
    expect(shared.ok).toBe(false);
    if (!shared.ok) expect(shared.issues.some((issue) => issue.message.includes("share a goal"))).toBe(true);

    const walled = parseFloor({
      width: 2,
      height: 1,
      rows: ["#."],
      travelers: [{ name: "Ada", start: [0, 0], goal: [1, 0] }],
    });
    expect(walled.ok).toBe(false);
  });

  it("reports an unreachable goal as unsolvable", () => {
    const result = solveDocument({
      width: 3,
      height: 1,
      walls: [[1, 0]],
      travelers: [{ name: "Ada", start: [0, 0], goal: [2, 0] }],
    });
    expect(result.status).toBe("unsolvable");
  });

  it("rejects rows and walls together", () => {
    const parsed = parseFloor({
      width: 1,
      height: 1,
      rows: ["."],
      walls: [],
      travelers: [{ name: "Ada", start: [0, 0], goal: [0, 0] }],
    });
    expect(parsed.ok).toBe(false);
  });
});
