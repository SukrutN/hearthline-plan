#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderComparison, solveDocument, type SolverChoice } from "@hearthline/application";

type ParsedArgs =
  | { readonly ok: true; readonly solver: SolverChoice; readonly document: unknown; readonly label: string }
  | { readonly ok: false; readonly message: string };

export function execute(argv: readonly string[]): { code: number; stdout: string; stderr: string } {
  const parsed = parseArgs(argv);
  if (!parsed.ok) return { code: 1, stdout: "", stderr: `${parsed.message}\n` };
  const result = solveDocument(parsed.document, parsed.solver);
  if (result.status === "invalid") {
    const detail = result.issues.map((issue) => `${issue.path || "floor"}: ${issue.message}`).join("\n");
    return { code: 1, stdout: "", stderr: `${detail}\n` };
  }
  const plans = result.status === "planned" ? result.comparison.plans : result.plans;
  const floor = result.status === "planned" ? result.comparison.floor : result.floor;
  const text = renderComparison(parsed.label, { floor, plans });
  if (result.status === "unsolvable") return { code: 2, stdout: text, stderr: "" };
  return { code: 0, stdout: text, stderr: "" };
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const args = argv.slice(2);
  if (args[0] !== "solve") {
    return { ok: false, message: "Usage: hearthline-plan solve (--fixture name | floor.json) [--solver cbs|icbs|both]" };
  }
  let solver: SolverChoice = "both";
  let fixture: string | null = null;
  let file: string | null = null;
  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (token === undefined) break;
    if (token === "--solver") {
      const value = args[index + 1];
      if (value !== "cbs" && value !== "icbs" && value !== "both") return { ok: false, message: "solver must be cbs, icbs, or both." };
      solver = value;
      index += 1;
      continue;
    }
    if (token === "--fixture") {
      const value = args[index + 1];
      if (value === undefined) return { ok: false, message: "Missing fixture name." };
      fixture = value;
      index += 1;
      continue;
    }
    if (token === "--file") {
      const value = args[index + 1];
      if (value === undefined) return { ok: false, message: "Missing floor file." };
      file = value;
      index += 1;
      continue;
    }
    if (token.startsWith("-")) return { ok: false, message: `Unknown option ${token}.` };
    file = token;
  }
  if ((fixture === null) === (file === null)) {
    return { ok: false, message: "Provide a fixture name or a floor file." };
  }
  if (fixture !== null) {
    const catalog = readCatalog(defaultFixtures());
    const body = catalog.get(fixture);
    if (body === undefined) return { ok: false, message: `No floor is named "${fixture}".` };
    return { ok: true, solver, document: body, label: fixture };
  }
  const target = file ?? "";
  let text: string;
  try {
    text = readFileSync(target, "utf8");
  } catch {
    return { ok: false, message: `Could not read ${target}.` };
  }
  try {
    return { ok: true, solver, document: JSON.parse(text) as unknown, label: path.basename(target) };
  } catch {
    return { ok: false, message: `${target} is not JSON.` };
  }
}

function defaultFixtures(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");
}

function readCatalog(directory: string): Map<string, unknown> {
  const catalog = new Map<string, unknown>();
  for (const entry of readdirSync(directory)) {
    if (!entry.endsWith(".json")) continue;
    catalog.set(entry.slice(0, -".json".length), JSON.parse(readFileSync(path.join(directory, entry), "utf8")) as unknown);
  }
  return catalog;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outcome = execute(process.argv);
  if (outcome.stdout) process.stdout.write(outcome.stdout);
  if (outcome.stderr) process.stderr.write(outcome.stderr);
  process.exitCode = outcome.code;
}
