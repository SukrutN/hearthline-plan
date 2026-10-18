/** A grid square. x grows east, y grows south. */
export type Square = {
  readonly x: number;
  readonly y: number;
};

export type Traveler = {
  readonly name: string;
  readonly start: Square;
  readonly goal: Square;
};

/** A floor is data. Walls are a set of "x,y" keys. */
export type Floor = {
  readonly width: number;
  readonly height: number;
  readonly walls: ReadonlySet<string>;
};

export type Instance = {
  readonly floor: Floor;
  readonly travelers: readonly Traveler[];
};

export type SolverName = "cbs" | "icbs";

export type ConflictClass = "cardinal" | "semi-cardinal" | "non-cardinal";

export type VertexClash = {
  readonly kind: "vertex";
  readonly left: number;
  readonly right: number;
  readonly x: number;
  readonly y: number;
  readonly time: number;
};

export type EdgeClash = {
  readonly kind: "edge";
  readonly left: number;
  readonly right: number;
  readonly time: number;
  readonly leftFrom: Square;
  readonly leftTo: Square;
  readonly rightFrom: Square;
  readonly rightTo: Square;
};

export type Clash = VertexClash | EdgeClash;

export type VertexBan = {
  readonly kind: "vertex";
  readonly traveler: number;
  readonly x: number;
  readonly y: number;
  readonly time: number;
};

export type EdgeBan = {
  readonly kind: "edge";
  readonly traveler: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly time: number;
};

export type Ban = VertexBan | EdgeBan;

export type ResolvedClash = {
  readonly clash: Clash;
  readonly classification: ConflictClass | null;
  readonly bypassed: boolean;
};

export type Route = {
  readonly squares: readonly Square[];
  readonly expansions: number;
};

export type JointPlan = {
  readonly ok: boolean;
  readonly reason: string;
  readonly solver: SolverName;
  readonly paths: readonly (readonly Square[])[];
  readonly cost: number;
  readonly makespan: number;
  readonly highLevelExpanded: number;
  readonly highLevelGenerated: number;
  readonly lowLevelExpansions: number;
  readonly runtimeMs: number;
  readonly resolved: readonly ResolvedClash[];
  readonly bypasses: number;
};

export type SearchBudget = {
  readonly highLevelNodes: number;
};

export const defaultBudget: SearchBudget = { highLevelNodes: 5000 };

export function squareKey(x: number, y: number): string {
  return `${x},${y}`;
}
