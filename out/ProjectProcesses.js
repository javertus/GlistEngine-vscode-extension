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
exports.CreateNewProject = CreateNewProject;
exports.OpenFiles = OpenFiles;
exports.DeleteProject = DeleteProject;
exports.QuickPickFromWorkspaceFolders = QuickPickFromWorkspaceFolders;
exports.CreateCanvas = CreateCanvas;
exports.CreateClass = CreateClass;
exports.DeleteClassFromProject = DeleteClassFromProject;
exports.CheckInput = CheckInput;
exports.CheckFolderInput = CheckFolderInput;
exports.CheckFileInput = CheckFileInput;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const FileProcesses = __importStar(require("./FileProcesses"));
const globals = __importStar(require("./globals"));
const WorkspaceProcesses = __importStar(require("./WorkspaceProcesses"));
const GitProcesses = __importStar(require("./GitProcesses"));
const extension = __importStar(require("./extension"));
async function CreateNewProject(projectName = undefined) {
    if (!fs.existsSync(path.join(extension.extensionPath, 'GlistApp-vscode'))) {
        if (!(await GitProcesses.CheckGitInstallation()))
            return;
        await extension.CloneGlistAppTemplate();
    }
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
    const result = CheckFolderInput(projectName);
    if (result) {
        await vscode.window.showErrorMessage(result);
        return;
    }
    projectName = projectName + "";
    projectName = projectName.trim();
    if (fs.existsSync(path.join(globals.glistappsPath, projectName))) {
        vscode.window.showErrorMessage("A project named " + projectName + " already exist. Opening already existing project...");
    }
    else {
        fs.cpSync(path.join(extension.extensionPath, 'GlistApp-vscode'), path.join(globals.glistappsPath, projectName), { recursive: true });
        fs.rmSync(path.join(globals.glistappsPath, projectName, ".git"), { recursive: true, force: true });
        vscode.window.showInformationMessage('Created new Project.');
    }
    await WorkspaceProcesses.AddProjectToWorkspace(projectName, forceCreate);
}
async function OpenFiles(filesToOpen) {
    filesToOpen.forEach(async (file) => {
        const uri = vscode.Uri.file(file);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, { preview: false });
    });
}
async function DeleteProject() {
    if (!WorkspaceProcesses.IsUserInWorkspace())
        return;
    let project = await QuickPickFromWorkspaceFolders();
    if (!project)
        return;
    let decision = await vscode.window.showInputBox({
        placeHolder: `Are you sure about deleting this project? Type "${project.name}" to continue.`
    });
    if (decision != project.name) {
        vscode.window.showErrorMessage("Deleting Project Cancelled!");
        return;
    }
    WorkspaceProcesses.RemoveProjectFromWorkspace(project.path);
    for (const terminal of vscode.window.terminals) {
        terminal.dispose(); // Close open terminals to prevent folder locks.
    }
    await new Promise(r => setTimeout(r, 1000)); // Wait for running shell tasks to exit (e.g., GlistApp.exe).
    await FileProcesses.DeleteFolder(project.path);
}
async function QuickPickFromWorkspaceFolders() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (CheckInput(workspaceFolders))
        return;
    let folders = [];
    workspaceFolders?.forEach(folder => {
        if (folder.uri.fsPath.toLowerCase() != globals.glistEnginePath.toLowerCase() && !folder.uri.fsPath.toLowerCase().includes(globals.glistpluginsPath.toLowerCase())) {
            folders.push({ name: folder.name, path: folder.uri.fsPath });
        }
    });
    const selectedFolder = await vscode.window.showQuickPick(folders.map(folder => `${folder.name} (${folder.path})`), {
        placeHolder: 'Select the project'
    });
    if (CheckInput(selectedFolder))
        return;
    return folders.find(folder => selectedFolder == `${folder.name} (${folder.path})`);
}
async function CreateCanvas() {
    if (!WorkspaceProcesses.IsUserInWorkspace())
        return;
    if (!fs.existsSync(path.join(extension.extensionPath, 'GlistApp-vscode'))) {
        if (!(await GitProcesses.CheckGitInstallation()))
            return;
        await extension.CloneGlistAppTemplate();
    }
    await CreateClass(path.join(extension.extensionPath, "GlistApp-vscode", "src"), "gCanvas");
}
async function CreateClass(baseFilePath, baseFileName) {
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
    const result = CheckFileInput(className);
    if (result) {
        vscode.window.showErrorMessage(result);
        return;
    }
    className = className + "";
    className = className.trim();
    if (!fs.existsSync(path.join(project.path, "src"))) {
        vscode.window.showErrorMessage("src folder does not exists!");
        return;
    }
    if (fs.existsSync(path.join(project.path, "src", className + ".h")) || fs.existsSync(path.join(project.path, "src", className + ".cpp"))) {
        vscode.window.showErrorMessage("A class named " + className + " already exist!");
        return;
    }
    fs.copyFileSync(path.join(baseFilePath, baseFileName + ".h"), path.join(project.path, "src", className + ".h"));
    fs.copyFileSync(path.join(baseFilePath, baseFileName + ".cpp"), path.join(project.path, "src", className + ".cpp"));
    FileProcesses.ReplaceText(path.join(project.path, "src", className + ".h"), baseFileName, className);
    FileProcesses.ReplaceText(path.join(project.path, "src", className + ".cpp"), baseFileName, className);
    FileProcesses.ReplaceText(path.join(project.path, "src", className + ".h"), baseFileName.toUpperCase() + "_H_", className.toUpperCase() + "_H_");
    FileProcesses.AddFileToCMakeLists(path.join(project.path), className);
    const filesToOpen = [
        path.join(project.path, 'src', className + ".h"),
        path.join(project.path, 'src', className + ".cpp")
    ];
    await OpenFiles(filesToOpen);
}
function GetSubFiles(directory) {
    return fs.readdirSync(directory).flatMap(file => {
        const fullPath = path.join(directory, file);
        return fs.statSync(fullPath).isDirectory() ? GetSubFiles(fullPath) : fullPath;
    });
}
async function DeleteClassFromProject() {
    if (!WorkspaceProcesses.IsUserInWorkspace())
        return;
    let project = await QuickPickFromWorkspaceFolders();
    if (!project)
        return;
    let fileList = [];
    if (!fs.existsSync(path.join(project.path, "src"))) {
        vscode.window.showErrorMessage("src does not exists!");
        return;
    }
    GetSubFiles(path.join(project.path, "src")).forEach(file => {
        if (!fileList.includes(path.parse(file).name) && path.parse(file).name != "main") {
            fileList.push(path.parse(file).name);
        }
    });
    let className = await vscode.window.showQuickPick(fileList, { title: "Select the class you want to delete." });
    if (CheckInput(className))
        return;
    className = className + "";
    if (!fs.existsSync(path.join(project.path, "src", className + ".h")) || !path.join(project.path, "src", className + ".cpp")) {
        vscode.window.showErrorMessage("A class named " + className + " does not exist!");
        return;
    }
    let decision = await vscode.window.showInputBox({
        placeHolder: `Are you sure about deleting ${className}? Type "${className}" to continue.`
    });
    if (decision != className) {
        vscode.window.showErrorMessage("Deleting Class Cancelled!");
        return;
    }
    FileProcesses.RemoveFileFromCMakeLists(project.path, className);
    await FileProcesses.DeleteFile(path.join(project.path, 'src', `${className}.cpp`));
    await FileProcesses.DeleteFile(path.join(project.path, 'src', `${className}.h`));
    WorkspaceProcesses.CloseNonExistentFileTabs();
}
function CheckInput(input, message = "No input provided.") {
    if (!input) {
        vscode.window.showErrorMessage(message);
        return true;
    }
    return false;
}
function CheckFolderInput(input) {
    input = input.trim();
    if (!input) {
        return "Name cannot be empty.";
    }
    // Allow ONLY: A-Z a-z 0-9 space _ - .
    const allowed = /^[A-Za-z0-9 _.-]+$/;
    if (!allowed.test(input)) {
        return "Only English letters, numbers, spaces, _, -, and . are allowed.";
    }
    // Windows reserved names
    const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    if (reserved.test(input)) {
        return "This name is reserved by Windows.";
    }
    if (input.endsWith(".")) {
        return "Name cannot end with a dot.";
    }
    return "";
}
function CheckFileInput(input) {
    input = input.trim();
    if (!input) {
        return "Name cannot be empty.";
    }
    if (input.includes(" ")) {
        return "Name cannot include spaces";
    }
    // Allow ONLY: A-Z a-z 0-9 space _
    const allowed = /^[A-Za-z0-9 _]+$/;
    if (!allowed.test(input)) {
        return "Only English letters, numbers, spaces, and _ are allowed.";
    }
    // Windows reserved names
    const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    if (reserved.test(input)) {
        return "This name is reserved by Windows.";
    }
    if (input.endsWith(".")) {
        return "Name cannot end with a space or dot.";
    }
    return "";
}
//# sourceMappingURL=ProjectProcesses.js.map