import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as globals from './globals';
import * as GitProcesses from './GitProcesses';
import * as InstallEngine from './InstallEngine';
import * as FileProcesses from './FileProcesses';
import * as ProjectProcesses from './ProjectProcesses';
import * as WorkspaceProcesses from './WorkspaceProcesses';


export let jsonData: any;
export let extensionPath: string;
export let dataFilePath: string;

export function activate(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand('glist-extension.create-project', async () => {
		await ProjectProcesses.CreateNewProject();
	});
	vscode.commands.registerCommand('glist-extension.delete-project', async () => {
		await ProjectProcesses.DeleteProject();
	});
	vscode.commands.registerCommand('glist-extension.update-workspace', async () => {
		await WorkspaceProcesses.ConfigureWorkspace();
	});
	vscode.commands.registerCommand('glist-extension.add-canvas-to-project', async () => {
		await ProjectProcesses.CreateCanvas()
	});
	vscode.commands.registerCommand('glist-extension.add-class-to-project', async () => {
		await ProjectProcesses.CreateClass(path.join(extensionPath), "EmptyClass");
	});
	vscode.commands.registerCommand('glist-extension.delete-class-from-project', async () => {
		await ProjectProcesses.DeleteClassFromProject();
	});
	vscode.commands.registerCommand('glist-extension.switch-workspace', async () => {
		await WorkspaceProcesses.LaunchWorkspace();
	});
	vscode.commands.registerCommand('glist-extension.clone-plugin', async () => {
		await GitProcesses.ClonePlugin();
	});
	vscode.commands.registerCommand('glist-extension.clone-pluginurl', async () => {
		await GitProcesses.ClonePluginUrl();
	});
	vscode.commands.registerCommand('glist-extension.update-repos', async () => {
		await GitProcesses.CheckRepoUpdates();
	});
	vscode.commands.registerCommand('glist-extension.clone-project', async () => {
		await GitProcesses.CloneProject();
	});
	vscode.commands.registerCommand('glist-extension.uninstall', async () => {
		await Uninstall();
	});
	vscode.commands.registerCommand('glist-extension.run-project', async () => {
		vscode.commands.executeCommand('workbench.action.debug.start');
	});
	vscode.commands.registerCommand('glist-extension.install-glistengine', async () => {
		await InstallEngine.InstallGlistEngine();
	});
	vscode.commands.registerCommand('glist-extension.reset', async () => {
		await ResetExtension();
	});

	extensionPath = context.extensionPath;
	dataFilePath = path.join(extensionPath, 'ExtensionData.json');
	OnExtensionStart();
}

async function OnExtensionStart() {
	if (fs.existsSync(globals.workspaceFilePath)) {
		WorkspaceProcesses.SortWorkspaceJson(""); // Adds engine folder if doesnt exists
	}
	InitializeJsonFile();
	if (jsonData.installGlistEngine) {
		await InstallEngine.InstallGlistEngine('Yes');
	}
	if (WorkspaceProcesses.IsUserInWorkspace(false)) {
		vscode.commands.executeCommand('setContext', 'glist-extension.showRunButton', true);
		const folderWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(globals.glistappsPath, '**'));
		folderWatcher.onDidCreate(e => { // Triggered when a file or folder added/renamed under /myglistapps folder, including subfolders.
			if (fs.existsSync(path.join(e.fsPath, "CMakeLists.txt")) && !e.toString().includes("CMakeTmp")) { // Prevent adding the CMakeTmp folder to the workspace when it is generated under /myglistapps during project build 
				WorkspaceProcesses.AddProjectToWorkspace(path.basename(e.fsPath));
			}
		});

		folderWatcher.onDidDelete(e => { // Triggered when a file or folder removed/renamed under /myglistapps folder, including subfolders.
			if (path.dirname(e.fsPath).toLowerCase() == globals.glistappsPath.toLowerCase()) {
				WorkspaceProcesses.RemoveProjectFromWorkspace(e.fsPath);
				vscode.window.showInformationMessage(`${path.basename(e.fsPath)} removed from workspace.`);
			}
			WorkspaceProcesses.CloseNonExistentFileTabs();
			WorkspaceProcesses.CheckLaunchConfigurations();
		});

		vscode.workspace.onDidChangeWorkspaceFolders(e => { // Triggered when a project added into workspace
			e.added.forEach(e => {
				if (!fs.existsSync(path.join(e.uri.fsPath, 'src', 'gCanvas.h')) || !e.uri.fsPath.toLowerCase().includes(globals.glistappsPath.toLowerCase())) return;
				const filesToOpen = [
					path.join(e.uri.fsPath, 'src', 'gCanvas.h'),
					path.join(e.uri.fsPath, 'src', 'gCanvas.cpp')
				];
				ProjectProcesses.OpenFiles(filesToOpen);
			});

			let isEngineRemoved = e.removed.some(e =>
				e.uri.fsPath.toLowerCase().includes(globals.glistEnginePath.toLowerCase())
			);
		
			if (isEngineRemoved) return;
			WorkspaceProcesses.SortWorkspaceJson("");
			WorkspaceProcesses.CloseNonExistentFileTabs();
			WorkspaceProcesses.CheckLaunchConfigurations();
		});

		WorkspaceProcesses.CloseNonExistentFileTabs();
		WorkspaceProcesses.CheckLaunchConfigurations();
		await CheckUpdates();
	}
	if (jsonData.firstRun) {
		await SetupExtension();
	}
	else if (jsonData.secondRun) {
		await LoadTabs();
	}
	if (jsonData.uninstall) {
		await Uninstall(jsonData.uninstall);
	}
}

export async function SetupExtension() {
	try {
		// Do not create workspace and stop setup process if zbinPath does not exist (Meaning Glist Engine is not installed.)
		if (!fs.existsSync(globals.glistZbinWindowsPath)) {
			jsonData.firstRun = false;
			jsonData.secondRun = false;
			FileProcesses.SaveExtensionJson()
			return;
		}

		// Install ninja if does not exist
		if (!fs.existsSync(path.join(globals.glistZbinWindowsPath, "CMake", "bin", "ninja.exe"))) {
			const ninjaPath = path.join(globals.glistZbinWindowsPath, "CMake", "bin", "ninja.zip");
			await FileProcesses.DownloadFile(globals.ninjaUrl, ninjaPath, "Downloading Ninja");
			FileProcesses.ExtractArchive(ninjaPath, path.join(globals.glistZbinWindowsPath, "CMake", "bin"), "");
			fs.removeSync(ninjaPath);
		}

		if (await FileProcesses.UpdateVSCodeSettings()) return;

		jsonData.firstRun = false;
		jsonData.isGlistInstalled = true;
		FileProcesses.SaveExtensionJson();
		// Opens the new workspace. Setup cannot continue after here because vscode restarts. For resuming setup, there is a secondary setup run.
		await WorkspaceProcesses.ConfigureWorkspace(true);
		// If workspace was already active, vscode will not restart so setup can continue.
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
		path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.h'),
		path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.cpp')
	];

	await ProjectProcesses.OpenFiles(filesToOpen);

	jsonData.secondRun = false;
	FileProcesses.SaveExtensionJson()
}

async function CheckUpdates() {
	const engineUpdate = vscode.workspace.getConfiguration('glistengine').get<boolean>('autoUpdate.engine');
	const pluginsUpdate = vscode.workspace.getConfiguration('glistengine').get<boolean>('autoUpdate.plugins');
	const projectsUpdate = vscode.workspace.getConfiguration('glistengine').get<boolean>('autoUpdate.projects');

	if (!(await GitProcesses.CheckGitInstallation())) return;

	if (engineUpdate) {
		GitProcesses.UpdateRepository(path.join(globals.glistPath, "GlistEngine"), true);
	}
	if (pluginsUpdate) {
		FileProcesses.GetSubfolders(globals.glistpluginsPath).map(folder => {
			if (fs.existsSync(path.join(folder, ".git"))) {
				GitProcesses.UpdateRepository(folder, true);
			}
		});
	}
	if (projectsUpdate) {
		FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
			if (fs.existsSync(path.join(folder, ".git"))) {
				GitProcesses.UpdateRepository(folder, true);
			}
		});
	}
	if (!fs.existsSync(path.join(extensionPath, 'GlistApp-vscode'))) {
		await CloneGlistAppTemplate();
	}
	else {
		GitProcesses.UpdateRepository(path.join(extensionPath, "GlistApp-vscode"), true);
	}
}

async function ResetExtension() {
	jsonData.firstRun = true;
	jsonData.secondRun = true;
	jsonData.isGlistInstalled = false;
	jsonData.uninstall = false;
	FileProcesses.SaveExtensionJson()

	const config = vscode.workspace.getConfiguration('glistengine');
	for (const key of globals.GLISTENGINE_SETTINGS) {
		await config.update(key, undefined, vscode.ConfigurationTarget.Global);
	}

	WorkspaceProcesses.ReloadWorkspace();
}

async function Uninstall(consent: any = '') {
	if (!jsonData.isGlistInstalled) {
		vscode.window.showErrorMessage("Glist Engine Is Not Installed!");
		return;
	}
	if (!consent) consent = await vscode.window.showInformationMessage(
		`Do you want to uninstall Glist Engine? This action will delete all your projects, plugins and engine`,
		{ modal: true, detail: `Choose "Engine Only" if you just want to delete GlistEngine and its binaries (Your projects and plugins will not be affected).` },
		'Yes',
		'Engine Only',
	);
	if (consent == 'Yes' || consent == 'Engine Only') {
		if (!jsonData.uninstall) {
			const doubleCheck = await vscode.window.showInformationMessage(
				`Are you sure?`,
				{ modal: true },
				'Yes'
			);
			if (doubleCheck != 'Yes') return;
			jsonData.uninstall = consent;
			FileProcesses.SaveExtensionJson();
			await vscode.commands.executeCommand('workbench.action.closeAllEditors');
			await vscode.commands.executeCommand('vscode.newWindow', { reuseWindow: true });
			return;
		}
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			cancellable: false,
			title: 'Uninstalling Glist Engine'
		}, async (progress) => {
			while ((fs.pathExistsSync(globals.glistPath) && consent == 'Yes') ||
				(fs.pathExistsSync(globals.glistEngineRootPath) && fs.pathExistsSync(globals.glistZbinWindowsPath) && consent == 'Engine Only')) {
				try {
					if (consent == 'Yes') {
						await FileProcesses.DeleteFolder(globals.glistPath);
					}
					else if (consent == 'Engine Only') {
						await FileProcesses.DeleteFolder(globals.glistEngineRootPath);
						await FileProcesses.DeleteFolder(globals.glistZbinWindowsPath);
						await FileProcesses.DeleteFile(globals.workspaceFilePath);
					}
				}
				catch (err) {
					console.log(err);
					vscode.window.showErrorMessage(`An error occurred while uninstalling Glist Engine: ${err}`);
					progress.report({ message: "Cannot Uninstall! Please close everything running under /dev/glist/ path" });
				}
			}
			WorkspaceProcesses.CloseNonExistentFileTabs(); // When VScode tries to open workspace configuration file as a tab
			vscode.window.showInformationMessage("Glist Engine Uninstalled.");
			await ResetExtension();
		});
	}
}

function InitializeJsonFile() {
	if (!fs.existsSync(dataFilePath)) {
		let initialData = { firstRun: true, secondRun: true, installGlistEngine: false, isGlistInstalled: false, uninstall: '' };
		fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
	}
	let data = fs.readFileSync(dataFilePath, 'utf8');
	jsonData = JSON.parse(data);
}

export async function CloneGlistAppTemplate() {
	try {
		return await GitProcesses.CloneRepository(globals.glistappUrl, extensionPath, false, "Cloning GlistApp Template");
	}
	catch (err) {
		console.log(`An error occurred while cloning GlistApp Template: ${err}`)
	}
}

export function deactivate() { }