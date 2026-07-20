import * as child_process from "child_process";
import * as path from "path";

import * as fs from "fs-extra";
import { TextDocument, Uri } from "vscode";
import { workspace } from "vscode";
import { window } from "vscode";
import { ProgressIndicator } from "./ProgressIndicator";
import { OutputInfoCollector } from "./extension";
import { Constant } from "./Commands";
import { allowExecution, isLinux, isWindows } from "./Utils";
import glob = require("glob");
import {
    formatReportForChannel,
    LpgJsonReport,
    parseDiagnosticsJson,
    publishGeneratorReport,
} from "./GeneratorDiagnostics";


const expandHomeDir = require("expand-home-dir");
/**
 * Options used by the parser files generation.
 */

 export interface GenerationOptions {

    // The folder in which to run the generation process. Should be an absolute path for predictable results.
    // Used internally only.
    baseDir?: string;


    // Search template  path for the LPG tool.
    use_define_template_directory?: string;

    // Search inlcude  path for the LPG tool.
    use_define_include_directory?: string;

    // Search template  path for the LPG tool.
    template_search_directory?: string;

    // Search inlcude  path for the LPG tool.
    include_search_directory?: string;

    // The folder where to place generated files in (relative to baseDir or absolute) (default: grammar dir),
    outputDir?: string;

    // Package or namespace name for generated files (default: none).
    package?: string;

    // The target language for the generated files. (default: what's given in the grammar or Java).
    language?: string;

    // The target template for the generated files. (default: java).
    built_in_template?: string;

    // Generate visitor files if set (default: false).
    visitor?: string;

    // Automatic AST mode (-automatic_ast).
    automatic_ast?: string;

    // Fail when conflicts remain (-fail_on_conflicts).
    fail_on_conflicts?: boolean;

    trace?: string;
    quiet?: boolean;
    verbose?: boolean;
    /** Pass -ebnf to lpg-v2 (opt-in EBNF sugar). */
    ebnf?: boolean;

    /** Analysis-only: -nowrite (no generated files). */
    nowrite?: boolean;

    /** Emit machine-readable diagnostics on stdout (-diagnostics=json). */
    diagnosticsJson?: boolean;

    // Use this jar for work instead of the built-in one(s).
    alternativeExe?: string;



    // Any additional parameter you want to send to LPG for generation (e.g. "-lalr=3").
    additionalParameters?: string;
}

export interface GenerateResult {
    exitCode: number;
    output: string[];
    report?: LpgJsonReport;
}
export interface GenerationSettingOptions {

    // Search template  path for the LPG tool.
    template_search_directory?: string;

    // Search inlcude  path for the LPG tool.
    include_search_directory?: string;

    // Package or namespace name for generated files (default: none).
    package?: string;

    // The target language for the generated files. (default: what's given in the grammar or Java).
    language?: string;

    // Generate visitor files if set (default: false).
    visitor?: string;

    trace?: string;
    quiet?: boolean;
    verbose?: boolean;

    // Any additional parameter you want to send to LPG for generation (e.g. "-lalr=3").
    additionalParameters?: string;
}
// iterate through symbolic links until file is found
async function findLinkedFile(file: string): Promise<string> {
    if (!await fs.pathExists(file) || !(await fs.lstat(file)).isSymbolicLink()) {
        return file;
    }
    return await findLinkedFile(await fs.readlink(file));
}
async function fromEnv(name: string): Promise<string[]> {
    const ret: string[] = [];
    if (process.env[name]) {
        const dir = expandHomeDir(process.env[name]);
        if (dir) {
            ret.push(dir);
        }
    }
    return ret;
}
let cachedExtensionPath: string | undefined;

/** Call once from activate() so built-in template paths resolve under webpack. */
export function setExtensionPath(extensionPath: string): void {
    cachedExtensionPath = extensionPath;
}

function extensionRoot(): string {
    if (cachedExtensionPath) {
        return cachedExtensionPath;
    }
    return path.resolve(__dirname, '..');
}

const BUILTIN_TEMPLATE_LANGS = [
    "java", "rt_cpp", "csharp", "typescript", "python2", "python3", "dart", "go", "rust",
] as const;

function appendSearchPath(existing: string | undefined, dir: string): string {
    if (!existing) {
        return dir;
    }
    return existing.endsWith(";") ? existing + dir : existing + ";" + dir;
}

function resolveBuiltinTemplateLang(raw: string | undefined): string {
    const lang = (raw && raw.trim()) || "java";
    return (BUILTIN_TEMPLATE_LANGS as readonly string[]).includes(lang) ? lang : "java";
}

export function GetGenerationSettingOptions():GenerationSettingOptions{
    let option = GetGenerationOptions(undefined,undefined);
    let settings : GenerationSettingOptions={
        template_search_directory: option.template_search_directory,
        include_search_directory :option.include_search_directory,
        package: option.package,
        language : option.language,
        visitor: option.visitor,
        quiet : option.quiet,
        trace : option.trace,
        verbose  : option.verbose,
        additionalParameters : option.additionalParameters
    };

    return settings;
}
export function GetGenerationOptions(basePath: string | undefined, outputDir : string | undefined):GenerationOptions
{
    const config = workspace.getConfiguration(Constant.LPG_GENERATION);
    // WorkspaceConfiguration values must be read via .get(); property access is always undefined.
    // Parent object default may be only { mode }, so nested defaults need explicit fallbacks.
    const options: GenerationOptions = {
        baseDir: basePath,
        template_search_directory: config.get<string>("use_define_template_directory") || "",
        include_search_directory: config.get<string>("use_define_include_directory") || "",
        outputDir,
        built_in_template : resolveBuiltinTemplateLang(config.get<string>("built_in_template")),
        language : config.get<string>("language") || "java",
        package : config.get<string>("package") || "",
        visitor : config.get<string>("visitor") || "default",
        automatic_ast: config.get<string>("automatic_ast") || "none",
        fail_on_conflicts: config.get<boolean>("fail_on_conflicts") ?? false,
        trace: config.get<string>("trace") || "conflicts",
        quiet: config.get<boolean>("quiet") ?? false,
        verbose: config.get<boolean>("verbose") ?? false,
        ebnf: config.get<boolean>("ebnf") ?? false,
        alternativeExe: config.get<string>("alternativeExe") || "",
        additionalParameters: config.get<string>("additionalParameters") || "",
    };

    const lang = options.built_in_template as string;
    const includeDir = path.resolve(extensionRoot(), "templates/include", lang);
    const templateDir = path.resolve(extensionRoot(), "templates/templates", lang);
    options.include_search_directory = appendSearchPath(options.include_search_directory, includeDir);
    options.template_search_directory = appendSearchPath(options.template_search_directory, templateDir);

    return options;
}

function resolveTargetLanguage(options: GenerationOptions): string {
    const mapLanguage = (raw: string): string => {
        switch (raw) {
            case "c++": return "cpp";
            case "undefined": return "";
            default: return raw;
        }
    };
    if (options.language && options.language !== "undefined") {
        return mapLanguage(options.language);
    }
    if (options.built_in_template) {
        return mapLanguage(options.built_in_template);
    }
    return "java";
}
    /**
     * For certain services we have to (re)generate files from grammars in the background:
     * - syntactic + semantic grammar analysis by the ANTLR tool
     * - generate interpreter data (for debugging + ATN views)
     *
     * @param document For which to generate the data.
     */
function resolveOutputDir(document: TextDocument, config: ReturnType<typeof workspace.getConfiguration>): string | undefined {
        const basePath = path.dirname(document.fileName);
        const mode = config.get<string>("mode");
        if (mode === "none") {
            return undefined;
        }
        let outputDir = path.join(basePath, ".lpg");
        if (mode === "external") {
            outputDir = config.get<string>("outputDir") as string;
            if (!outputDir) {
                outputDir = basePath;
            } else if (!path.isAbsolute(outputDir)) {
                outputDir = path.join(basePath, outputDir);
            }
        }
        return outputDir;
    }

    function applyReport(uri: Uri, report: LpgJsonReport | undefined, outputChannel: OutputInfoCollector): void {
        publishGeneratorReport(uri, report);
        if (report) {
            for (const line of formatReportForChannel(report)) {
                outputChannel.appendLine(line);
            }
        }
    }

   export  function regenerateParser(document: TextDocument,
        progress : ProgressIndicator,
        outputChannel:OutputInfoCollector): void
        {
        const config = workspace.getConfiguration(Constant.LPG_GENERATION);
        if (config.get<string>("mode") === "none") {
            return;
        }

        const grammarFileName = document.uri.fsPath;
        progress.startAnimation();
        const basePath = path.dirname(document.fileName);
        const outputDir = resolveOutputDir(document, config);
        if (!outputDir) {
            progress.stopAnimation();
            return;
        }

        try {
            fs.ensureDirSync(outputDir);
        } catch (error) {
            progress.stopAnimation();
            void window.showErrorMessage("Cannot create output folder: " + (error as string));

            return;
        }

        const options = GetGenerationOptions(basePath, outputDir);
        options.diagnosticsJson = true;

        generate(grammarFileName, options, outputChannel).then((result: GenerateResult) => {
            for (const str of result.output) {
                if (!str.trim().startsWith("{") || !str.includes("schema_version")) {
                    outputChannel.appendLine(str);
                }
            }
            applyReport(document.uri, result.report, outputChannel);
            progress.stopAnimation();
            if (result.exitCode === 0 || result.exitCode === null) {
                window.showInformationMessage("Generate parser for " + grammarFileName + " has done.");
            } else {
                outputChannel.show(true);
                window.showErrorMessage(
                    `Generate parser for ${grammarFileName} failed (exit ${result.exitCode}). See Problems / Output.`,
                );
            }
        }).catch((reason) => {
            progress.stopAnimation();
            outputChannel.appendLine(String(reason));
            outputChannel.show(true);
            window.showErrorMessage("Generate parser for " + grammarFileName + " failed: " + reason);
        });
    }

    /** Background -nowrite analysis for Problems (analyzeOnSave). */
    export function analyzeGrammarDocument(
        document: TextDocument,
        outputChannel?: OutputInfoCollector,
    ): Promise<GenerateResult> {
        const basePath = path.dirname(document.fileName);
        const options = GetGenerationOptions(basePath, undefined);
        options.nowrite = true;
        options.diagnosticsJson = true;
        options.quiet = true;
        // Analysis should not create .lpg output.
        options.outputDir = undefined;
        const silent = outputChannel || {
            appendLine: (_: string) => { /* no-op for save storm */ },
        } as OutputInfoCollector;
        return generate(document.uri.fsPath, options, silent).then((result) => {
            publishGeneratorReport(document.uri, result.report);
            return result;
        });
    }

    export function get_server_path(): string[]
    {
        let exeHome: string ;
        if (isWindows) {
            exeHome = path.resolve(__dirname, '../server/win');

        } else if(isLinux) {
            exeHome =   path.resolve(__dirname, '../server/linux');
        }
        else{
            exeHome =  path.resolve(__dirname, '../server/mac');
        }

        const launchersFound: Array<string> = glob.sync('**/LPG-language-server*',
        { cwd: exeHome });
        if (launchersFound.length) {
            return [(path.resolve(exeHome, launchersFound[0])),exeHome] ;
        } else {
            return  ["",exeHome] ;
        }
    }
    function get_lpg_generator_path(): string[]
    {
        let exeHome: string ;
        if (isWindows) {
            exeHome = path.resolve(__dirname, '../server/win');

        } else if(isLinux) {
            exeHome =   path.resolve(__dirname, '../server/linux');
        }
        else{
            exeHome =  path.resolve(__dirname, '../server/mac');
        }

        const launchersFound: Array<string> = glob.sync('**/lpg-v*',
        { cwd: exeHome });
        if (launchersFound.length) {
            // Prefer the newest generator if multiple lpg-v* binaries are present.
            launchersFound.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
            return [(path.resolve(exeHome, launchersFound[0])),exeHome] ;
        } else {
            return  ["",exeHome] ;
        }
    }
    function generate(fileName: string, options: GenerationOptions, outputChannel: OutputInfoCollector): Promise<GenerateResult> {
    return new Promise<GenerateResult>((resolve, reject) => {

        let  cmd_string : string;
        if (options.alternativeExe) {
            cmd_string= (options.alternativeExe);
        } else {
            let paths =get_lpg_generator_path();
            cmd_string = paths[0];
            if(!cmd_string.length){
                reject("Can't find LPG generator");
                return;
            }
        }
        if (! fs.pathExistsSync(cmd_string) ){
            reject(cmd_string + " didn't exist.")
            return
        }
        const parameters = [];
        if (options.nowrite) {
            parameters.push("-nowrite");
        }
        if (options.diagnosticsJson !== false) {
            // Default on for Problems integration; callers can set false to opt out.
            parameters.push("-diagnostics=json");
        }
        parameters.push("-table");
        const language = resolveTargetLanguage(options);
        if (language) {
            parameters.push("-programming_language=" + language);
        }

        if (options.quiet) {
            parameters.push("-quiet");
        }
        if (options.package) {
            parameters.push("-package="+ options.package);
        }
        if (options.verbose) {
            parameters.push("-verbose");
        }
        if (options.ebnf) {
            parameters.push("-ebnf");
        }
        if (options.visitor) {
            parameters.push("-visitor=" + options.visitor);
        }
        if (options.automatic_ast && options.automatic_ast !== "none") {
            parameters.push("-automatic_ast=" + options.automatic_ast);
        }
        if (options.fail_on_conflicts) {
            parameters.push("-fail_on_conflicts");
        }
        if (options.trace) {
            parameters.push("-trace=" + options.trace);
        }

        if (options.include_search_directory || options.template_search_directory) {

            let arg: string = "-include-directory=";
            if (options.include_search_directory ) {

                arg += options.include_search_directory;
                arg += ";";
            }
            if (options.template_search_directory) {

                arg += options.template_search_directory;
            }
            parameters.push(arg);
        }

        if (options.outputDir) {
            parameters.push("-out_directory=" +options.outputDir);

        }

        if (options.additionalParameters) {
            parameters.push(options.additionalParameters);
        }


        parameters.push(fileName);
        const spawnOptions = { cwd: options.baseDir || path.dirname(fileName) };
        outputChannel.appendLine(parameters.join(" "))
        const lpg_process = child_process.spawn(cmd_string, parameters, spawnOptions);

        const outputList: string[] = [];
        lpg_process.stderr.on("data", (data) => {
            let text = data.toString() as string;
            if (text.startsWith("Picked up _JAVA_OPTIONS:")) {
                const endOfInfo = text.indexOf("\n");
                if (endOfInfo === -1) {
                    text = "";
                } else {
                    text = text.substr(endOfInfo + 1, text.length);
                }
            }
            if (text.length > 0) {
                outputList.push(text);
            }
        });
        lpg_process.stdout.on("data",(data)=>{
            let text = data.toString() as string;
            outputList.push(text);
        })
        lpg_process.on("close", (code) => {
            const joined = outputList.join("");
            const report = parseDiagnosticsJson(joined);
            const exitCode = code === null ? 0 : code;
            resolve({ exitCode, output: outputList, report });
        });
        lpg_process.on("error", (err) => {
            reject(err.message || String(err));
        });
    });
}


export async function makeOfflineBinariesExecutable(): Promise<void> {
    const promises: Thenable<void>[] = [];
    const path_list : string[] =[];
    let _path = get_lpg_generator_path()[0];
    if(_path.length){
        path_list.push(_path);
    }
    _path = get_server_path()[0];
    if(_path.length){
        path_list.push(_path);
    }
    path_list.forEach( p => {
        promises.push(allowExecution(p))
    });
    await Promise.all(promises);
}
