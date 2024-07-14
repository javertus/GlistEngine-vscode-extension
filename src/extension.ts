import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as globals from './globals';
import * as GitProcessses from './GitProcesses';
import * as InstallEngine from './InstallEngine';
import * as FileProcesses from './FileProcesses';
import * as ProjectProcesses from './ProjectProcesses';
import * as WorkspaceProcesses from './WorkspaceProcesses';


export let extensionJsonData: any;
export let extensionPath: string;
export let extensionDataFilePath: string;

export function activate(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand('glist-extension.create-project', async () => {
		await ProjectProcesses.CreateNewProject();
	});
	vscode.commands.registerCommand('glist-extension.delete-project', async () => {
		await ProjectProcesses.DeleteProject();
	});
	vscode.commands.registerCommand('glist-extension.update-workspace', async () => {
		await WorkspaceProcesses.UpdateWorkspace();
	});
	vscode.commands.registerCommand('glist-extension.add-canvas-to-project', async () => {
		await ProjectProcesses.AddClassToProject(path.join(extensionPath, "GlistApp", "src"), "gCanvas");
	});
	vscode.commands.registerCommand('glist-extension.add-class-to-project', async () => {
		await ProjectProcesses.AddClassToProject(path.join(extensionPath), "EmptyClass");
	});
	vscode.commands.registerCommand('glist-extension.delete-class-from-project', async () => {
		await ProjectProcesses.DeleteClassFromProject();
	});
	vscode.commands.registerCommand('glist-extension.switch-workspace', async () => {
		await WorkspaceProcesses.LaunchWorkspace();
	});
	vscode.commands.registerCommand('glist-extension.install-glistengine', async () => {
		await InstallEngine.InstallGlistEngine();
	});
	vscode.commands.registerCommand('glist-extension.clone-plugin', async () => {
		await GitProcessses.ClonePlugin();
	});
	vscode.commands.registerCommand('glist-extension.clone-pluginurl', async () => {
		await GitProcessses.ClonePluginUrl();
	});
	vscode.commands.registerCommand('glist-extension.update-repos', async () => {
		await GitProcessses.CheckRepoUpdates();
	});
	vscode.commands.registerCommand('glist-extension.clone-project', async () => {
		await GitProcessses.CloneProject();
	});
	vscode.commands.registerCommand('glist-extension.reset', async () => {
		ResetExtension();
	});
	vscode.commands.registerCommand('glist-extension.run-project', async () => {
		vscode.commands.executeCommand('workbench.action.debug.start');
	});

	extensionPath = context.extensionPath;
	extensionDataFilePath = path.join(extensionPath, 'ExtensionData.json');
	FirstRunWorker();
	CheckUpdates();
}

async function FirstRunWorker() {
	CheckJsonFile();
	if (extensionJsonData.deleteFolder) {
		await FileProcesses.DeleteFolder(extensionJsonData.deleteFolder);
		extensionJsonData.deleteFolder = undefined;
		FileProcesses.SaveExtensionJson()
		vscode.window.showInformationMessage("Project Deleted.");
	}

	if(WorkspaceProcesses.IsUserInWorkspace(false)) {
		vscode.commands.executeCommand('setContext', 'glist-extension.showRunButton', true);
		const folderWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(globals.glistPath, '**'));
		folderWatcher.onDidDelete(e => {
			WorkspaceProcesses.CloseNonExistentFileTabs();
		});
		folderWatcher.onDidChange(e => {
			WorkspaceProcesses.CloseNonExistentFileTabs();
		});
		await WorkspaceProcesses.CloseNonExistentFileTabs();
	} 

	if (extensionJsonData.installGlistEngine) {
		extensionJsonData.installGlistEngine = false;
		FileProcesses.SaveExtensionJson()
		await InstallEngine.InstallGlistEngine();
	}
	if (!fs.existsSync(path.join(extensionPath, "GlistApp"))) {
		await InstallGlistAppTemplate();
	}
	if (extensionJsonData.firstRun) {
		await ConfigureExtension();
	}
	else if (extensionJsonData.secondRun) {
		await LoadTabs();
	}
}

async function ConfigureExtension() {
	try {
		// Do not create workspace and stop setup process if glistapps does not exist (Also Meaning Glist Engine is not installed.)
		if (!fs.existsSync(globals.glistappsPath)) {
			extensionJsonData.firstRun = false;
			extensionJsonData.secondRun = false;
			FileProcesses.SaveExtensionJson()
			return;
		}
		await FileProcesses.UpdateVSCodeSettings();

		// Install ninja if does not exist
		fs.ensureDirSync(path.join(globals.glistZbinPath, "CMake"));
		if (!fs.existsSync(path.join(globals.glistZbinPath, "CMake", "bin", "ninja.exe"))) {
			const ninjaPath = path.join(globals.glistZbinPath, "CMake", "bin", "ninja.zip");
			await FileProcesses.DownloadFile(globals.ninjaUrl, ninjaPath, "Downloading Ninja");
			FileProcesses.ExtractArchive(ninjaPath, path.join(globals.glistZbinPath, "CMake", "bin"), "");
			await fs.remove(ninjaPath);
		}

		extensionJsonData.firstRun = false;
		extensionJsonData.isGlistInstalled = true;
		FileProcesses.SaveExtensionJson()
		// Opens the new workspace. Setup cannot continue after here because vscode restarts. For resuming setup, there is a secondary setup run.
		await WorkspaceProcesses.UpdateWorkspace(true);
		// If workspace was already opened before, vscode will not restart so setup can continue.
		if (WorkspaceProcesses.IsUserInWorkspace(false)) await LoadTabs();
	}
	catch (error) {
		vscode.window.showErrorMessage('Failed to create workspace.');
		console.error(error);
	}
}


async function LoadTabs() {
	// Close all active tabs
	vscode.commands.executeCommand('workbench.action.closeAllEditors');

	const filesToOpen = [
		path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.h'),
		path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.cpp')
	];

	await ProjectProcesses.OpenFiles(filesToOpen);

	extensionJsonData.secondRun = false;
	FileProcesses.SaveExtensionJson()
}

async function CheckUpdates() {
	if (!WorkspaceProcesses.IsUserInWorkspace(false)) return;
	let engineUpdate = vscode.workspace.getConfiguration('glistengine').get<boolean>('autoUpdate.engine');
	let pluginsUpdate = vscode.workspace.getConfiguration('glistengine').get<boolean>('autoUpdate.plugins');
	let projectsUpdate = vscode.workspace.getConfiguration('glistengine').get<boolean>('autoUpdate.projects');
	
	if(engineUpdate) {
		if (!(await GitProcessses.CheckGitInstallation())) return;
		GitProcessses.UpdateRepository(path.join(globals.glistPath, "GlistEngine"), true);
	}
	if(pluginsUpdate) {
		if (!(await GitProcessses.CheckGitInstallation())) return;
		FileProcesses.GetSubfolders(globals.glistpluginsPath).map(folder => {
			if (fs.existsSync(path.join(folder, ".git"))) {
				GitProcessses.UpdateRepository(folder, true);
			}
		});
	}
	if(projectsUpdate) {
		if (!(await GitProcessses.CheckGitInstallation())) return;
		FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
			if (fs.existsSync(path.join(folder, ".git"))) {
				GitProcessses.UpdateRepository(folder, true);
			}
		});
	}
}

function ResetExtension() {
	extensionJsonData.firstRun = true;
	extensionJsonData.secondRun = true;
	extensionJsonData.isGlistInstalled = false;
	FileProcesses.SaveExtensionJson()
	fs.rmSync(path.join(extensionPath, 'GlistApp'), { recursive: true, force: true });
	vscode.commands.executeCommand('workbench.action.reloadWindow');
}

function CheckJsonFile() {
	if (!fs.existsSync(extensionDataFilePath)) {
		let initialData = { firstRun: true, secondRun: true, installGlistEngine: false, isGlistInstalled: false };
		fs.writeFileSync(extensionDataFilePath, JSON.stringify(initialData, null, 2));

	}
	let data = fs.readFileSync(extensionDataFilePath, 'utf8');
	extensionJsonData = JSON.parse(data);
}

async function InstallGlistAppTemplate() {
	const zipFilePath = path.join(extensionPath, "GlistApp.zip");
	await FileProcesses.DownloadFile(globals.glistAppUrl, zipFilePath, "");
	FileProcesses.ExtractArchive(zipFilePath, extensionPath, "");
	await fs.rename(path.join(extensionPath, 'GlistApp-vscode-main'), path.join(extensionPath, 'GlistApp'));
	await fs.remove(zipFilePath);
}

export function deactivate() { }