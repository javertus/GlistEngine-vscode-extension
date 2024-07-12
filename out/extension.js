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
exports.deactivate = exports.activate = exports.extensionDataFilePath = exports.extensionPath = exports.extensionJsonData = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const globals = __importStar(require("./globals"));
const GitProcessses = __importStar(require("./GitProcesses"));
const InstallEngine = __importStar(require("./InstallEngine"));
const FileProcesses = __importStar(require("./FileProcesses"));
const ProjectProcesses = __importStar(require("./ProjectProcesses"));
const WorkspaceProcesses = __importStar(require("./WorkspaceProcesses"));
function activate(context) {
    vscode.commands.registerCommand('glist-extension.create-project', async () => {
        await ProjectProcesses.CreateNewProject();
    });
    vscode.commands.registerCommand('glist-extension.delete-project', async () => {
        await ProjectProcesses.DeleteProject();
    });
    vscode.commands.registerCommand('glist-extension.update-workspace', async () => {
        await WorkspaceProcesses.UpdateWorkspace();
    });
    vscode.commands.registerCommand('glist-extension.add-canvas-to-project', async () => {
        await ProjectProcesses.AddClassToProject(path.join(exports.extensionPath, "GlistApp", "src"), "gCanvas");
    });
    vscode.commands.registerCommand('glist-extension.add-class-to-project', async () => {
        await ProjectProcesses.AddClassToProject(path.join(exports.extensionPath), "EmptyClass");
    });
    vscode.commands.registerCommand('glist-extension.delete-class-from-project', async () => {
        await ProjectProcesses.DeleteClassFromProject();
    });
    vscode.commands.registerCommand('glist-extension.switch-workspace', async () => {
        await WorkspaceProcesses.LaunchWorkspace();
    });
    vscode.commands.registerCommand('glist-extension.install-glistengine', async () => {
        await InstallEngine.InstallGlistEngine();
    });
    vscode.commands.registerCommand('glist-extension.clone-plugin', async () => {
        await GitProcessses.ClonePlugin();
    });
    vscode.commands.registerCommand('glist-extension.update-repos', async () => {
        await GitProcessses.CheckRepoUpdates();
    });
    vscode.commands.registerCommand('glist-extension.clone-project', async () => {
        await GitProcessses.CloneProject();
    });
    vscode.commands.registerCommand('glist-extension.reset', async () => {
        ResetExtension();
    });
    exports.extensionPath = context.extensionPath;
    exports.extensionDataFilePath = path.join(exports.extensionPath, 'ExtensionData.json');
    FirstRunWorker();
    CheckUpdates();
}
exports.activate = activate;
async function FirstRunWorker() {
    CheckJsonFile();
    if (exports.extensionJsonData.deleteFolder) {
        await FileProcesses.DeleteFolder(exports.extensionJsonData.deleteFolder);
        exports.extensionJsonData.deleteFolder = undefined;
        FileProcesses.SaveExtensionJson();
        vscode.window.showInformationMessage("Project Deleted.");
    }
    if (WorkspaceProcesses.IsUserInWorkspace(false))
        await WorkspaceProcesses.CloseNonExistentFileTabs();
    if (exports.extensionJsonData.installGlistEngine) {
        exports.extensionJsonData.installGlistEngine = false;
        FileProcesses.SaveExtensionJson();
        await InstallEngine.InstallGlistEngine();
    }
    if (!fs.existsSync(path.join(exports.extensionPath, "GlistApp"))) {
        await InstallGlistAppTemplate();
    }
    if (exports.extensionJsonData.firstRun) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
            title: 'Installing required extensions for Glist Engine. Please wait...'
        }, async (progress) => {
            progress.report({ increment: 0 });
            await InstallExtensions(progress);
        });
        await ConfigureExtension();
    }
    else if (exports.extensionJsonData.secondRun) {
        await OpenFiles();
    }
}
async function ConfigureExtension() {
    try {
        // Do not create workspace and stop setup process if glistapps does not exist (Also Meaning Glist Engine is not installed.)
        if (!fs.existsSync(globals.glistappsPath)) {
            exports.extensionJsonData.firstRun = false;
            exports.extensionJsonData.secondRun = false;
            FileProcesses.SaveExtensionJson();
            return;
        }
        await FileProcesses.UpdateVSCodeSettings();
        // Install ninja if does not exist
        fs.ensureDirSync(path.join(globals.glistZbinPath, "CMake"));
        const ninjaPath = path.join(globals.glistZbinPath, "CMake", "bin", "ninja.zip");
        if (!fs.existsSync(path.join(globals.glistZbinPath, "CMake", "bin", "ninja.exe"))) {
            await FileProcesses.DownloadFile(globals.ninjaUrl, ninjaPath, "Downloading Ninja");
            FileProcesses.ExtractArchive(ninjaPath, path.join(globals.glistZbinPath, "CMake", "bin"), "");
            await fs.remove(ninjaPath);
        }
        let workspaceFolders = [];
        FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
            if (fs.existsSync(path.join(folder, "CMakeLists.txt"))) {
                workspaceFolders.push(folder);
                if (!fs.existsSync(path.join(folder, ".vscode"))) {
                    vscode.window.showInformationMessage("Launch configurations are not found for project at " + folder + ". Creating launch configurations...");
                    fs.cpSync(path.join(exports.extensionPath, 'GlistApp', '.vscode'), path.join(folder, '.vscode'), { recursive: true });
                }
            }
        });
        workspaceFolders.push(globals.glistEnginePath);
        const workspaceContent = {
            folders: workspaceFolders.map(folder => ({ path: folder })),
        };
        fs.writeFileSync(globals.workspaceFilePath, JSON.stringify(workspaceContent, null, 2));
        vscode.window.showInformationMessage('Workspace configured.');
        exports.extensionJsonData.firstRun = false;
        FileProcesses.SaveExtensionJson();
        // Opens the new workspace. Setup cannot continue after here because vscode restarts. For resuming setup, there is a secondary setup run.
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(globals.workspaceFilePath), false);
        // If workspace was already opened before, vscode will not restart so setup can continue.
        if (WorkspaceProcesses.IsUserInWorkspace(false))
            await OpenFiles();
    }
    catch (error) {
        vscode.window.showErrorMessage('Failed to create workspace.');
        console.error(error);
    }
}
async function OpenFiles() {
    // Close all active tabs
    vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const filesToOpen = [
        path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.h'),
        path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.cpp')
    ];
    filesToOpen.forEach(async (file) => {
        const uri = vscode.Uri.file(file);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, { preview: false });
    });
    exports.extensionJsonData.secondRun = false;
    FileProcesses.SaveExtensionJson();
}
async function CheckUpdates() {
    if (!WorkspaceProcesses.IsUserInWorkspace(false))
        return;
    if (!(await GitProcessses.CheckGitInstallation()))
        return;
    let engineUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.engine');
    let pluginsUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.plugins');
    let projectsUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.projects');
    if (engineUpdate) {
        GitProcessses.UpdateRepository(path.join(globals.glistPath, "GlistEngine"), true);
    }
    if (pluginsUpdate) {
        FileProcesses.GetSubfolders(globals.glistpluginsPath).map(folder => {
            if (fs.existsSync(path.join(folder, ".git"))) {
                GitProcessses.UpdateRepository(folder, true);
            }
        });
    }
    if (projectsUpdate) {
        FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
            if (fs.existsSync(path.join(folder, ".git"))) {
                GitProcessses.UpdateRepository(folder, true);
            }
        });
    }
}
function ResetExtension() {
    exports.extensionJsonData.firstRun = true;
    exports.extensionJsonData.secondRun = true;
    FileProcesses.SaveExtensionJson();
    fs.rmSync(path.join(exports.extensionPath, 'GlistApp'), { recursive: true, force: true });
    vscode.commands.executeCommand('workbench.action.reloadWindow');
}
function CheckJsonFile() {
    if (!fs.existsSync(exports.extensionDataFilePath)) {
        let initialData = { firstRun: true, secondRun: true, installGlistEngine: false };
        fs.writeFileSync(exports.extensionDataFilePath, JSON.stringify(initialData, null, 2));
    }
    let data = fs.readFileSync(exports.extensionDataFilePath, 'utf8');
    exports.extensionJsonData = JSON.parse(data);
}
async function InstallGlistAppTemplate() {
    const zipFilePath = path.join(exports.extensionPath, "GlistApp.zip");
    await FileProcesses.DownloadFile(globals.glistAppUrl, zipFilePath, "");
    FileProcesses.ExtractArchive(zipFilePath, exports.extensionPath, "");
    await fs.rename(path.join(exports.extensionPath, 'GlistApp-vscode-main'), path.join(exports.extensionPath, 'GlistApp'));
    await fs.remove(zipFilePath);
}
async function InstallExtensions(progress) {
    try {
        // Required extension names
        const extensionsToInstall = [
            'vadimcn.vscode-lldb',
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
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map