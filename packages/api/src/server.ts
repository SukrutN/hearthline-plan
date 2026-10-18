import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { solveDocument, type SolverChoice } from "@hearthline/application";
import { jsonLogger, type Logger } from "./log.js";

export type PlanApp = {
  readonly handle: (request: Request) => Promise<Response>;
  readonly listen: (port: number, host?: string) => Promise<{ port: number; close: () => Promise<void> }>;
};

const SOLVERS = new Set(["cbs", "icbs", "both"]);

export function createPlanApp(catalog: ReadonlyMap<string, unknown>, log: Logger = jsonLogger): PlanApp {
  const spec = readFileSync(fileURLToPath(new URL("../openapi.yaml", import.meta.url)), "utf8");

  const handle = async (request: Request): Promise<Response> => {
    const started = performance.now();
    const url = new URL(request.url);
    let response: Response;
    try {
      response = await route(request, url, catalog, spec);
    } catch (error) {
      log("error", "request failed", { path: url.pathname });
      response = problem(500, "internal-error", "The plan service failed.", error instanceof Error ? error.message : "Unknown error.");
    }
    log("info", "request", {
      method: request.method,
      path: url.pathname,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
    });
    return response;
  };

  return {
    handle,
    listen(port, host = "0.0.0.0") {
      const server = createServer(async (req, res) => {
        const web = await incomingToRequest(req);
        const response = await handle(web);
        await writeResponse(res, response);
      });
      return new Promise((resolve) => {
        server.listen(port, host, () => {
          const address = server.address();
          const bound = typeof address === "object" && address !== null ? address.port : port;
          resolve({
            port: bound,
            close: () => new Promise((done, reject) => server.close((error) => (error ? reject(error) : done()))),
          });
        });
      });
    },
  };
}

async function route(request: Request, url: URL, catalog: ReadonlyMap<string, unknown>, spec: string): Promise<Response> {
  if (request.method === "GET" && url.pathname === "/health") {
    return json(200, { status: "ok" });
  }
  if (request.method === "GET" && url.pathname === "/v1/openapi.yaml") {
    return new Response(spec, { status: 200, headers: { "content-type": "application/yaml; charset=utf-8" } });
  }
  if (request.method === "GET" && url.pathname === "/v1/fixtures") {
    return json(200, { fixtures: [...catalog.keys()].sort() });
  }
  if (request.method === "POST" && url.pathname === "/v1/plans") {
    return plan(request, catalog);
  }
  return problem(404, "not-found", "No such route.", `${request.method} ${url.pathname} is not part of this service.`);
}

async function plan(request: Request, catalog: ReadonlyMap<string, unknown>): Promise<Response> {
  const text = await request.text();
  if (text.trim().length === 0) {
    return problem(400, "invalid-floor", "Empty plan request.", "Send a JSON object with a fixture name or a floor document.");
  }
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return problem(400, "invalid-floor", "Plan request is not JSON.", "The body must be a JSON object.");
  }
  if (!isRecord(body)) {
    return problem(400, "invalid-floor", "Plan request must be an object.", "Expected fixture or floor.");
  }
  const solver = body.solver === undefined ? "both" : body.solver;
  if (typeof solver !== "string" || !SOLVERS.has(solver)) {
    return problem(400, "invalid-floor", "Unknown solver.", "solver must be cbs, icbs, or both.");
  }
  const hasFixture = "fixture" in body;
  const hasFloor = "floor" in body;
  if (hasFixture === hasFloor) {
    return problem(400, "invalid-floor", "Choose one source.", "Provide fixture or floor, not both and not neither.");
  }
  let document: unknown;
  let fixture: string | null = null;
  if (hasFixture) {
    if (typeof body.fixture !== "string" || body.fixture.trim().length === 0) {
      return problem(400, "unknown-fixture", "Unknown fixture.", "fixture must be the name of a shipped floor.");
    }
    fixture = body.fixture;
    if (!catalog.has(fixture)) {
      return problem(400, "unknown-fixture", "Unknown fixture.", `No floor is named "${fixture}".`);
    }
    document = catalog.get(fixture);
  } else {
    document = body.floor;
  }
  const result = solveDocument(document, solver as SolverChoice);
  if (result.status === "invalid") {
    return problem(400, "invalid-floor", "The floor document was rejected.", result.issues.map((issue) => `${issue.path || "floor"}: ${issue.message}`).join(" "), {
      issues: result.issues,
    });
  }
  const floor = result.status === "planned" ? result.comparison.floor : result.floor;
  const plans = result.status === "planned" ? result.comparison.plans : result.plans;
  const payload = {
    fixture,
    floor: { name: floor.name ?? null, width: floor.width, height: floor.height },
    plans,
  };
  if (result.status === "unsolvable") {
    return problem(422, "unsolvable-floor", "No collision-free plan.", "Every requested search failed to find a joint plan.", payload);
  }
  return json(200, payload);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function problem(status: number, type: string, title: string, detail: string, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ type: `https://hearthline.dev/problems/${type}`, title, status, detail, ...extra }), {
    status,
    headers: { "content-type": "application/problem+json; charset=utf-8" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function incomingToRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "127.0.0.1";
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  const method = req.method ?? "GET";
  return new Request(`http://${host}${req.url ?? "/"}`, {
    method,
    headers: new Headers(Object.entries(req.headers).flatMap(([key, value]) => {
      if (value === undefined) return [];
      return Array.isArray(value) ? value.map((item) => [key, item] as [string, string]) : [[key, value] as [string, string]];
    })),
    body: body.length > 0 && method !== "GET" && method !== "HEAD" ? body : null,
  });
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
