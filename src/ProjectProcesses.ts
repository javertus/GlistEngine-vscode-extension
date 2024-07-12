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
	if (checkInput(projectName)) return;
	projectName = projectName + "";
	if (!checkPath(path.join(globals.glistappsPath, projectName), "A project named " + projectName + " already exist. Opening already existing project...", false)) {
		fs.cpSync(path.join(extension.extensionPath, 'GlistApp'), path.join(globals.glistappsPath, projectName), { recursive: true });
		vscode.window.showInformationMessage('Created new Project.');
	}

	await WorkspaceProcesses.AddNewProjectToWorkspace(projectName, forceCreate);
	if(forceCreate) return;
	const filesToOpen = [
		path.join(globals.glistappsPath, projectName, 'src', 'gCanvas.h'),
		path.join(globals.glistappsPath, projectName, 'src', 'gCanvas.cpp')
	];
	OpenFiles(filesToOpen);
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
	let projectName = await vscode.window.showInputBox({
		placeHolder: "Enter the name of Project you want to delete"
	});
	if (checkInput(projectName)) return;
	projectName = projectName + "";
	if (checkPath(path.join(globals.glistappsPath, projectName), "A project named " + projectName + " does not exist!")) return;

	let decision = await vscode.window.showInputBox({
		placeHolder: 'Are you sure about deleting this project? Type "yes" to continue.'
	});
	if (!(decision?.toLowerCase() == "yes")) {
		vscode.window.showErrorMessage("Deleting Project Cancelled!");
		return;
	}
	WorkspaceProcesses.DeleteProjectFromWorkspace(projectName)
	FileProcesses.DeleteFolder(path.join(globals.glistappsPath, projectName));
	extension.extensionJsonData.deleteFolder = path.join(globals.glistappsPath, projectName);
	FileProcesses.SaveExtensionJson();
	vscode.commands.executeCommand('workbench.action.reloadWindow');
}

export async function AddClassToProject(baseFilePath: string, fileBaseName: string) {
	if (!WorkspaceProcesses.IsUserInWorkspace()) return;
	let projectName = await vscode.window.showInputBox({
		placeHolder: "Enter the name of project you want to create new class"
	});
	if (checkInput(projectName)) return;
	projectName = projectName + "";
	if (checkPath(path.join(globals.glistappsPath, projectName), "A project named " + projectName + " does not exist!")) return;

	let className = await vscode.window.showInputBox({
		placeHolder: "Enter the name of file you want to create"
	});
	if (checkInput(className)) return;
	className = className + "";
	if (checkPath(path.join(globals.glistappsPath, projectName, "src", className + ".h"), "A class named " + className + " already exist!", false)) return;
	if (checkPath(path.join(globals.glistappsPath, projectName, "src", className + ".cpp"), "A class named " + className + " already exist!", false)) return;

	fs.copyFileSync(path.join(baseFilePath, fileBaseName + ".h"), path.join(globals.glistappsPath, projectName, "src", className + ".h"));
	fs.copyFileSync(path.join(baseFilePath, fileBaseName + ".cpp"), path.join(globals.glistappsPath, projectName, "src", className + ".cpp"));
	FileProcesses.ReplaceText(path.join(globals.glistappsPath, projectName, "src", className + ".h"), fileBaseName, className);
	FileProcesses.ReplaceText(path.join(globals.glistappsPath, projectName, "src", className + ".cpp"), fileBaseName, className);
	FileProcesses.ReplaceText(path.join(globals.glistappsPath, projectName, "src", className + ".h"), fileBaseName.toUpperCase() + "_H_", className.toUpperCase() + "_H_");
	FileProcesses.AddFileToCMakeLists(path.join(globals.glistappsPath, projectName), className);

	const filesToOpen = [
		path.join(globals.glistappsPath, projectName, 'src', className + ".h"),
		path.join(globals.glistappsPath, projectName, 'src', className + ".cpp")
	];
	OpenFiles(filesToOpen);
}

export async function DeleteClassFromProject() {
	if (!WorkspaceProcesses.IsUserInWorkspace()) return;
	let projectName = await vscode.window.showInputBox({
		placeHolder: "Enter the name of project you want to delete class from"
	});
	if (checkInput(projectName)) return;
	projectName = projectName + "";
	if (checkPath(path.join(globals.glistappsPath, projectName), "A project named " + projectName + " does not exist!")) return;

	let className = await vscode.window.showInputBox({
		placeHolder: "Enter the name of the file you want to delete"
	});
	if (checkInput(className)) return;
	className = className + "";
	if (checkPath(path.join(globals.glistappsPath, projectName, "src", className + ".h"), "A class named " + className + " does not exist!")) return;
	if (checkPath(path.join(globals.glistappsPath, projectName, "src", className + ".cpp"), "A class named " + className + " does not exist!")) return;
	let decision = await vscode.window.showInputBox({
		placeHolder: 'Are you sure about deleting this class? Type "yes" to continue.'
	});
	if (!(decision?.toLowerCase() == "yes")) {
		vscode.window.showErrorMessage("Deleting Class Cancelled!");
		return;
	}
	FileProcesses.RemoveFileFromCMakeLists(path.join(globals.glistappsPath, projectName), className);
	await WorkspaceProcesses.CloseNonExistentFileTabs();
}

export function checkInput(name: any, message: string = "No input provided."): Boolean {
	if (!name) {
		vscode.window.showErrorMessage(message);
		return true;
	}
	return false;
}

export function checkPath(inputPath: any, message: any = undefined, errorMessageIfNotExist = true) {
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