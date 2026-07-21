import * as child_process from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import { workspace } from "vscode";
import { generateForTestGrammar, getExtensionRoot } from "./GrammarGenerator";
import { OutputInfoCollector } from "./extension";

export interface TestRigToken {
    kind: number;
    name: string;
    lexeme: string;
    start: number;
    end: number;
}

export interface TestRigTreeNode {
    id: number;
    name: string;
    type: string | number;
    symbol?: string | { text?: string; tokenIndex?: number };
    range?: Record<string, number>;
    children?: TestRigTreeNode[];
}

export interface TestRigResult {
    ok: boolean;
    tokens: TestRigToken[];
    tree: TestRigTreeNode | null;
    error?: string | null;
}

/** Schema expected by misc/parse-tree.js (numeric type + symbol/range shape). */
export interface ParseTreeViewNode {
    id: number;
    name: string;
    type: number;
    children: ParseTreeViewNode[];
    range: { startIndex: number; stopIndex: number; length: number };
    symbol: { text: string; tokenIndex: number };
}

function jdkBin(tool: "java" | "javac"): string {
    const home = workspace.getConfiguration("lpg.test").get<string>("jdkHome") || "";
    if (home && home.trim()) {
        const candidate = path.join(home.trim(), "bin", tool + (process.platform === "win32" ? ".exe" : ""));
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return tool;
}

export function grammarHasImportTerminals(grammarText: string): boolean {
    return /import_terminals\s*=\s*[^\s,]+/i.test(grammarText);
}

function runtimeJarPath(): string {
    return path.join(getExtensionRoot(), "server", "lib", "lpg-runtime.jar");
}

function harnessClassesDir(): string {
    return path.join(getExtensionRoot(), "misc", "java-testrig", "classes");
}

function runCmd(cmd: string, args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = child_process.spawn(cmd, args, { cwd });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => { stdout += d.toString(); });
        child.stderr.on("data", (d) => { stderr += d.toString(); });
        child.on("error", (err) => reject(err));
        child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    });
}

export function adaptTreeForParseView(node: TestRigTreeNode | null): ParseTreeViewNode {
    if (!node) {
        return {
            id: 0,
            name: "(no tree)",
            type: 0,
            children: [],
            range: { startIndex: 0, stopIndex: 0, length: 0 },
            symbol: { text: "", tokenIndex: -1 },
        };
    }
    const children = (node.children || []).map((c) => adaptTreeForParseView(c));
    const isLeaf = children.length === 0;
    const start = node.range?.start ?? node.range?.startIndex ?? 0;
    const end = node.range?.end ?? node.range?.stopIndex ?? start;
    const span = end > start ? 2 : (end === start ? 0 : 1);
    let symbolText = "";
    if (typeof node.symbol === "string") {
        symbolText = node.symbol;
    } else if (node.symbol && typeof node.symbol === "object") {
        symbolText = node.symbol.text || "";
    }
    if (isLeaf) {
        // Prefer short name / lexeme for leaf label.
        const nm = node.name || "";
        const colon = nm.indexOf(": ");
        symbolText = colon >= 0 ? nm.substring(colon + 2) : (symbolText || nm);
    }
    return {
        id: typeof node.id === "number" ? node.id : 0,
        name: node.name || String(node.type),
        type: isLeaf ? 1 : 0,
        children,
        range: { startIndex: start, stopIndex: end, length: span },
        symbol: { text: symbolText, tokenIndex: -1 },
    };
}

async function cacheStampPath(outDir: string): Promise<string> {
    return path.join(outDir, ".testrig.stamp");
}

async function shouldRegenerate(grammarPath: string, outDir: string): Promise<boolean> {
    const stamp = await cacheStampPath(outDir);
    if (!await fs.pathExists(stamp)) {
        return true;
    }
    const classesDir = path.join(outDir, "classes");
    if (!await fs.pathExists(classesDir)) {
        return true;
    }
    // classes may be nested under package dirs
    let hasClass = false;
    const walk = async (dir: string): Promise<void> => {
        for (const ent of await fs.readdir(dir)) {
            const p = path.join(dir, ent);
            const st = await fs.stat(p);
            if (st.isDirectory()) {
                await walk(p);
            } else if (ent.endsWith(".class")) {
                hasClass = true;
            }
        }
    };
    await walk(classesDir);
    if (!hasClass) {
        return true;
    }
    const stampText = (await fs.readFile(stamp, "utf8")).trim();
    const gStat = await fs.stat(grammarPath);
    const grammarText = await fs.readFile(grammarPath, "utf8");
    const ebnf = /\bebnf\b/i.test(grammarText) ? "ebnf" : "noebnf";
    const expected = `${gStat.mtimeMs}|java|nested|${ebnf}`;
    return stampText !== expected;
}

async function writeStamp(grammarPath: string, outDir: string): Promise<void> {
    const gStat = await fs.stat(grammarPath);
    const grammarText = await fs.readFile(grammarPath, "utf8");
    const ebnf = /\bebnf\b/i.test(grammarText) ? "ebnf" : "noebnf";
    await fs.writeFile(await cacheStampPath(outDir), `${gStat.mtimeMs}|java|nested|${ebnf}`, "utf8");
}

/**
 * Generate → javac generated sources → run LpgTestRig on sample input.
 */
export async function runJavaTestRig(
    grammarPath: string,
    sampleInput: string,
    outputChannel: OutputInfoCollector,
): Promise<TestRigResult> {
    const grammarText = await fs.readFile(grammarPath, "utf8");
    if (!grammarHasImportTerminals(grammarText)) {
        return {
            ok: false,
            tokens: [],
            tree: null,
            error: "Test Grammar requires import_terminals=….gi (real lexer). "
                + "Token-seeded examples (calculator / ebnf-call) are not supported.",
        };
    }

    const jar = runtimeJarPath();
    if (!await fs.pathExists(jar)) {
        return {
            ok: false,
            tokens: [],
            tree: null,
            error: `Missing ${jar}. Run scripts/assemble-release.sh (builds server/lib/lpg-runtime.jar).`,
        };
    }
    const harnessDir = harnessClassesDir();
    if (!await fs.pathExists(path.join(harnessDir, "LpgTestRig.class"))) {
        return {
            ok: false,
            tokens: [],
            tree: null,
            error: `Missing compiled LpgTestRig at ${harnessDir}. Re-run assemble-release.sh.`,
        };
    }

    const javac = jdkBin("javac");
    const java = jdkBin("java");
    try {
        await runCmd(java, ["-version"]);
    } catch (e) {
        return {
            ok: false,
            tokens: [],
            tree: null,
            error: `JDK not found (java). Set lpg.test.jdkHome or install a JDK on PATH. (${e})`,
        };
    }

    const basePath = path.dirname(grammarPath);
    const outDir = path.join(basePath, ".lpg", "test");
    await fs.ensureDir(outDir);
    const classesDir = path.join(outDir, "classes");

    const needGen = await shouldRegenerate(grammarPath, outDir);
    if (needGen) {
        const { result: genResult } = await generateForTestGrammar(grammarPath, outputChannel);
        if (genResult.exitCode !== 0) {
            const msg = genResult.report?.diagnostics?.[0]?.message
                || `Generator exited with code ${genResult.exitCode}`;
            return { ok: false, tokens: [], tree: null, error: msg };
        }

        const javaSources = (await fs.readdir(outDir)).filter((f) => f.endsWith(".java"));
        // Generated sources may sit flat or under package dirs — collect recursively.
        const collectJava = async (dir: string): Promise<string[]> => {
            const out: string[] = [];
            for (const ent of await fs.readdir(dir)) {
                const p = path.join(dir, ent);
                const st = await fs.stat(p);
                if (st.isDirectory()) {
                    if (ent === "classes") {
                        continue;
                    }
                    out.push(...await collectJava(p));
                } else if (ent.endsWith(".java")) {
                    out.push(p);
                }
            }
            return out;
        };
        const allJava = javaSources.length
            ? javaSources.map((f) => path.join(outDir, f))
            : await collectJava(outDir);

        if (!allJava.some((f) => /Lexer\.java$/i.test(f) && !/KWLexer\.java$/i.test(f))) {
            return {
                ok: false,
                tokens: [],
                tree: null,
                error: "No *Lexer.java generated. Check import_terminals and regenerate.",
            };
        }

        await fs.emptyDir(classesDir);
        const compileGen = await runCmd(javac, [
            "-encoding", "UTF-8",
            "-source", "8",
            "-target", "8",
            "-cp", jar,
            "-d", classesDir,
            ...allJava,
        ], outDir);
        if (compileGen.code !== 0) {
            return {
                ok: false,
                tokens: [],
                tree: null,
                error: `javac failed:\n${compileGen.stderr || compileGen.stdout}`,
            };
        }
        await writeStamp(grammarPath, outDir);
    }

    const inputFile = path.join(outDir, "_testrig_input.txt");
    await fs.writeFile(inputFile, sampleInput, "utf8");

    const sep = process.platform === "win32" ? ";" : ":";
    const cp = [jar, classesDir, harnessDir].join(sep);
    let run: { code: number; stdout: string; stderr: string };
    try {
        run = await runCmd(java, [
            "-cp", cp,
            "LpgTestRig",
            "--classes-dir", classesDir,
            "--input", inputFile,
        ], outDir);
    } catch (e) {
        return {
            ok: false,
            tokens: [],
            tree: null,
            error: `Failed to launch java: ${e}`,
        };
    }

    const joined = (run.stdout || "").trim();
    const jsonLine = joined.split(/\r?\n/).filter((l) => l.startsWith("{")).pop();
    if (!jsonLine) {
        return {
            ok: false,
            tokens: [],
            tree: null,
            error: `testrig produced no JSON (exit ${run.code}):\n${run.stderr || run.stdout}`,
        };
    }
    try {
        return JSON.parse(jsonLine) as TestRigResult;
    } catch (e) {
        return {
            ok: false,
            tokens: [],
            tree: null,
            error: `failed to parse testrig JSON: ${e}\n${jsonLine}`,
        };
    }
}
