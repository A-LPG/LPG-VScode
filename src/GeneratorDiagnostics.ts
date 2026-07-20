import * as path from "path";
import {
    CodeAction,
    CodeActionKind,
    CodeActionProvider,
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity,
    Disposable,
    languages,
    Position,
    Range,
    TextDocument,
    Uri,
    workspace,
    window,
    env,
    commands,
} from "vscode";

/** Schema from lpg `--diagnostics=json` (docs/en/AI.md §5.3). */
export interface LpgJsonSpanPoint {
    line: number;
    column: number;
    offset: number;
}

export interface LpgJsonDiagnostic {
    file: string;
    span: { start: LpgJsonSpanPoint; end: LpgJsonSpanPoint };
    code: string;
    severity: string;
    message: string;
    help?: string | null;
    conflict_kind?: string;
    example_lookahead?: string;
}

export interface LpgJsonReport {
    schema_version: number;
    diagnostics: LpgJsonDiagnostic[];
    health?: {
        available?: boolean;
        healthy?: boolean;
        conflict_count?: number;
        shift_reduce_conflicts?: number;
        reduce_reduce_conflicts?: number;
        write_enabled?: boolean;
        warning_summary?: { errors?: number; warnings?: number; information?: number };
    };
}

const SOURCE = "lpg";
const COLLECTION_NAME = "lpg-generator";

let collection: DiagnosticCollection | undefined;

export function ensureDiagnosticCollection(): DiagnosticCollection {
    if (!collection) {
        collection = languages.createDiagnosticCollection(COLLECTION_NAME);
    }
    return collection;
}

export function disposeGeneratorDiagnostics(): void {
    collection?.dispose();
    collection = undefined;
}

/** Extract the first top-level JSON object from generator stdout. */
export function parseDiagnosticsJson(stdout: string): LpgJsonReport | undefined {
    const text = stdout.trim();
    if (!text) {
        return undefined;
    }
    const start = text.indexOf("{");
    if (start < 0) {
        return undefined;
    }
    // Prefer last line that looks like the report (generator emits one object).
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith("{") && lines[i].includes("schema_version")) {
            try {
                return JSON.parse(lines[i]) as LpgJsonReport;
            } catch {
                /* try whole blob */
            }
        }
    }
    try {
        return JSON.parse(text.substring(start)) as LpgJsonReport;
    } catch {
        return undefined;
    }
}

function toSeverity(sev: string): DiagnosticSeverity {
    switch ((sev || "").toLowerCase()) {
        case "error":
            return DiagnosticSeverity.Error;
        case "warning":
            return DiagnosticSeverity.Warning;
        case "information":
        case "info":
        case "informative":
            return DiagnosticSeverity.Information;
        default:
            return DiagnosticSeverity.Hint;
    }
}

/** LPG lines/columns are 1-based inclusive ends. */
function toRange(span: LpgJsonDiagnostic["span"]): Range {
    const startLine = Math.max(0, (span.start.line || 1) - 1);
    const startCol = Math.max(0, (span.start.column || 1) - 1);
    let endLine = Math.max(0, (span.end.line || 1) - 1);
    let endCol = Math.max(0, (span.end.column || 1) - 1);
    if (endLine < startLine || (endLine === startLine && endCol <= startCol)) {
        endLine = startLine;
        endCol = startCol + 1;
    }
    return new Range(new Position(startLine, startCol), new Position(endLine, endCol));
}

function isConflictDiagnostic(d: LpgJsonDiagnostic): boolean {
    if (d.conflict_kind) {
        return true;
    }
    const code = d.code || "";
    return code === "LPG2001" || code === "LPG2002" || code === "LPG2003"
        || /shift\/reduce|reduce\/reduce|conflict/i.test(d.message || "");
}

/**
 * Publish generator diagnostics for one grammar run.
 * Clears previous generator diagnostics for touched files, then sets new ones.
 */
export function publishGeneratorReport(
    grammarUri: Uri,
    report: LpgJsonReport | undefined,
): Diagnostic[] {
    const coll = ensureDiagnosticCollection();
    const byFile = new Map<string, Diagnostic[]>();

    // Always clear the primary grammar file so a clean run removes stale items.
    byFile.set(grammarUri.fsPath, []);

    if (report?.diagnostics) {
        for (const item of report.diagnostics) {
            const filePath = item.file && item.file.length
                ? path.resolve(item.file)
                : grammarUri.fsPath;
            const diag = new Diagnostic(toRange(item.span), item.message, toSeverity(item.severity));
            diag.source = SOURCE;
            diag.code = item.code;
            if (item.help) {
                diag.message = `${item.message}\n${item.help}`;
            }
            const extras: string[] = [];
            if (item.conflict_kind) {
                extras.push(`conflict: ${item.conflict_kind}`);
            }
            if (item.example_lookahead) {
                extras.push(`lookahead: ${item.example_lookahead}`);
            }
            if (extras.length) {
                diag.message = `${diag.message} (${extras.join("; ")})`;
            }
            if (isConflictDiagnostic(item)) {
                diag.tags = [];
            }
            const list = byFile.get(filePath) || [];
            list.push(diag);
            byFile.set(filePath, list);
        }
    }

    const all: Diagnostic[] = [];
    for (const [filePath, diags] of byFile) {
        coll.set(Uri.file(filePath), diags);
        all.push(...diags);
    }
    return all;
}

export function formatReportForChannel(report: LpgJsonReport): string[] {
    const lines: string[] = [];
    const h = report.health;
    if (h) {
        lines.push(
            `LPG health: healthy=${h.healthy} conflicts=${h.conflict_count ?? 0}`
            + ` (SR=${h.shift_reduce_conflicts ?? 0}, RR=${h.reduce_reduce_conflicts ?? 0})`
            + ` write=${h.write_enabled}`,
        );
    }
    for (const d of report.diagnostics || []) {
        const loc = `${d.file}:${d.span.start.line}:${d.span.start.column}`;
        lines.push(`[${d.severity}] ${d.code} ${loc}: ${d.message}`);
    }
    return lines;
}

export class GeneratorConflictCodeActionProvider implements CodeActionProvider {
    provideCodeActions(document: TextDocument, range: Range): CodeAction[] {
        const coll = ensureDiagnosticCollection();
        const diags = coll.get(document.uri) || [];
        const actions: CodeAction[] = [];
        for (const diag of diags) {
            if (!diag.range.intersection(range) && !diag.range.contains(range.start)) {
                continue;
            }
            const code = typeof diag.code === "string" ? diag.code : String(diag.code ?? "");
            const conflictish = /conflict|LPG200/i.test(code + " " + diag.message);
            if (!conflictish) {
                continue;
            }

            const copy = new CodeAction("LPG: Copy diagnostic message", CodeActionKind.QuickFix);
            copy.diagnostics = [diag];
            copy.command = {
                title: "Copy diagnostic",
                command: "lpg.tools.copyDiagnostic",
                arguments: [diag.message],
            };
            actions.push(copy);

            const listing = new CodeAction(
                "LPG: Suggest regenerate with -list (listing file)",
                CodeActionKind.QuickFix,
            );
            listing.diagnostics = [diag];
            listing.command = {
                title: "Suggest -list",
                command: "lpg.tools.suggestListFlag",
                arguments: [document.uri],
            };
            actions.push(listing);
        }
        return actions;
    }
}

export function registerGeneratorDiagnostics(disposables: Disposable[]): void {
    ensureDiagnosticCollection();
    disposables.push(
        languages.registerCodeActionsProvider(
            { language: "lpg" },
            new GeneratorConflictCodeActionProvider(),
            { providedCodeActionKinds: [CodeActionKind.QuickFix] },
        ),
    );
    disposables.push(
        commands.registerCommand("lpg.tools.copyDiagnostic", async (message: string) => {
            await env.clipboard.writeText(message || "");
            void window.showInformationMessage("Copied LPG diagnostic to clipboard.");
        }),
    );
    disposables.push(
        commands.registerCommand("lpg.tools.suggestListFlag", async (uri: Uri) => {
            const hint =
                "Add `-list` via lpg.generation.setting.additionalParameters "
                + "(or run the generator with -list) to write a conflict listing next to the grammar. "
                + `File: ${uri.fsPath}`;
            await env.clipboard.writeText("-list");
            void window.showInformationMessage(hint);
        }),
    );
    disposables.push({ dispose: () => disposeGeneratorDiagnostics() });
}

export function analyzeOnSaveEnabled(): boolean {
    const config = workspace.getConfiguration("lpg.generation.setting");
    return config.get<boolean>("analyzeOnSave") ?? true;
}
