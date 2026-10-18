import { sameSquare } from "./motion.js";
import type { Clash, Square } from "./types.js";

export function squareAt(path: readonly Square[], time: number): Square {
  const last = path[path.length - 1];
  if (last === undefined) throw new Error("A route must include its start square.");
  return time < path.length ? (path[time] ?? last) : last;
}

export function routeCost(path: readonly Square[]): number {
  return Math.max(0, path.length - 1);
}

export function totalCost(paths: readonly (readonly Square[])[]): number {
  return paths.reduce((sum, path) => sum + routeCost(path), 0);
}

export function makespan(paths: readonly (readonly Square[])[]): number {
  return paths.reduce((span, path) => Math.max(span, routeCost(path)), 0);
}

/**
 * A vertex clash is two travelers on one square at one minute.
 * An edge clash is a swap through the same corridor between one minute and the next.
 * After a route ends, the traveler stays on the last square.
 */
export function findClashes(paths: readonly (readonly Square[])[]): Clash[] {
  const found: Clash[] = [];
  if (paths.length === 0) return found;
  const horizon = makespan(paths);

  for (let time = 0; time <= horizon; time += 1) {
    for (let left = 0; left < paths.length; left += 1) {
      for (let right = left + 1; right < paths.length; right += 1) {
        const here = squareAt(paths[left] ?? [], time);
        const there = squareAt(paths[right] ?? [], time);
        if (sameSquare(here, there)) {
          found.push({ kind: "vertex", left, right, x: here.x, y: here.y, time });
        }
      }
    }
  }

  for (let time = 0; time < horizon; time += 1) {
    for (let left = 0; left < paths.length; left += 1) {
      for (let right = left + 1; right < paths.length; right += 1) {
        const leftFrom = squareAt(paths[left] ?? [], time);
        const rightFrom = squareAt(paths[right] ?? [], time);
        const leftTo = squareAt(paths[left] ?? [], time + 1);
        const rightTo = squareAt(paths[right] ?? [], time + 1);
        const swapped = sameSquare(leftFrom, rightTo) && sameSquare(rightFrom, leftTo);
        if (swapped && !sameSquare(leftFrom, leftTo)) {
          found.push({ kind: "edge", left, right, time, leftFrom, leftTo, rightFrom, rightTo });
        }
      }
    }
  }

  return found;
}
