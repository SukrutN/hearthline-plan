# Hearthline Plan

A planning service for travelers who share one clock. It finds routes on a 4-connected floor so that nobody occupies the same square at the same minute, and nobody swaps through the same edge. Waiting costs the same as a step. After arrival, a traveler stays.

The service returns a joint plan and the search effort behind it: sum of arrival times, high-level constraint-tree nodes, and low-level space-time expansions, for Conflict-Based Search and Improved CBS. It does not draw the floor, store maps, or keep accounts. The visual studio that showcases these rooms is a separate product: [github.com/SukrutN/hearthlane](https://github.com/SukrutN/hearthlane).

## Run the tests

```bash
npm install
npm test
```

`npm test` typechecks the packages and runs the behavioral tests. The published Crosscurrent room is locked to the showcase figures (cost 11, CBS 4 high-level nodes, ICBS 2). Exchange, a smaller floor, is locked to cost 6.

## Run the API

```bash
npm run build
npm start
```

The process listens on port 8080 (`PORT` overrides it).

```bash
curl -s localhost:8080/health
curl -s localhost:8080/v1/fixtures
curl -s localhost:8080/v1/plans -H 'content-type: application/json' \
  -d '{"fixture":"crosscurrent","solver":"both"}'
```

`GET /v1/openapi.yaml` is the contract. An unknown fixture is HTTP 400 with `application/problem+json`.

## Run the CLI

```bash
npm run build
npm run plan -- solve --fixture crosscurrent --solver both
npm run plan -- solve fixtures/exchange.json --solver icbs
```

A collision-free plan exits 0. A rejected document exits 1. A well-formed floor with no plan exits 2.

## Floors are data

Shipped rooms live in `fixtures/`. The solver does not name them. See `docs/customizing.md` for the file format and `docs/architecture.md` for why the domain is separate from HTTP.
