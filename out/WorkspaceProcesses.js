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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsUserInWorkspace = IsUserInWorkspace;
exports.ConfigureWorkspace = ConfigureWorkspace;
exports.AddProjectToWorkspace = AddProjectToWorkspace;
exports.SortWorkspaceJson = SortWorkspaceJson;
exports.RemoveProjectFromWorkspace = RemoveProjectFromWorkspace;
exports.CloseNonExistentFileTabs = CloseNonExistentFileTabs;
exports.CheckLaunchConfigurations = CheckLaunchConfigurations;
exports.ReloadWorkspace = ReloadWorkspace;
exports.LaunchWorkspace = LaunchWorkspace;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const FileProcesses = __importStar(require("./FileProcesses"));
const globals = __importStar(require("./globals"));
const extension = __importStar(require("./extension"));
//Checks if user is in Glist Workspace
function IsUserInWorkspace(showErrorMessage = true) {
    let folders = vscode.workspace.workspaceFolders;
    let len = folders?.length;
    if (!folders || !len || !folders.some(folder => folder.uri.fsPath.toLowerCase() == globals.glistEnginePath.toLowerCase())) {
        if (showErrorMessage)
            vscode.window.showErrorMessage("You should switch to GlistEngine workspace to do that.");
        return false;
    }
    return true;
}
async function ConfigureWorkspace(forceCreate = false) {
    if (!IsUserInWorkspace(!forceCreate) && !forceCreate)
        return;
    try {
        // If glist was not found before but now exists
        if (fs.existsSync(globals.glistZbinWindowsPath) && !extension.jsonData.isGlistInstalled) {
            extension.jsonData.firstRun = true;
            extension.jsonData.secondRun = true;
            FileProcesses.SaveExtensionJson();
            extension.SetupExtension();
            return;
        }
        else if (!fs.existsSync(globals.glistZbinWindowsPath)) {
            vscode.window.showErrorMessage("GlistEngine is not installed.");
            return;
        }
        let workspaceFolders = [];
        FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
            if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
                workspaceFolders.push(folder);
            }
        });
        if (fs.existsSync(globals.workspaceFilePath)) {
            const jsonData = JSON.parse(fs.readFileSync(globals.workspaceFilePath, "utf-8"));
            jsonData.folders = jsonData.folders.filter((f) => !workspaceFolders.includes(f.path) && !f.path.includes(globals.glistEnginePath));
            jsonData.folders = [
                { path: globals.glistEnginePath },
                ...jsonData.folders,
                ...workspaceFolders.map(folder => ({ path: folder }))
            ];
            fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(jsonData, null, 2));
            vscode.window.showInformationMessage("Workspace configured.");
            return;
        }
        workspaceFolders.unshift(globals.glistEnginePath);
        const workspaceContent = {
            folders: workspaceFolders.map(folder => ({ path: folder })),
        };
        fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(workspaceContent, null, 2));
        CheckLaunchConfigurations();
        vscode.window.showInformationMessage('Workspace configured.');
        //VS Code will restart if another workspace is active.
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to create workspace! Check if Glist Engine is installed. ${error}`);
    }
}
async function AddProjectToWorkspace(projectName, forceCreate = false) {
    if (!fs.existsSync(globals.workspaceFilePath) || forceCreate) {
        extension.jsonData.firstRun = false;
        extension.jsonData.secondRun = true;
        extension.jsonData.isGlistInstalled = true;
        FileProcesses.SaveExtensionJson();
        await ConfigureWorkspace(true);
        return;
    }
    SortWorkspaceJson(projectName);
}
function SortWorkspaceJson(projectName) {
    const jsonString = fs.readFileSync(globals.workspaceFilePath, 'utf-8');
    const jsonData = JSON.parse(jsonString);
    const enginePath = { path: globals.glistEnginePath };
    jsonData.folders = jsonData.folders.map((folder) => {
        if (!path.isAbsolute(folder.path)) {
            if (folder.path.startsWith("myglistapps")) {
                return { path: path.resolve(globals.glistappsPath, path.basename(folder.path)) };
            }
            if (folder.path.startsWith("glistplugins")) {
                return { path: path.resolve(globals.glistpluginsPath, path.basename(folder.path)) };
            }
            vscode.window.showErrorMessage(`"Copy ${path.basename(folder.path)} into /myglistapps folder in order to add it`);
        }
        return { path: folder.path };
    }).filter((folder) => !folder.path.includes(globals.glistEnginePath) && path.isAbsolute(folder.path));
    if (projectName)
        jsonData.folders.push({ path: path.join(globals.glistappsPath, projectName) });
    jsonData.folders.sort((a, b) => path.basename(a.path).localeCompare(path.basename(b.path)));
    jsonData.folders.unshift(enginePath);
    fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(jsonData, null, 2));
}
function RemoveProjectFromWorkspace(folderPath) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders)
        return;
    const index = folders.findIndex(f => f.uri.fsPath == folderPath);
    if (index == -1)
        return;
    vscode.workspace.updateWorkspaceFolders(index, 1);
}
function CloseNonExistentFileTabs() {
    try {
        const visibleWindows = vscode.window.tabGroups.activeTabGroup.tabs;
        for (const visibleWindow of visibleWindows) {
            if (!visibleWindow.input)
                continue;
            const tab = JSON.parse(JSON.stringify(visibleWindow.input, null, 2));
            if (fs.existsSync(tab.uri.fsPath))
                continue;
            vscode.window.tabGroups.close(visibleWindow, false);
        }
    }
    catch (err) {
        console.log(err);
    }
}
function CheckLaunchConfigurations() {
    FileProcesses.GetSubfolders(globals.glistappsPath).forEach(folder => {
        if (!fs.existsSync(path.join(folder, "CMakeLists.txt")) || fs.existsSync(path.join(folder, ".vscode"))) {
            return;
        }
        fs.cpSync(path.join(extension.extensionPath, 'GlistApp-vscode', '.vscode'), path.join(folder, '.vscode'), { recursive: true });
        vscode.window.showInformationMessage("Created launch configurations for " + path.basename(folder));
    });
}
async function ReloadWorkspace() {
    vscode.commands.executeCommand('workbench.action.reloadWindow'); // Throws exception if awaited!
}
async function LaunchWorkspace() {
    if (fs.existsSync(globals.workspaceFilePath)) {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
    }
    else { // If no workspace file found, create one and launch the workspace
        await ConfigureWorkspace(true);
    }
}
//# sourceMappingURL=WorkspaceProcesses.js.map