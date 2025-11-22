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
exports.UpdateWorkspace = UpdateWorkspace;
exports.AddProjectToWorkspace = AddProjectToWorkspace;
exports.SortWorkspaceJson = SortWorkspaceJson;
exports.RemoveProjectFromWorkspace = RemoveProjectFromWorkspace;
exports.CloseNonExistentFileTabs = CloseNonExistentFileTabs;
exports.ReloadWorkspace = ReloadWorkspace;
exports.LaunchWorkspace = LaunchWorkspace;
exports.CheckLaunchConfigurations = CheckLaunchConfigurations;
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
    if (!folders || !len || !folders?.filter(folder => folder.uri.fsPath.toLowerCase().includes(globals.glistEnginePath.toLowerCase()))) {
        if (showErrorMessage)
            vscode.window.showErrorMessage("You should switch to Glist workspace to do that.");
        return false;
    }
    return true;
}
async function UpdateWorkspace(forceCreate = false) {
    if (!IsUserInWorkspace(!forceCreate) && !forceCreate)
        return;
    try {
        // If glist was not found before but now exists
        if (fs.existsSync(globals.glistappsPath) && !extension.jsonData.isGlistInstalled) {
            extension.jsonData.firstRun = true;
            extension.jsonData.secondRun = true;
            FileProcesses.SaveExtensionJson();
            extension.SetupExtension();
            return;
        }
        let workspaceFolders = [];
        FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
            if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
                workspaceFolders.push(folder);
            }
        });
        workspaceFolders.push(globals.glistEnginePath);
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
        vscode.window.showErrorMessage(`Failed to create workspace! Are you sure Glist Engine is installed? ${error}`);
    }
}
async function AddProjectToWorkspace(projectName, forceCreate = false) {
    CheckLaunchConfigurations();
    if (!fs.existsSync(globals.workspaceFilePath) || forceCreate) {
        extension.jsonData.firstRun = false;
        extension.jsonData.secondRun = true;
        extension.jsonData.isGlistInstalled = true;
        FileProcesses.SaveExtensionJson();
        await UpdateWorkspace(true);
        return;
    }
    SortWorkspaceJson(projectName);
    //VS Code will restart if another workspace is active.
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
}
function SortWorkspaceJson(projectName) {
    const jsonString = fs.readFileSync(globals.workspaceFilePath, 'utf-8');
    const jsonData = JSON.parse(jsonString);
    const enginePath = { path: globals.glistEnginePath };
    jsonData.folders = jsonData.folders.filter((folder) => !folder.path.includes(globals.glistEnginePath));
    // Add the new path and sort the folders array alphabetically by path
    if (projectName)
        jsonData.folders.push({ path: path.join(globals.glistappsPath, projectName) });
    jsonData.folders.sort((a, b) => path.basename(a.path).localeCompare(path.basename(b.path)));
    // Re-add the engine path
    jsonData.folders.push(enginePath);
    // Convert the updated data back to JSON format and write it to the file
    fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(jsonData, null, 2));
}
function RemoveProjectFromWorkspace(projectName) {
    if (!fs.existsSync(globals.workspaceFilePath)) {
        vscode.window.showWarningMessage('Workspace file does not exist.');
        return;
    }
    const jsonString = fs.readFileSync(globals.workspaceFilePath, 'utf-8');
    const jsonData = JSON.parse(jsonString);
    // Check if the project exists in the workspace folders
    const projectIndex = jsonData.folders.findIndex((folder) => folder.path.includes(globals.glistappsPath) && folder.path.endsWith(`${projectName}`));
    if (projectIndex === -1) {
        return;
    }
    jsonData.folders = jsonData.folders.filter((folder) => !(folder.path.includes(globals.glistappsPath) && folder.path.endsWith(`${projectName}`)));
    fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(jsonData, null, 2));
    vscode.window.showInformationMessage(`Deleted project '${projectName}' from workspace.`);
}
async function CloseNonExistentFileTabs() {
    try {
        const visibleWindows = vscode.window.tabGroups.activeTabGroup.tabs;
        for (const visibleWindow of visibleWindows) {
            if (!visibleWindow.input)
                continue;
            const filePath = JSON.parse(JSON.stringify(visibleWindow.input, null, 2));
            if (fs.existsSync(filePath.uri.fsPath))
                continue;
            await vscode.window.tabGroups.close(visibleWindow, false);
        }
    }
    catch (err) {
        console.log(err);
    }
}
async function ReloadWorkspace() {
    vscode.commands.executeCommand('workbench.action.reloadWindow'); // Throws exception if awaited!
}
async function LaunchWorkspace() {
    if (fs.existsSync(globals.workspaceFilePath)) {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
    }
    else { // If no workspace file found, create one and launch the workspace
        await UpdateWorkspace(true);
    }
}
async function CheckLaunchConfigurations() {
    FileProcesses.GetSubfolders(globals.glistappsPath).forEach(folder => {
        if (fs.existsSync(path.join(folder, "CMakeLists.txt")) || fs.existsSync(path.join(folder, ".vscode"))) {
            return;
        }
        vscode.window.showInformationMessage("Creating launch configurations for " + path.basename(folder));
        fs.cpSync(path.join(extension.extensionPath, 'GlistApp-vscode', '.vscode'), path.join(folder, '.vscode'), { recursive: true });
    });
}
//# sourceMappingURL=WorkspaceProcesses.js.map