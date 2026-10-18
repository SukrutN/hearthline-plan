import { describe, expect, it } from "vitest";
import { findClashes } from "@hearthline/domain";

describe("clash detection", () => {
  it("ignores the same square at another minute and flags a shared vertex", () => {
    const calm = findClashes([
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
      [{ x: 0, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }],
    ]);
    expect(calm).toEqual([]);

    const crowded = findClashes([
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 1, y: 1 }, { x: 1, y: 0 }],
    ]);
    expect(crowded.some((clash) => clash.kind === "vertex" && clash.time === 1 && clash.x === 1)).toBe(true);
  });

  it("flags a swap and allows one traveler to follow another", () => {
    const swap = findClashes([
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 1, y: 0 }, { x: 0, y: 0 }],
    ]).filter((clash) => clash.kind === "edge");
    expect(swap).toHaveLength(1);

    const follow = findClashes([
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
      [{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
    ]);
    expect(follow.some((clash) => clash.kind === "edge")).toBe(false);
  });

  it("keeps a finished traveler on the goal", () => {
    const sitting = findClashes([
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 2, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }],
    ]);
    expect(sitting.some((clash) => clash.kind === "vertex" && clash.time === 2)).toBe(true);
  });
});
