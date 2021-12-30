/*
 * This file is released under the MIT license.
 * Copyright (c) 2017, 2020, Mike Lischke
 *
 * See LICENSE file for more info.
 */

import * as path from "path";
import * as vscode from "vscode";

import { WebviewProvider, WebviewShowOptions } from "./WebviewProvider";
import { Utils } from "./Utils";
import { RailRoadScriptInfo } from "./protocol";

export class LpgRailroadDiagramProvider extends WebviewProvider {

    symbols : Array<RailRoadScriptInfo> = [];
    public generateContent(webView: vscode.Webview, editor: vscode.TextEditor, options: WebviewShowOptions): string {
        const caret = editor.selection.active;

        const fileName = editor.document.fileName;


        const baseName = path.basename(fileName, path.extname(fileName));

        // Content Security Policy
        const nonce = new Date().getTime() + "" + new Date().getMilliseconds();
        const scripts = [
            Utils.getMiscPath("utils.js", this.context, webView),
            Utils.getMiscPath("railroad-diagrams.js", this.context, webView),
        ];

        let diagram = `<!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="Content-type" content="text/html; charset=UTF-8"/>
                ${this.generateContentSecurityPolicy(editor)}
                ${this.getStyles(webView)}
                <base href="${editor.document.uri.toString(true)}">
            </head>

            <body>
            ${this.getScripts(nonce, scripts)}
        `;

       
        diagram += `
            <div class="header">
                <span class="rrd-color"><span class="graph-initial">Ⓡ</span>rd&nbsp;&nbsp;</span>All rules
                <span class="action-box">
                Save to HTML<a onClick="exportToHTML('rrd', '${baseName}');"><span class="rrd-save-image" /></a>
                </span>
            </div>
            <div id="container">`;
        
            for (const entry of this.symbols) 
            {
                diagram += `<h3 class=\"${entry.ruleName}-class\">${entry.ruleName}</h3>\n<script>${entry.rrdInfo}</script>\n\n`; 
            };

        diagram += "</div>";
        
        diagram += "</body></html>";

        return diagram;
    }
}
