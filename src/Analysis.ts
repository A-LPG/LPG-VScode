'use strict';

import * as path from 'path';
import { commands, ExtensionContext, TextEditor, TextEditorEdit, window } from 'vscode';
import { TextDocumentIdentifier } from 'vscode-languageclient';
import { Commands } from './commands';
import {   CallGraphRequest, FirstSet_AllRules_Request, FirstSet_SingleRule_Request, FollowSet_AllRules_Request, FollowSet_SingleRule_Request, RRD_AllRules_Request, RRD_SingleRule_Request} from './protocol';
import { LanguageClient } from 'vscode-languageclient/node';
import { getTextDocumentPositionParams } from './Utils';
import { LpgRailroadDiagramProvider } from './RailroadDiagramProvider';
import { LpgCallGraphProvider } from './CallGraphProvider';
export function registerCommands(languageClient: LanguageClient, context: ExtensionContext) {
    registerAnalysisCommand(languageClient, context);
}
function getUrl() : string {
   let uri = window.activeTextEditor?.document.uri.toString();
	if(uri)
	return uri;
	return "";
}
function registerAnalysisCommand(languageClient: LanguageClient, context: ExtensionContext): void {
      // The call graph command.
   const callGraphProvider = new LpgCallGraphProvider(languageClient,context);
   context.subscriptions.push(commands.registerTextEditorCommand(Commands.LPG_CALL_GRAPH,
	   async (textEditor: TextEditor, edit: TextEditorEdit) => {
		const  result   = await   languageClient.sendRequest(
			CallGraphRequest.type, getTextDocumentPositionParams(languageClient));
			if (result.errorMessage) {
				window.showErrorMessage(result.errorMessage);
				return;
			}
		   callGraphProvider.graph = result.infos;
		   callGraphProvider.showWebview(textEditor, {
			   title: "Call Graph: " + path.basename(textEditor.document.fileName),
		   });
	   }),
   );
   const diagramProvider = new LpgRailroadDiagramProvider(languageClient,context);

   // The single RRD diagram command.
   context.subscriptions.push(commands.registerTextEditorCommand(Commands.LPG_RRD_SINGLE_RULE,
	async  (textEditor: TextEditor, edit: TextEditorEdit) => {

		const  result   = await   languageClient.sendRequest(RRD_SingleRule_Request.type, 
			getTextDocumentPositionParams(languageClient) );
		if (result.errorMessage) {
			window.showErrorMessage(result.errorMessage);
			return;
		}
		diagramProvider.symbols = result.infos;
		diagramProvider.showWebview(textEditor, {
			   title: "RRD: " + path.basename(textEditor.document.fileName),
			   fullList: false,
		   });
	   }),
   );

   // The full RRD diagram command.
   context.subscriptions.push(commands.registerTextEditorCommand(Commands.LPG_RRD_ALL_RULE,
   async  (textEditor: TextEditor, edit: TextEditorEdit) => {
	const textDocument : TextDocumentIdentifier = {
		uri : getUrl()
	};
	const  result   = await   languageClient.sendRequest(RRD_AllRules_Request.type, textDocument );
    if (result.errorMessage) {
        window.showErrorMessage(result.errorMessage);
        return;
    }
	diagramProvider.symbols = result.infos;
	diagramProvider.showWebview(textEditor, {
			   title: "RRD: " + path.basename(textEditor.document.fileName),
			   fullList: true,
		   });
	   }),

   );


   const firstsetProvider = new LpgRailroadDiagramProvider(languageClient,context);

   // The single RRD diagram command.
   context.subscriptions.push(commands.registerTextEditorCommand(Commands.LPG_FIRST_SET_SINGLE_RULE,
	async  (textEditor: TextEditor, edit: TextEditorEdit) => {

		const  result   = await   languageClient.sendRequest(FirstSet_SingleRule_Request.type, 
			getTextDocumentPositionParams(languageClient) );
		if (result.errorMessage) {
			window.showErrorMessage(result.errorMessage);
			return;
		}
		firstsetProvider.symbols = result.infos;
		firstsetProvider.showWebview(textEditor, {
			   title: "First set: " + path.basename(textEditor.document.fileName),
			   fullList: false,
		   });
	   }),
   );

 
   context.subscriptions.push(commands.registerTextEditorCommand(Commands.LPG_FIRST_SET_ALL_RULE,
   async  (textEditor: TextEditor, edit: TextEditorEdit) => {
	const textDocument : TextDocumentIdentifier = {
		uri : getUrl()
	};
	const  result   = await   languageClient.sendRequest(FirstSet_AllRules_Request.type, textDocument );
    if (result.errorMessage) {
        window.showErrorMessage(result.errorMessage);
        return;
    }
	firstsetProvider.symbols = result.infos;
	firstsetProvider.showWebview(textEditor, {
			   title: "First set: " + path.basename(textEditor.document.fileName),
			   fullList: true,
		   });
	   }),

   );


   const followsetProvider = new LpgRailroadDiagramProvider(languageClient,context);

   
   context.subscriptions.push(commands.registerTextEditorCommand(Commands.LPG_FOLLOW_SET_SINGLE_RULE,
	async  (textEditor: TextEditor, edit: TextEditorEdit) => {

		const  result   = await   languageClient.sendRequest(FollowSet_SingleRule_Request.type, 
			getTextDocumentPositionParams(languageClient) );
		if (result.errorMessage) {
			window.showErrorMessage(result.errorMessage);
			return;
		}
		followsetProvider.symbols = result.infos;
		followsetProvider.showWebview(textEditor, {
			   title: "Follow set: " + path.basename(textEditor.document.fileName),
			   fullList: false,
		   });
	   }),
   );
   
 
   context.subscriptions.push(commands.registerTextEditorCommand(Commands.LPG_FOLLOW_SET_ALL_RULE,
   async  (textEditor: TextEditor, edit: TextEditorEdit) => {
	const textDocument : TextDocumentIdentifier = {
		uri : getUrl()
	};
	const  result   = await   languageClient.sendRequest(FollowSet_AllRules_Request.type, textDocument );
    if (result.errorMessage) {
        window.showErrorMessage(result.errorMessage);
        return;
    }
	followsetProvider.symbols = result.infos;
	followsetProvider.showWebview(textEditor, {
			   title: "Follow set: " + path.basename(textEditor.document.fileName),
			   fullList: true,
		   });
	   }),

   );
}