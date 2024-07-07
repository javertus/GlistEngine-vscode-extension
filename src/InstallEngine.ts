import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as extension from './extension';
import * as FileProcesses from './FileProcesses';
import * as globals from './globals';
import * as ProjectProcesses from './ProjectProcesses';


export async function InstallGlistEngine() {
	extension.extensionJsonData.installGlistEngine = true;
	FileProcesses.SaveExtensionJson()
	if (await FileProcesses.UpdateVSCodeSettings()) return;
	extension.extensionJsonData.installGlistEngine = false;
	FileProcesses.SaveExtensionJson()
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
			title: 'Installing dependencies for Glist Engine. Please wait...'
		}, async (progress) => {
			progress.report({ increment: 0 });
			await createDirectories();
			progress.report({ increment: 20 });
			await InstallEngine();
			progress.report({ increment: 20 });
			await InstallCmake();
			progress.report({ increment: 20 });
			await InstallClang();
			progress.report({ increment: 20 });
			await createEmptyProject();
			progress.report({ increment: 20 });
			vscode.window.showInformationMessage("Glist Engine Installed Successfully.");
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
	vscode.window.showInformationMessage("Installing Engine (~8MB)");

	const zipFilePath = path.join(globals.tempPath, 'GlistEngine.zip');
	await FileProcesses.DownloadFile(globals.glistEngineUrl, zipFilePath);
	await fs.remove(path.join(globals.glistPath, "GlistEngine"));
	FileProcesses.ExtractArchive(zipFilePath, globals.glistPath, "Engine Installed.");
	await fs.rename(path.join(globals.glistPath, 'GlistEngine-main'), path.join(globals.glistPath, 'GlistEngine'));
}

async function InstallCmake() {
	vscode.window.showInformationMessage("Installing Cmake (~35MB)");

	const zipFilePath = path.join(globals.tempPath, 'CMake.zip');
	await FileProcesses.DownloadFile(globals.glistCmakeUrl, zipFilePath);
	await fs.remove(path.join(globals.glistZbinPath, 'CMake'));
	FileProcesses.ExtractArchive(zipFilePath, globals.glistZbinPath, "CMake Binaries Installed.");
}

async function InstallClang() {
	vscode.window.showInformationMessage("Installing Clang Binaries (~400MB)");

	const zipFilePath = path.join(globals.tempPath, 'clang64.zip');
	await FileProcesses.DownloadFile(globals.glistClangUrl, zipFilePath);
	await fs.remove(path.join(globals.glistZbinPath, 'clang64'));
	FileProcesses.ExtractArchive(zipFilePath, globals.glistZbinPath, "Clang Binaries Installed.");
}

async function createEmptyProject() {
	vscode.window.showInformationMessage("Creating Empty Project");
	ProjectProcesses.CreateNewProject("GlistApp");
}
