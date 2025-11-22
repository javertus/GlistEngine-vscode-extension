import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as extension from './extension';
import * as FileProcesses from './FileProcesses';
import * as globals from './globals';
import * as ProjectProcesses from './ProjectProcesses';
import * as GitProcesses from './GitProcesses';

let installation = false;

export async function InstallGlistEngine(consent = 'No') {
	if (installation) {
		vscode.window.showErrorMessage("You can't run this action while installing is in process!");
		return;
	}

	let result;
	consent == 'Yes' ? result = consent : result = await vscode.window.showInformationMessage(
		'This action will install the Glist Engine and its dependencies. Current Glist Engine installation in /dev/glist folder will be modified if exists. Your projects and plugins will not be affected. Do you want to continue?',
		{ modal: true },
		'Yes',
		'No',
	);
	if (result == 'Yes') {
		extension.jsonData.installGlistEngine = true;
		FileProcesses.SaveExtensionJson();
		if (await FileProcesses.UpdateVSCodeSettings()) return;
		extension.jsonData.installGlistEngine = false;
		FileProcesses.SaveExtensionJson();

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			cancellable: false,
			title: 'Installing dependencies for Glist Engine'
		}, async (progress) => {
			try {
				installation = true;
				if (!(await GitProcesses.CheckGitInstallation())) {
					installation = false;
					return;
				}
				createDirectories();
				progress.report({ message: "Installing Engine", increment: 20 });
				await InstallEngine();
				progress.report({ increment: 20 });
				await InstallCmake(progress);
				progress.report({ increment: 20 });
				await InstallClang(progress);
				progress.report({ increment: 20 });
				await createEmptyProject();
				progress.report({ increment: 20 });
				vscode.window.showInformationMessage("Glist Engine Installed Successfully.");
				installation = false;
			}
			catch (err) {
				vscode.window.showErrorMessage(`An error occurred while installing Glist Engine: ${err}`);
				installation = false;
			}
		});
	}
}

export function createDirectories() {
	fs.ensureDirSync(globals.glistappsPath);
	fs.ensureDirSync(globals.glistpluginsPath);
	fs.removeSync(globals.tempPath);
	fs.ensureDirSync(globals.tempPath);
}

async function InstallEngine() {
	await fs.remove(path.join(globals.glistPath, "GlistEngine"));
	await GitProcesses.CloneRepository(globals.glistEngineUrl, globals.glistPath, false);
}

async function InstallCmake(progress: vscode.Progress<{ message: string, increment: number }>) {
	const zipFilePath = path.join(globals.tempPath, 'CMake.zip');
	await FileProcesses.DownloadFile(globals.glistCmakeUrl, zipFilePath, "Downloading CMake");
	progress.report({ message: "Extracting CMake", increment: 0 });
	await fs.remove(path.join(globals.glistZbinPath, 'CMake'));
	FileProcesses.ExtractArchive(zipFilePath, globals.glistZbinPath, "CMake Installed.");
}

async function InstallClang(progress: vscode.Progress<{ message: string, increment: number }>) {
	const zipFilePath = path.join(globals.tempPath, 'clang64.zip');
	await FileProcesses.DownloadFile(globals.glistClangUrl, zipFilePath, "Downloading Binaries");
	progress.report({ message: "Extracting Binaries", increment: 0 });
	await fs.remove(path.join(globals.glistZbinPath, 'clang64'));
	FileProcesses.ExtractArchive(zipFilePath, globals.glistZbinPath, "Binaries Installed.");
}

async function createEmptyProject() {
	vscode.window.showInformationMessage("Creating Empty Project");
	ProjectProcesses.CreateNewProject("GlistApp");
}
