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
exports.LaunchWorkspace = exports.CloseNonExistentFileTabs = exports.DeleteProjectFromWorkspace = exports.AddNewProjectToWorkspace = exports.UpdateWorkspace = exports.CheckWorkspace = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const FileProcesses = __importStar(require("./FileProcesses"));
const globals = __importStar(require("./globals"));
const extension = __importStar(require("./extension"));
//Checks if user is in Glist Workspace
function CheckWorkspace(showErrorMessage = true) {
    let folders = vscode.workspace.workspaceFolders;
    let len = folders?.length;
    if (!folders || !len || folders[len - 1].uri.fsPath.toLowerCase() != globals.glistEnginePath.toLowerCase()) {
        if (showErrorMessage)
            vscode.window.showErrorMessage("You should switch to Glist workspace to do that.");
        return false;
    }
    return true;
}
exports.CheckWorkspace = CheckWorkspace;
async function UpdateWorkspace(forceCreate = false) {
    if (!CheckWorkspace(!forceCreate) && !forceCreate)
        return;
    try {
        let workspaceFolders = [];
        FileProcesses.getSubfolders(globals.glistappsPath).map(folder => {
            if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
                workspaceFolders.push(folder);
                if (!fs.existsSync(path.join(folder, ".vscode"))) {
                    vscode.window.showInformationMessage("Launch configurations are not found for project named " + path.basename(folder) + ". Creating launch configurations...");
                    fs.cpSync(path.join(extension.extensionPath, 'GlistApp', '.vscode'), path.join(folder, '.vscode'), { recursive: true });
                }
            }
        });
        workspaceFolders.push(globals.glistEnginePath);
        const workspaceContent = {
            folders: workspaceFolders.map(folder => ({ path: folder })),
        };
        fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(workspaceContent, null, 2));
        vscode.window.showInformationMessage('Workspace Updated.');
        //VS Code will restart if another workspace is active.
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
    }
    catch (error) {
        vscode.window.showErrorMessage('Failed to create workspace.');
        console.error(error);
    }
}
exports.UpdateWorkspace = UpdateWorkspace;
async function AddNewProjectToWorkspace(projectName, forceCreate = false) {
    // Read the JSON file
    if (!fs.existsSync(globals.workspaceFilePath) || forceCreate) {
        extension.extensionJsonData.firstRun = false;
        extension.extensionJsonData.secondRun = true;
        FileProcesses.SaveExtensionJson();
        UpdateWorkspace(true);
        return;
    }
    const jsonString = fs.readFileSync(globals.workspaceFilePath, 'utf-8');
    const jsonData = JSON.parse(jsonString);
    // Extract the engine path if it exists
    const enginePath = jsonData.folders.find((folder) => folder.path.includes('GlistEngine'));
    jsonData.folders = jsonData.folders.filter((folder) => !folder.path.includes('GlistEngine'));
    // Add the new path and sort the folders array alphabetically by path
    jsonData.folders.push({ path: path.join(globals.glistappsPath, projectName) });
    jsonData.folders.sort((a, b) => a.path.localeCompare(b.path));
    // Re-add the engine path at the end if it was found
    if (enginePath) {
        jsonData.folders.push(enginePath);
    }
    // Convert the updated data back to JSON format and write it to the file
    fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(jsonData, null, 2));
    //VS Code will restart if another workspace is active.
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
}
exports.AddNewProjectToWorkspace = AddNewProjectToWorkspace;
function DeleteProjectFromWorkspace(projectName) {
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
exports.DeleteProjectFromWorkspace = DeleteProjectFromWorkspace;
async function CloseNonExistentFileTabs() {
    const visibleWindows = vscode.window.tabGroups.activeTabGroup.tabs;
    for (const visibleWindow of visibleWindows) {
        const filePath = JSON.parse(JSON.stringify(visibleWindow.input, null, 2));
        if (fs.existsSync(filePath.uri.fsPath))
            continue;
        await vscode.window.tabGroups.close(visibleWindow, false);
    }
}
exports.CloseNonExistentFileTabs = CloseNonExistentFileTabs;
async function LaunchWorkspace() {
    if (fs.existsSync(globals.workspaceFilePath)) {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
    }
    else { // If no workspace file found, create one and launch the workspace
        UpdateWorkspace(true);
    }
}
exports.LaunchWorkspace = LaunchWorkspace;
//# sourceMappingURL=WorkspaceProcesses.js.map