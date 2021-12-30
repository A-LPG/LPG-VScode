import * as vscode from 'vscode';
import * as net from 'net';
import * as path from 'path';
import * as os from 'os'
import * as fs from 'fs';
import glob = require('glob');
import {     
       workspace, Position, window,commands, ViewColumn, OutputChannel,
	 Selection } from "vscode";

import {  
        LanguageClientOptions, RevealOutputChannelOn,
        ErrorHandler, Message, ErrorAction, CloseAction,
           
		    MessageType,
			WorkspaceEdit,
			Command,
			DidChangeConfigurationNotification,
		
		  } from 'vscode-languageclient';

import { LanguageClient, ServerOptions, StreamInfo } from 'vscode-languageclient/node';

import { logger, initializeLogFile } from './log';
import * as child_process from "child_process";
import { Commands } from './commands';
import { deleteDirectory, get_free_port, isString } from './Utils';
import { ActionableMessage, ActionableNotification, ProgressReport, ProgressReportNotification } from './protocol';
import { serverTasks } from './serverTasks';
import * as refactorAction from './refactorAction';
import { TextEditor } from 'vscode';
import * as analysisAction from  './Analysis';
import { ProgressIndicator } from './ProgressIndicator';
import { TextEditorEdit } from 'vscode';
import { GetGenerationOptions, GetGenerationSettingOptions, get_server_path, makeOfflineBinariesExecutable, regenerateParser } from './GrammarGenerator';




var languageClient: LanguageClient ;
const cleanWorkspaceFileName = '.cleanWorkspace';
const extensionName = 'Language Support for LPG';
let clientLogFile : string;
let progress: ProgressIndicator;
let outputChannel : OutputInfoCollector;

function getTempWorkspace() {
	return path.resolve(os.tmpdir(), 'vscodesws_' + makeRandomHexString(5));
}

function makeRandomHexString(length : Number) {
	const chars = ['0', '1', '2', '3', '4', '5', '6', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
	let result = '';
	for (let i = 0; i < length; i++) {
		const idx = Math.floor(chars.length * Math.random());
		result += chars[idx];
	}
	return result;
}

function openServerLogFile(workspacePath : string, column: ViewColumn = ViewColumn.Active): Thenable<boolean> {
	const serverLogFile = path.join(workspacePath, '.lpgdata', '.log');
	return openLogFile(serverLogFile, 'Could not open LPG Language Server log file', column);
}

function openClientLogFile(logFile: string, column: ViewColumn = ViewColumn.Active): Thenable<boolean> {
	return new Promise((resolve) => {
		const filename = path.basename(logFile);
		const dirname = path.dirname(logFile);

		// find out the newest one
		glob(filename + '.*', { cwd: dirname }, (err, files) => {
			if (!err && files.length > 0) {
				files.sort();
				logFile = path.join(dirname, files[files.length - 1]);
			}

			openLogFile(logFile, 'Could not open lpg extension log file', column).then((result) => resolve(result));
		});
	});
}

async function openLogs() {
	await commands.executeCommand(Commands.OPEN_CLIENT_LOG, ViewColumn.One);
	await commands.executeCommand(Commands.OPEN_SERVER_LOG, ViewColumn.Two);
}


function openLogFile(logFile : string, openingFailureWarning: string, column: ViewColumn = ViewColumn.Active): Thenable<boolean> {
	if (!fs.existsSync(logFile)) {
		return window.showWarningMessage('No log file available').then(() => false);
	}

	return workspace.openTextDocument(logFile)
		.then(doc => {
			if (!doc) {
				return false;
			}
			return window.showTextDocument(doc, column)
				.then(editor => !!editor);
		}, () => false)
		.then(didOpen => {
			if (!didOpen) {
				window.showWarningMessage(openingFailureWarning);
			}
			return didOpen;
		});
}

export class ClientErrorHandler implements ErrorHandler {
	private restarts: number[];

	constructor(private name: string) {
		this.restarts = [];
	}

	public error(_error: Error, _message: Message, count: number): ErrorAction {
		if (count && count <= 3) {
			logger.error(`${this.name} server encountered error: ${_message}, ${_error && _error.toString()}`);
			return ErrorAction.Continue;
		}

		logger.error(`${this.name} server encountered error and will shut down: ${_message}, ${_error && _error.toString()}`);
		return ErrorAction.Shutdown;
	}

	public closed(): CloseAction {
		this.restarts.push(Date.now());
		if (this.restarts.length < 5) {
			logger.error(`The ${this.name} server crashed and will restart.`);
			return CloseAction.Restart;
		} else {
			const diff = this.restarts[this.restarts.length - 1] - this.restarts[0];
			if (diff <= 3 * 60 * 1000) {
				const message = `The ${this.name} server crashed 5 times in the last 3 minutes. The server will not be restarted.`;
				logger.error(message);
				const action = "Show logs";
				window.showErrorMessage(message, action).then(selection => {
					if (selection === action) {
						commands.executeCommand(Commands.OPEN_LOGS);
					}
				});
				return CloseAction.DoNotRestart;
			}

			logger.error(`The ${this.name} server crashed and will restart.`);
			this.restarts.shift();
			return CloseAction.Restart;
		}
	}
}

export class OutputInfoCollector implements OutputChannel {
	private channel: OutputChannel ;

	constructor(public name: string) {
		this.channel = window.createOutputChannel(this.name);
	}

	append(value: string): void {
		logger.info(value);
		this.channel.append(value);
	}

	appendLine(value: string): void {
		logger.info(value);
		this.channel.appendLine(value);
	}

	clear(): void {
		this.channel.clear();
	}

	show(preserveFocus?: boolean): void;
	show(column?: ViewColumn, preserveFocus?: boolean): void;
	show(column?: any, preserveFocus?: any) {
		this.channel.show(column, preserveFocus);
	}

	hide(): void {
		this.channel.hide();
	}

	dispose(): void {
		this.channel.dispose();
	}
}
function logNotification(message: string) : Promise<string | undefined>{
	return new Promise( () => {
		logger.verbose(message);
	});
}
async function executeRangeFormat(editor : TextEditor, startPosition:Position, lineOffset : number) {
	const endPosition = editor.document.positionAt(editor.document.offsetAt(new Position(startPosition.line + lineOffset + 1, 0)) - 1);
	editor.selection = new Selection(startPosition, endPosition);
	await commands.executeCommand('editor.action.formatSelection');
}

export async function applyWorkspaceEdit(obj :WorkspaceEdit, languageClient : LanguageClient) {
	const edit = languageClient.protocol2CodeConverter.asWorkspaceEdit(obj);
	if (edit) {
		await workspace.applyEdit(edit);
		// By executing the range formatting command to correct the indention according to the VS Code editor settings.
		// More details, see: https://github.com/redhat-developer/vscode-java/issues/557
		try {
			if(!window.activeTextEditor){
				return;
			}
			const currentEditor : TextEditor = window.activeTextEditor;
			// If the Uri path of the edit change is not equal to that of the active editor, we will skip the range formatting
			if (currentEditor.document.uri.fsPath !== edit.entries()[0][0].fsPath) {
				return;
			}
			const cursorPostion = currentEditor.selection.active;
			// Get the array of all the changes
			const changes = edit.entries()[0][1];
			// Get the position information of the first change
			let startPosition = new Position(changes[0].range.start.line, changes[0].range.start.character);
			let lineOffsets = changes[0].newText.split(/\r?\n/).length - 1;
			for (let i = 1; i < changes.length; i++) {
				// When it comes to a discontinuous range, execute the range formatting and record the new start position
				if (changes[i].range.start.line !== startPosition.line) {
					await executeRangeFormat(currentEditor, startPosition, lineOffsets);
					startPosition = new Position(changes[i].range.start.line, changes[i].range.start.character);
					lineOffsets = 0;
				}
				lineOffsets += changes[i].newText.split(/\r?\n/).length - 1;
			}
			await executeRangeFormat(currentEditor, startPosition, lineOffsets);
			// Recover the cursor's original position
			currentEditor.selection = new Selection(cursorPostion, cursorPostion);
		} catch (error) {
			if( isString(error))
				languageClient.error(error);
			else{
				logger.error(error);
			}
		}
	}
}
function getClient(): LanguageClient {
	return languageClient;
}
const DEBUG =  process.env['DEBUG_LPG_VSCODE'] === 'true';
//const DEBUG =  true;
let server_process : child_process.ChildProcessWithoutNullStreams ;
let lsPort : string | undefined;

function get_server_port():string{
	if(lsPort)
		return lsPort;
	return "";
}
function  start_lpg(context: vscode.ExtensionContext) { 

	let generate_option = GetGenerationOptions(undefined,undefined);
	let clientOptions: LanguageClientOptions =
	{
		// Register the server for plain text documents
		documentSelector: [
			{scheme: 'file', language: 'lpg'},
		   
		],
		revealOutputChannelOn: RevealOutputChannelOn.Never,
		errorHandler: new ClientErrorHandler(extensionName),
		initializationFailedHandler: error => {
			logger.error(`Failed to initialize ${extensionName} due to ${error && error.toString()}`);
			return true;
		},
		outputChannel:  outputChannel ,
		outputChannelName: extensionName,
		initializationOptions:{
		   settings: {
				options: generate_option
			}
		},
		middleware: {
			workspace: {
				didChangeConfiguration: () => {
					getClient().sendNotification(DidChangeConfigurationNotification.type, {
						settings: {
							options: GetGenerationSettingOptions()
						}
					});
				}
			}
		},
	};
	let serverOptions : ServerOptions = async () => {
		const socket = net.connect(get_server_port());
		const result: StreamInfo = {
			writer: socket,
			reader: socket
		};
		return Promise.resolve(result);	 
	};
   console.log('LPG Language Server start active!');
   languageClient = new LanguageClient('LPG Language Server', serverOptions, clientOptions);
  
   refactorAction.registerCommands(languageClient, context);
   analysisAction.registerCommands(languageClient,context);
	languageClient.onReady().then(() => {
		languageClient.onNotification(ProgressReportNotification.type, (progress : ProgressReport) => {
			serverTasks.updateServerTask(progress);
		});
		languageClient.onNotification(ActionableNotification.type, (notification : ActionableMessage) => {
			let show = null;
			switch (notification.severity) {
				case MessageType.Log:
					show =logNotification;
					break;
				case MessageType.Info:
					show = window.showInformationMessage;
					break;
				case MessageType.Warning:
					show = window.showWarningMessage;
					break;
				case MessageType.Error:
					show = window.showErrorMessage;
					break;
			}
			if (!show) {
				return;
			}
			if(!notification.commands)return;
			
			let notification_commands : Command[]  = notification.commands;
			let titles : string[] = notification_commands.map(a => a.title);

			show(notification.message, ...titles).then( (selection :string| undefined) => {
				for (const action of notification_commands) {
					if (action.title === selection) {
						const args: any[] = (action.arguments) ? action.arguments : [];
						commands.executeCommand(action.command, ...args);
						break;
					}
				}
			
			});
		});
	});
   languageClient.registerProposedFeatures();
   languageClient.start();
   console.log('LPG Language Server is now active!');
 }
 export async function start_server(context: vscode.ExtensionContext){
	if(DEBUG){
		lsPort = process.env['SERVER_PORT']
	}
	else{
		lsPort = await get_free_port();
		
		let [cmd_string, exeHome] = get_server_path();
		if(!cmd_string.length){
			window.showErrorMessage("Can't find LPG server");
		}
		else{
			
			const parameters = [];
			const spawnOptions = { cwd: exeHome };
			parameters.push("--port")
			parameters.push(lsPort)
			parameters.push("--watchParentProcess")
			server_process = child_process.spawn(cmd_string, parameters, spawnOptions);
			
			server_process.stderr.on("data", (data) => {
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
					outputChannel.append(text);
				}
			});
			server_process.stdout.on("data",(data)=>{
				let text = data.toString() as string;
				outputChannel.append(text);
			})
			server_process.on("close", (code) => {
				outputChannel.append("服务器关闭") // Treat this as non-grammar output (e.g. Java exception).
			});

		}
	}

	setTimeout(start_lpg, 1000,context);
}
export async function activate(context: vscode.ExtensionContext)
{
	progress = new ProgressIndicator();
    let storagePath = context.storagePath;
	if (!storagePath) {
		storagePath = getTempWorkspace();
	}
	clientLogFile = path.join(storagePath, 'client.log');
    initializeLogFile(clientLogFile);
    
    const workspacePath = path.resolve(storagePath + '/LPG_ws');
    const cleanWorkspaceExists = fs.existsSync(path.join(workspacePath, cleanWorkspaceFileName));
    if (cleanWorkspaceExists) {
        try {
            deleteDirectory(workspacePath);
        } catch (error) {
            window.showErrorMessage(`Failed to delete ${workspacePath}: ${error}`);
        }
    }
    outputChannel = new OutputInfoCollector(extensionName);
	await makeOfflineBinariesExecutable();
   // Register commands here to make it available even when the language client fails
   context.subscriptions.push(commands.registerCommand(Commands.OPEN_SERVER_LOG, (column: ViewColumn) => openServerLogFile(workspacePath, column)));

   context.subscriptions.push(commands.registerCommand(Commands.OPEN_CLIENT_LOG, (column: ViewColumn) => openClientLogFile(clientLogFile, column)));
   context.subscriptions.push(commands.registerCommand(Commands.OPEN_LOGS, () => openLogs()));
   context.subscriptions.push(commands.registerTextEditorCommand("lpg.tools.generateParser",
   (textEditor: TextEditor, edit: TextEditorEdit) => {
		regenerateParser(textEditor.document,progress,outputChannel);
   }));
   start_server(context);

}

export function deactivate(): Thenable<void> | undefined
{
    if (!languageClient)
    {
        return undefined;
    }
    return languageClient.stop();
}

