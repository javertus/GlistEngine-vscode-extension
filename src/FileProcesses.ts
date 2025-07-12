import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import AdmZip from 'adm-zip';
import axios from 'axios';
import json5 from 'json5'
import { execSync } from 'child_process';
import * as WorkspaceProcesses from './WorkspaceProcesses'
import { rimraf, rimrafSync } from 'rimraf';
import * as extension from './extension';
import * as globals from './globals';


export async function UpdateVSCodeSettings(): Promise<boolean> {
	let settings: any;
	try {
		if (fs.existsSync(globals.vscodeSettingsPath)) {
			const fileContent = await fs.readFile(globals.vscodeSettingsPath, 'utf-8');
			settings = json5.parse(fileContent);
		}
		else {
			fs.writeFileSync(globals.vscodeSettingsPath, JSON.stringify(globals.vscodeSettings, null, 2));
			WorkspaceProcesses.ReloadWorkspace();
			return true;
		}

		let isReloadRequired = false;

		// Add or update settings
		for (const [key, value] of Object.entries(globals.vscodeSettings)) {
			if (Array.isArray(value)) {
				const currentArray = settings[key] || [];
				const updatedArray = ArraysUnion(currentArray, value);
				if (currentArray.length !== updatedArray.length) {
					settings[key] = updatedArray;
				}
			} else if (typeof value === 'object' && value !== null) {
				// Check for nested objects (e.g., terminal.integrated.env.windows)
				settings[key] = settings[key] || {};
				for (const [subKey, subValue] of Object.entries(value)) {
					if (!settings[key][subKey] || !settings[key][subKey].includes(subValue)) {
						settings[key][subKey] = settings[key][subKey] ? settings[key][subKey] + ';' + subValue : subValue;
					}
				}
			} else {
				if (settings[key] !== value) {
					settings[key] = value;
					if (key == "security.workspace.trust.enabled") isReloadRequired = true;
				}
			}
		}
		fs.writeFileSync(globals.vscodeSettingsPath, JSON.stringify(settings, null, 2));
		if (isReloadRequired) {
			WorkspaceProcesses.ReloadWorkspace();
		}
		return isReloadRequired;
	} catch (err) {
		console.error('Error while updating VS Code settings:', err);
		return true;
	}
}

export function ReplaceText(inputFilePath: string, searchText: string, replaceText: string) {
	let data = fs.readFileSync(inputFilePath, 'utf8')
	const result = data.replace(new RegExp(searchText, 'g'), replaceText);
	fs.writeFileSync(inputFilePath, result, 'utf8');
}

export function AddFileToCMakeLists(projectPath: string, newFileName: string) {
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

export function RemoveFileFromCMakeLists(projectPath: string, fileName: string) {
	const cmakeListsPath = path.join(projectPath, 'CMakeLists.txt');

	let data = fs.readFileSync(cmakeListsPath, 'utf8');

	// Remove file from GlistApp_SOURCES
	const sourcesPattern = /set\(GlistApp_SOURCES\s*\n([^\)]*)\)/;
	const sourcesMatch = data.match(sourcesPattern);
	if (sourcesMatch && sourcesMatch[1]) {
		const sources = sourcesMatch[1];
		const newSources = sources
			.split('\n')
			.filter(line => !line.includes(`src/${fileName}.cpp`))
			.join('\n');
		data = data.replace(sourcesPattern, `set(GlistApp_SOURCES\n${newSources}\n)`);
	}

	// Remove file from GlistApp_HEADERS
	const headersPattern = /set\(GlistApp_HEADERS\s*\n([^\)]*)\)/;
	const headersMatch = data.match(headersPattern);
	if (headersMatch && headersMatch[1]) {
		const headers = headersMatch[1];
		const newHeaders = headers
			.split('\n')
			.filter(line => !line.includes(`src/${fileName}.h`))
			.join('\n');
		data = data.replace(headersPattern, `set(GlistApp_HEADERS\n${newHeaders}\n)`);
	}

	fs.writeFileSync(cmakeListsPath, data, 'utf8');

	// Delete the .cpp and .h files
	const cppFilePath = path.join(projectPath, 'src', `${fileName}.cpp`);
	const hFilePath = path.join(projectPath, 'src', `${fileName}.h`);
	rimrafSync(cppFilePath);
	rimrafSync(hFilePath);
}


export async function DownloadFile(url: string, dest: string, message: string) {
	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: message,
		cancellable: false
	}, async (progress) => {
		let lastIncrementVal = 0;
		const response = await axios({
			method: 'GET',
			url: url,
			responseType: 'arraybuffer',
			maxRedirects: 5,
			onDownloadProgress: (progressEvent) => {
				if (!message) return;
				if (progressEvent.lengthComputable) {
					if (!progressEvent.total) return;
					const percentage = (progressEvent.loaded / progressEvent.total) * 100;
					progress.report({ message: ` ${percentage.toFixed(2)}%`, increment: percentage - lastIncrementVal });
					lastIncrementVal = percentage;
				} else {
					progress.report({ message: `Downloaded ${(progressEvent.loaded / (1024 * 1024)).toFixed(2)}MB` });
				}
			}
		});

		fs.writeFileSync(dest, response.data);
	});
}

export function SaveExtensionJson() {
	fs.writeFileSync(extension.dataFilePath, JSON.stringify(extension.jsonData, null, 2));
}

export function ExtractArchive(zipPath: string, dest: string, message: string) {
	const zip = new AdmZip(zipPath);
	zip.extractAllTo(dest, true);
	vscode.window.showInformationMessage(message);
}

export function GetSubfolders(directory: string): string[] {
	return fs.readdirSync(directory)
		.filter(file => fs.statSync(path.join(directory, file)).isDirectory())
		.map(folder => path.join(directory, folder));
}

export async function DeleteFolder(folderPath: string) {
	await rimraf(folderPath);
	console.log(`Folder ${folderPath} deleted successfully.`);
}

function ArraysUnion(a: any[], b: any[]) {
	const set = new Set(a);
	for (const item of b) {
		set.add(item);
	}
	return Array.from(set);
}

function GetDisks(): string[] {
	let disks: string[] = [];
	const result = execSync('wmic logicaldisk get name').toString();
	disks = result.split('\n').map(line => line.trim()).filter(line => line && line !== 'Name');
	return disks;
}

function CheckDirectoryOnDisks(dirName: string): string[] {
	const disks = GetDisks();
	const foundDisks: string[] = [];

	disks.forEach(disk => {
		const fullPath = path.join(disk, dirName);
		if (fs.existsSync(fullPath)) {
			foundDisks.push(disk);
		}
	});

	return foundDisks;
}

export function GetGlistDrive() {
	const foundDisks = CheckDirectoryOnDisks('dev\\glist');
	let disk = vscode.workspace.getConfiguration('glistengine').get<string>('glist.disk');
	if (disk) return disk;
	if (foundDisks.length == 0) {
		vscode.window.showWarningMessage(`Glist Engine not found in any disks! Setting glist disk as: ${GetDisks()[0]} You can change the disk from Visual Studio Code settings.`)
		vscode.workspace.getConfiguration('glistengine').update("glist.disk", GetDisks()[0], 1);
		return GetDisks()[0];
	}
	else if (foundDisks.length == 1) {
		return foundDisks[0];
	}
	else {
		vscode.window.showWarningMessage(`More than one glist installations are found! Setting current glist disk as: ${foundDisks[0]} You can change the disk from Visual Studio Code settings.`)
		vscode.workspace.getConfiguration('glistengine').update("glist.disk", foundDisks[0], 1);
		return foundDisks[0];
	}
}
