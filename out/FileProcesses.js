"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteFolder = exports.getSubfolders = exports.ExtractArchive = exports.SaveExtensionJson = exports.DownloadFile = exports.RemoveFileFromCMakeLists = exports.AddFileToCMakeLists = exports.ReplaceText = exports.UpdateVSCodeSettings = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const axios_1 = __importDefault(require("axios"));
const json5_1 = __importDefault(require("json5"));
const rimraf_1 = require("rimraf");
const extension = __importStar(require("./extension"));
const globals = __importStar(require("./globals"));
async function UpdateVSCodeSettings() {
    const vscodeSettingsPath = path.join(process.env.HOME || process.env.USERPROFILE || '', 'AppData/Roaming/Code/User/settings.json' // This path might differ based on OS and VS Code distribution
    );
    let settings;
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
            settings = json5_1.default.parse(fileContent);
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
            }
            else if (typeof value === 'object' && value !== null) {
                // Check for nested objects (e.g., terminal.integrated.env.windows)
                settings[key] = settings[key] || {};
                for (const [subKey, subValue] of Object.entries(value)) {
                    if (!settings[key][subKey] || !settings[key][subKey].includes(subValue)) {
                        settings[key][subKey] = settings[key][subKey] ? settings[key][subKey] + ';' + subValue : subValue;
                        isChanged = true;
                    }
                }
            }
            else {
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
    }
    catch (err) {
        console.error('Error while updating VS Code settings:', err);
        return true;
    }
}
exports.UpdateVSCodeSettings = UpdateVSCodeSettings;
function ReplaceText(inputFilePath, searchText, replaceText) {
    let data = fs.readFileSync(inputFilePath, 'utf8');
    const result = data.replace(new RegExp(searchText, 'g'), replaceText);
    fs.writeFileSync(inputFilePath, result, 'utf8');
}
exports.ReplaceText = ReplaceText;
function AddFileToCMakeLists(projectPath, newFileName) {
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
exports.AddFileToCMakeLists = AddFileToCMakeLists;
function RemoveFileFromCMakeLists(projectPath, fileName) {
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
    (0, rimraf_1.rimrafSync)(cppFilePath);
    (0, rimraf_1.rimrafSync)(hFilePath);
}
exports.RemoveFileFromCMakeLists = RemoveFileFromCMakeLists;
async function DownloadFile(url, dest) {
    const response = await (0, axios_1.default)({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        maxRedirects: 5,
    });
    // Pipe the stream to the destination file
    fs.writeFileSync(dest, response.data);
}
exports.DownloadFile = DownloadFile;
function SaveExtensionJson() {
    fs.writeFileSync(extension.extensionDataFilePath, JSON.stringify(extension.extensionJsonData, null, 2));
}
exports.SaveExtensionJson = SaveExtensionJson;
function ExtractArchive(zipPath, dest, message) {
    const zip = new adm_zip_1.default(zipPath);
    zip.extractAllTo(dest, true);
    vscode.window.showInformationMessage(message);
}
exports.ExtractArchive = ExtractArchive;
function getSubfolders(directory) {
    return fs.readdirSync(directory)
        .filter(file => fs.statSync(path.join(directory, file)).isDirectory())
        .map(folder => path.join(directory, folder));
}
exports.getSubfolders = getSubfolders;
async function DeleteFolder(folderPath) {
    await (0, rimraf_1.rimraf)(folderPath);
    console.log(`Folder ${folderPath} deleted successfully.`);
}
exports.DeleteFolder = DeleteFolder;
function arraysUnion(a, b) {
    const set = new Set(a);
    for (const item of b) {
        set.add(item);
    }
    return Array.from(set);
}
//# sourceMappingURL=FileProcesses.js.map