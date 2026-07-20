[![](https://vsmarketplacebadge.apphb.com/version-short/A-LPG.lpg-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=kuafuwang.lpg-vscode)


# LPG-VScode README

# lpg-vscode
**The** extension for LPG support in Visual Studio code.
## Features


### Syntax Coloring

* TextMate grammar for LPG files (`.lpg`, `.g`, `.gi`): section keywords, macros, strings, produces markers, and EBNF operators (`?` `*` `+` `( )` `[ ]` `{ }`).
* Bracket matching / auto-close for `()`, `[]`, `{}` via `language-configuration.json`.
>![Syntax Coloring](https://raw.githubusercontent.com/A-LPG/LPG-VScode/master/doc/img/hover.png)

### EBNF sugar (opt-in)

* Language server and TextMate understand generator EBNF when the grammar uses `%Options ebnf` (or `la=…,ebnf`): groups, postfix quantifiers, ISO `[…]` / `{…}`.
* Generation: set `lpg.generation.setting.ebnf` to pass `-ebnf`, or put `ebnf` in `%Options` (preferred).

### Code Completion + Symbol Information

* Code suggestions for all rule + optioins ,  etc. (including built-in ones).
* Symbol type + location are shown on mouse hover. Navigate to any symbol with Ctrl/Cmd + Click. This works even for nested grammars.
>![completion](https://raw.githubusercontent.com/A-LPG/LPG-VScode/master/doc/img/completion.png)


### Grammar Validations

* In the background syntax checking takes place, while typing. Also some semantic checks are done.
* Generator-level errors/conflicts appear in the **Problems** panel: on **Generate parser**, and on save when `lpg.generation.setting.analyzeOnSave` is enabled (default). Uses `-diagnostics=json` / `-nowrite`.
* Lightbulb quick fixes on conflict diagnostics: copy message, suggest regenerating with `-list`.
>![](https://raw.githubusercontent.com/A-LPG/LPG-VScode/master/doc/img/dianosic.png)


### Doc formatting

### Graphical-visualizations

* Call graph for LPG grammars 
>![Call graph](https://raw.githubusercontent.com/A-LPG/LPG-VScode/master/doc/img/call_graph.png )

* Terminal and non-terminal  railroad graph for LPG grammars 
>![Rule RailRoad](https://raw.githubusercontent.com/A-LPG/LPG-VScode/master/doc/img/railroad.png )

* First set and follow set for LPG grammars 
  
### Parser-generation


### More Informations
There are a number of documentation files for specific topics:


* [Extension Settings](https://github.com/A-LPG/LPG-VScode/blob/main/doc/extension-settings.md)



### Miscellaneous

* It's the beta version.


## Known Issues

See the [Git issue tracker](https://github.com/A-LPG/LPG-VScode/issues).

## Release / generator alignment checklist (LPG2 2.3.0+)

1. Point assemble script at `lpg-v2.3.0` (`scripts/assemble-release.sh`).
2. Generate with `-table` for `rust` / `java` / `rt_cpp` from the command palette.
3. Confirm non-zero generator exits (including conflict fail-fast exit 12) show `showErrorMessage`.
4. Confirm settings enum has no stub languages (`c` / `ml` / `plx` / `plxasm` / `xml`).
5. Optional: smoke LSP hover/completion on a small `.g`.

## What's planned next?

1. Interactive **Test Grammar** panel (sample input → tokens / parse tree).
2. CodeLens reference counts + more lightbulb refactors.
3. Marketplace / publish automation (needs operator PATs).
