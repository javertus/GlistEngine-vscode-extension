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
exports.checkPath = exports.checkInput = exports.DeleteClassFromProject = exports.AddClassToProject = exports.DeleteProject = exports.OpenFiles = exports.CreateNewProject = void 0;
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
    if (checkInput(projectName))
        return;
    projectName = projectName + "";
    if (!checkPath(path.join(globals.glistappsPath, projectName), "A project named " + projectName + " already exist. Opening already existing project...", false)) {
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
    OpenFiles(filesToOpen);
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
    let projectName = await vscode.window.showInputBox({
        placeHolder: "Enter the name of Project you want to delete"
    });
    if (checkInput(projectName))
        return;
    projectName = projectName + "";
    if (checkPath(path.join(globals.glistappsPath, projectName), "A project named " + projectName + " does not exist!"))
        return;
    let decision = await vscode.window.showInputBox({
        placeHolder: 'Are you sure about deleting this project? Type "yes" to continue.'
    });
    if (!(decision?.toLowerCase() == "yes")) {
        vscode.window.showErrorMessage("Deleting Project Cancelled!");
        return;
    }
    WorkspaceProcesses.DeleteProjectFromWorkspace(projectName);
    FileProcesses.DeleteFolder(path.join(globals.glistappsPath, projectName));
    extension.extensionJsonData.deleteFolder = path.join(globals.glistappsPath, projectName);
    FileProcesses.SaveExtensionJson();
    vscode.commands.executeCommand('workbench.action.reloadWindow');
}
exports.DeleteProject = DeleteProject;
async function AddClassToProject(baseFilePath, fileBaseName) {
    if (!WorkspaceProcesses.IsUserInWorkspace())
        return;
    let projectName = await vscode.window.showInputBox({
        placeHolder: "Enter the name of project you want to create new class"
    });
    if (checkInput(projectName))
        return;
    projectName = projectName + "";
    if (checkPath(path.join(globals.glistappsPath, projectName), "A project named " + projectName + " does not exist!"))
        return;
    let className = await vscode.window.showInputBox({
        placeHolder: "Enter the name of file you want to create"
    });
    if (checkInput(className))
        return;
    className = className + "";
    if (checkPath(path.join(globals.glistappsPath, projectName, "src", className + ".h"), "A class named " + className + " already exist!", false))
        return;
    if (checkPath(path.join(globals.glistappsPath, projectName, "src", className + ".cpp"), "A class named " + className + " already exist!", false))
        return;
    fs.copyFileSync(path.join(baseFilePath, fileBaseName + ".h"), path.join(globals.glistappsPath, projectName, "src", className + ".h"));
    fs.copyFileSync(path.join(baseFilePath, fileBaseName + ".cpp"), path.join(globals.glistappsPath, projectName, "src", className + ".cpp"));
    FileProcesses.ReplaceText(path.join(globals.glistappsPath, projectName, "src", className + ".h"), fileBaseName, className);
    FileProcesses.ReplaceText(path.join(globals.glistappsPath, projectName, "src", className + ".cpp"), fileBaseName, className);
    FileProcesses.ReplaceText(path.join(globals.glistappsPath, projectName, "src", className + ".h"), fileBaseName.toUpperCase() + "_H_", className.toUpperCase() + "_H_");
    FileProcesses.AddFileToCMakeLists(path.join(globals.glistappsPath, projectName), className);
    const filesToOpen = [
        path.join(globals.glistappsPath, projectName, 'src', className + ".h"),
        path.join(globals.glistappsPath, projectName, 'src', className + ".cpp")
    ];
    OpenFiles(filesToOpen);
}
exports.AddClassToProject = AddClassToProject;
async function DeleteClassFromProject() {
    if (!WorkspaceProcesses.IsUserInWorkspace())
        return;
    let projectName = await vscode.window.showInputBox({
        placeHolder: "Enter the name of project you want to delete class from"
    });
    if (checkInput(projectName))
        return;
    projectName = projectName + "";
    if (checkPath(path.join(globals.glistappsPath, projectName), "A project named " + projectName + " does not exist!"))
        return;
    let className = await vscode.window.showInputBox({
        placeHolder: "Enter the name of the file you want to delete"
    });
    if (checkInput(className))
        return;
    className = className + "";
    if (checkPath(path.join(globals.glistappsPath, projectName, "src", className + ".h"), "A class named " + className + " does not exist!"))
        return;
    if (checkPath(path.join(globals.glistappsPath, projectName, "src", className + ".cpp"), "A class named " + className + " does not exist!"))
        return;
    let decision = await vscode.window.showInputBox({
        placeHolder: 'Are you sure about deleting this class? Type "yes" to continue.'
    });
    if (!(decision?.toLowerCase() == "yes")) {
        vscode.window.showErrorMessage("Deleting Class Cancelled!");
        return;
    }
    FileProcesses.RemoveFileFromCMakeLists(path.join(globals.glistappsPath, projectName), className);
    await WorkspaceProcesses.CloseNonExistentFileTabs();
}
exports.DeleteClassFromProject = DeleteClassFromProject;
function checkInput(name, message = "No input provided.") {
    if (!name) {
        vscode.window.showErrorMessage(message);
        return true;
    }
    return false;
}
exports.checkInput = checkInput;
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
exports.checkPath = checkPath;
//# sourceMappingURL=ProjectProcesses.js.map