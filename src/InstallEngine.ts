import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as extension from './extension';
import * as FileProcesses from './FileProcesses';
import * as globals from './globals';
import * as ProjectProcesses from './ProjectProcesses';
import * as GitProcesses from './GitProcesses';

let installation = false;

export async function InstallGlistEngine() {
	if (installation) {
        vscode.window.showErrorMessage("You can't run this action while installing is in process!");
        return;
    }

	extension.extensionJsonData.installGlistEngine = true;
	FileProcesses.SaveExtensionJson();
	if (await FileProcesses.UpdateVSCodeSettings()) return;
	extension.extensionJsonData.installGlistEngine = false;
	FileProcesses.SaveExtensionJson();
	const result = await vscode.window.showInformationMessage(
		'This action will install the Glist Engine and its dependencies. Current Glist Engine installation in /glist folder will be modified if exist. Your projects and plugins will not affected. Do you want to continue?',
		{ modal: true },
		'Yes',
		'No',
	);
	if (result == 'Yes') {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			cancellable: false,
			title: 'Installing dependencies for Glist Engine'
		}, async (progress) => {
			installation = true;
			if(!(await GitProcesses.CheckGitInstallation())) {
				installation = false;
				return;
			} 
			progress.report({ increment: 0 });
			createDirectories();
			progress.report({ increment: 20 });
			await InstallEngine(progress);
			progress.report({ increment: 20 });
			await InstallCmake(progress);
			progress.report({ increment: 20 });
			await InstallClang(progress);
			progress.report({ increment: 20 });
			await createEmptyProject();
			progress.report({ increment: 20 });
			vscode.window.showInformationMessage("Glist Engine Installed Successfully.");
			installation = false;
		});
	}
}

export function createDirectories() {
	fs.ensureDirSync(globals.glistappsPath);
	fs.ensureDirSync(globals.glistpluginsPath);
	fs.removeSync(globals.tempPath);
	fs.ensureDirSync(globals.tempPath);
}

async function InstallEngine(progress: vscode.Progress<{message: string, increment: number}>) {
	progress.report({ message: "Installing Engine", increment: 0 });
	await fs.remove(path.join(globals.glistPath, "GlistEngine"));
	await GitProcesses.CloneRepository(globals.glistEngineUrl, globals.glistPath, "GlistEngine", false);
}

async function InstallCmake(progress: vscode.Progress<{message: string, increment: number}>) {
	const zipFilePath = path.join(globals.tempPath, 'CMake.zip');
	await FileProcesses.DownloadFile(globals.glistCmakeUrl, zipFilePath, "Downloading CMake");
	progress.report({ message: "Extracting CMake", increment: 0 });
	await fs.remove(path.join(globals.glistZbinPath, 'CMake'));
	FileProcesses.ExtractArchive(zipFilePath, globals.glistZbinPath, "CMake Binaries Installed.");
}

async function InstallClang(progress: vscode.Progress<{message: string, increment: number}>) {
	const zipFilePath = path.join(globals.tempPath, 'clang64.zip');
	await FileProcesses.DownloadFile(globals.glistClangUrl, zipFilePath, "Downloading Clang");
	progress.report({ message: "Extracting Clang", increment: 0 });
	await fs.remove(path.join(globals.glistZbinPath, 'clang64'));
	FileProcesses.ExtractArchive(zipFilePath, globals.glistZbinPath, "Clang Binaries Installed.");
}

async function createEmptyProject() {
	vscode.window.showInformationMessage("Creating Empty Project");
	ProjectProcesses.CreateNewProject("GlistApp");
}
