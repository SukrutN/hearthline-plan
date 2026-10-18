import { MinHeap } from "./heap.js";
import { manhattan, STEPS } from "./motion.js";
import { squareKey, type Ban, type Floor, type Route, type Square } from "./types.js";

type Frame = {
  readonly x: number;
  readonly y: number;
  readonly t: number;
  readonly g: number;
  readonly f: number;
  readonly h: number;
  readonly seq: number;
  readonly parent: string | null;
  readonly key: string;
};

/**
 * Space-time A* . Unit cost, waits allowed. The traveler may finish only when
 * every later minute on the goal is free, because arrival means staying.
 */
export function planRoute(
  floor: Floor,
  start: Square,
  goal: Square,
  traveler: number,
  bans: readonly Ban[],
): Route | null {
  if (!inside(floor, start) || !inside(floor, goal)) return null;
  if (floor.walls.has(squareKey(start.x, start.y)) || floor.walls.has(squareKey(goal.x, goal.y))) return null;

  const vertexBan = new Set<string>();
  const edgeBan = new Set<string>();
  const goalBan = new Set<number>();
  let latest = -1;
  for (const ban of bans) {
    if (ban.traveler !== traveler) continue;
    if (ban.kind === "vertex") {
      vertexBan.add(`${ban.x},${ban.y},${ban.time}`);
      latest = Math.max(latest, ban.time);
      if (ban.x === goal.x && ban.y === goal.y) goalBan.add(ban.time);
    } else {
      edgeBan.add(`${ban.x1},${ban.y1},${ban.x2},${ban.y2},${ban.time}`);
      latest = Math.max(latest, ban.time);
    }
  }

  const seed = manhattan(start, goal);
  const span = floor.width * floor.height + seed;
  const maxTime = Math.max(seed, latest + 1) + span;
  const canStay = (time: number): boolean => {
    for (const banned of goalBan) {
      if (banned >= time) return false;
    }
    return true;
  };

  const heap = new MinHeap<Frame>((a, b) => (a.f === b.f ? (a.h === b.h ? a.seq < b.seq : a.h < b.h) : a.f < b.f));
  const bestG = new Map<string, number>();
  const trail = new Map<string, Frame>();
  let seq = 0;
  const originKey = `${start.x},${start.y},0`;
  const origin: Frame = {
    x: start.x,
    y: start.y,
    t: 0,
    g: 0,
    h: seed,
    f: seed,
    seq: seq++,
    parent: null,
    key: originKey,
  };
  heap.push(origin);
  bestG.set(originKey, 0);
  trail.set(originKey, origin);

  let expansions = 0;
  const expansionCap = (maxTime + 1) * floor.width * floor.height + 8;

  while (heap.size > 0) {
    const current = heap.pop();
    if (current === undefined || current.g !== bestG.get(current.key)) continue;
    expansions += 1;
    if (expansions > expansionCap) return null;

    if (current.x === goal.x && current.y === goal.y && canStay(current.t)) {
      return { squares: rebuild(trail, current.key), expansions };
    }
    if (current.t >= maxTime) continue;

    for (const step of STEPS) {
      const x = current.x + step.x;
      const y = current.y + step.y;
      const time = current.t + 1;
      if (!inside(floor, { x, y })) continue;
      if (floor.walls.has(squareKey(x, y))) continue;
      if (vertexBan.has(`${x},${y},${time}`)) continue;
      if (edgeBan.has(`${current.x},${current.y},${x},${y},${current.t}`)) continue;
      const key = `${x},${y},${time}`;
      const g = current.g + 1;
      const known = bestG.get(key);
      if (known !== undefined && known <= g) continue;
      const h = manhattan({ x, y }, goal);
      const next: Frame = { x, y, t: time, g, h, f: g + h, seq: seq++, parent: current.key, key };
      bestG.set(key, g);
      trail.set(key, next);
      heap.push(next);
    }
  }

  return null;
}

function rebuild(trail: Map<string, Frame>, key: string): Square[] {
  const path: Square[] = [];
  let cursor: string | null = key;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const frame = trail.get(cursor);
    if (frame === undefined) break;
    path.push({ x: frame.x, y: frame.y });
    cursor = frame.parent;
  }
  path.reverse();
  return path;
}

function inside(floor: Floor, square: Square): boolean {
  return square.x >= 0 && square.y >= 0 && square.x < floor.width && square.y < floor.height;
}
