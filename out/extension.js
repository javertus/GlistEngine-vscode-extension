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
exports.deactivate = exports.ConfigureExtension = exports.activate = exports.dataFilePath = exports.path = exports.jsonData = void 0;
const vscode = __importStar(require("vscode"));
const fspath = __importStar(require("path"));
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
        await ProjectProcesses.AddClassToProject(fspath.join(exports.path, "GlistApp-vscode", "src"), "gCanvas");
    });
    vscode.commands.registerCommand('glist-extension.add-class-to-project', async () => {
        await ProjectProcesses.AddClassToProject(fspath.join(exports.path), "EmptyClass");
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
    exports.path = context.extensionPath;
    exports.dataFilePath = fspath.join(exports.path, 'ExtensionData.json');
    OnExtensionStart();
}
exports.activate = activate;
async function OnExtensionStart() {
    CheckJsonFile();
    if (exports.jsonData.deleteFolder) {
        await FileProcesses.DeleteFolder(exports.jsonData.deleteFolder);
        exports.jsonData.deleteFolder = undefined;
        FileProcesses.SaveExtensionJson();
        vscode.window.showInformationMessage("Project Deleted.");
    }
    if (exports.jsonData.installGlistEngine) {
        await InstallEngine.InstallGlistEngine();
    }
    if (WorkspaceProcesses.IsUserInWorkspace(false)) {
        vscode.commands.executeCommand('setContext', 'glist-extension.showRunButton', true);
        const folderWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(globals.glistPath, '**'));
        folderWatcher.onDidCreate(e => {
            if (fspath.dirname(e.fsPath).toLowerCase() + "\\" == globals.glistappsPath.toLowerCase() && fs.existsSync(fspath.join(e.fsPath, "CMakeLists.txt"))) {
                WorkspaceProcesses.AddProjectToWorkspace(fspath.basename(e.fsPath));
                if (!fs.existsSync(fspath.join(e.fsPath, 'src', 'gCanvas.h')))
                    return;
                const filesToOpen = [
                    fspath.join(e.fsPath, 'src', 'gCanvas.h'),
                    fspath.join(e.fsPath, 'src', 'gCanvas.cpp')
                ];
                ProjectProcesses.OpenFiles(filesToOpen);
            }
            WorkspaceProcesses.CloseNonExistentFileTabs();
            WorkspaceProcesses.CheckLaunchConfigurations();
        });
        folderWatcher.onDidChange(e => {
            WorkspaceProcesses.CloseNonExistentFileTabs();
            WorkspaceProcesses.CheckLaunchConfigurations();
        });
        folderWatcher.onDidDelete(e => {
            if (fspath.dirname(e.fsPath).toLowerCase() + "\\" == globals.glistappsPath.toLowerCase()) {
                WorkspaceProcesses.RemoveProjectFromWorkspace(fspath.basename(e.fsPath));
            }
            WorkspaceProcesses.CloseNonExistentFileTabs();
            WorkspaceProcesses.CheckLaunchConfigurations();
        });
        vscode.workspace.onDidChangeWorkspaceFolders(e => {
            e.added.forEach(folder => {
                if (!fs.existsSync(fspath.join(folder.uri.fsPath, 'src', 'gCanvas.h')))
                    return;
                const filesToOpen = [
                    fspath.join(folder.uri.fsPath, 'src', 'gCanvas.h'),
                    fspath.join(folder.uri.fsPath, 'src', 'gCanvas.cpp')
                ];
                ProjectProcesses.OpenFiles(filesToOpen);
            });
            WorkspaceProcesses.SortWorkspaceJson("");
            WorkspaceProcesses.CloseNonExistentFileTabs();
            WorkspaceProcesses.CheckLaunchConfigurations();
        });
        await WorkspaceProcesses.CloseNonExistentFileTabs();
        await WorkspaceProcesses.CheckLaunchConfigurations();
        await CheckUpdates();
    }
    if (exports.jsonData.firstRun) {
        await ConfigureExtension();
    }
    else if (exports.jsonData.secondRun) {
        await LoadTabs();
    }
}
async function ConfigureExtension() {
    try {
        // Do not create workspace and stop setup process if glistapps does not exist (Also Meaning Glist Engine is not installed.)
        if (!fs.existsSync(globals.glistappsPath)) {
            exports.jsonData.firstRun = false;
            exports.jsonData.secondRun = false;
            FileProcesses.SaveExtensionJson();
            return;
        }
        // Clone GlistApp template if does not exist
        if (!fs.existsSync(fspath.join(exports.path, "GlistApp-vscode", ".git"))) {
            await CloneGlistAppTemplate();
        }
        // Install ninja if does not exist
        if (!fs.existsSync(fspath.join(globals.glistZbinPath, "CMake", "bin", "ninja.exe"))) {
            const ninjaPath = fspath.join(globals.glistZbinPath, "CMake", "bin", "ninja.zip");
            await FileProcesses.DownloadFile(globals.ninjaUrl, ninjaPath, "Downloading Ninja");
            FileProcesses.ExtractArchive(ninjaPath, fspath.join(globals.glistZbinPath, "CMake", "bin"), "");
            fs.removeSync(ninjaPath);
        }
        if (await FileProcesses.UpdateVSCodeSettings())
            return;
        exports.jsonData.firstRun = false;
        exports.jsonData.isGlistInstalled = true;
        FileProcesses.SaveExtensionJson();
        // Opens the new workspace. Setup cannot continue after here because vscode restarts. For resuming setup, there is a secondary setup run.
        await WorkspaceProcesses.UpdateWorkspace(true);
        // If workspace was already opened vscode will not restart so setup can continue.
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
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const filesToOpen = [
        fspath.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.h'),
        fspath.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.cpp')
    ];
    await ProjectProcesses.OpenFiles(filesToOpen);
    exports.jsonData.secondRun = false;
    FileProcesses.SaveExtensionJson();
}
async function CheckUpdates() {
    const engineUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.engine');
    const pluginsUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.plugins');
    const projectsUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.projects');
    if (engineUpdate) {
        if (!(await GitProcessses.CheckGitInstallation()))
            return;
        GitProcessses.UpdateRepository(fspath.join(globals.glistPath, "GlistEngine"), true);
    }
    if (pluginsUpdate) {
        if (!(await GitProcessses.CheckGitInstallation()))
            return;
        FileProcesses.GetSubfolders(globals.glistpluginsPath).map(folder => {
            if (fs.existsSync(fspath.join(folder, ".git"))) {
                GitProcessses.UpdateRepository(folder, true);
            }
        });
    }
    if (projectsUpdate) {
        if (!(await GitProcessses.CheckGitInstallation()))
            return;
        FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
            if (fs.existsSync(fspath.join(folder, ".git"))) {
                GitProcessses.UpdateRepository(folder, true);
            }
        });
    }
    GitProcessses.UpdateRepository(fspath.join(exports.path, "GlistApp-vscode"), true);
}
function ResetExtension() {
    exports.jsonData.firstRun = true;
    exports.jsonData.secondRun = true;
    exports.jsonData.isGlistInstalled = false;
    FileProcesses.SaveExtensionJson();
    WorkspaceProcesses.ReloadWorkspace();
}
function CheckJsonFile() {
    if (!fs.existsSync(exports.dataFilePath)) {
        let initialData = { firstRun: true, secondRun: true, installGlistEngine: false, isGlistInstalled: false };
        fs.writeFileSync(exports.dataFilePath, JSON.stringify(initialData, null, 2));
    }
    let data = fs.readFileSync(exports.dataFilePath, 'utf8');
    exports.jsonData = JSON.parse(data);
}
async function CloneGlistAppTemplate() {
    try {
        fs.rmSync(fspath.join(exports.path, 'GlistApp-vscode'), { recursive: true, force: true });
        await GitProcessses.CloneRepository(globals.glistAppUrl, exports.path, false, "Cloning GlistApp Template");
    }
    catch (err) {
        console.log(`An error occurred while cloning GlistApp Template: ${err}`);
    }
}
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map