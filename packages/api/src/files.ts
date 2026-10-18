import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export function readCatalog(directory: string): Map<string, unknown> {
  const catalog = new Map<string, unknown>();
  for (const file of readdirSync(directory)) {
    if (!file.endsWith(".json")) continue;
    const body = JSON.parse(readFileSync(path.join(directory, file), "utf8")) as unknown;
    catalog.set(file.slice(0, -".json".length), body);
  }
  return catalog;
}

export function fixturesDir(fromModule: string): string {
  return path.resolve(path.dirname(fromModule), "../../../fixtures");
}
