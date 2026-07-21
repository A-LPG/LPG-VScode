# Java TestRig (Test Grammar panel)

`LpgTestRig` reflectively loads a generated `*Lexer` / `*Parser`, lexes and parses a UTF-8 input file, and prints one JSON object to stdout:

```json
{ "ok": true, "tokens": [...], "tree": { "id", "name", "type", "children", "range", "symbol" }, "error": null }
```

Built by `scripts/assemble-release.sh` into `classes/` (classpath needs `server/lib/lpg-runtime.jar`).
