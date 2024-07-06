import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';
import AdmZip from 'adm-zip';
import axios from 'axios';
import json5 from 'json5'
import { rimraf } from 'rimraf';


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

let extensionJsonData: any;
let extensionPath: string;
let extensionDataFilePath: string;

export function activate(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand('glist-extension.create-glistapp', async () => {
		await CreateNewProject();
	});
	vscode.commands.registerCommand('glist-extension.workspace-update', async () => {
		await UpdateWorkspace();
	});
	vscode.commands.registerCommand('glist-extension.deleteproject', async () => {
		await DeleteProject();
	});
	vscode.commands.registerCommand('glist-extension.addcanvastoproject', async () => {
		await AddClassToProject(path.join(extensionPath, "GlistApp", "src"), "gCanvas");
	});
	vscode.commands.registerCommand('glist-extension.addclasstoproject', async () => {
		await AddClassToProject(path.join(extensionPath), "EmptyClass");
	});
	vscode.commands.registerCommand('glist-extension.openWorkspace', async () => {
		await LaunchWorkspace();
	});
	vscode.commands.registerCommand('glist-extension.installglistengine', async () => {
		await InstallGlistEngine();
	});
	vscode.commands.registerCommand('glist-extension.reset', async () => {
		ResetExtension();
	});

	extensionPath = context.extensionPath;
	extensionDataFilePath = path.join(extensionPath, 'ExtensionData.json');
	FirstRunWorker();
}

function CheckWorkspace(showErrorMessage: boolean = true) {
	let folders = vscode.workspace.workspaceFolders;
	let len = vscode.workspace.workspaceFolders?.length;
	if (!folders || !len || folders[len - 1].uri.fsPath.toLowerCase() != glistEnginePath.toLowerCase()) {
		if (showErrorMessage) vscode.window.showErrorMessage("You should switch to Glist workspace to do that.");
		return false;
	}
	return true;
}

async function CreateNewProject(projectName: any = undefined) {
	if (!CheckWorkspace()) return;
	if (projectName == undefined) {
		projectName = await vscode.window.showInputBox({
			placeHolder: "Enter the name of new Project"
		});
	}
	if (checkInput(projectName)) return;
	projectName = projectName + "";
	if (!checkPath(path.join(glistappsPath, projectName), "A project named " + projectName + " already exist. Opening already existing project...", false)) {
		fs.cpSync(path.join(extensionPath, 'GlistApp'), path.join(glistappsPath, projectName), { recursive: true });
		vscode.window.showInformationMessage('Created new Project.');
	}

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
	if (!fs.existsSync(workspaceFilePath)) {
		extensionJsonData.firstRun = false;
		extensionJsonData.secondRun = true;
		SaveExtensionJson()
		UpdateWorkspace();
		return;
	}
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

	//VS Code will restart if another workspace is active.
	await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFilePath), false);
}

async function DeleteProjectFromWorkspace(projectName: string) {
	if (!fs.existsSync(workspaceFilePath)) {
		vscode.window.showWarningMessage('Workspace file does not exist.');
		return;
	}

	const jsonString = fs.readFileSync(workspaceFilePath, 'utf-8');
	const jsonData = JSON.parse(jsonString);
	// Check if the project exists in the workspace folders
	const projectIndex = jsonData.folders.findIndex((folder: { path: string }) =>
		folder.path.includes(glistappsPath) && folder.path.endsWith(`${projectName}`)
	);
	if (projectIndex === -1) {
		return;
	}
	jsonData.folders = jsonData.folders.filter((folder: { path: string }) =>
		!(folder.path.includes(glistappsPath) && folder.path.endsWith(`${projectName}`))
	);

	await fs.writeFile(workspaceFilePath, JSON.stringify(jsonData, null, 2));
	vscode.window.showInformationMessage(`Deleted project '${projectName}' from workspace.`);
}

async function UpdateWorkspace() {
	if (!CheckWorkspace()) return;
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
	extensionJsonData.firstRun = true;
	extensionJsonData.secondRun = true;
	SaveExtensionJson()
	fs.rmSync(path.join(extensionPath, 'GlistApp'), { recursive: true, force: true });
	vscode.commands.executeCommand('workbench.action.reloadWindow');
}

async function InstallGlistEngine() {
	extensionJsonData.installGlistEngine = true;
	SaveExtensionJson()
	if (await updateVSCodeSettings()) return;
	extensionJsonData.installGlistEngine = false;
	SaveExtensionJson()
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

async function InstallEngine() {
	vscode.window.showInformationMessage("Installing Engine (~8MB)");

	const zipFilePath = path.join(tempPath, 'GlistEngine.zip');
	await DownloadFile(glistEngineUrl, zipFilePath);
	await fs.remove(path.join(glistPath, "GlistEngine"));
	ExtractArchive(zipFilePath, glistPath, "Engine Installed.");
	await fs.rename(path.join(glistPath, 'GlistEngine-main'), path.join(glistPath, 'GlistEngine'));
}

async function InstallCmake() {
	vscode.window.showInformationMessage("Installing Cmake (~35MB)");

	const zipFilePath = path.join(tempPath, 'CMake.zip');
	await DownloadFile(glistCmakeUrl, zipFilePath);
	await fs.remove(path.join(glistZbinPath, 'CMake'));
	ExtractArchive(zipFilePath, glistZbinPath, "CMake Binaries Installed.");
}

async function InstallClang() {
	vscode.window.showInformationMessage("Installing Clang Binaries (~400MB)");

	const zipFilePath = path.join(tempPath, 'clang64.zip');
	await DownloadFile(glistClangUrl, zipFilePath);
	await fs.remove(path.join(glistZbinPath, 'clang64'));
	ExtractArchive(zipFilePath, glistZbinPath, "Clang Binaries Installed.");
}

function arraysUnion(a: any[], b: any[]) {
	const set = new Set(a);
	for (const item of b) {
		set.add(item);
	}
	return Array.from(set);
}

async function updateVSCodeSettings(): Promise<boolean> {
	const vscodeSettingsPath = path.join(
		process.env.HOME || process.env.USERPROFILE || '',
		'AppData/Roaming/Code/User/settings.json' // This path might differ based on OS and VS Code distribution
	);
	let settings: any;
	const newSettings = {
		"extensions.ignoreRecommendations": true,
		/*"cmake.options.statusBarVisibility": "visible",
		"cmake.showOptionsMovedNotification": false,
		"cmake.configureOnOpen": true,*/
		"security.workspace.trust.enabled": false,
		"security.workspace.trust.banner": "never",
		"security.workspace.trust.untrustedFiles": "open",
		"security.workspace.trust.startupPrompt": "never",
		"C_Cpp.default.compilerPath": currentDrive.at(0) + ":\\dev\\glist\\zbin\\glistzbin-win64\\clang64\\bin\\clang++.exe",
		"C_Cpp.default.includePath": [
			"${workspaceFolder}/**",
			"${workspaceFolder}/../../glistplugins/**",
			"${workspaceFolder}/../../GlistEngine/**",
			"${workspaceFolder}/../../zbin/glistzbin-win64/clang64/include/**"
		],
		"terminal.integrated.env.windows": {
			"Path": "C:/dev/glist/zbin/glistzbin-win64/CMake/bin"
		}
	};
	try {
		if (fs.existsSync(vscodeSettingsPath)) {
			const fileContent = await fs.readFile(vscodeSettingsPath, 'utf-8');
			settings = json5.parse(fileContent);
		}
		else {
			await fs.writeFile(vscodeSettingsPath, JSON.stringify(newSettings, null, 2));
			vscode.commands.executeCommand('workbench.action.reloadWindow');
			return true;
		}

		let isChanged = false;

		// Add or update settings
		for (const [key, value] of Object.entries(newSettings)) {
			if (Array.isArray(value)) {
				const currentArray = settings[key] || [];
				const updatedArray = arraysUnion(currentArray, value);
				if (currentArray.length !== updatedArray.length) {
					settings[key] = updatedArray;
					isChanged = true;
				}
			} else if (typeof value === 'object' && value !== null) {
				// Check for nested objects (e.g., terminal.integrated.env.windows)
				settings[key] = settings[key] || {};
				for (const [subKey, subValue] of Object.entries(value)) {
					if (!settings[key][subKey] || !settings[key][subKey].includes(subValue)) {
						settings[key][subKey] = settings[key][subKey] ? settings[key][subKey] + ';' + subValue : subValue;
						isChanged = true;
					}
				}
			} else {
				if (settings[key] !== value) {
					settings[key] = value;
					isChanged = true;
				}
			}
		}
		if (isChanged) {
			await fs.writeFile(vscodeSettingsPath, JSON.stringify(settings, null, 2));
			vscode.commands.executeCommand('workbench.action.reloadWindow');
		}
		return isChanged;
	} catch (err) {
		console.error('Error while updating VS Code settings:', err);
		return true;
	}
}

function ReplaceText(inputFilePath: string, searchText: string, replaceText: string) {
	let data = fs.readFileSync(inputFilePath, 'utf8')
	const result = data.replace(new RegExp(searchText, 'g'), replaceText);
	fs.writeFileSync(inputFilePath, result, 'utf8');
}

function AddFileToCMakeLists(projectPath: string, newFileName: string) {
	const cmakeListsPath = path.join(projectPath, 'CMakeLists.txt');

	let data = fs.readFileSync(cmakeListsPath, 'utf8');

	// Add new file to GlistApp_SOURCES
	const sourcesPattern = /set\(GlistApp_SOURCES\s*\n([^)]*)\)/;
	const sourcesMatch = data.match(sourcesPattern);
	if (sourcesMatch && sourcesMatch[1]) {
		const sources = sourcesMatch[1];
		const newSources = sources.trim() + "\n\t${APP_DIR}" + `/src/${newFileName}.cpp`;
		data = data.replace(sourcesPattern, `set(GlistApp_SOURCES\n${newSources}\n)`);
	}

	// Add new file to GlistApp_HEADERS
	const headersPattern = /set\(GlistApp_HEADERS\s*\n([^)]*)\)/;
	const headersMatch = data.match(headersPattern);
	if (headersMatch && headersMatch[1]) {
		const headers = headersMatch[1];
		const newHeaders = headers.trim() + "\n\t${APP_DIR}" + `/src/${newFileName}.h`;
		data = data.replace(headersPattern, `set(GlistApp_HEADERS\n${newHeaders}\n)`);
	}

	fs.writeFileSync(cmakeListsPath, data, 'utf8');
}


async function createEmptyProject() {
	vscode.window.showInformationMessage("Creating Empty Project");
	CreateNewProject("GlistApp");
}

async function createDirectories() {
	await fs.ensureDir(glistappsPath);
	await fs.ensureDir(glistpluginsPath);
	await fs.remove(tempPath);
	await fs.ensureDir(tempPath);
}

async function CloseNonExistentFileTabs() {
	const visibleWindows = vscode.window.tabGroups.activeTabGroup.tabs;
	try {
		for (const visibleWindow of visibleWindows) {
			const filePath = JSON.parse(JSON.stringify(visibleWindow.input, null, 2));
			if (fs.existsSync(filePath.uri.fsPath)) continue;
			await vscode.window.showTextDocument(filePath, { preview: false });
		}
	}
	catch (err) {
		console.log(err);
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		CloseNonExistentFileTabs();
	}
}

async function DeleteFolder(folderPath: string): Promise<void> {
	await rimraf(folderPath);
	console.log(`Folder ${folderPath} deleted successfully.`);
}

async function DeleteProject() {
	if (!CheckWorkspace()) return;
	let projectName = await vscode.window.showInputBox({
		placeHolder: "Enter the name of Project you want to delete"
	});
	if (checkInput(projectName)) return;
	projectName = projectName + "";
	if (checkPath(path.join(glistappsPath, projectName), "A project named " + projectName + " does not exist!")) return;

	let decision = await vscode.window.showInputBox({
		placeHolder: 'Are you sure about deleting this project? Type "yes" to continue.'
	});
	if (!(decision?.toLowerCase() == "yes")) {
		vscode.window.showErrorMessage("Deleting Project Cancelled!");
		return;
	}
	await DeleteProjectFromWorkspace(projectName)
	DeleteFolder(path.join(glistappsPath, projectName));
	extensionJsonData.deleteFolder = path.join(glistappsPath, projectName);
	fs.writeFile(extensionDataFilePath, JSON.stringify(extensionJsonData, null, 2));
	vscode.commands.executeCommand('workbench.action.reloadWindow');
}

function checkInput(name: any, message: string = "No input provided."): Boolean {
	if (!name) {
		vscode.window.showErrorMessage(message);
		return true;
	}
	return false;
}

function checkPath(inputPath: any, message: any = undefined, errorMessageIfNotExist = true) {
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

async function AddClassToProject(baseFilePath: string, fileBaseName: string) {
	if (!CheckWorkspace()) return;
	let projectName = await vscode.window.showInputBox({
		placeHolder: "Enter the name of project you want to create new class"
	});
	if (!projectName) {
		vscode.window.showErrorMessage("No input provided.");
		return;
	}
	if (checkPath(path.join(glistappsPath, projectName), "A project named " + projectName + " does not exist!")) return;

	let className = await vscode.window.showInputBox({
		placeHolder: "Enter the name of canvas you want to create"
	});
	if (checkInput(className)) return;
	className = className + "";
	if (checkPath(path.join(glistappsPath, projectName, "src", className + ".h"), "A class named " + className + " already exist!", false)) return;
	if (checkPath(path.join(glistappsPath, projectName, "src", className + ".cpp"), "A class named " + className + " already exist!", false)) return;

	fs.copyFileSync(path.join(baseFilePath, fileBaseName + ".h"), path.join(glistappsPath, projectName, "src", className + ".h"));
	fs.copyFileSync(path.join(baseFilePath, fileBaseName + ".cpp"), path.join(glistappsPath, projectName, "src", className + ".cpp"));
	ReplaceText(path.join(glistappsPath, projectName, "src", className + ".h"), fileBaseName, className);
	ReplaceText(path.join(glistappsPath, projectName, "src", className + ".cpp"), fileBaseName, className);
	ReplaceText(path.join(glistappsPath, projectName, "src", className + ".h"), fileBaseName.toUpperCase() + "_H_", className.toUpperCase() + "_H_");
	AddFileToCMakeLists(path.join(glistappsPath, projectName), className);

	const filesToOpen = [
		path.join(glistappsPath, projectName, 'src', className + ".h"),
		path.join(glistappsPath, projectName, 'src', className + ".cpp")
	];

	filesToOpen.forEach(async file => {
		const uri = vscode.Uri.file(file);
		const document = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(document, { preview: false });
	});
}

function SaveExtensionJson() {
	fs.writeFileSync(extensionDataFilePath, JSON.stringify(extensionJsonData, null, 2));
}

async function FirstRunWorker() {
	CheckJsonFile();
	if (extensionJsonData.deleteFolder) {
		await DeleteFolder(extensionJsonData.deleteFolder);
		extensionJsonData.deleteFolder = undefined;
		SaveExtensionJson()
		vscode.window.showInformationMessage("Project Deleted.");
	}
	if (CheckWorkspace(false)) await CloseNonExistentFileTabs();
	if (extensionJsonData.installGlistEngine) {
		extensionJsonData.installGlistEngine = false;
		SaveExtensionJson()
		await InstallGlistEngine();
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
		await CreateWorkspace();
	}
	else if (extensionJsonData.secondRun) {
		await OpenFiles();
	}
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
	await DownloadFile(glistAppUrl, zipFilePath);
	ExtractArchive(zipFilePath, extensionPath, "");
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

async function CreateWorkspace() {
	try {
		// Do not create workspace and stop setup process if glistapps does not exist (Also Meaning Glist Engine is not installed.)
		if (!fs.existsSync(glistappsPath)) {
			extensionJsonData.firstRun = false;
			extensionJsonData.secondRun = false;
			SaveExtensionJson()
			return;
		}
		await updateVSCodeSettings();
		// Install ninja if does not exist
		fs.ensureDirSync(path.join(glistZbinPath, "CMake"));
		const ninjaPath = path.join(glistZbinPath, "CMake", "bin", "ninja.zip");
		if (!fs.existsSync(path.join(glistZbinPath, "CMake", "bin", "ninja.exe"))) {
			vscode.window.showInformationMessage("Ninja not found. Installing...");
			await DownloadFile(ninjaUrl, ninjaPath);
			ExtractArchive(ninjaPath, path.join(glistZbinPath, "CMake", "bin"), "");
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
		extensionJsonData.firstRun = false;
		SaveExtensionJson()

		// Opens the new workspace. Setup cannot continue after here because vscode restarts. For resuming setup, there is a secondary setup run.
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFilePath), false);
		// If workspace was already opened before, vscode will not restart so setup can continue.
		if (CheckWorkspace(false)) await OpenFiles();
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

	extensionJsonData.secondRun = false;
	SaveExtensionJson()
}

function getSubfolders(directory: string): string[] {
	return fs.readdirSync(directory)
		.filter(file => fs.statSync(path.join(directory, file)).isDirectory())
		.map(folder => path.join(directory, folder));
}

export function deactivate() { }