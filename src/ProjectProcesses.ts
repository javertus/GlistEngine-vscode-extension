import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as FileProcesses from './FileProcesses';
import * as globals from './globals';
import * as WorkspaceProcesses from './WorkspaceProcesses';
import * as extension from './extension';


export async function CreateNewProject(projectName: any = undefined) {
	let forceCreate = false;
	if (projectName) forceCreate = true;
	if (!WorkspaceProcesses.IsUserInWorkspace(!forceCreate) && !forceCreate) return;
	if (!forceCreate) {
		projectName = await vscode.window.showInputBox({
			placeHolder: "Enter the name of new Project"
		});
	}
	if (CheckInput(projectName)) return;
	projectName = projectName + "";
	if (!CheckPath(path.join(globals.glistappsPath, projectName), "A project named " + projectName + " already exist. Opening already existing project...", false)) {
		fs.cpSync(path.join(extension.path, 'GlistApp-vscode'), path.join(globals.glistappsPath, projectName), { recursive: true });
		fs.rmSync(path.join(globals.glistappsPath, projectName, ".git"), { recursive: true, force: true });
		vscode.window.showInformationMessage('Created new Project.');
	}

	await WorkspaceProcesses.AddProjectToWorkspace(projectName, forceCreate);
	if (forceCreate) return;
	const filesToOpen = [
		path.join(globals.glistappsPath, projectName, 'src', 'gCanvas.h'),
		path.join(globals.glistappsPath, projectName, 'src', 'gCanvas.cpp')
	];
	await OpenFiles(filesToOpen);
}

export async function OpenFiles(filesToOpen: string[]) {
	filesToOpen.forEach(async file => {
		const uri = vscode.Uri.file(file);
		const document = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(document, { preview: false });
	});
}

export async function DeleteProject() {
	if (!WorkspaceProcesses.IsUserInWorkspace()) return;
	let project = await QuickPickFromWorkspaceFolders();
	if (!project) return;

	let decision = await vscode.window.showInputBox({
		placeHolder: 'Are you sure about deleting this project? Type "yes" to continue.'
	});
	if (!(decision?.toLowerCase() == "yes")) {
		vscode.window.showErrorMessage("Deleting Project Cancelled!");
		return;
	}
	WorkspaceProcesses.RemoveProjectFromWorkspace(project.name)
	FileProcesses.DeleteFolder(project.path);
	extension.jsonData.deleteFolder = project.path;
	FileProcesses.SaveExtensionJson();
	WorkspaceProcesses.ReloadWorkspace();
}

export async function QuickPickFromWorkspaceFolders(): Promise<{ name: string; path: string } | undefined> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (CheckInput(workspaceFolders)) return;
	let folders: Array<any> = [];
	workspaceFolders?.forEach(folder => {
		if (!(folder.uri.fsPath.toLowerCase() == globals.glistEnginePath.toLowerCase())) {
			folders.push({ name: folder.name, path: folder.uri.fsPath })
		}
	});
	const selectedFolder = await vscode.window.showQuickPick(folders.map(folder => `${folder.name} (${folder.path})`), {
		placeHolder: 'Select the project'
	});
	if (CheckInput(selectedFolder)) return;
	return folders.find(folder => selectedFolder == `${folder.name} (${folder.path})`);
}

export async function AddClassToProject(baseFilePath: string, baseFileName: string) {
	if (!WorkspaceProcesses.IsUserInWorkspace()) return;
	let project = await QuickPickFromWorkspaceFolders();
	if (!project) return;
	let className = await vscode.window.showInputBox({
		placeHolder: "Enter the name of file you want to create"
	});
	if (CheckInput(className)) return;
	className = className + "";
	if (CheckPath(path.join(project.path, "src", className + ".h"), "A class named " + className + " already exist!", false)) return;
	if (CheckPath(path.join(project.path, "src", className + ".cpp"), "A class named " + className + " already exist!", false)) return;

	fs.copyFileSync(path.join(baseFilePath, baseFileName + ".h"), path.join(project.path, "src", className + ".h"));
	fs.copyFileSync(path.join(baseFilePath, baseFileName + ".cpp"), path.join(project.path, "src", className + ".cpp"));
	FileProcesses.ReplaceText(path.join(project.path, "src", className + ".h"), baseFileName, className);
	FileProcesses.ReplaceText(path.join(project.path, "src", className + ".cpp"), baseFileName, className);
	FileProcesses.ReplaceText(path.join(project.path, "src", className + ".h"), baseFileName.toUpperCase() + "_H_", className.toUpperCase() + "_H_");
	FileProcesses.AddFileToCMakeLists(path.join(project.path), className);

	const filesToOpen = [
		path.join(project.path, 'src', className + ".h"),
		path.join(project.path, 'src', className + ".cpp")
	];
	await OpenFiles(filesToOpen);
}

function GetSubFiles(directory: string): string[] {
	return fs.readdirSync(directory).flatMap(file => {
		const fullPath = path.join(directory, file);
		return fs.statSync(fullPath).isDirectory() ? GetSubFiles(fullPath) : fullPath;
	});
}

function GetBaseNameWithoutExtension(filePath: string): string {
	const baseName = path.basename(filePath);
	const extension = path.extname(baseName);
	return baseName.slice(0, -extension.length);
}

export async function DeleteClassFromProject() {
	if (!WorkspaceProcesses.IsUserInWorkspace()) return;

	let project = await QuickPickFromWorkspaceFolders();
	if (!project) return;
	let fileList: string[] = [];
	GetSubFiles(path.join(project.path, "src")).forEach(file => {
		if (!fileList.includes(GetBaseNameWithoutExtension(file)) && GetBaseNameWithoutExtension(file) != "main") {
			fileList.push(GetBaseNameWithoutExtension(file));
		}
	});
	let className = await vscode.window.showQuickPick(fileList, { title: "Select the class you want to delete." });
	if (CheckInput(className)) return;
	className = className + "";
	if (CheckPath(path.join(project.path, "src", className + ".h"), "A class named " + className + " does not exist!")) return;
	if (CheckPath(path.join(project.path, "src", className + ".cpp"), "A class named " + className + " does not exist!")) return;
	let decision = await vscode.window.showInputBox({
		placeHolder: 'Are you sure about deleting ' + className + '? Type "yes" to continue.'
	});
	if (!(decision?.toLowerCase() == "yes")) {
		vscode.window.showErrorMessage("Deleting Class Cancelled!");
		return;
	}
	FileProcesses.RemoveFileFromCMakeLists(project.path, className);
	await WorkspaceProcesses.CloseNonExistentFileTabs();
}

export function CheckInput(input: any, message: string = "No input provided."): Boolean {
	if (!input) {
		vscode.window.showErrorMessage(message);
		return true;
	}
	return false;
}

export function CheckPath(inputPath: any, message: any = undefined, errorMessageIfNotExist = true) {
	if (!fs.existsSync(inputPath) && errorMessageIfNotExist) {
		vscode.window.showErrorMessage(message);
		return true;
	}
	else if (fs.existsSync(inputPath) && errorMessageIfNotExist == false) {
		vscode.window.showErrorMessage(message);
		return true;
	}
	return false;
}