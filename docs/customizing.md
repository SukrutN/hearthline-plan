# Customizing a floor

A floor is a JSON object. The shipped Exchange room is the worked example, and it is not baked into the solver:

```json
{
  "name": "Exchange",
  "width": 3,
  "height": 2,
  "rows": ["...", "..."],
  "travelers": [
    { "name": "Ada", "start": [0, 1], "goal": [2, 1] },
    { "name": "Bo", "start": [2, 1], "goal": [0, 1] }
  ]
}
```

`rows` is one string per row, y growing downward. `.` is open floor. `#` is a wall. You may send `walls` as `[x, y]` pairs instead of `rows`, and not both.

Rules that are not knobs:

- Movement is four-connected. Diagonal steps are rejected.
- A step and a wait each cost one minute.
- After a traveler arrives, they stay. Two travelers cannot share a goal.
- Starts and goals must be on open squares, inside the floor, and unique.
- The objective is the sum of arrival times.
- `width` and `height` are from 1 to 64. At most 12 travelers.

Knobs:

- `name`, optional label.
- `width`, `height`.
- `rows` or `walls`.
- `travelers`: `name`, `start`, `goal`, each coordinate an `[x, y]` pair.
- At solve time, `solver` is `cbs`, `icbs`, or `both`. That field belongs on the API request or the CLI flag, not inside the floor file.

```bash
npm run plan -- solve fixtures/exchange.json --solver both
```

An API caller can send the same object inline:

```bash
curl -s localhost:8080/v1/plans -H 'content-type: application/json' \
  -d '{"solver":"both","floor":{"width":3,"height":2,"rows":["...","..."],"travelers":[{"name":"Ada","start":[0,1],"goal":[2,1]},{"name":"Bo","start":[2,1],"goal":[0,1]}]}}'
```

Crosscurrent, Pocket, Atrium, and Blank floor are the other rooms from the showcase. They are files in `fixtures/`, addressed by filename: `{"fixture":"pocket"}`. An unknown name is a 400 problem document, and the service does not invent a floor.
