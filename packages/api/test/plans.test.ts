import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createPlanApp } from "../src/server.js";
import { readCatalog } from "../src/files.js";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");
const catalog = readCatalog(fixtures);
const app = createPlanApp(catalog, () => {});

async function post(body: unknown): Promise<Response> {
  return app.handle(new Request("http://plan.local/v1/plans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

describe("plan API", () => {
  it("serves health, fixtures, and the Crosscurrent sample", async () => {
    const health = await app.handle(new Request("http://plan.local/health"));
    expect(await health.json()).toEqual({ status: "ok" });

    const listed = await app.handle(new Request("http://plan.local/v1/fixtures"));
    const names = (await listed.json()) as { fixtures: string[] };
    expect(names.fixtures).toContain("crosscurrent");
    expect(names.fixtures).toContain("exchange");

    const response = await post({ fixture: "crosscurrent", solver: "both" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { plans: { cbs: { cost: number }; icbs: { cost: number; highLevelExpanded: number } } };
    expect(body.plans.cbs.cost).toBe(11);
    expect(body.plans.icbs.cost).toBe(11);
    expect(body.plans.icbs.highLevelExpanded).toBe(2);
  });

  it("rejects an unknown fixture and an empty body with problem details", async () => {
    const unknown = await post({ fixture: "no-such-floor" });
    expect(unknown.status).toBe(400);
    expect(unknown.headers.get("content-type")).toContain("application/problem+json");
    const problem = (await unknown.json()) as { title: string; status: number };
    expect(problem.status).toBe(400);
    expect(problem.title).toBe("Unknown fixture.");

    const empty = await app.handle(new Request("http://plan.local/v1/plans", { method: "POST", body: "   " }));
    expect(empty.status).toBe(400);
    expect(empty.headers.get("content-type")).toContain("application/problem+json");
  });

  it("rejects a shared goal and reports a sealed corridor", async () => {
    const shared = await post({
      floor: {
        width: 3,
        height: 1,
        rows: ["..."],
        travelers: [
          { name: "Ada", start: [0, 0], goal: [1, 0] },
          { name: "Bo", start: [2, 0], goal: [1, 0] },
        ],
      },
    });
    expect(shared.status).toBe(400);

    const sealed = await post({
      floor: {
        width: 3,
        height: 1,
        walls: [[1, 0]],
        travelers: [{ name: "Ada", start: [0, 0], goal: [2, 0] }],
      },
    });
    expect(sealed.status).toBe(422);
  });

  it("serves the inline Exchange floor over HTTP", async () => {
    const floor = JSON.parse(readFileSync(path.join(fixtures, "exchange.json"), "utf8")) as unknown;
    const server = await app.listen(0, "127.0.0.1");
    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/v1/plans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ solver: "both", floor }),
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { plans: { cbs: { cost: number }; icbs: { cost: number } } };
      expect(body.plans.cbs.cost).toBe(6);
      expect(body.plans.icbs.cost).toBe(6);
    } finally {
      await server.close();
    }
  });
});
