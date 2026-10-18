import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { auditPlan } from "@hearthline/domain";
import { solveDocument } from "@hearthline/application";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureDir = path.join(root, "fixtures");

function load(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixtureDir, `${name}.json`), "utf8")) as unknown;
}

function planned(name: string) {
  const result = solveDocument(load(name), "both");
  expect(result.status).toBe("planned");
  if (result.status !== "planned") throw new Error(name);
  return result.comparison;
}

describe("published floors", () => {
  it("locks Crosscurrent to the showcase comparison", () => {
    const comparison = planned("crosscurrent");
    const cbs = comparison.plans.cbs;
    const icbs = comparison.plans.icbs;
    expect(cbs?.ok).toBe(true);
    expect(icbs?.ok).toBe(true);
    expect(cbs?.cost).toBe(11);
    expect(icbs?.cost).toBe(11);
    expect(cbs?.highLevelExpanded).toBe(4);
    expect(icbs?.highLevelExpanded).toBe(2);
    expect(cbs?.lowLevelExpansions).toBe(38);
    expect(icbs?.lowLevelExpansions).toBe(26);
    expect(icbs?.bypasses).toBe(1);
    expect(icbs?.highLevelExpanded).toBeLessThan(cbs?.highLevelExpanded ?? 0);
    expect(auditPlan(instanceOf(comparison.floor), cbs?.paths ?? [])).toBeNull();
    expect(auditPlan(instanceOf(comparison.floor), icbs?.paths ?? [])).toBeNull();

    const cbsFirst = cbs?.resolved[0];
    expect(cbsFirst?.bypassed).toBe(false);
    expect(cbsFirst?.clash).toMatchObject({ kind: "vertex", time: 1, x: 7, y: 4, left: 0, right: 1 });

    const icbsSplit = icbs?.resolved.find((item) => !item.bypassed);
    expect(icbsSplit?.classification).toBe("cardinal");
    expect(icbsSplit?.clash).toMatchObject({ kind: "vertex", time: 1, x: 2, y: 2, left: 2, right: 3 });
    expect(icbs?.resolved.some((item) => item.bypassed && item.classification === "non-cardinal")).toBe(true);
  });

  it("locks Exchange, a smaller and different floor, to cost 6", () => {
    const comparison = planned("exchange");
    expect(comparison.floor.width).toBe(3);
    expect(comparison.floor.travelers.map((traveler) => traveler.name)).toEqual(["Ada", "Bo"]);
    expect(comparison.plans.cbs?.cost).toBe(6);
    expect(comparison.plans.icbs?.cost).toBe(6);
    expect(auditPlan(instanceOf(comparison.floor), comparison.plans.cbs?.paths ?? [])).toBeNull();
    expect(auditPlan(instanceOf(comparison.floor), comparison.plans.icbs?.paths ?? [])).toBeNull();
  });

  it("keeps ICBS from returning a worse cost on every shipped floor", () => {
    for (const file of readdirSync(fixtureDir).filter((name) => name.endsWith(".json"))) {
      const comparison = planned(file.replace(/\.json$/, ""));
      const cbs = comparison.plans.cbs;
      const icbs = comparison.plans.icbs;
      expect(icbs?.cost, file).toBe(cbs?.cost);
      expect(icbs?.cost, file).toBeLessThanOrEqual(cbs?.cost ?? 0);
      expect(auditPlan(instanceOf(comparison.floor), cbs?.paths ?? []), file).toBeNull();
    }
  });
});

describe("the solver does not contain the sample", () => {
  it("keeps traveler names and fixture ids out of the domain sources", () => {
    const sourceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
    const text = readdirSync(sourceDir)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => readFileSync(path.join(sourceDir, name), "utf8"))
      .join("\n");
    expect(text).not.toContain("crosscurrent");
    expect(text).not.toContain("Ada");
    expect(text).not.toContain("Exchange");
  });
});

function instanceOf(floor: { width: number; height: number; walls: readonly { x: number; y: number }[]; travelers: readonly { name: string; start: { x: number; y: number }; goal: { x: number; y: number } }[] }) {
  return {
    floor: { width: floor.width, height: floor.height, walls: new Set(floor.walls.map((wall) => `${wall.x},${wall.y}`)) },
    travelers: floor.travelers,
  };
}
