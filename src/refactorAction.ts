'use strict';


import { commands, ExtensionContext,  window, workspace } from 'vscode';
import { Commands} from './commands';
import {   GetInlineNonTerminalRefactorRequest, GetMakeEmptyRefactorRequest, GetMakeLeftRecursiveRefactorRequest, GetNonEmptyRefactorRequest, RefactorWorkspaceEdit} from './protocol';
import { LanguageClient } from 'vscode-languageclient/node';
import { getTextDocumentPositionParams } from './Utils';
export function registerCommands(languageClient: LanguageClient, context: ExtensionContext) {
    registerApplyRefactorCommand(languageClient, context);
}

async function applyRefactorEdit(languageClient: LanguageClient, refactorEdit: RefactorWorkspaceEdit) {
    if (!refactorEdit) {
        return;
    }

    if (refactorEdit.errorMessage) {
        window.showErrorMessage(refactorEdit.errorMessage);
        return;
    }

    if (refactorEdit.edit) {
        const edit = languageClient.protocol2CodeConverter.asWorkspaceEdit(refactorEdit.edit);
        if (edit) {
            await workspace.applyEdit(edit);
        }
    }

    if (refactorEdit.command) {
        await new Promise(resolve => setTimeout(resolve, 400));
        if (refactorEdit.command.arguments) {
            await commands.executeCommand(refactorEdit.command.command, ...refactorEdit.command.arguments);
        } else {
            await commands.executeCommand(refactorEdit.command.command);
        }
    }
}

function registerApplyRefactorCommand(languageClient: LanguageClient, context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand(Commands.LPG_MAKE_NON_EMPTY,async () =>{

            const result: RefactorWorkspaceEdit = await languageClient.sendRequest(
                GetNonEmptyRefactorRequest.type,getTextDocumentPositionParams(languageClient));
            applyRefactorEdit(languageClient,result);
            
	}));
    context.subscriptions.push(commands.registerCommand(Commands.LPG_MAKE_EMPTY,async () =>{
        const result: RefactorWorkspaceEdit = await languageClient.sendRequest(GetMakeEmptyRefactorRequest.type,getTextDocumentPositionParams(languageClient));
        applyRefactorEdit(languageClient,result);
    }));
    context.subscriptions.push(commands.registerCommand(Commands.LPG_MAKE_LEFT_RECURSIVE,async () =>{
        const result: RefactorWorkspaceEdit = await languageClient.sendRequest(GetMakeLeftRecursiveRefactorRequest.type,getTextDocumentPositionParams(languageClient));
        applyRefactorEdit(languageClient,result);
}));
context.subscriptions.push(commands.registerCommand(Commands.LPG_MAKE_INLINE_NONT_TERMINAL,async () =>{
    const result: RefactorWorkspaceEdit = await languageClient.sendRequest(GetInlineNonTerminalRefactorRequest.type,getTextDocumentPositionParams(languageClient));
    applyRefactorEdit(languageClient,result);
}));
}