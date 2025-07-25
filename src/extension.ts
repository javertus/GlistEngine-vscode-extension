import * as vscode from 'vscode';
import * as fspath from 'path';
import * as fs from 'fs-extra';
import * as globals from './globals';
import * as GitProcessses from './GitProcesses';
import * as InstallEngine from './InstallEngine';
import * as FileProcesses from './FileProcesses';
import * as ProjectProcesses from './ProjectProcesses';
import * as WorkspaceProcesses from './WorkspaceProcesses';


export let jsonData: any;
export let path: string;
export let dataFilePath: string;

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
		await ProjectProcesses.AddClassToProject(fspath.join(path, "GlistApp-vscode", "src"), "gCanvas");
	});
	vscode.commands.registerCommand('glist-extension.add-class-to-project', async () => {
		await ProjectProcesses.AddClassToProject(fspath.join(path), "EmptyClass");
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

	path = context.extensionPath;
	dataFilePath = fspath.join(path, 'ExtensionData.json');
	OnExtensionStart();
}

async function OnExtensionStart() {
	CheckJsonFile();
	if (jsonData.deleteFolder) {
		await FileProcesses.DeleteFolder(jsonData.deleteFolder);
		jsonData.deleteFolder = undefined;
		FileProcesses.SaveExtensionJson()
		vscode.window.showInformationMessage("Project Deleted.");
	}
	if (jsonData.installGlistEngine) {
		await InstallEngine.InstallGlistEngine();
	}
	if (WorkspaceProcesses.IsUserInWorkspace(false)) {
		vscode.commands.executeCommand('setContext', 'glist-extension.showRunButton', true);
		const folderWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(globals.glistPath, '**'));
		folderWatcher.onDidCreate(e => {
			if (fspath.dirname(e.fsPath).toLowerCase() + "\\" == globals.glistappsPath.toLowerCase() && fs.existsSync(fspath.join(e.fsPath, "CMakeLists.txt"))) {
				WorkspaceProcesses.AddProjectToWorkspace(fspath.basename(e.fsPath));
				if (!fs.existsSync(fspath.join(e.fsPath, 'src', 'gCanvas.h'))) return;
				const filesToOpen = [
					fspath.join(e.fsPath, 'src', 'gCanvas.h'),
					fspath.join(e.fsPath, 'src', 'gCanvas.cpp')
				];
				ProjectProcesses.OpenFiles(filesToOpen)
			}
			WorkspaceProcesses.CloseNonExistentFileTabs();
			WorkspaceProcesses.CheckLaunchConfigurations();
		});

		folderWatcher.onDidChange(e => {
			WorkspaceProcesses.CloseNonExistentFileTabs();
			WorkspaceProcesses.CheckLaunchConfigurations();
		});

		folderWatcher.onDidDelete(e => {
			if (fspath.dirname(e.fsPath).toLowerCase() + "\\" == globals.glistappsPath.toLowerCase()) {
				WorkspaceProcesses.RemoveProjectFromWorkspace(fspath.basename(e.fsPath));
			}
			WorkspaceProcesses.CloseNonExistentFileTabs();
			WorkspaceProcesses.CheckLaunchConfigurations();
		});

		vscode.workspace.onDidChangeWorkspaceFolders(e => {
			e.added.forEach(folder => {
				if (!fs.existsSync(fspath.join(folder.uri.fsPath, 'src', 'gCanvas.h'))) return;
				const filesToOpen = [
					fspath.join(folder.uri.fsPath, 'src', 'gCanvas.h'),
					fspath.join(folder.uri.fsPath, 'src', 'gCanvas.cpp')
				];
				ProjectProcesses.OpenFiles(filesToOpen)
			});
			WorkspaceProcesses.SortWorkspaceJson("");
			WorkspaceProcesses.CloseNonExistentFileTabs();
			WorkspaceProcesses.CheckLaunchConfigurations();
		});

		await WorkspaceProcesses.CloseNonExistentFileTabs();
		await WorkspaceProcesses.CheckLaunchConfigurations();
		await CheckUpdates();
	}
	if (jsonData.firstRun) {
		await ConfigureExtension();
	}
	else if (jsonData.secondRun) {
		await LoadTabs();
	}
}

export async function ConfigureExtension() {
	try {
		// Do not create workspace and stop setup process if glistapps does not exist (Also Meaning Glist Engine is not installed.)
		if (!fs.existsSync(globals.glistappsPath)) {
			jsonData.firstRun = false;
			jsonData.secondRun = false;
			FileProcesses.SaveExtensionJson()
			return;
		}
		// Clone GlistApp template if does not exist
		if (!fs.existsSync(fspath.join(path, "GlistApp-vscode", ".git"))) {
			await CloneGlistAppTemplate();
		}
		// Install ninja if does not exist
		if (!fs.existsSync(fspath.join(globals.glistZbinPath, "CMake", "bin", "ninja.exe"))) {
			const ninjaPath = fspath.join(globals.glistZbinPath, "CMake", "bin", "ninja.zip");
			await FileProcesses.DownloadFile(globals.ninjaUrl, ninjaPath, "Downloading Ninja");
			FileProcesses.ExtractArchive(ninjaPath, fspath.join(globals.glistZbinPath, "CMake", "bin"), "");
			fs.removeSync(ninjaPath);
		}

		if (await FileProcesses.UpdateVSCodeSettings()) return;

		jsonData.firstRun = false;
		jsonData.isGlistInstalled = true;
		FileProcesses.SaveExtensionJson()
		// Opens the new workspace. Setup cannot continue after here because vscode restarts. For resuming setup, there is a secondary setup run.
		await WorkspaceProcesses.UpdateWorkspace(true);
		// If workspace was already opened vscode will not restart so setup can continue.
		if (WorkspaceProcesses.IsUserInWorkspace(false)) await LoadTabs();
	}
	catch (error) {
		vscode.window.showErrorMessage('Failed to create workspace.');
		console.error(error);
	}
}


async function LoadTabs() {
	// Close all active tabs
	await vscode.commands.executeCommand('workbench.action.closeAllEditors');

	const filesToOpen = [
		fspath.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.h'),
		fspath.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.cpp')
	];

	await ProjectProcesses.OpenFiles(filesToOpen);

	jsonData.secondRun = false;
	FileProcesses.SaveExtensionJson()
}

async function CheckUpdates() {
	const engineUpdate = vscode.workspace.getConfiguration('glistengine').get<boolean>('autoUpdate.engine');
	const pluginsUpdate = vscode.workspace.getConfiguration('glistengine').get<boolean>('autoUpdate.plugins');
	const projectsUpdate = vscode.workspace.getConfiguration('glistengine').get<boolean>('autoUpdate.projects');

	if (engineUpdate) {
		if (!(await GitProcessses.CheckGitInstallation())) return;
		GitProcessses.UpdateRepository(fspath.join(globals.glistPath, "GlistEngine"), true);
	}
	if (pluginsUpdate) {
		if (!(await GitProcessses.CheckGitInstallation())) return;
		FileProcesses.GetSubfolders(globals.glistpluginsPath).map(folder => {
			if (fs.existsSync(fspath.join(folder, ".git"))) {
				GitProcessses.UpdateRepository(folder, true);
			}
		});
	}
	if (projectsUpdate) {
		if (!(await GitProcessses.CheckGitInstallation())) return;
		FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
			if (fs.existsSync(fspath.join(folder, ".git"))) {
				GitProcessses.UpdateRepository(folder, true);
			}
		});
	}
	GitProcessses.UpdateRepository(fspath.join(path, "GlistApp-vscode"), true);
}

function ResetExtension() {
	jsonData.firstRun = true;
	jsonData.secondRun = true;
	jsonData.isGlistInstalled = false;
	FileProcesses.SaveExtensionJson()
	WorkspaceProcesses.ReloadWorkspace();
}

function CheckJsonFile() {
	if (!fs.existsSync(dataFilePath)) {
		let initialData = { firstRun: true, secondRun: true, installGlistEngine: false, isGlistInstalled: false };
		fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
	}
	let data = fs.readFileSync(dataFilePath, 'utf8');
	jsonData = JSON.parse(data);
}

async function CloneGlistAppTemplate() {
	try {
		fs.rmSync(fspath.join(path, 'GlistApp-vscode'), { recursive: true, force: true });
		await GitProcessses.CloneRepository(globals.glistAppUrl, path, false, "Cloning GlistApp Template");
	}
	catch (err) {
		console.log(`An error occurred while cloning GlistApp Template: ${err}`)
	}
}

export function deactivate() { }