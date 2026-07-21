# Extension Settings
The vscode-lpg extension can be configured in many ways to support your preferred working style. Below is a grouped list of all currently supported settings.

## General

* **lpg.referencesCodeLens.enabled**, boolean (default: false), if true enables the reference count display via Code Lens
* **lpg.customCSS**, array of string (no default), list of absolute CSS file names for diagrams/graphs
* **lpg.rrd.saveDir**, string (no default), default export target folder for railroad (syntax) diagrams
* **lpg.call-graph.saveDir**, string (no default), default export target folder for call graphs
* **lpg.test.jdkHome**, string (default: empty), optional JDK home used by **Test Grammar** (`java` / `javac`). Empty uses PATH.


## Parser Generation

This is a settings object named **lpg.generation.setting** with the following members:

* **mode**, string enum (default: "internal"), determines what code generation pattern should be followed:
    * **none**: don't generate any code, not even for internal use (note: this value will disable grammar debugging)
    * **internal**: allow code generation for internal use (e.g. for full error detection and interpreter data)
    * **external**: generate code also for external use, depending on the other generation options
* **outputDir**, string (default: undefined), determines the output folder where to place generated code (considered only if **mode** is set to `external`)
* **built_in_template**, string enum (default: java), Specifies the built-in target template pack for generation. Packaging must assemble `templates/` via `scripts/assemble-release.sh`; without that pack, the default `java` template will fail to resolve.
* **use_define_include_directory**, string (default: undefined), Location to import/include grammars from (relative to a grammar or absolute path)
* **use_define_template_directory**, string (default: undefined), Location to template grammars from (relative to a grammar or absolute path)
* **package**, string (default: undefined), package/namespace for generated code
* **language**, string (default: "java"), Target language passed to the generator as `-programming_language` (also used for table generation).
* **automatic_ast**, string enum (default: none), Maps to `-automatic_ast` (`none` / `nested` / `toplevel`).
* **fail_on_conflicts**, boolean (default: false), When true, passes `-fail_on_conflicts` so unresolved conflicts fail generation.
* **visitor**, string (default: default), create visitors on code generation
* **trace**, string enum (default: conflicts), trace rule info when code generation
* **quiet**, false (default: false), quiet option.
* **verbose**, false (default: false), verbose option.
* **ebnf**, boolean (default: false), if true passes `-ebnf` to the generator so EBNF sugar (`?` `*` `+`, groups `(…)`, ISO `[…]` / `{…}`) is expanded. Prefer `%Options ebnf` in the grammar when possible.
* **analyzeOnSave**, boolean (default: true), on save run the generator with `-nowrite -diagnostics=json` and publish errors/conflicts to the Problems panel (`source: lpg`). Disable if you only want LSP diagnostics.
* **alternativeExe**, string (default: undefined), specifies the lpg.exe to use for generation, instead of the ones shipping with this extension.
* **additionalParameters**, string (default: undefined), specifies additional parameters to be passed on to the lpg.exe (built-in or custom) during parser generation.

## Test Grammar

Command **Test Grammar (Java)** (`lpg.tools.testGrammar`) generates Java nested-AST tables under `<grammarDir>/.lpg/test/`, compiles them with the bundled `server/lib/lpg-runtime.jar`, and runs `misc/java-testrig/LpgTestRig`. The grammar must declare `import_terminals=….gi`. Token-seeded examples without a real lexer are not supported.

## Packaging note

`templates/` and `server/` are gitignored. Clean clones must run
`scripts/assemble-release.sh` before local generate / `vsce package`. Marketplace
VSIX builds include the assembled tree (including `server/lib/lpg-runtime.jar` and the precompiled testrig).
