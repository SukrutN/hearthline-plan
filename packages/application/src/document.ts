import { squareKey, type Floor, type Instance, type Square, type Traveler } from "@hearthline/domain";

export const MAX_SIDE = 64;
export const MAX_TRAVELERS = 12;

export type FloorDocument = {
  readonly name?: string;
  readonly width: number;
  readonly height: number;
  readonly walls: readonly Square[];
  readonly travelers: readonly Traveler[];
};

export type DocumentIssue = {
  readonly path: string;
  readonly message: string;
};

export type ParsedFloor =
  | { readonly ok: true; readonly document: FloorDocument; readonly instance: Instance }
  | { readonly ok: false; readonly issues: readonly DocumentIssue[] };

const TOP_KEYS = new Set(["name", "width", "height", "walls", "rows", "travelers"]);
const TRAVELER_KEYS = new Set(["name", "start", "goal"]);

export function parseFloor(input: unknown): ParsedFloor {
  const issues: DocumentIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [{ path: "", message: "A floor document must be a JSON object." }] };
  }
  for (const key of Object.keys(input)) {
    if (!TOP_KEYS.has(key)) issues.push({ path: key, message: `Unknown field "${key}".` });
  }

  const width = requireInt(input.width, "width", 1, MAX_SIDE, issues);
  const height = requireInt(input.height, "height", 1, MAX_SIDE, issues);
  const name = readOptionalName(input.name, "name", issues);

  let walls: Square[] = [];
  const hasWalls = "walls" in input;
  const hasRows = "rows" in input;
  if (hasWalls && hasRows) {
    issues.push({ path: "rows", message: "Provide walls or rows, not both." });
  } else if (hasRows) {
    walls = readRows(input.rows, width, height, issues);
  } else if (hasWalls) {
    walls = readWalls(input.walls, width, height, issues);
  }

  const travelers = readTravelers(input.travelers, width, height, walls, issues);
  if (issues.length > 0 || width === null || height === null || travelers === null) {
    return { ok: false, issues };
  }

  const floor: Floor = { width, height, walls: new Set(walls.map((wall) => squareKey(wall.x, wall.y))) };
  const document: FloorDocument = name === undefined ? { width, height, walls, travelers } : { name, width, height, walls, travelers };
  return { ok: true, document, instance: { floor, travelers } };
}

function readRows(value: unknown, width: number | null, height: number | null, issues: DocumentIssue[]): Square[] {
  if (!Array.isArray(value)) {
    issues.push({ path: "rows", message: "rows must be an array of strings." });
    return [];
  }
  if (height !== null && value.length !== height) {
    issues.push({ path: "rows", message: `rows must contain ${height} lines.` });
  }
  const walls: Square[] = [];
  value.forEach((row, y) => {
    if (typeof row !== "string") {
      issues.push({ path: `rows[${y}]`, message: "Each row must be a string of '.' and '#'." });
      return;
    }
    if (width !== null && row.length !== width) {
      issues.push({ path: `rows[${y}]`, message: `Each row must be ${width} characters.` });
    }
    for (let x = 0; x < row.length; x += 1) {
      const cell = row[x];
      if (cell === "#") walls.push({ x, y });
      else if (cell !== ".") issues.push({ path: `rows[${y}][${x}]`, message: "Use '.' for open floor and '#' for a wall." });
    }
  });
  return walls;
}

function readWalls(value: unknown, width: number | null, height: number | null, issues: DocumentIssue[]): Square[] {
  if (!Array.isArray(value)) {
    issues.push({ path: "walls", message: "walls must be an array of [x, y] pairs." });
    return [];
  }
  const walls: Square[] = [];
  value.forEach((entry, index) => {
    const square = readPair(entry, `walls[${index}]`, issues);
    if (square === null) return;
    if (width !== null && height !== null && (square.x >= width || square.y >= height)) {
      issues.push({ path: `walls[${index}]`, message: "That wall sits outside the floor." });
      return;
    }
    walls.push(square);
  });
  return walls;
}

function readTravelers(
  value: unknown,
  width: number | null,
  height: number | null,
  walls: readonly Square[],
  issues: DocumentIssue[],
): Traveler[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path: "travelers", message: "Name at least one traveler." });
    return null;
  }
  if (value.length > MAX_TRAVELERS) {
    issues.push({ path: "travelers", message: `At most ${MAX_TRAVELERS} travelers.` });
  }
  const travelers: Traveler[] = [];
  const names = new Set<string>();
  const starts = new Set<string>();
  const goals = new Set<string>();
  const blocked = new Set(walls.map((wall) => squareKey(wall.x, wall.y)));
  value.forEach((entry, index) => {
    const path = `travelers[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ path, message: "A traveler must be an object." });
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!TRAVELER_KEYS.has(key)) issues.push({ path: `${path}.${key}`, message: `Unknown field "${key}".` });
    }
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (name.length === 0) issues.push({ path: `${path}.name`, message: "A traveler needs a name." });
    else if (names.has(name)) issues.push({ path: `${path}.name`, message: `Duplicate traveler name "${name}".` });
    else names.add(name);
    const start = readPair(entry.start, `${path}.start`, issues);
    const goal = readPair(entry.goal, `${path}.goal`, issues);
    if (start === null || goal === null || width === null || height === null) return;
    for (const [label, square] of [
      ["start", start],
      ["goal", goal],
    ] as const) {
      if (square.x >= width || square.y >= height) {
        issues.push({ path: `${path}.${label}`, message: "That square is outside the floor." });
      } else if (blocked.has(squareKey(square.x, square.y))) {
        issues.push({ path: `${path}.${label}`, message: "That square is a wall." });
      }
    }
    const startKey = squareKey(start.x, start.y);
    const goalKey = squareKey(goal.x, goal.y);
    if (starts.has(startKey)) issues.push({ path: `${path}.start`, message: "Two travelers share a start." });
    if (goals.has(goalKey)) issues.push({ path: `${path}.goal`, message: "Two travelers share a goal, so neither can stay." });
    starts.add(startKey);
    goals.add(goalKey);
    if (name.length > 0) travelers.push({ name, start, goal });
  });
  return issues.length > 0 ? null : travelers;
}

function readPair(value: unknown, path: string, issues: DocumentIssue[]): Square | null {
  if (!Array.isArray(value) || value.length !== 2) {
    issues.push({ path, message: "Expected [x, y]." });
    return null;
  }
  const [x, y] = value;
  if (!isWhole(x) || !isWhole(y) || x < 0 || y < 0) {
    issues.push({ path, message: "Coordinates must be whole numbers, zero or greater." });
    return null;
  }
  return { x, y };
}

function requireInt(value: unknown, path: string, min: number, max: number, issues: DocumentIssue[]): number | null {
  if (!isWhole(value)) {
    issues.push({ path, message: "Expected a whole number." });
    return null;
  }
  if (value < min || value > max) {
    issues.push({ path, message: `Expected a value from ${min} to ${max}.` });
    return null;
  }
  return value;
}

function readOptionalName(value: unknown, path: string, issues: DocumentIssue[]): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path, message: "name must be a non-empty string." });
    return undefined;
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWhole(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}
