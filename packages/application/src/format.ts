import type { JointPlan, SolverName } from "@hearthline/domain";
import type { Comparison } from "./solve.js";

export function renderComparison(label: string, comparison: Comparison): string {
  const lines: string[] = [`floor: ${label}`];
  const order: SolverName[] = ["cbs", "icbs"];
  for (const solver of order) {
    const plan = comparison.plans[solver];
    if (plan === undefined) continue;
    lines.push(...renderPlan(plan));
  }
  return `${lines.join("\n")}\n`;
}

export function renderPlan(plan: JointPlan): string[] {
  const lines = [
    `${plan.solver}: ${plan.ok ? "collision-free" : plan.reason}`,
    `${plan.solver} cost: ${plan.cost}`,
    `${plan.solver} high-level: ${plan.highLevelExpanded}`,
    `${plan.solver} low-level: ${plan.lowLevelExpansions}`,
    `${plan.solver} runtime-ms: ${plan.runtimeMs.toFixed(2)}`,
  ];
  if (!plan.ok) return lines;
  plan.paths.forEach((path, index) => {
    lines.push(`${plan.solver} route ${index + 1}: ${path.length - 1} steps`);
  });
  for (const item of plan.resolved) {
    const clash = item.clash;
    const where = clash.kind === "vertex" ? `(${clash.x}, ${clash.y})` : "edge";
    const label = item.bypassed ? "bypass" : "split";
    const klass = item.classification ?? "unclassified";
    lines.push(`${plan.solver} ${label} ${klass} minute ${clash.time} ${where} travelers ${clash.left + 1},${clash.right + 1}`);
  }
  return lines;
}
