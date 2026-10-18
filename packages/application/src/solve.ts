import { searchJoint, type JointPlan, type SolverName } from "@hearthline/domain";
import { parseFloor, type DocumentIssue, type FloorDocument } from "./document.js";

export type SolverChoice = SolverName | "both";

export type Comparison = {
  readonly floor: FloorDocument;
  readonly plans: Partial<Record<SolverName, JointPlan>>;
};

export type SolveResult =
  | { readonly status: "invalid"; readonly issues: readonly DocumentIssue[] }
  | { readonly status: "unsolvable"; readonly floor: FloorDocument; readonly plans: Partial<Record<SolverName, JointPlan>> }
  | { readonly status: "planned"; readonly comparison: Comparison };

export function solveDocument(input: unknown, choice: SolverChoice = "both"): SolveResult {
  const parsed = parseFloor(input);
  if (!parsed.ok) return { status: "invalid", issues: parsed.issues };
  const solvers: SolverName[] = choice === "both" ? ["cbs", "icbs"] : [choice];
  const plans: Partial<Record<SolverName, JointPlan>> = {};
  for (const solver of solvers) {
    plans[solver] = searchJoint(parsed.instance, solver);
  }
  const failed = solvers.some((solver) => plans[solver]?.ok !== true);
  if (failed) return { status: "unsolvable", floor: parsed.document, plans };
  return { status: "planned", comparison: { floor: parsed.document, plans } };
}

export function indexDocuments(entries: Iterable<{ id: string; body: unknown }>): Map<string, unknown> {
  const catalog = new Map<string, unknown>();
  for (const entry of entries) catalog.set(entry.id, entry.body);
  return catalog;
}
