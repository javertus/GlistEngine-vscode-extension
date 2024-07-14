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
exports.CheckPath = exports.CheckInput = exports.DeleteClassFromProject = exports.AddClassToProject = exports.QuickPickFromWorkspaceFolders = exports.DeleteProject = exports.OpenFiles = exports.CreateNewProject = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const FileProcesses = __importStar(require("./FileProcesses"));
const globals = __importStar(require("./globals"));
const WorkspaceProcesses = __importStar(require("./WorkspaceProcesses"));
const extension = __importStar(require("./extension"));
async function CreateNewProject(projectName = undefined) {
    let forceCreate = false;
    if (projectName)
        forceCreate = true;
    if (!WorkspaceProcesses.IsUserInWorkspace(!forceCreate) && !forceCreate)
        return;
    if (!forceCreate) {
        projectName = await vscode.window.showInputBox({
            placeHolder: "Enter the name of new Project"
        });
    }
    if (CheckInput(projectName))
        return;
    projectName = projectName + "";
    if (!CheckPath(path.join(globals.glistappsPath, projectName), "A project named " + projectName + " already exist. Opening already existing project...", false)) {
        fs.cpSync(path.join(extension.extensionPath, 'GlistApp'), path.join(globals.glistappsPath, projectName), { recursive: true });
        vscode.window.showInformationMessage('Created new Project.');
    }
    await WorkspaceProcesses.AddNewProjectToWorkspace(projectName, forceCreate);
    if (forceCreate)
        return;
    const filesToOpen = [
        path.join(globals.glistappsPath, projectName, 'src', 'gCanvas.h'),
        path.join(globals.glistappsPath, projectName, 'src', 'gCanvas.cpp')
    ];
    await OpenFiles(filesToOpen);
}
exports.CreateNewProject = CreateNewProject;
async function OpenFiles(filesToOpen) {
    filesToOpen.forEach(async (file) => {
        const uri = vscode.Uri.file(file);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, { preview: false });
    });
}
exports.OpenFiles = OpenFiles;
async function DeleteProject() {
    if (!WorkspaceProcesses.IsUserInWorkspace())
        return;
    let project = await QuickPickFromWorkspaceFolders();
    if (!project)
        return;
    let decision = await vscode.window.showInputBox({
        placeHolder: 'Are you sure about deleting this project? Type "yes" to continue.'
    });
    if (!(decision?.toLowerCase() == "yes")) {
        vscode.window.showErrorMessage("Deleting Project Cancelled!");
        return;
    }
    WorkspaceProcesses.DeleteProjectFromWorkspace(project.name);
    FileProcesses.DeleteFolder(project.path);
    extension.extensionJsonData.deleteFolder = project.path;
    FileProcesses.SaveExtensionJson();
    vscode.commands.executeCommand('workbench.action.reloadWindow');
}
exports.DeleteProject = DeleteProject;
async function QuickPickFromWorkspaceFolders() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (CheckInput(workspaceFolders))
        return;
    let folders = [];
    workspaceFolders?.forEach(folder => {
        if (!(folder.uri.fsPath.toLowerCase() == globals.glistEnginePath.toLowerCase())) {
            folders.push({ name: folder.name, path: folder.uri.fsPath });
        }
    });
    const selectedFolder = await vscode.window.showQuickPick(folders.map(folder => `${folder.name} (${folder.path})`), {
        placeHolder: 'Select the name of project you want to create new class'
    });
    if (CheckInput(selectedFolder))
        return;
    return folders.find(folder => selectedFolder == `${folder.name} (${folder.path})`);
}
exports.QuickPickFromWorkspaceFolders = QuickPickFromWorkspaceFolders;
async function AddClassToProject(baseFilePath, fileBaseName) {
    if (!WorkspaceProcesses.IsUserInWorkspace())
        return;
    let project = await QuickPickFromWorkspaceFolders();
    if (!project)
        return;
    let className = await vscode.window.showInputBox({
        placeHolder: "Enter the name of file you want to create"
    });
    if (CheckInput(className))
        return;
    className = className + "";
    if (CheckPath(path.join(project.path, "src", className + ".h"), "A class named " + className + " already exist!", false))
        return;
    if (CheckPath(path.join(project.path, "src", className + ".cpp"), "A class named " + className + " already exist!", false))
        return;
    fs.copyFileSync(path.join(baseFilePath, fileBaseName + ".h"), path.join(project.path, "src", className + ".h"));
    fs.copyFileSync(path.join(baseFilePath, fileBaseName + ".cpp"), path.join(project.path, "src", className + ".cpp"));
    FileProcesses.ReplaceText(path.join(project.path, "src", className + ".h"), fileBaseName, className);
    FileProcesses.ReplaceText(path.join(project.path, "src", className + ".cpp"), fileBaseName, className);
    FileProcesses.ReplaceText(path.join(project.path, "src", className + ".h"), fileBaseName.toUpperCase() + "_H_", className.toUpperCase() + "_H_");
    FileProcesses.AddFileToCMakeLists(path.join(project.path), className);
    const filesToOpen = [
        path.join(project.path, 'src', className + ".h"),
        path.join(project.path, 'src', className + ".cpp")
    ];
    await OpenFiles(filesToOpen);
}
exports.AddClassToProject = AddClassToProject;
function GetSubFiles(directory) {
    return fs.readdirSync(directory)
        .filter(file => fs.statSync(path.join(directory, file)).isFile())
        .map(folder => path.join(directory, folder));
}
function GetBaseNameWithoutExtension(filePath) {
    const baseName = path.basename(filePath);
    const extension = path.extname(baseName);
    return baseName.slice(0, -extension.length);
}
async function DeleteClassFromProject() {
    if (!WorkspaceProcesses.IsUserInWorkspace())
        return;
    let project = await QuickPickFromWorkspaceFolders();
    if (!project)
        return;
    let fileList = [];
    GetSubFiles(path.join(project.path, "src")).forEach(file => {
        if (!fileList.includes(GetBaseNameWithoutExtension(file)) && GetBaseNameWithoutExtension(file) != "main") {
            fileList.push(GetBaseNameWithoutExtension(file));
        }
    });
    let className = await vscode.window.showQuickPick(fileList);
    if (CheckInput(className))
        return;
    className = className + "";
    if (CheckPath(path.join(project.path, "src", className + ".h"), "A class named " + className + " does not exist!"))
        return;
    if (CheckPath(path.join(project.path, "src", className + ".cpp"), "A class named " + className + " does not exist!"))
        return;
    let decision = await vscode.window.showInputBox({
        placeHolder: 'Are you sure about deleting ' + className + '? Type "yes" to continue.'
    });
    if (!(decision?.toLowerCase() == "yes")) {
        vscode.window.showErrorMessage("Deleting Class Cancelled!");
        return;
    }
    FileProcesses.RemoveFileFromCMakeLists(project.path, className);
    await WorkspaceProcesses.CloseNonExistentFileTabs();
}
exports.DeleteClassFromProject = DeleteClassFromProject;
function CheckInput(input, message = "No input provided.") {
    if (!input) {
        vscode.window.showErrorMessage(message);
        return true;
    }
    return false;
}
exports.CheckInput = CheckInput;
function CheckPath(inputPath, message = undefined, errorMessageIfNotExist = true) {
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
exports.CheckPath = CheckPath;
//# sourceMappingURL=ProjectProcesses.js.map