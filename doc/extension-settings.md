# Extension Settings
The vscode-lpg extension can be configured in many ways to support your preferred working style. Below is a grouped list of all currently supported settings.

## General

* **lpg.referencesCodeLens.enabled**, boolean (default: false), if true enables the reference count display via Code Lens
* **lpg.customCSS**, array of string (no default), list of absolute CSS file names for diagrams/graphs
* **lpg.rrd.saveDir**, string (no default), default export target folder for railroad (syntax) diagrams
* **lpg.call-graph.saveDir**, string (no default), default export target folder for call graphs


## Parser Generation

This is a settings object named **lpg.generation.setting** with the following members:

* **mode**, string enum (default: "internal"), determines what code generation pattern should be followed:
    * **none**: don't generate any code, not even for internal use (note: this value will disable grammar debugging)
    * **internal**: allow code generation for internal use (e.g. for full error detection and interpreter data)
    * **external**: generate code also for external use, depending on the other generation options
* **outputDir**, string (default: undefined), determines the output folder where to place generated code (considered only if **mode** is set to `external`)
* **built_in_template**, string enum (default: java), Specifies the built in  target template for the generated code
* **use_define_include_directory**, string (default: undefined), Location to import/include grammars from (relative to a grammar or absolute path)
* **use_define_template_directory**, string (default: undefined), Location to template grammars from (relative to a grammar or absolute path)
* **package**, string (default: undefined), package/namespace for generated code 
* **language**, string (default: "undefined"), Specifies the target language for the Lsp  server no for generation.
* **visitor**, string (default: default),create visitors on code generation
* **trace**, string enum (default: conflicts), trace rule info when code generation
* **quiet**, false (default: false), quiet option.
* **verbose**, false (default: false), verbose option.
* **alternativeExe**, string (default: undefined), specifies the lpg.exe to use for generation, instead of the ones shipping with this extension.
* **additionalParameters**, string (default: undefined), specifies additional parameters to be passed on to the lpg.exe (built-in or custom) during parser generation.
