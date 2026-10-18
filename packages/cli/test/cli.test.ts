import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { execute } from "../src/main.js";

const exchange = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures/exchange.json");

describe("hearthline-plan", () => {
  it("prints the published Exchange cost from the fixture file", () => {
    const outcome = execute(["node", "hearthline-plan", "solve", exchange, "--solver", "both"]);
    expect(outcome.code).toBe(0);
    expect(outcome.stdout).toContain("cbs cost: 6");
    expect(outcome.stdout).toContain("icbs cost: 6");
    expect(outcome.stdout).toContain("collision-free");
  });

  it("prints Crosscurrent from the shipped fixture name", () => {
    const outcome = execute(["node", "hearthline-plan", "solve", "--fixture", "crosscurrent", "--solver", "icbs"]);
    expect(outcome.code).toBe(0);
    expect(outcome.stdout).toContain("icbs cost: 11");
    expect(outcome.stdout).toContain("icbs high-level: 2");
    expect(outcome.stdout).toContain("cardinal");
  });

  it("fails clearly on a missing fixture and on an impossible file", () => {
    const missing = execute(["node", "hearthline-plan", "solve", "--fixture", "nope"]);
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("No floor is named");

    const sealed = execute([
      "node",
      "hearthline-plan",
      "solve",
      "--file",
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "sealed.json"),
    ]);
    expect(sealed.code).not.toBe(0);
  });
});
