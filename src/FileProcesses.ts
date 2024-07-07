import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import AdmZip from 'adm-zip';
import axios from 'axios';
import json5 from 'json5'
import { rimraf, rimrafSync } from 'rimraf';
import * as extension from './extension';
import * as globals from './globals';


export async function UpdateVSCodeSettings(): Promise<boolean> {
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
		"C_Cpp.debugShortcut": false,
		"C_Cpp.default.compilerPath": globals.currentDrive.at(0) + ":\\dev\\glist\\zbin\\glistzbin-win64\\clang64\\bin\\clang++.exe",
		"C_Cpp.default.includePath": [
			"${workspaceFolder}/**",
			"${workspaceFolder}/../../glistplugins/**",
			"${workspaceFolder}/../../GlistEngine/**",
			"${workspaceFolder}/../../zbin/glistzbin-win64/clang64/include/**"
		],
		"terminal.integrated.env.windows": {
			"Path": "${env:PATH};C:/dev/glist/zbin/glistzbin-win64/CMake/bin"
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


export async function DownloadFile(url: string, dest: string) {
	const response = await axios({
		method: 'GET',
		url: url,
		responseType: 'arraybuffer',
		maxRedirects: 5,
	});

	// Pipe the stream to the destination file
	fs.writeFileSync(dest, response.data);
}

export function SaveExtensionJson() {
	fs.writeFileSync(extension.extensionDataFilePath, JSON.stringify(extension.extensionJsonData, null, 2));
}

export function ExtractArchive(zipPath: string, dest: string, message: string) {
	const zip = new AdmZip(zipPath);
	zip.extractAllTo(dest, true);
	vscode.window.showInformationMessage(message);
}

export function getSubfolders(directory: string): string[] {
	return fs.readdirSync(directory)
		.filter(file => fs.statSync(path.join(directory, file)).isDirectory())
		.map(folder => path.join(directory, folder));
}

export async function DeleteFolder(folderPath: string) {
	await rimraf(folderPath);
	console.log(`Folder ${folderPath} deleted successfully.`);
}

function arraysUnion(a: any[], b: any[]) {
	const set = new Set(a);
	for (const item of b) {
		set.add(item);
	}
	return Array.from(set);
}