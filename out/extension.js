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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const axios_1 = __importDefault(require("axios"));
const json5_1 = __importDefault(require("json5"));
const child_process_1 = require("child_process");
const rimraf_1 = require("rimraf");
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
let extensionJsonData;
let extensionPath;
let extensionDataFilePath;
function activate(context) {
    vscode.commands.registerCommand('glist-extension.create-glistapp', async () => {
        await CreateNewProject();
    });
    vscode.commands.registerCommand('glist-extension.workspace-update', async () => {
        await UpdateWorkspace();
    });
    vscode.commands.registerCommand('glist-extension.openWorkspace', async () => {
        await LaunchWorkspace();
    });
    vscode.commands.registerCommand('glist-extension.reset', async () => {
        ResetExtension();
    });
    vscode.commands.registerCommand('glist-extension.installglistengine', async () => {
        extensionJsonData.installGlistEngine = true;
        SaveExtensionJson();
        if (await updateVSCodeSettings())
            return;
        extensionJsonData.installGlistEngine = false;
        SaveExtensionJson();
        await InstallGlistEngine();
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
    extensionPath = context.extensionPath;
    extensionDataFilePath = path.join(extensionPath, 'ExtensionData.json');
    FirstRunWorker();
}
exports.activate = activate;
async function CreateNewProject(projectName = undefined) {
    if (projectName == undefined) {
        projectName = await vscode.window.showInputBox({
            placeHolder: "Enter the name of new Project"
        });
    }
    if (checkInput(projectName))
        return;
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
    filesToOpen.forEach(async (file) => {
        const uri = vscode.Uri.file(file);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, { preview: false });
    });
}
async function AddNewProjectToWorkspace(projectName) {
    // Read the JSON file
    if (!fs.existsSync(workspaceFilePath)) {
        extensionJsonData.firstRun = false;
        extensionJsonData.secondRun = true;
        SaveExtensionJson();
        UpdateWorkspace();
        return;
    }
    const jsonString = fs.readFileSync(workspaceFilePath, 'utf-8');
    const jsonData = JSON.parse(jsonString);
    // Extract the engine path if it exists
    const enginePath = jsonData.folders.find((folder) => folder.path.includes('GlistEngine'));
    jsonData.folders = jsonData.folders.filter((folder) => !folder.path.includes('GlistEngine'));
    // Add the new path and sort the folders array alphabetically by path
    jsonData.folders.push({ path: path.join(glistappsPath, projectName) });
    jsonData.folders.sort((a, b) => a.path.localeCompare(b.path));
    // Re-add the engine path at the end if it was found
    if (enginePath) {
        jsonData.folders.push(enginePath);
    }
    // Convert the updated data back to JSON format and write it to the file
    fs.writeFileSync(workspaceFilePath, JSON.stringify(jsonData, null, 2));
    //VS Code will restart if another workspace is active.
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFilePath), false);
}
async function DeleteProjectFromWorkspace(projectName) {
    if (!fs.existsSync(workspaceFilePath)) {
        vscode.window.showWarningMessage('Workspace file does not exist.');
        return false;
    }
    const jsonString = fs.readFileSync(workspaceFilePath, 'utf-8');
    const jsonData = JSON.parse(jsonString);
    // Check if the project exists in the workspace folders
    const projectIndex = jsonData.folders.findIndex((folder) => folder.path.includes(glistappsPath) && folder.path.endsWith(`${projectName}`));
    if (projectIndex === -1) {
        return true;
    }
    jsonData.folders = jsonData.folders.filter((folder) => !(folder.path.includes(glistappsPath) && folder.path.endsWith(`${projectName}`)));
    await fs.writeFile(workspaceFilePath, JSON.stringify(jsonData, null, 2));
    vscode.window.showInformationMessage(`Deleted project '${projectName}' from workspace.`);
    return true;
}
async function UpdateWorkspace() {
    try {
        let workspaceFolders = [];
        getSubfolders(glistappsPath).map(folder => {
            if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
                workspaceFolders.push(folder);
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
    }
    catch (error) {
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
    SaveExtensionJson();
    fs.rmSync(path.join(extensionPath, 'GlistApp'), { recursive: true, force: true });
    vscode.commands.executeCommand('workbench.action.reloadWindow');
}
async function InstallGlistEngine() {
    const result = await vscode.window.showInformationMessage('This action will install the Glist Engine and its dependencies. Current Glist Engine installation in /glist folder will be modified if exist. Your projects and plugins will not affected. Do you want to continue?', { modal: true }, 'Yes', 'No');
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
            AddPathToSystemEnvironment(path.join(glistZbinPath, "CMake", "bin"));
            await InstallClang();
            progress.report({ increment: 20 });
            await createEmptyProject();
            progress.report({ increment: 20 });
            vscode.window.showInformationMessage("Glist Engine Installed Successfully.");
        });
    }
}
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
function ExtractArchive(zipPath, dest, message) {
    const zip = new adm_zip_1.default(zipPath);
    zip.extractAllTo(dest, true);
    vscode.window.showInformationMessage(message);
}
async function InstallEngine() {
    vscode.window.showInformationMessage("Installing Engine ~8MB");
    const zipFilePath = path.join(tempPath, 'GlistEngine.zip');
    await DownloadFile(glistEngineUrl, zipFilePath);
    await fs.remove(path.join(glistPath, "GlistEngine"));
    ExtractArchive(zipFilePath, glistPath, "Engine Installed.");
    await fs.rename(path.join(glistPath, 'GlistEngine-main'), path.join(glistPath, 'GlistEngine'));
}
async function InstallCmake() {
    vscode.window.showInformationMessage("Installing Cmake ~35MB");
    const zipFilePath = path.join(tempPath, 'CMake.zip');
    await DownloadFile(glistCmakeUrl, zipFilePath);
    await fs.remove(path.join(glistZbinPath, 'CMake'));
    ExtractArchive(zipFilePath, glistZbinPath, "CMake Binaries Installed.");
}
async function InstallClang() {
    vscode.window.showInformationMessage("Installing Clang Binaries ~400MB");
    const zipFilePath = path.join(tempPath, 'clang64.zip');
    await DownloadFile(glistClangUrl, zipFilePath);
    await fs.remove(path.join(glistZbinPath, 'clang64'));
    ExtractArchive(zipFilePath, glistZbinPath, "Clang Binaries Installed.");
}
function AddPathToSystemEnvironment(newPath) {
    const command = `powershell.exe -Command "[Environment]::GetEnvironmentVariable('Path', 'User')"`;
    //Removing the last index because it's space 
    let currentPath = (0, child_process_1.execSync)(command, { encoding: 'utf-8' }).replace(/\n/g, '').slice(0, -1);
    if (currentPath.endsWith(';'))
        currentPath = currentPath.slice(0, -1);
    if (!currentPath.includes(newPath)) {
        const psCommand = `powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${currentPath};${newPath}', [EnvironmentVariableTarget]::User)"`;
        (0, child_process_1.execSync)(psCommand);
    }
}
async function updateVSCodeSettings() {
    const vscodeSettingsPath = path.join(process.env.HOME || process.env.USERPROFILE || '', 'AppData/Roaming/Code/User/settings.json' // This path might differ based on OS and VS Code distribution
    );
    let settings;
    const newSettings = {
        "extensions.ignoreRecommendations": true,
        "cmake.options.statusBarVisibility": "visible",
        "cmake.showOptionsMovedNotification": false,
        "cmake.configureOnOpen": true,
        "security.workspace.trust.enabled": false,
        "security.workspace.trust.banner": "never",
        "security.workspace.trust.untrustedFiles": "open",
        "security.workspace.trust.startupPrompt": "never",
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
            if (settings[key] !== value) {
                settings[key] = value;
                isChanged = true;
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
function ReplaceText(inputFilePath, searchText, replaceText) {
    let data = fs.readFileSync(inputFilePath, 'utf8');
    const result = data.replace(new RegExp(searchText, 'g'), replaceText);
    fs.writeFileSync(inputFilePath, result, 'utf8');
}
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
            if (fs.existsSync(filePath.uri.fsPath))
                continue;
            await vscode.window.showTextDocument(filePath, { preview: false });
        }
    }
    catch (err) {
        console.log(err);
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        CloseNonExistentFileTabs();
    }
}
async function DeleteFolder(folderPath) {
    await (0, rimraf_1.rimraf)(folderPath);
    console.log(`Folder ${folderPath} deleted successfully.`);
}
async function DeleteProject() {
    let projectName = await vscode.window.showInputBox({
        placeHolder: "Enter the name of Project you want to delete"
    });
    if (checkInput(projectName))
        return;
    projectName = projectName + "";
    if (checkPath(path.join(glistappsPath, projectName), "A project named " + projectName + " does not exist!"))
        return;
    let decision = await vscode.window.showInputBox({
        placeHolder: 'Are you sure about deleting this project? Type "yes" to continue.'
    });
    if (!(decision?.toLowerCase() == "yes")) {
        vscode.window.showErrorMessage("Deleting Project Cancelled!");
        return;
    }
    await DeleteProjectFromWorkspace(projectName);
    DeleteFolder(path.join(glistappsPath, projectName));
    extensionJsonData.deleteFolder = path.join(glistappsPath, projectName);
    fs.writeFile(extensionDataFilePath, JSON.stringify(extensionJsonData, null, 2));
    vscode.commands.executeCommand('workbench.action.reloadWindow');
}
function checkInput(name, message = "No input provided.") {
    if (!name) {
        vscode.window.showErrorMessage(message);
        return true;
    }
    return false;
}
function checkPath(inputPath, message = undefined, errorMessageIfNotExist = true) {
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
async function AddClassToProject(baseFilePath, fileBaseName) {
    let projectName = await vscode.window.showInputBox({
        placeHolder: "Enter the name of project you want to create new class"
    });
    if (!projectName) {
        vscode.window.showErrorMessage("No input provided.");
        return;
    }
    if (checkPath(path.join(glistappsPath, projectName), "A project named " + projectName + " does not exist!"))
        return;
    let className = await vscode.window.showInputBox({
        placeHolder: "Enter the name of canvas you want to create"
    });
    if (checkInput(className))
        return;
    className = className + "";
    if (checkPath(path.join(glistappsPath, projectName, "src", className + ".h"), "A class named " + className + " already exist!", false))
        return;
    if (checkPath(path.join(glistappsPath, projectName, "src", className + ".cpp"), "A class named " + className + " already exist!", false))
        return;
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
    filesToOpen.forEach(async (file) => {
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
        SaveExtensionJson();
        vscode.window.showInformationMessage("Project Deleted.");
    }
    await CloseNonExistentFileTabs();
    if (extensionJsonData.installGlistEngine) {
        extensionJsonData.installGlistEngine = false;
        SaveExtensionJson();
        await InstallGlistEngine();
    }
    if (!fs.existsSync(path.join(extensionPath, "GlistApp"))) {
        await InstallGlistAppTemplate();
    }
    if (extensionJsonData.firstRun) {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
            title: 'Installing required extensions for Glist Engine. Please wait...'
        }, async (progress) => {
            progress.report({ increment: 0 });
            await InstallExtensions(progress);
            await CreateWorkspace();
        });
    }
    else if (extensionJsonData.secondRun) {
        await OpenFiles();
    }
}
function CheckJsonFile() {
    if (!fs.existsSync(extensionDataFilePath)) {
        let initialData = { firstRun: true, secondRun: true, installGlistEngine: false, deleteFolder: undefined };
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
async function InstallExtensions(progress) {
    try {
        // Required extension names
        const extensionsToInstall = [
            'vadimcn.vscode-lldb',
            'twxs.cmake',
            'ms-vscode.cmake-tools',
            'ms-vscode.cpptools',
        ];
        let incrementValue = 100 / extensionsToInstall.length;
        for (let i = 0; i < extensionsToInstall.length; i++) {
            const extension = vscode.extensions.getExtension(extensionsToInstall[i]);
            if (extension) {
                progress.report({ increment: incrementValue });
            }
            else {
                await vscode.commands.executeCommand('workbench.extensions.installExtension', extensionsToInstall[i]);
                progress.report({ increment: incrementValue });
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
            SaveExtensionJson();
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
        // Add cmake to system path
        AddPathToSystemEnvironment(path.join(glistZbinPath, "CMake", "bin"));
        let workspaceFolders = [];
        getSubfolders(glistappsPath).map(folder => {
            if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
                workspaceFolders.push(folder);
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
        SaveExtensionJson();
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
    filesToOpen.forEach(async (file) => {
        const uri = vscode.Uri.file(file);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, { preview: false });
    });
    extensionJsonData.secondRun = false;
    SaveExtensionJson();
}
function getSubfolders(directory) {
    return fs.readdirSync(directory)
        .filter(file => fs.statSync(path.join(directory, file)).isDirectory())
        .map(folder => path.join(directory, folder));
}
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map