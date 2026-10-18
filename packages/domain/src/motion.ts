import type { Square } from "./types.js";

/**
 * Four-connected steps, then a wait. East and west are generated before
 * north and south so equal-cost ties are stable across runs.
 */
export const STEPS: readonly Square[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: 0, y: 0 },
];

export function manhattan(from: Square, to: Square): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

export function sameSquare(left: Square, right: Square): boolean {
  return left.x === right.x && left.y === right.y;
}
