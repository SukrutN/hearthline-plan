# Architecture

Three layers, and a thin HTTP and CLI edge.

`@hearthline/domain` is the floor rules and the search. It has no file, network, or clock dependency beyond `performance.now()` for the runtime figure. The same call with the same floor returns the same routes and the same node counts.

`@hearthline/application` validates a floor document and times a solve. It does not open sockets or directories. Callers hand it a parsed JSON value and a catalog of already-loaded fixtures.

`@hearthline/api` and `@hearthline/cli` are the edges. Both call the application. Neither one contains a second copy of the search.

## Why CBS and ICBS

The showcase compares two optimal searches on the sum of arrival times. CBS grows a constraint tree: each branch forbids one traveler from a contested square or edge at one minute, and only that traveler replans in space and time. The first collision-free node, taken in cost order, is optimal.

ICBS is the same tree with two published changes. Clashes are cardinal, semi-cardinal, or non-cardinal, read from each traveler's diagram of optimal routes. Cardinal clashes are split first. A same-cost replacement route that reduces the clash count is adopted in the current node (a bypass) and does not grow the tree. The high-level comparison number is the count of constraint-tree nodes popped before that first collision-free plan. Runtime is not part of the contract.

## Why there is no database

A plan is a pure function of a floor document. Fixtures are files shipped with the process. Nothing is retained between requests, so there is no schema, no tenant, and no queue. See `docs/adr/0001-in-process-search.md` for the size of floor this is meant to answer.
