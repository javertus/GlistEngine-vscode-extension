import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
const AdmZip = require('adm-zip');
import axios from 'axios';



const myglistappsPath = 'c:\\dev\\glist\\myglistapps\\';
const glistEnginePath = 'c:\\dev\\glist\\GlistEngine\\engine';
const workspaceFilePath = 'c:\\dev\\glist\\Glist.code-workspace';
const glistAppUrl = 'https://github.com/javertus/GlistApp-vscode/archive/refs/heads/main.zip';

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
	extensionPath = context.extensionPath;
    extensionDataFilePath = path.join(extensionPath, 'ExtensionData.json');
	FirstRunWorker();	
}

async function CreateGlistApp() {
	const projectName = await vscode.window.showInputBox({
		placeHolder: "Enter the name of new GlistApp"
	});

	if (!projectName) {
		vscode.window.showErrorMessage("No input provided.");
		return;
	}
	if(fs.existsSync(path.join(myglistappsPath, projectName))) {
		vscode.window.showErrorMessage("A folder named " + projectName + " already exist.");
		return;
	}

	fs.cpSync(path.join(extensionPath, 'GlistApp'), path.join(myglistappsPath, projectName), {recursive: true});

	await AddNewProjectToWorkspace(projectName);

    const filesToOpen = [
        path.join(myglistappsPath, projectName, 'src', 'gCanvas.h'),
        path.join(myglistappsPath, projectName, 'src', 'gCanvas.cpp')
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
    jsonData.folders.push({ path: path.join(myglistappsPath, projectName) });
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
		getSubfolders(myglistappsPath).map(folder => {
			if(fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
				workspaceFolders.push(folder)
				if(!fs.existsSync(path.join(folder, ".vscode"))) {
					vscode.window.showInformationMessage("Launch configurations are not found for project named " + path.basename(folder) + ". Creating launch configurations...");
					fs.cpSync(path.join(extensionPath, 'GlistApp', '.vscode'), path.join(folder, '.vscode'), {recursive: true});
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
	if(fs.existsSync(workspaceFilePath)) {
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFilePath), false);
	}
	else {
		UpdateWorkspace();
	}
}

function ResetExtension() {
	jsonParsedData.firstRun = true;
	jsonParsedData.secondRun = true;
	fs.writeFileSync(extensionDataFilePath, JSON.stringify(jsonParsedData, null, 2));
	fs.rmSync(path.join(extensionPath, 'GlistApp'), { recursive: true, force: true });
}

async function FirstRunWorker() {
	CheckJsonFile();
	if(jsonParsedData.firstRun) {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			cancellable: false,
			title: 'Installing required extensions for Glist Engine. Please wait...'
		}, async (progress) => {
			progress.report({  increment: 0 });

			DownloadAndExtractZip(glistAppUrl, extensionPath);
			await InstallExtensions(progress);
			await CreateWorkspace();
		});
	}
	else if(jsonParsedData.secondRun) {
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

async function DownloadAndExtractZip(url: string, outputDir: string) {
	const zipFilePath = path.join(outputDir, 'temp.zip');
	try {
		// Ensure the output directory exists
		if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
		}
  
		// Download the zip file
		const response = await axios({
		url,
		method: 'GET',
		responseType: 'arraybuffer',
		});

		// Save the zip file to the output directory
		fs.writeFileSync(zipFilePath, response.data);

		// Extract the zip file
		const zip = new AdmZip(zipFilePath);
		zip.extractAllTo(outputDir, true);

		// Clean up the temporary zip file
		fs.unlinkSync(zipFilePath);

		//Rename the extracted file
		fs.renameSync(path.join(outputDir, 'GlistApp-vscode-main'), path.join(outputDir, 'GlistApp'));

		console.log('Download and extraction complete.');
	} catch (error) {
	  console.error('An error occurred:', error);
	}
}

// Installs the required extensions
async function InstallExtensions(progress: any) {
	console.log('Installing Extensions...');
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
			if(extension) {
				progress.report({ increment: incrementValue * (i + 1)})
			}
			else {
				await vscode.commands.executeCommand('workbench.extensions.installExtension', extensionsToInstall[i]);
				progress.report({ increment: incrementValue * (i + 1)})
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
		let workspaceFolders = [];
		getSubfolders(myglistappsPath).map(folder => {
			if(fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
				workspaceFolders.push(folder)
				if(!fs.existsSync(path.join(folder, ".vscode"))) {
					vscode.window.showErrorMessage("Launch configurations are not found for project at " + folder + ". Creating launch configurations...");
					fs.cpSync(path.join(extensionPath, 'GlistApp', '.vscode'), path.join(folder, '.vscode'), {recursive: true});
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

export function deactivate() {}