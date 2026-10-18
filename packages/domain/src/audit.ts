import { findClashes, squareAt } from "./clashes.js";
import { sameSquare, STEPS } from "./motion.js";
import { squareKey, type Instance, type Square } from "./types.js";

/** Returns a human reason when a joint plan breaks the floor rules, otherwise null. */
export function auditPlan(instance: Instance, paths: readonly (readonly Square[])[]): string | null {
  if (paths.length !== instance.travelers.length) return "The plan is missing a traveler.";
  for (let index = 0; index < instance.travelers.length; index += 1) {
    const traveler = instance.travelers[index];
    const path = paths[index];
    if (traveler === undefined || path === undefined || path.length === 0) return "A route is empty.";
    const first = path[0];
    const last = path[path.length - 1];
    if (first === undefined || last === undefined) return "A route is empty.";
    if (!sameSquare(first, traveler.start)) return `${traveler.name} does not start on the given square.`;
    if (!sameSquare(last, traveler.goal)) return `${traveler.name} does not finish on the goal.`;
    for (let time = 0; time < path.length; time += 1) {
      const square = path[time];
      if (square === undefined) return "A route has a gap.";
      if (square.x < 0 || square.y < 0 || square.x >= instance.floor.width || square.y >= instance.floor.height) {
        return `${traveler.name} leaves the floor.`;
      }
      if (instance.floor.walls.has(squareKey(square.x, square.y))) return `${traveler.name} enters a wall.`;
      if (time === 0) continue;
      const previous = path[time - 1];
      if (previous === undefined) return "A route has a gap.";
      const legal = STEPS.some((step) => previous.x + step.x === square.x && previous.y + step.y === square.y);
      if (!legal) return `${traveler.name} takes a diagonal or a longer jump.`;
    }
  }
  const clash = findClashes(paths)[0];
  if (clash) {
    const at = squareAt(paths[clash.left] ?? [], clash.time);
    return `Travelers still meet near (${at.x}, ${at.y}) at minute ${clash.time}.`;
  }
  return null;
}
