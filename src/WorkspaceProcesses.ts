import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as FileProcesses from './FileProcesses';
import * as globals from './globals';
import * as extension from './extension';


//Checks if user is in Glist Workspace
export function IsUserInWorkspace(showErrorMessage: boolean = true) {
	let folders = vscode.workspace.workspaceFolders;
	let len = folders?.length;
	if (!folders || !len || !folders?.filter(folder => folder.uri.fsPath.toLowerCase().includes(globals.glistEnginePath.toLowerCase()))) {
		if (showErrorMessage) vscode.window.showErrorMessage("You should switch to Glist workspace to do that.");
		return false;
	}
	return true;
}

export async function UpdateWorkspace(forceCreate: boolean = false) {
	if (!IsUserInWorkspace(!forceCreate) && !forceCreate) return;
	try {
		if (fs.existsSync(globals.glistappsPath) && !extension.extensionJsonData.isGlistInstalled) {
			extension.extensionJsonData.firstRun = true;
			extension.extensionJsonData.secondRun = true;
			FileProcesses.SaveExtensionJson();
			extension.ConfigureExtension();
			return;
		}
		let workspaceFolders = [];
		FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
			if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
				workspaceFolders.push(folder)
			}
		});
		workspaceFolders.push(globals.glistEnginePath);
		const workspaceContent = {
			folders: workspaceFolders.map(folder => ({ path: folder })),
		};

		fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(workspaceContent, null, 2));
		CheckLaunchConfigurations();
		vscode.window.showInformationMessage('Workspace configured.');

		//VS Code will restart if another workspace is active.
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to create workspace! Are you sure Glist Engine is installed? ${error}`);
	}
}

export async function AddProjectToWorkspace(projectName: string, forceCreate: boolean = false) {
	CheckLaunchConfigurations();
	if (!fs.existsSync(globals.workspaceFilePath) || forceCreate) {
		extension.extensionJsonData.firstRun = false;
		extension.extensionJsonData.secondRun = true;
		extension.extensionJsonData.isGlistInstalled = true;
		FileProcesses.SaveExtensionJson()
		await UpdateWorkspace(true);
		return;
	}
	SortWorkspaceJson(projectName);
	//VS Code will restart if another workspace is active.
	await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
}

export function SortWorkspaceJson(projectName: string) {
	const jsonString = fs.readFileSync(globals.workspaceFilePath, 'utf-8');
	const jsonData = JSON.parse(jsonString);
	const enginePath = {path: globals.glistEnginePath};

	jsonData.folders = jsonData.folders.filter((folder: { path: string }) => !folder.path.includes(globals.glistEnginePath));

	// Add the new path and sort the folders array alphabetically by path
	if(projectName) jsonData.folders.push({ path: path.join(globals.glistappsPath, projectName) });
	jsonData.folders.sort((a: { path: string }, b: { path: string }) => path.basename(a.path).localeCompare(path.basename(b.path)));

	// Re-add the engine path
	jsonData.folders.push(enginePath);

	// Convert the updated data back to JSON format and write it to the file
	fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(jsonData, null, 2));
}

export function RemoveProjectFromWorkspace(projectName: string) {
	if (!fs.existsSync(globals.workspaceFilePath)) {
		vscode.window.showWarningMessage('Workspace file does not exist.');
		return;
	}

	const jsonString = fs.readFileSync(globals.workspaceFilePath, 'utf-8');
	const jsonData = JSON.parse(jsonString);
	// Check if the project exists in the workspace folders
	const projectIndex = jsonData.folders.findIndex((folder: { path: string }) =>
		folder.path.includes(globals.glistappsPath) && folder.path.endsWith(`${projectName}`)
	);
	if (projectIndex === -1) {
		return;
	}
	jsonData.folders = jsonData.folders.filter((folder: { path: string }) =>
		!(folder.path.includes(globals.glistappsPath) && folder.path.endsWith(`${projectName}`))
	);

	fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(jsonData, null, 2));
	vscode.window.showInformationMessage(`Deleted project '${projectName}' from workspace.`);
}

export async function CloseNonExistentFileTabs() {
	try {
		const visibleWindows = vscode.window.tabGroups.activeTabGroup.tabs;
		for (const visibleWindow of visibleWindows) {
			if (!visibleWindow.input) continue;
			const filePath = JSON.parse(JSON.stringify(visibleWindow.input, null, 2));
			if (fs.existsSync(filePath.uri.fsPath)) continue;
			await vscode.window.tabGroups.close(visibleWindow, false);
		}
	}
	catch (err) {
		console.log(err);
	}
}

export async function ReloadWorkspace() {
	vscode.commands.executeCommand('workbench.action.reloadWindow'); // Throws exception if awaited!
}

export async function LaunchWorkspace() {
	if (fs.existsSync(globals.workspaceFilePath)) {
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
	}
	else { // If no workspace file found, create one and launch the workspace
		await UpdateWorkspace(true);
	}
}

export async function CheckLaunchConfigurations() {
	FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
		if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
			if (!fs.existsSync(path.join(folder, ".vscode"))) {
				vscode.window.showInformationMessage("Creating launch configurations for " + path.basename(folder));
				fs.cpSync(path.join(extension.extensionPath, 'GlistApp-vscode', '.vscode'), path.join(folder, '.vscode'), { recursive: true });
			}
		}
	});
}