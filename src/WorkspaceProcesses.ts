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
	if (!folders || !len || !folders.some(folder => folder.uri.fsPath.toLowerCase() == globals.glistEnginePath.toLowerCase())) {
		if (showErrorMessage) vscode.window.showErrorMessage("You should switch to GlistEngine workspace to do that.");
		return false;
	}
	return true;
}

export async function ConfigureWorkspace(forceCreate: boolean = false) {
	if (!IsUserInWorkspace(!forceCreate) && !forceCreate) return;
	try {
		// If glist was not found before but now exists
		if (fs.existsSync(globals.glistZbinWindowsPath) && !extension.jsonData.isGlistInstalled) {
			extension.jsonData.firstRun = true;
			extension.jsonData.secondRun = true;
			FileProcesses.SaveExtensionJson();
			extension.SetupExtension();
			return;
		}
		else if (!fs.existsSync(globals.glistZbinWindowsPath)) {
			vscode.window.showErrorMessage("GlistEngine is not installed.");
			return;
		}

		let workspaceFolders: string[] = [];
		FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
			if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
				workspaceFolders.push(folder)
			}
		});

		if (fs.existsSync(globals.workspaceFilePath)) {
			const jsonData = JSON.parse(fs.readFileSync(globals.workspaceFilePath, "utf-8"));

			jsonData.folders = jsonData.folders.filter((f: { path: string }) => !workspaceFolders.includes(f.path) && !f.path.includes(globals.glistEnginePath))

			jsonData.folders = [
				{ path: globals.glistEnginePath },
				...jsonData.folders,
				...workspaceFolders.map(folder => ({ path: folder }))
			];

			fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(jsonData, null, 2));
			vscode.window.showInformationMessage("Workspace configured.");
			return;
		}

		workspaceFolders.unshift(globals.glistEnginePath);
		const workspaceContent = {
			folders: workspaceFolders.map(folder => ({ path: folder })),
		};

		fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(workspaceContent, null, 2));
		CheckLaunchConfigurations();
		vscode.window.showInformationMessage('Workspace configured.');

		//VS Code will restart if another workspace is active.
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to create workspace! Check if Glist Engine is installed. ${error}`);
	}
}

export async function AddProjectToWorkspace(projectName: string, forceCreate: boolean = false) {
	if (!fs.existsSync(globals.workspaceFilePath) || forceCreate) {
		extension.jsonData.firstRun = false;
		extension.jsonData.secondRun = true;
		extension.jsonData.isGlistInstalled = true;
		FileProcesses.SaveExtensionJson()
		await ConfigureWorkspace(true);
		return;
	}
	SortWorkspaceJson(projectName);
}

export function SortWorkspaceJson(projectName: string) {
	const jsonString = fs.readFileSync(globals.workspaceFilePath, 'utf-8');
	const jsonData = JSON.parse(jsonString);
	const enginePath = { path: globals.glistEnginePath };

	jsonData.folders = jsonData.folders.map((folder: any) => {
		if (!path.isAbsolute(folder.path)) {
			if (folder.path.startsWith("myglistapps")) {
				return { path: path.resolve(globals.glistappsPath, path.basename(folder.path)) };
			}
			if (folder.path.startsWith("glistplugins")) {
				return { path: path.resolve(globals.glistpluginsPath, path.basename(folder.path)) };
			}
			vscode.window.showErrorMessage(`"Copy ${path.basename(folder.path)} into /myglistapps folder in order to add it`);
		}
		return { path: folder.path };
	}).filter((folder: { path: string }) => !folder.path.includes(globals.glistEnginePath) && path.isAbsolute(folder.path));

	if (projectName) jsonData.folders.push({ path: path.join(globals.glistappsPath, projectName) });
	jsonData.folders.sort((a: { path: string }, b: { path: string }) => path.basename(a.path).localeCompare(path.basename(b.path)));
	jsonData.folders.unshift(enginePath);
	fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(jsonData, null, 2));
}

export function RemoveProjectFromWorkspace(folderPath: string) {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders) return;

	const index = folders.findIndex(f => f.uri.fsPath == folderPath);
	if (index == -1) return;

	vscode.workspace.updateWorkspaceFolders(index, 1);
}

export function CloseNonExistentFileTabs() {
	try {
		const visibleWindows = vscode.window.tabGroups.activeTabGroup.tabs;
		for (const visibleWindow of visibleWindows) {
			if (!visibleWindow.input) continue;
			const tab = JSON.parse(JSON.stringify(visibleWindow.input, null, 2));
			if (fs.existsSync(tab.uri.fsPath)) continue;
			vscode.window.tabGroups.close(visibleWindow, false);
		}
	}
	catch (err) {
		console.log(err);
	}
}

export function CheckLaunchConfigurations() {
	FileProcesses.GetSubfolders(globals.glistappsPath).forEach(folder => {
		if (!fs.existsSync(path.join(folder, "CMakeLists.txt")) || fs.existsSync(path.join(folder, ".vscode"))) {
			return;
		}
		fs.cpSync(path.join(extension.extensionPath, 'GlistApp-vscode', '.vscode'), path.join(folder, '.vscode'), { recursive: true });
		vscode.window.showInformationMessage("Created launch configurations for " + path.basename(folder));
	});
}

export async function ReloadWorkspace() {
	vscode.commands.executeCommand('workbench.action.reloadWindow'); // Throws exception if awaited!
}

export async function LaunchWorkspace() {
	if (fs.existsSync(globals.workspaceFilePath)) {
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
	}
	else { // If no workspace file found, create one and launch the workspace
		await ConfigureWorkspace(true);
	}
}