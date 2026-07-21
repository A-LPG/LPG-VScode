import * as path from "path";
import { TextEditor, Uri, Webview, window } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { ExtensionContext } from "vscode";
import { WebviewProvider, WebviewShowOptions, WebviewMessage } from "./WebviewProvider";
import { Utils } from "./Utils";
import { adaptTreeForParseView, runJavaTestRig, TestRigResult } from "./JavaParseRunner";
import { OutputInfoCollector } from "./extension";

/**
 * Interactive Test Grammar panel: sample text → Java lexer/parser → tokens + AST.
 */
export class TestGrammarProvider extends WebviewProvider {
    private outputChannel: OutputInfoCollector;
    private grammarUri: Uri | undefined;

    public constructor(
        languageClient: LanguageClient | undefined,
        context: ExtensionContext,
        outputChannel: OutputInfoCollector,
    ) {
        super(languageClient, context);
        this.outputChannel = outputChannel;
    }

    public showForEditor(editor: TextEditor): void {
        this.grammarUri = editor.document.uri;
        this.showWebview(editor, {
            title: "Test Grammar: " + path.basename(editor.document.fileName),
        });
    }

    protected handleMessage(message: WebviewMessage): boolean {
        if (message.command === "runTest") {
            void this.runTest(String(message.input || ""));
            return true;
        }
        return false;
    }

    private async runTest(input: string): Promise<void> {
        if (!this.grammarUri) {
            void window.showErrorMessage("No grammar file associated with Test Grammar panel.");
            return;
        }
        const uri = this.grammarUri;
        this.sendMessage(uri, { command: "setStatus", text: "Running…", ok: true });
        try {
            const result = await runJavaTestRig(uri.fsPath, input, this.outputChannel);
            this.postResult(uri, result);
        } catch (e) {
            this.sendMessage(uri, {
                command: "setStatus",
                text: String(e),
                ok: false,
            });
        }
    }

    private postResult(uri: Uri, result: TestRigResult): void {
        const treeData = adaptTreeForParseView(result.tree);
        this.sendMessage(uri, { command: "updateParseTreeData", treeData });
        this.sendMessage(uri, {
            command: "updateTokens",
            tokens: result.tokens || [],
            ok: result.ok,
            error: result.error || null,
        });
        if (!result.ok && result.error) {
            this.outputChannel.appendLine("[Test Grammar] " + result.error);
        }
    }

    public generateContent(webView: Webview, source: TextEditor | Uri, options: WebviewShowOptions): string {
        const uri = (source instanceof Uri) ? source : source.document.uri;
        this.grammarUri = uri;
        const baseName = path.basename(uri.fsPath, path.extname(uri.fsPath));
        const nonce = new Date().getTime() + "" + new Date().getMilliseconds();

        const scripts = [
            Utils.getMiscPath("d3.min.js", this.context, webView),
            Utils.getMiscPath("utils.js", this.context, webView),
            Utils.getMiscPath("parse-tree.js", this.context, webView),
        ];

        const placeholder = {
            id: 0,
            name: "Run to see AST",
            type: 0,
            children: [] as unknown[],
            range: { startIndex: 0, stopIndex: 0, length: 0 },
            symbol: { text: "", tokenIndex: -1 },
        };

        return `<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-type" content="text/html;charset=UTF-8"/>
    ${this.generateContentSecurityPolicy(webView)}
    ${this.getStyles(webView)}
    <base href="${uri.toString(true)}">
    <style>
        .testrig-toolbar { margin: 8px 0 12px 0; }
        #sampleInput {
            width: 100%; min-height: 90px; font-family: var(--vscode-editor-font-family, monospace);
            background: var(--vscode-input-background); color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, #555); padding: 6px;
        }
        #runBtn {
            margin-top: 6px; padding: 4px 14px; cursor: pointer;
            background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none;
        }
        #status { margin: 6px 0; white-space: pre-wrap; font-size: 12px; }
        #status.err { color: var(--vscode-errorForeground, #f44); }
        #tokenTable { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
        #tokenTable th, #tokenTable td {
            border: 1px solid var(--vscode-panel-border, #444); padding: 2px 6px; text-align: left;
        }
        #treeHost { width: 100%; height: 55vh; overflow: hidden; border-top: 1px solid var(--vscode-panel-border, #444); }
        #treeHost svg { width: 100%; height: 100%; }
    </style>
    <script>
        var width = Math.max(window.innerWidth - 40, 400);
        var height = Math.max(window.innerHeight * 0.5, 320);
        var initialScale = 0.7;
        var initialTranslateX = width / 2;
        var initialTranslateY = 30;
        var useCluster = false;
        var horizontal = true;
        var parseTreeData = ${JSON.stringify(placeholder)};
    </script>
    ${this.getScripts(nonce, scripts)}
</head>
<body>
    <div class="header">
        <span class="parse-tree-color"><span class="graph-initial">Ⓣ</span>est Grammar</span>
        <span class="action-box">
            Cluster
            <div class="switch">
                <span class="switch-border">
                    <input id="switch1" type="checkbox" onClick="toggleTreeType(this)">
                    <span class="switch-handle-top"></span>
                </span>
            </div>
            &nbsp;Vertical
            <div class="switch">
                <span class="switch-border">
                    <input id="switch2" type="checkbox" onClick="toggleOrientation(this)">
                    <span class="switch-handle-top"></span>
                </span>
            </div>
            &nbsp;
            <a onClick="changeNodeSize(0.8);"><span style="cursor:pointer;font-weight:800;">−</span></a>
            node size
            <a onClick="changeNodeSize(1.2);"><span style="cursor:pointer;font-weight:800;">+</span></a>
            &nbsp;Save SVG
            <a onClick="exportToSVG('parse-tree', '${baseName}');"><span class="parse-tree-save-image"></span></a>
        </span>
    </div>

    <div class="testrig-toolbar">
        <textarea id="sampleInput" placeholder='Paste sample input (e.g. {"a":1})'></textarea>
        <button id="runBtn" type="button">Run</button>
        <div id="status">Requires import_terminals lexer + JDK. Java nested AST only.</div>
    </div>

    <table id="tokenTable">
        <thead><tr><th>#</th><th>Kind</th><th>Name</th><th>Lexeme</th><th>Start</th><th>End</th></tr></thead>
        <tbody id="tokenBody"></tbody>
    </table>

    <div id="treeHost"><svg></svg></div>

    <script>
        initSwitches();
        update(root);

        document.getElementById("runBtn").addEventListener("click", function () {
            var text = document.getElementById("sampleInput").value;
            vscode.postMessage({ command: "runTest", input: text });
        });

        window.addEventListener("message", function (event) {
            var msg = event.data;
            if (msg.command === "setStatus") {
                var el = document.getElementById("status");
                el.textContent = msg.text || "";
                el.className = msg.ok ? "" : "err";
            }
            if (msg.command === "updateTokens") {
                var el = document.getElementById("status");
                if (msg.error) {
                    el.textContent = msg.error;
                    el.className = "err";
                } else {
                    el.textContent = msg.ok ? "Parse OK — " + (msg.tokens || []).length + " tokens" : "Parse failed";
                    el.className = msg.ok ? "" : "err";
                }
                var body = document.getElementById("tokenBody");
                body.innerHTML = "";
                (msg.tokens || []).forEach(function (t, i) {
                    var tr = document.createElement("tr");
                    tr.innerHTML = "<td>" + i + "</td><td>" + t.kind + "</td><td>" + escapeHtml(t.name) +
                        "</td><td>" + escapeHtml(t.lexeme) + "</td><td>" + t.start + "</td><td>" + t.end + "</td>";
                    body.appendChild(tr);
                });
            }
        });

        function escapeHtml(s) {
            return String(s == null ? "" : s)
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
    </script>
</body>
</html>`;
    }
}
