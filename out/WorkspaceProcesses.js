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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckLaunchConfigurations = exports.LaunchWorkspace = exports.ReloadWorkspace = exports.CloseNonExistentFileTabs = exports.RemoveProjectFromWorkspace = exports.SortWorkspaceJson = exports.AddProjectToWorkspace = exports.UpdateWorkspace = exports.IsUserInWorkspace = void 0;
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
exports.IsUserInWorkspace = IsUserInWorkspace;
async function UpdateWorkspace(forceCreate = false) {
    if (!IsUserInWorkspace(!forceCreate) && !forceCreate)
        return;
    try {
        // If glist was not found before but now exists
        if (fs.existsSync(globals.glistappsPath) && !extension.jsonData.isGlistInstalled) {
            extension.jsonData.firstRun = true;
            extension.jsonData.secondRun = true;
            FileProcesses.SaveExtensionJson();
            extension.ConfigureExtension();
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
exports.UpdateWorkspace = UpdateWorkspace;
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
exports.AddProjectToWorkspace = AddProjectToWorkspace;
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
exports.SortWorkspaceJson = SortWorkspaceJson;
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
exports.RemoveProjectFromWorkspace = RemoveProjectFromWorkspace;
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
exports.CloseNonExistentFileTabs = CloseNonExistentFileTabs;
async function ReloadWorkspace() {
    vscode.commands.executeCommand('workbench.action.reloadWindow'); // Throws exception if awaited!
}
exports.ReloadWorkspace = ReloadWorkspace;
async function LaunchWorkspace() {
    if (fs.existsSync(globals.workspaceFilePath)) {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
    }
    else { // If no workspace file found, create one and launch the workspace
        await UpdateWorkspace(true);
    }
}
exports.LaunchWorkspace = LaunchWorkspace;
async function CheckLaunchConfigurations() {
    FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
        if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
            if (!fs.existsSync(path.join(folder, ".vscode"))) {
                vscode.window.showInformationMessage("Creating launch configurations for " + path.basename(folder));
                fs.cpSync(path.join(extension.path, 'GlistApp-vscode', '.vscode'), path.join(folder, '.vscode'), { recursive: true });
            }
        }
    });
}
exports.CheckLaunchConfigurations = CheckLaunchConfigurations;
//# sourceMappingURL=WorkspaceProcesses.js.map