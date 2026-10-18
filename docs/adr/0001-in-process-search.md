# In-process CBS and ICBS

The service answers a floor document inside the request. It does not enqueue a job.

CBS and ICBS are deterministic for a fixed tie-break: space-time A* expands equal-cost frames by lowest heuristic, then by the order steps were generated (east, west, north, south, wait). CBS then splits the earliest clash. That tie-break is part of the published comparison, because it decides which non-cardinal weave CBS opens first on Crosscurrent.

The search budget stops at 5000 high-level nodes. The shipped rooms are at most 10 by 5 with four travelers, and Crosscurrent finishes in two or four high-level nodes. A warehouse floor with dozens of travelers needs a different decomposition; this process is the wrong place to hide that behind a queue.

Sum of arrival times is the objective the showcase reports. Makespan is returned as a figure, not optimized on its own.
