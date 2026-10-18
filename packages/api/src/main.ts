import { fileURLToPath } from "node:url";
import { fixturesDir, readCatalog } from "./files.js";
import { jsonLogger } from "./log.js";
import { createPlanApp } from "./server.js";

const port = Number(process.env.PORT ?? "8080");
const catalog = readCatalog(fixturesDir(fileURLToPath(import.meta.url)));
const app = createPlanApp(catalog, jsonLogger);
const server = await app.listen(port);
jsonLogger("info", "listening", { port: server.port, fixtures: catalog.size });
