import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { execSync } from 'child_process';



const currentDirectory = process.cwd();
const currentDrive = path.parse(currentDirectory).root;

const tempPath = path.join(os.tmpdir(), "GlistVSCodeInstaller");
const glistPath = path.join(currentDrive, "\\dev\\glist");
const glistappsPath = path.join(currentDrive, "\\dev\\glist\\myglistapps\\");
const glistEnginePath = path.join(currentDrive, "\\dev\\glist\\GlistEngine\\engine");
const glistZbinPath = path.join(currentDrive, "\\dev\\glist\\zbin\\glistzbin-win64");
const workspaceFilePath = path.join(currentDrive, "\\dev\\glist\\Glist.code-workspace");
const glistpluginsPath = path.join(currentDrive, "\\dev\\glist\\glistplugins");

const glistAppUrl = "https://codeload.github.com/javertus/GlistApp-vscode/zip/refs/heads/main";
const glistEngineUrl = "https://codeload.github.com/GlistEngine/GlistEngine/zip/refs/heads/main";
const glistClangUrl = "https://github.com/javertus/glistzbin-win64-vscode/releases/download/Dependencies/clang64.zip";
const glistCmakeUrl = "https://github.com/javertus/glistzbin-win64-vscode/releases/download/Dependencies/CMake.zip";
const ninjaUrl = "https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip";

let jsonParsedData: any;
let extensionPath: string;
let extensionDataFilePath: string;

export function activate(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand('glist-engine-worker-extension.create-glistapp', async () => {
		await CreateGlistApp();
	});
	vscode.commands.registerCommand('glist-engine-worker-extension.workspace-update', async () => {
		await UpdateWorkspace();
	});
	vscode.commands.registerCommand('glist-engine-worker-extension.openWorkspace', async () => {
		await LaunchWorkspace();
	});
	vscode.commands.registerCommand('glist-engine-worker-extension.reset', async () => {
		ResetExtension();
	});
	vscode.commands.registerCommand('glist-engine-worker-extension.installglistengine', async () => {
		InstallGlistEngine();
	});

	extensionPath = context.extensionPath;
	extensionDataFilePath = path.join(extensionPath, 'ExtensionData.json');
	FirstRunWorker();
}

async function CreateGlistApp(projectName: any = undefined) {
	if (projectName == undefined) {
		projectName = await vscode.window.showInputBox({
			placeHolder: "Enter the name of new GlistApp"
		});
	}

	if (!projectName) {
		vscode.window.showErrorMessage("No input provided.");
		return;
	}
	if (fs.existsSync(path.join(glistappsPath, projectName))) {
		vscode.window.showErrorMessage("A folder named " + projectName + " already exist.");
		return;
	}

	fs.cpSync(path.join(extensionPath, 'GlistApp'), path.join(glistappsPath, projectName), { recursive: true });

	await AddNewProjectToWorkspace(projectName);

	const filesToOpen = [
		path.join(glistappsPath, projectName, 'src', 'gCanvas.h'),
		path.join(glistappsPath, projectName, 'src', 'gCanvas.cpp')
	];

	filesToOpen.forEach(async file => {
		const uri = vscode.Uri.file(file);
		const document = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(document, { preview: false });
	});
}

async function AddNewProjectToWorkspace(projectName: string) {
	// Read the JSON file
	const jsonString = fs.readFileSync(workspaceFilePath, 'utf-8');
	const jsonData = JSON.parse(jsonString);

	// Extract the engine path if it exists
	const enginePath = jsonData.folders.find((folder: { path: string }) => folder.path.includes('GlistEngine'));
	jsonData.folders = jsonData.folders.filter((folder: { path: string }) => !folder.path.includes('GlistEngine'));

	// Add the new path and sort the folders array alphabetically by path
	jsonData.folders.push({ path: path.join(glistappsPath, projectName) });
	jsonData.folders.sort((a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path));

	// Re-add the engine path at the end if it was found
	if (enginePath) {
		jsonData.folders.push(enginePath);
	}

	// Convert the updated data back to JSON format and write it to the file
	fs.writeFileSync(workspaceFilePath, JSON.stringify(jsonData, null, 2));
	vscode.window.showInformationMessage('Created new GlistApp.');

	//VS Code will restart if another workspace is active.
	await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFilePath), false);
}

async function UpdateWorkspace() {
	try {
		let workspaceFolders = [];
		getSubfolders(glistappsPath).map(folder => {
			if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
				workspaceFolders.push(folder)
				if (!fs.existsSync(path.join(folder, ".vscode"))) {
					vscode.window.showInformationMessage("Launch configurations are not found for project named " + path.basename(folder) + ". Creating launch configurations...");
					fs.cpSync(path.join(extensionPath, 'GlistApp', '.vscode'), path.join(folder, '.vscode'), { recursive: true });
				}
			}
		});
		workspaceFolders.push(glistEnginePath);
		const workspaceContent = {
			folders: workspaceFolders.map(folder => ({ path: folder })),
		};

		fs.writeFileSync(workspaceFilePath, JSON.stringify(workspaceContent, null, 2));
		vscode.window.showInformationMessage('Workspace Updated.');

		//VS Code will restart if another workspace is active.
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFilePath), false);
	} catch (error) {
		vscode.window.showErrorMessage('Failed to create workspace.');
		console.error(error);
	}
}

async function LaunchWorkspace() {
	if (fs.existsSync(workspaceFilePath)) {
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFilePath), false);
	}
	else { // If no workspace file found, create one and launch the workspace
		UpdateWorkspace();
	}
}

function ResetExtension() {
	jsonParsedData.firstRun = true;
	jsonParsedData.secondRun = true;
	fs.writeFileSync(extensionDataFilePath, JSON.stringify(jsonParsedData, null, 2));
	fs.rmSync(path.join(extensionPath, 'GlistApp'), { recursive: true, force: true });
}

async function InstallGlistEngine() {
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
			await installGlistEngine();
			progress.report({ increment: 20 });
			await installCmake();
			progress.report({ increment: 20 });
			AddPathToSystemEnvironment(path.join(glistZbinPath, "CMake"));
			await installClang();
			progress.report({ increment: 20 });
			await createEmptyGlistApp();
			progress.report({ increment: 20 });
			vscode.window.showInformationMessage("Glist Engine Installed Successfully.");
		});
	}
}

async function DownloadFile(url: string, dest: string) {
	const response = await axios({
		method: 'GET',
		url: url,
		responseType: 'arraybuffer',
		maxRedirects: 5,
	});

	// Pipe the stream to the destination file
	fs.writeFileSync(dest, response.data);
}


function ExtractArchive(zipPath: string, dest: string, message: string) {
	const zip = new AdmZip(zipPath);
	zip.extractAllTo(dest, true);
	vscode.window.showInformationMessage(message);
}

async function installGlistEngine() {
	vscode.window.showInformationMessage("Installing Engine ~8MB");

	const zipFilePath = path.join(tempPath, 'GlistEngine.zip');
	await DownloadFile(glistEngineUrl, zipFilePath);
	await fs.remove(path.join(glistPath, "GlistEngine"));
	ExtractArchive(zipFilePath, glistPath, "Engine Installed.");
	await fs.rename(path.join(glistPath, 'GlistEngine-main'), path.join(glistPath, 'GlistEngine'));
}

async function installCmake() {
	vscode.window.showInformationMessage("Installing Cmake ~35MB");

	const zipFilePath = path.join(tempPath, 'CMake.zip');
	await DownloadFile(glistCmakeUrl, zipFilePath);
	await fs.remove(path.join(glistZbinPath, 'CMake'));
	ExtractArchive(zipFilePath, glistZbinPath, "CMake Binaries Installed.");
}

async function installClang() {
	vscode.window.showInformationMessage("Installing Clang Binaries ~400MB");

	const zipFilePath = path.join(tempPath, 'clang64.zip');
	await DownloadFile(glistClangUrl, zipFilePath);
	await fs.remove(path.join(glistZbinPath, 'clang64'));
	ExtractArchive(zipFilePath, glistZbinPath, "Clang Binaries Installed.");
}

function AddPathToSystemEnvironment(newPath: string) {
	const currentPath = process.env.PATH || '';
	if (!currentPath.includes(newPath)) {
		const psCommand = `powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${currentPath};${newPath}', [EnvironmentVariableTarget]::User)"`;
		execSync(psCommand);
	}
}
async function createEmptyGlistApp() {
	vscode.window.showInformationMessage("Creating Empty GlistApp");
	CreateGlistApp("GlistApp");
}

async function createDirectories() {
	await fs.ensureDir(glistpluginsPath);
	await fs.remove(tempPath);
	await fs.ensureDir(tempPath);
}


async function FirstRunWorker() {
	CheckJsonFile();
	if (jsonParsedData.firstRun) {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			cancellable: false,
			title: 'Installing required extensions for Glist Engine. Please wait...'
		}, async (progress) => {
			progress.report({ increment: 0 });
			const zipFilePath = path.join(extensionPath, "GlistApp.zip");
			await DownloadFile(glistAppUrl, zipFilePath);
			ExtractArchive(zipFilePath, extensionPath, "");
			await fs.rename(path.join(extensionPath, 'GlistApp-vscode-main'), path.join(extensionPath, 'GlistApp'));
			await fs.remove(zipFilePath);
			await InstallExtensions(progress);
			await CreateWorkspace();
		});
	}
	else if (jsonParsedData.secondRun) {
		await OpenFiles();
	}
}

function CheckJsonFile() {
	// Check if the file exists
	if (!fs.existsSync(extensionDataFilePath)) {
		// File does not exist, create it with initial data
		let initialData = { firstRun: true, secondRun: true };
		fs.writeFileSync(extensionDataFilePath, JSON.stringify(initialData, null, 2));
	}
	//Read data from file
	let data = fs.readFileSync(extensionDataFilePath, 'utf8');
	jsonParsedData = JSON.parse(data);
}

// Installs the required extensions
async function InstallExtensions(progress: any) {
	try {
		// Required extension names
		const extensionsToInstall = [
			'vadimcn.vscode-lldb',
			'twxs.cmake',
			'ms-vscode.cmake-tools',
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

// Create and open a workspace for glist engine
async function CreateWorkspace() {
	try {
		// Do not create workspace and stop setup process if glistapps does not exist (Also Meaning Glist Engine is not installed.)
		if(!fs.existsSync(glistappsPath)) {
			jsonParsedData.firstRun = false;
			jsonParsedData.secondRun = false;
			fs.writeFileSync(extensionDataFilePath, JSON.stringify(jsonParsedData, null, 2));
			return;
		}
		// Install ninja if does not exist
		fs.ensureDirSync(path.join(glistZbinPath, "CMake"))
		const ninjaPath = path.join(glistZbinPath, "CMake", "ninja.zip");
		if(!fs.existsSync(ninjaPath)) {
			vscode.window.showInformationMessage("yok");
			await DownloadFile(ninjaUrl, ninjaPath);
			ExtractArchive(ninjaPath, path.join(glistZbinPath, "CMake"), "");
			await fs.remove(ninjaPath);
		}

		let workspaceFolders = [];
		getSubfolders(glistappsPath).map(folder => {
			if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
				workspaceFolders.push(folder)
				if (!fs.existsSync(path.join(folder, ".vscode"))) {
					vscode.window.showInformationMessage("Launch configurations are not found for project at " + folder + ". Creating launch configurations...");
					fs.cpSync(path.join(extensionPath, 'GlistApp', '.vscode'), path.join(folder, '.vscode'), { recursive: true });
				}
			}
		});
		workspaceFolders.push(glistEnginePath);
		const workspaceContent = {
			folders: workspaceFolders.map(folder => ({ path: folder })),
		};

		fs.writeFileSync(workspaceFilePath, JSON.stringify(workspaceContent, null, 2));
		vscode.window.showInformationMessage('Workspace configured.');
		jsonParsedData.firstRun = false;
		fs.writeFileSync(extensionDataFilePath, JSON.stringify(jsonParsedData, null, 2));

		// Opens the new workspace. Setup cannot continue after here because vscode restarts. For resuming setup, there is a secondary setup run.
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFilePath), false);
		// If workspace was already opened before, vscode will not restart so setup can continue.
		await OpenFiles();
	}
	catch (error) {
		vscode.window.showErrorMessage('Failed to create workspace.');
		console.error(error);
	}
}

// Open the canvas files
async function OpenFiles() {
	// Close all active tabs
	vscode.commands.executeCommand('workbench.action.closeAllEditors');

	const myglistappsPath = 'c:\\dev\\glist\\myglistapps\\';
	const filesToOpen = [
		path.join(myglistappsPath, 'GlistApp', 'src', 'gCanvas.h'),
		path.join(myglistappsPath, 'GlistApp', 'src', 'gCanvas.cpp')
	];

	filesToOpen.forEach(async file => {
		const uri = vscode.Uri.file(file);
		const document = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(document, { preview: false });
	});

	jsonParsedData.secondRun = false;
	fs.writeFileSync(extensionDataFilePath, JSON.stringify(jsonParsedData, null, 2));
}

function getSubfolders(directory: string): string[] {
	return fs.readdirSync(directory)
		.filter(file => fs.statSync(path.join(directory, file)).isDirectory())
		.map(folder => path.join(directory, folder));
}

export function deactivate() { }