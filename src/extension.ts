import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as globals from './globals';
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
	vscode.commands.registerCommand('glist-extension.reset', async () => {
		ResetExtension();
	});

	extensionPath = context.extensionPath;
	extensionDataFilePath = path.join(extensionPath, 'ExtensionData.json');
	FirstRunWorker();
}

async function FirstRunWorker() {
	CheckJsonFile();
	if (extensionJsonData.deleteFolder) {
		await FileProcesses.DeleteFolder(extensionJsonData.deleteFolder);
		extensionJsonData.deleteFolder = undefined;
		FileProcesses.SaveExtensionJson()
		vscode.window.showInformationMessage("Project Deleted.");
	}
	if (WorkspaceProcesses.CheckWorkspace(false)) await WorkspaceProcesses.CloseNonExistentFileTabs();
	if (extensionJsonData.installGlistEngine) {
		extensionJsonData.installGlistEngine = false;
		FileProcesses.SaveExtensionJson()
		await InstallEngine.InstallGlistEngine();
	}
	if (!fs.existsSync(path.join(extensionPath, "GlistApp"))) {
		await InstallGlistAppTemplate();
	}
	if (extensionJsonData.firstRun) {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			cancellable: false,
			title: 'Installing required extensions for Glist Engine. Please wait...'
		}, async (progress) => {
			progress.report({ increment: 0 });
			await InstallExtensions(progress);
		});
		await ConfigureExtension();
	}
	else if (extensionJsonData.secondRun) {
		await OpenFiles();
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
		const ninjaPath = path.join(globals.glistZbinPath, "CMake", "bin", "ninja.zip");
		if (!fs.existsSync(path.join(globals.glistZbinPath, "CMake", "bin", "ninja.exe"))) {
			vscode.window.showInformationMessage("Ninja not found. Installing...");
			await FileProcesses.DownloadFile(globals.ninjaUrl, ninjaPath);
			FileProcesses.ExtractArchive(ninjaPath, path.join(globals.glistZbinPath, "CMake", "bin"), "");
			await fs.remove(ninjaPath);
		}

		let workspaceFolders = [];
		FileProcesses.getSubfolders(globals.glistappsPath).map(folder => {
			if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
				workspaceFolders.push(folder)
				if (!fs.existsSync(path.join(folder, ".vscode"))) {
					vscode.window.showInformationMessage("Launch configurations are not found for project at " + folder + ". Creating launch configurations...");
					fs.cpSync(path.join(extensionPath, 'GlistApp', '.vscode'), path.join(folder, '.vscode'), { recursive: true });
				}
			}
		});
		workspaceFolders.push(globals.glistEnginePath);
		const workspaceContent = {
			folders: workspaceFolders.map(folder => ({ path: folder })),
		};

		fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(workspaceContent, null, 2));
		vscode.window.showInformationMessage('Workspace configured.');
		extensionJsonData.firstRun = false;
		FileProcesses.SaveExtensionJson()

		// Opens the new workspace. Setup cannot continue after here because vscode restarts. For resuming setup, there is a secondary setup run.
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
		// If workspace was already opened before, vscode will not restart so setup can continue.
		if (WorkspaceProcesses.CheckWorkspace(false)) await OpenFiles();
	}
	catch (error) {
		vscode.window.showErrorMessage('Failed to create workspace.');
		console.error(error);
	}
}


async function OpenFiles() {
	// Close all active tabs
	vscode.commands.executeCommand('workbench.action.closeAllEditors');

	const filesToOpen = [
		path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.h'),
		path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.cpp')
	];

	filesToOpen.forEach(async file => {
		const uri = vscode.Uri.file(file);
		const document = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(document, { preview: false });
	});

	extensionJsonData.secondRun = false;
	FileProcesses.SaveExtensionJson()
}

function ResetExtension() {
	extensionJsonData.firstRun = true;
	extensionJsonData.secondRun = true;
	FileProcesses.SaveExtensionJson()
	fs.rmSync(path.join(extensionPath, 'GlistApp'), { recursive: true, force: true });
	vscode.commands.executeCommand('workbench.action.reloadWindow');
}

function CheckJsonFile() {
	if (!fs.existsSync(extensionDataFilePath)) {
		let initialData = { firstRun: true, secondRun: true, installGlistEngine: false };
		fs.writeFileSync(extensionDataFilePath, JSON.stringify(initialData, null, 2));

	}
	let data = fs.readFileSync(extensionDataFilePath, 'utf8');
	extensionJsonData = JSON.parse(data);
}

async function InstallGlistAppTemplate() {
	const zipFilePath = path.join(extensionPath, "GlistApp.zip");
	await FileProcesses.DownloadFile(globals.glistAppUrl, zipFilePath);
	FileProcesses.ExtractArchive(zipFilePath, extensionPath, "");
	await fs.rename(path.join(extensionPath, 'GlistApp-vscode-main'), path.join(extensionPath, 'GlistApp'));
	await fs.remove(zipFilePath);
}

async function InstallExtensions(progress: any) {
	try {
		// Required extension names
		const extensionsToInstall = [
			'vadimcn.vscode-lldb',
			'ms-vscode.cpptools',
		];
		let incrementValue = 100 / extensionsToInstall.length

		for (let i = 0; i < extensionsToInstall.length; i++) {
			const extension = vscode.extensions.getExtension(extensionsToInstall[i]);
			if (extension) {
				progress.report({ increment: incrementValue })
			}
			else {
				await vscode.commands.executeCommand('workbench.extensions.installExtension', extensionsToInstall[i]);
				progress.report({ increment: incrementValue })
			}
		}
		vscode.window.showInformationMessage("Required Glist Engine extensions are installed successfully!");
	}
	catch (error) {
		vscode.window.showErrorMessage('Failed to Install Extensions.');
		console.error(error);
	}
}

export function deactivate() { }