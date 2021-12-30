'use strict';
import {
  
    Command,
    MessageType,
    NotificationType,
    RequestType,
    SymbolInformation,
    TextDocumentIdentifier,
    TextDocumentPositionParams,
    WorkspaceEdit,
    WorkspaceSymbolParams,
} from 'vscode-languageclient';


export interface ProviderHandle {
	handles: any[];
}
export interface StatusReport {
	message: string;
	type: string;
}

export interface ProgressReport {
	id: string;
	task: string;
	subTask: string;
	status: string;
	workDone: number;
	totalWork: number;
	complete: boolean;
}
export interface CallGraphNodeInfo {
    name : string;
    rules: Array<string>;
    terminal: Array<string>;

}
export interface CallGraphResult {
    infos: Array<CallGraphNodeInfo> ;
    errorMessage?: string;
}

export interface RailRoadScriptInfo {
    ruleName : string;
    rrdInfo: string;

}
export interface RailRoadResult {
    infos: Array<RailRoadScriptInfo> ;
    errorMessage?: string;
}
export interface ActionableMessage {
	severity: MessageType;
	message: string;
	data?: any;
	commands?: Command[];
}

export interface ActionableMessage {
	severity: MessageType;
	message: string;
	data?: any;
	commands?: Command[];
}
export interface RefactorWorkspaceEdit {
    edit: WorkspaceEdit;
    command?: Command;
    errorMessage?: string;
}

export namespace StatusNotification {
	export const type = new NotificationType<StatusReport >('language/status');
}

export namespace ProgressReportNotification {
	export const type = new NotificationType<ProgressReport >('language/progressReport');
}
export namespace ActionableNotification {
    export const type = new NotificationType<ActionableMessage>('language/actionableNotification');
}

export namespace GetNonEmptyRefactorRequest {
    export const type = new RequestType<TextDocumentPositionParams,RefactorWorkspaceEdit, void>('lpg/MakeNonEmpty');
}

export namespace GetMakeEmptyRefactorRequest {
    export const type = new RequestType<TextDocumentPositionParams,RefactorWorkspaceEdit,  void>('lpg/makeEmpty');
}
export namespace GetMakeLeftRecursiveRefactorRequest {
    export const type = new RequestType<TextDocumentPositionParams,RefactorWorkspaceEdit,  void>('lpg/MakeLeftRecursive');
}
export namespace GetInlineNonTerminalRefactorRequest {
    export const type = new RequestType<TextDocumentPositionParams,RefactorWorkspaceEdit,  void>('lpg/inlineNonTerminal');
}
export namespace CallGraphRequest {
    export const type = new RequestType<TextDocumentPositionParams,CallGraphResult,  void>('lpg/call-graph');
}

export namespace RRD_AllRules_Request {
    export const type = new RequestType<TextDocumentIdentifier, RailRoadResult,  void>('lpg/rrd.allRules');
}
export namespace RRD_SingleRule_Request {
    export const type = new RequestType<TextDocumentPositionParams, RailRoadResult,  void>('lpg/rrd.singleRule');
}

export namespace FirstSet_AllRules_Request {
    export const type = new RequestType<TextDocumentIdentifier, RailRoadResult,  void>('lpg/firset.allRules');
}
export namespace FirstSet_SingleRule_Request {
    export const type = new RequestType<TextDocumentPositionParams, RailRoadResult,  void>('lpg/firset.singleRule');
}

export namespace FollowSet_AllRules_Request {
    export const type = new RequestType<TextDocumentIdentifier, RailRoadResult,  void>('lpg/fowllow.allRules');
}
export namespace FollowSet_SingleRule_Request {
    export const type = new RequestType<TextDocumentPositionParams, RailRoadResult,  void>('lpg/fowllow.singleRule');
}
