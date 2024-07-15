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
exports.deactivate = exports.ConfigureExtension = exports.activate = exports.extensionDataFilePath = exports.extensionPath = exports.extensionJsonData = void 0;
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
    vscode.commands.registerCommand('glist-extension.clone-pluginurl', async () => {
        await GitProcessses.ClonePluginUrl();
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
    vscode.commands.registerCommand('glist-extension.run-project', async () => {
        vscode.commands.executeCommand('workbench.action.debug.start');
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
    if (WorkspaceProcesses.IsUserInWorkspace(false)) {
        vscode.commands.executeCommand('setContext', 'glist-extension.showRunButton', true);
        const folderWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(globals.glistPath, '**'));
        folderWatcher.onDidDelete(e => {
            WorkspaceProcesses.CloseNonExistentFileTabs();
        });
        folderWatcher.onDidChange(e => {
            WorkspaceProcesses.CloseNonExistentFileTabs();
        });
        await WorkspaceProcesses.CloseNonExistentFileTabs();
        WorkspaceProcesses.CheckLaunchConfigurations();
    }
    if (exports.extensionJsonData.installGlistEngine) {
        exports.extensionJsonData.installGlistEngine = false;
        FileProcesses.SaveExtensionJson();
        await InstallEngine.InstallGlistEngine();
    }
    if (!fs.existsSync(path.join(exports.extensionPath, "GlistApp"))) {
        await InstallGlistAppTemplate();
    }
    if (exports.extensionJsonData.firstRun) {
        await ConfigureExtension();
    }
    else if (exports.extensionJsonData.secondRun) {
        await LoadTabs();
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
        // Install ninja if does not exist
        fs.ensureDirSync(path.join(globals.glistZbinPath, "CMake"));
        if (!fs.existsSync(path.join(globals.glistZbinPath, "CMake", "bin", "ninja.exe"))) {
            const ninjaPath = path.join(globals.glistZbinPath, "CMake", "bin", "ninja.zip");
            await FileProcesses.DownloadFile(globals.ninjaUrl, ninjaPath, "Downloading Ninja");
            FileProcesses.ExtractArchive(ninjaPath, path.join(globals.glistZbinPath, "CMake", "bin"), "");
            fs.removeSync(ninjaPath);
        }
        if (await FileProcesses.UpdateVSCodeSettings())
            return;
        exports.extensionJsonData.firstRun = false;
        exports.extensionJsonData.isGlistInstalled = true;
        FileProcesses.SaveExtensionJson();
        // Opens the new workspace. Setup cannot continue after here because vscode restarts. For resuming setup, there is a secondary setup run.
        await WorkspaceProcesses.UpdateWorkspace(true);
        // If workspace was already opened before, vscode will not restart so setup can continue.
        if (WorkspaceProcesses.IsUserInWorkspace(false))
            await LoadTabs();
    }
    catch (error) {
        vscode.window.showErrorMessage('Failed to create workspace.');
        console.error(error);
    }
}
exports.ConfigureExtension = ConfigureExtension;
async function LoadTabs() {
    // Close all active tabs
    vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const filesToOpen = [
        path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.h'),
        path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.cpp')
    ];
    await ProjectProcesses.OpenFiles(filesToOpen);
    exports.extensionJsonData.secondRun = false;
    FileProcesses.SaveExtensionJson();
}
async function CheckUpdates() {
    if (!WorkspaceProcesses.IsUserInWorkspace(false))
        return;
    let engineUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.engine');
    let pluginsUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.plugins');
    let projectsUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.projects');
    if (engineUpdate) {
        if (!(await GitProcessses.CheckGitInstallation()))
            return;
        GitProcessses.UpdateRepository(path.join(globals.glistPath, "GlistEngine"), true);
    }
    if (pluginsUpdate) {
        if (!(await GitProcessses.CheckGitInstallation()))
            return;
        FileProcesses.GetSubfolders(globals.glistpluginsPath).map(folder => {
            if (fs.existsSync(path.join(folder, ".git"))) {
                GitProcessses.UpdateRepository(folder, true);
            }
        });
    }
    if (projectsUpdate) {
        if (!(await GitProcessses.CheckGitInstallation()))
            return;
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
    exports.extensionJsonData.isGlistInstalled = false;
    FileProcesses.SaveExtensionJson();
    fs.rmSync(path.join(exports.extensionPath, 'GlistApp'), { recursive: true, force: true });
    vscode.commands.executeCommand('workbench.action.reloadWindow');
}
function CheckJsonFile() {
    if (!fs.existsSync(exports.extensionDataFilePath)) {
        let initialData = { firstRun: true, secondRun: true, installGlistEngine: false, isGlistInstalled: false };
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
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map