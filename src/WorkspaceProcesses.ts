import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as FileProcesses from './FileProcesses';
import * as globals from './globals';
import * as extension from './extension';


//Checks if user is in Glist Workspace
export function CheckWorkspace(showErrorMessage: boolean = true) {
	let folders = vscode.workspace.workspaceFolders;
	let len = folders?.length;
	if (!folders || !len || folders[len - 1].uri.fsPath.toLowerCase() != globals.glistEnginePath.toLowerCase()) {
		if (showErrorMessage) vscode.window.showErrorMessage("You should switch to Glist workspace to do that.");
		return false;
	}
	return true;
}

export async function UpdateWorkspace(forceCreate: boolean = false) {
	if (!CheckWorkspace(!forceCreate) && !forceCreate) return;
	try {
		let workspaceFolders = [];
		FileProcesses.getSubfolders(globals.glistappsPath).map(folder => {
			if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
				workspaceFolders.push(folder)
				if (!fs.existsSync(path.join(folder, ".vscode"))) {
					vscode.window.showInformationMessage("Launch configurations are not found for project named " + path.basename(folder) + ". Creating launch configurations...");
					fs.cpSync(path.join(extension.extensionPath, 'GlistApp', '.vscode'), path.join(folder, '.vscode'), { recursive: true });
				}
			}
		});
		workspaceFolders.push(globals.glistEnginePath);
		const workspaceContent = {
			folders: workspaceFolders.map(folder => ({ path: folder })),
		};

		fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(workspaceContent, null, 2));
		vscode.window.showInformationMessage('Workspace Updated.');

		//VS Code will restart if another workspace is active.
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
	} catch (error) {
		vscode.window.showErrorMessage('Failed to create workspace.');
		console.error(error);
	}
}

export async function AddNewProjectToWorkspace(projectName: string, forceCreate: boolean = false) {
	// Read the JSON file
	if (!fs.existsSync(globals.workspaceFilePath) || forceCreate) {
		extension.extensionJsonData.firstRun = false;
		extension.extensionJsonData.secondRun = true;
		FileProcesses.SaveExtensionJson()
		await UpdateWorkspace(true);
		return;
	}
	const jsonString = fs.readFileSync(globals.workspaceFilePath, 'utf-8');
	const jsonData = JSON.parse(jsonString);

	// Extract the engine path if it exists
	const enginePath = jsonData.folders.find((folder: { path: string }) => folder.path.includes('GlistEngine'));
	jsonData.folders = jsonData.folders.filter((folder: { path: string }) => !folder.path.includes('GlistEngine'));

	// Add the new path and sort the folders array alphabetically by path
	jsonData.folders.push({ path: path.join(globals.glistappsPath, projectName) });
	jsonData.folders.sort((a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path));

	// Re-add the engine path at the end if it was found
	if (enginePath) {
		jsonData.folders.push(enginePath);
	}

	// Convert the updated data back to JSON format and write it to the file
	fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(jsonData, null, 2));

	//VS Code will restart if another workspace is active.
	await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
}

export function DeleteProjectFromWorkspace(projectName: string) {
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
	const visibleWindows = vscode.window.tabGroups.activeTabGroup.tabs;
	for (const visibleWindow of visibleWindows) {
		const filePath = JSON.parse(JSON.stringify(visibleWindow.input, null, 2));
		if (fs.existsSync(filePath.uri.fsPath)) continue;
		await vscode.window.tabGroups.close(visibleWindow, false);
	}
}

export async function LaunchWorkspace() {
	if (fs.existsSync(globals.workspaceFilePath)) {
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
	}
	else { // If no workspace file found, create one and launch the workspace
		await UpdateWorkspace(true);
	}
}