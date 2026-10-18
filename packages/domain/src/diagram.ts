import { STEPS } from "./motion.js";
import { squareKey, type Ban, type Floor, type Square } from "./types.js";

/** Every optimal route for one traveler, layered by minute. */
export type Diagram = {
  readonly levels: ReadonlyMap<number, ReadonlySet<string>>;
};

export function buildDiagram(
  floor: Floor,
  start: Square,
  goal: Square,
  traveler: number,
  bans: readonly Ban[],
  cost: number,
): Diagram {
  const forward: Array<Set<string>> = [new Set([squareKey(start.x, start.y)])];
  const vertexBan = new Set<string>();
  const edgeBan = new Set<string>();
  for (const ban of bans) {
    if (ban.traveler !== traveler) continue;
    if (ban.kind === "vertex") vertexBan.add(`${ban.x},${ban.y},${ban.time}`);
    else edgeBan.add(`${ban.x1},${ban.y1},${ban.x2},${ban.y2},${ban.time}`);
  }

  for (let time = 0; time < cost; time += 1) {
    const layer = forward[time] ?? new Set<string>();
    const next = new Set<string>();
    for (const token of layer) {
      const parsed = parseKey(token);
      if (parsed === null) continue;
      for (const step of STEPS) {
        const x = parsed.x + step.x;
        const y = parsed.y + step.y;
        const at = time + 1;
        if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) continue;
        if (floor.walls.has(squareKey(x, y))) continue;
        if (vertexBan.has(`${x},${y},${at}`)) continue;
        if (edgeBan.has(`${parsed.x},${parsed.y},${x},${y},${time}`)) continue;
        if (at + Math.abs(x - goal.x) + Math.abs(y - goal.y) > cost) continue;
        next.add(squareKey(x, y));
      }
    }
    forward.push(next);
  }

  const keep: Array<Set<string>> = Array.from({ length: cost + 1 }, () => new Set<string>());
  const goalToken = squareKey(goal.x, goal.y);
  const last = forward[cost];
  if (last?.has(goalToken)) {
    keep[cost]?.add(goalToken);
    for (let time = cost - 1; time >= 0; time -= 1) {
      const layer = forward[time];
      if (layer === undefined) continue;
      for (const token of layer) {
        const parsed = parseKey(token);
        if (parsed === null) continue;
        for (const step of STEPS) {
          const x = parsed.x + step.x;
          const y = parsed.y + step.y;
          if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) continue;
          if (floor.walls.has(squareKey(x, y))) continue;
          if (vertexBan.has(`${x},${y},${time + 1}`)) continue;
          if (edgeBan.has(`${parsed.x},${parsed.y},${x},${y},${time}`)) continue;
          if (!keep[time + 1]?.has(squareKey(x, y))) continue;
          keep[time]?.add(token);
          break;
        }
      }
    }
  }

  const levels = new Map<number, ReadonlySet<string>>();
  for (let time = 0; time <= cost; time += 1) levels.set(time, keep[time] ?? new Set());
  return { levels };
}

export function onlySquare(diagram: Diagram, time: number, x: number, y: number): boolean {
  const level = diagram.levels.get(time);
  return level !== undefined && level.size === 1 && level.has(squareKey(x, y));
}

function parseKey(token: string): Square | null {
  const [xText, yText] = token.split(",");
  if (xText === undefined || yText === undefined) return null;
  return { x: Number(xText), y: Number(yText) };
}
