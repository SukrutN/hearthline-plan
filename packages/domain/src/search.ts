import { findClashes, makespan, routeCost, totalCost } from "./clashes.js";
import { buildDiagram, onlySquare, type Diagram } from "./diagram.js";
import { MinHeap } from "./heap.js";
import { planRoute } from "./route.js";
import type {
  Ban,
  Clash,
  ConflictClass,
  EdgeClash,
  Instance,
  JointPlan,
  ResolvedClash,
  SearchBudget,
  SolverName,
  Square,
} from "./types.js";
import { defaultBudget } from "./types.js";

type TreeNode = {
  readonly id: number;
  readonly bans: readonly Ban[];
  paths: Square[][];
  cost: number;
};

const BYPASS_GUARD = 64;

/**
 * Conflict-Based Search and Improved CBS.
 *
 * The high level is a best-first tree ordered by the sum of arrival times.
 * CBS splits the earliest clash. ICBS labels each clash from the travelers'
 * optimal-route diagrams, splits cardinal clashes first, and adopts a same-cost
 * route with fewer clashes as a bypass instead of branching.
 * High-level nodes are counted when popped. The comparison figure is that count
 * at the moment the first collision-free plan is returned.
 */
export function searchJoint(instance: Instance, solver: SolverName, budget: SearchBudget = defaultBudget): JointPlan {
  const started = performance.now();
  const stats = {
    highLevelExpanded: 0,
    highLevelGenerated: 0,
    lowLevelExpansions: 0,
    bypasses: 0,
    resolved: [] as ResolvedClash[],
  };

  const rootPaths: Square[][] = [];
  for (let index = 0; index < instance.travelers.length; index += 1) {
    const traveler = instance.travelers[index];
    if (traveler === undefined) {
      return finish(solver, stats, started, [], false, "A traveler is missing.");
    }
    const route = planRoute(instance.floor, traveler.start, traveler.goal, index, []);
    if (route === null) {
      return finish(solver, stats, started, [], false, `${traveler.name} has no route around the walls.`);
    }
    stats.lowLevelExpansions += route.expansions;
    rootPaths.push(route.squares.map((square) => ({ ...square })));
  }

  let nextId = 1;
  const root: TreeNode = { id: nextId++, bans: [], paths: rootPaths, cost: totalCost(rootPaths) };
  stats.highLevelGenerated = 1;
  const open = new MinHeap<TreeNode>((a, b) => (a.cost === b.cost ? a.id < b.id : a.cost < b.cost));
  open.push(root);

  while (open.size > 0) {
    if (stats.highLevelExpanded >= budget.highLevelNodes) {
      return finish(solver, stats, started, [], false, "The constraint tree passed the search budget.");
    }
    const node = open.pop();
    if (node === undefined) break;
    stats.highLevelExpanded += 1;

    let bypassesHere = 0;
    let settled = false;
    while (!settled) {
      const clashes = findClashes(node.paths);
      const clash = clashes[0];
      if (clash === undefined) {
        return finish(solver, stats, started, node.paths, true, "Collision-free joint plan.");
      }
      const choice =
        solver === "icbs"
          ? preferCardinal(instance, node, clashes)
          : { clash, classification: null as ConflictClass | null, must: [false, false] as const };

      if (solver === "icbs" && choice.classification !== "cardinal" && bypassesHere < BYPASS_GUARD) {
        if (tryBypass(instance, node, choice.clash, choice.must, stats)) {
          bypassesHere += 1;
          stats.bypasses += 1;
          stats.resolved.push({ clash: choice.clash, classification: choice.classification, bypassed: true });
          continue;
        }
      }

      stats.resolved.push({ clash: choice.clash, classification: choice.classification, bypassed: false });
      for (const ban of bansFor(choice.clash)) {
        const route = planRoute(
          instance.floor,
          instance.travelers[ban.traveler]?.start ?? { x: -1, y: -1 },
          instance.travelers[ban.traveler]?.goal ?? { x: -1, y: -1 },
          ban.traveler,
          [...node.bans, ban],
        );
        stats.lowLevelExpansions += route?.expansions ?? 0;
        if (route === null) continue;
        const paths = node.paths.slice();
        paths[ban.traveler] = route.squares.map((square) => ({ ...square }));
        open.push({
          id: nextId++,
          bans: [...node.bans, ban],
          paths,
          cost: totalCost(paths),
        });
        stats.highLevelGenerated += 1;
      }
      settled = true;
    }
  }

  return finish(solver, stats, started, [], false, "No collision-free plan exists for these starts and goals.");
}

function preferCardinal(
  instance: Instance,
  node: TreeNode,
  clashes: readonly Clash[],
): { clash: Clash; classification: ConflictClass; must: readonly [boolean, boolean] } {
  const diagrams = new Map<number, Diagram>();
  const diagramFor = (index: number): Diagram => {
    const cached = diagrams.get(index);
    if (cached) return cached;
    const traveler = instance.travelers[index];
    if (traveler === undefined) return { levels: new Map() };
    const built = buildDiagram(
      instance.floor,
      traveler.start,
      traveler.goal,
      index,
      node.bans,
      routeCost(node.paths[index] ?? []),
    );
    diagrams.set(index, built);
    return built;
  };

  let best: { clash: Clash; classification: ConflictClass; must: readonly [boolean, boolean]; rank: number } | null = null;
  for (const clash of clashes) {
    const mustLeft = forced(node.paths[clash.left] ?? [], diagramFor(clash.left), clash, "left");
    const mustRight = forced(node.paths[clash.right] ?? [], diagramFor(clash.right), clash, "right");
    const classification: ConflictClass =
      mustLeft && mustRight ? "cardinal" : mustLeft || mustRight ? "semi-cardinal" : "non-cardinal";
    const rank = classification === "cardinal" ? 0 : classification === "semi-cardinal" ? 1 : 2;
    if (best === null || rank < best.rank || (rank === best.rank && earlier(clash, best.clash))) {
      best = { clash, classification, must: [mustLeft, mustRight], rank };
    }
  }
  if (best === null) throw new Error("Clash list was empty.");
  return best;
}

function forced(path: readonly Square[], diagram: Diagram, clash: Clash, side: "left" | "right"): boolean {
  const cost = routeCost(path);
  if (clash.kind === "vertex") {
    if (clash.time > cost) {
      const last = path[path.length - 1];
      return last !== undefined && last.x === clash.x && last.y === clash.y;
    }
    return onlySquare(diagram, clash.time, clash.x, clash.y);
  }
  const from = side === "left" ? clash.leftFrom : clash.rightFrom;
  const to = side === "left" ? clash.leftTo : clash.rightTo;
  if (clash.time >= cost) return false;
  return onlySquare(diagram, clash.time, from.x, from.y) && onlySquare(diagram, clash.time + 1, to.x, to.y);
}

function tryBypass(
  instance: Instance,
  node: TreeNode,
  clash: Clash,
  must: readonly [boolean, boolean],
  stats: { lowLevelExpansions: number },
): boolean {
  const order: number[] = [];
  if (!must[0]) order.push(clash.left);
  if (!must[1]) order.push(clash.right);
  const before = findClashes(node.paths).length;
  for (const traveler of order) {
    const ban = banFor(clash, traveler);
    const person = instance.travelers[traveler];
    if (person === undefined) continue;
    const route = planRoute(instance.floor, person.start, person.goal, traveler, [...node.bans, ban]);
    stats.lowLevelExpansions += route?.expansions ?? 0;
    if (route === null) continue;
    if (routeCost(route.squares) !== routeCost(node.paths[traveler] ?? [])) continue;
    const trial = node.paths.slice();
    trial[traveler] = route.squares.map((square) => ({ ...square }));
    if (findClashes(trial).length < before) {
      node.paths = trial;
      node.cost = totalCost(trial);
      return true;
    }
  }
  return false;
}

function bansFor(clash: Clash): Ban[] {
  return [banFor(clash, clash.left), banFor(clash, clash.right)];
}

function banFor(clash: Clash, traveler: number): Ban {
  if (clash.kind === "vertex") {
    return { kind: "vertex", traveler, x: clash.x, y: clash.y, time: clash.time };
  }
  const edge = clash as EdgeClash;
  if (traveler === edge.left) {
    return { kind: "edge", traveler, x1: edge.leftFrom.x, y1: edge.leftFrom.y, x2: edge.leftTo.x, y2: edge.leftTo.y, time: edge.time };
  }
  return { kind: "edge", traveler, x1: edge.rightFrom.x, y1: edge.rightFrom.y, x2: edge.rightTo.x, y2: edge.rightTo.y, time: edge.time };
}

function earlier(left: Clash, right: Clash): boolean {
  if (left.time !== right.time) return left.time < right.time;
  if (left.left !== right.left) return left.left < right.left;
  if (left.right !== right.right) return left.right < right.right;
  return left.kind === "vertex" && right.kind !== "vertex";
}

function finish(
  solver: SolverName,
  stats: {
    highLevelExpanded: number;
    highLevelGenerated: number;
    lowLevelExpansions: number;
    bypasses: number;
    resolved: ResolvedClash[];
  },
  started: number,
  paths: readonly (readonly Square[])[],
  ok: boolean,
  reason: string,
): JointPlan {
  return {
    ok,
    reason,
    solver,
    paths,
    cost: ok ? totalCost(paths) : 0,
    makespan: ok ? makespan(paths) : 0,
    highLevelExpanded: stats.highLevelExpanded,
    highLevelGenerated: stats.highLevelGenerated,
    lowLevelExpansions: stats.lowLevelExpansions,
    runtimeMs: performance.now() - started,
    resolved: stats.resolved,
    bypasses: stats.bypasses,
  };
}
