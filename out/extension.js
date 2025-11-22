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
exports.dataFilePath = exports.extensionPath = exports.jsonData = void 0;
exports.activate = activate;
exports.SetupExtension = SetupExtension;
exports.CloneGlistAppTemplate = CloneGlistAppTemplate;
exports.deactivate = deactivate;
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
        await ProjectProcesses.AddClassToProject(path.join(exports.extensionPath, "GlistApp-vscode", "src"), "gCanvas");
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
    vscode.commands.registerCommand('glist-extension.uninstall', async () => {
        await Uninstall();
    });
    vscode.commands.registerCommand('glist-extension.run-project', async () => {
        vscode.commands.executeCommand('workbench.action.debug.start');
    });
    exports.extensionPath = context.extensionPath;
    exports.dataFilePath = path.join(exports.extensionPath, 'ExtensionData.json');
    OnExtensionStart();
}
async function OnExtensionStart() {
    InitializeJsonFile();
    if (exports.jsonData.deleteFolder) {
        await FileProcesses.DeleteFolder(exports.jsonData.deleteFolder);
        exports.jsonData.deleteFolder = undefined;
        FileProcesses.SaveExtensionJson();
        vscode.window.showInformationMessage("Project Deleted.");
    }
    if (exports.jsonData.installGlistEngine) {
        await InstallEngine.InstallGlistEngine('Yes');
    }
    if (WorkspaceProcesses.IsUserInWorkspace(false)) {
        vscode.commands.executeCommand('setContext', 'glist-extension.showRunButton', true);
        const folderWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(globals.glistPath, '**'));
        folderWatcher.onDidCreate(e => {
            if (path.dirname(e.fsPath).toLowerCase() + "\\" == globals.glistappsPath.toLowerCase() && fs.existsSync(path.join(e.fsPath, "CMakeLists.txt"))) {
                WorkspaceProcesses.AddProjectToWorkspace(path.basename(e.fsPath));
                if (!fs.existsSync(path.join(e.fsPath, 'src', 'gCanvas.h')))
                    return;
                const filesToOpen = [
                    path.join(e.fsPath, 'src', 'gCanvas.h'),
                    path.join(e.fsPath, 'src', 'gCanvas.cpp')
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
            if (path.dirname(e.fsPath).toLowerCase() + "\\" == globals.glistappsPath.toLowerCase()) {
                WorkspaceProcesses.RemoveProjectFromWorkspace(path.basename(e.fsPath));
            }
            WorkspaceProcesses.CloseNonExistentFileTabs();
            WorkspaceProcesses.CheckLaunchConfigurations();
        });
        vscode.workspace.onDidChangeWorkspaceFolders(e => {
            e.added.forEach(folder => {
                if (!fs.existsSync(path.join(folder.uri.fsPath, 'src', 'gCanvas.h')))
                    return;
                const filesToOpen = [
                    path.join(folder.uri.fsPath, 'src', 'gCanvas.h'),
                    path.join(folder.uri.fsPath, 'src', 'gCanvas.cpp')
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
        await SetupExtension();
    }
    else if (exports.jsonData.secondRun) {
        await LoadTabs();
    }
    if (exports.jsonData.uninstall) {
        await Uninstall('Yes');
    }
}
async function SetupExtension() {
    try {
        // Do not create workspace and stop setup process if glistapps does not exist (Also Meaning Glist Engine is not installed.)
        if (!fs.existsSync(globals.glistappsPath)) {
            exports.jsonData.firstRun = false;
            exports.jsonData.secondRun = false;
            FileProcesses.SaveExtensionJson();
            return;
        }
        fs.rmSync(path.join(exports.extensionPath, 'GlistApp-vscode'), { recursive: true, force: true });
        await CloneGlistAppTemplate();
        // Install ninja if does not exist
        if (!fs.existsSync(path.join(globals.glistZbinPath, "CMake", "bin", "ninja.exe"))) {
            const ninjaPath = path.join(globals.glistZbinPath, "CMake", "bin", "ninja.zip");
            await FileProcesses.DownloadFile(globals.ninjaUrl, ninjaPath, "Downloading Ninja");
            FileProcesses.ExtractArchive(ninjaPath, path.join(globals.glistZbinPath, "CMake", "bin"), "");
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
async function LoadTabs() {
    // Close all active tabs
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const filesToOpen = [
        path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.h'),
        path.join(globals.glistappsPath, 'GlistApp', 'src', 'gCanvas.cpp')
    ];
    await ProjectProcesses.OpenFiles(filesToOpen);
    exports.jsonData.secondRun = false;
    FileProcesses.SaveExtensionJson();
}
async function CheckUpdates() {
    const engineUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.engine');
    const pluginsUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.plugins');
    const projectsUpdate = vscode.workspace.getConfiguration('glistengine').get('autoUpdate.projects');
    if (!(await GitProcessses.CheckGitInstallation()))
        return;
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
    GitProcessses.UpdateRepository(path.join(exports.extensionPath, "GlistApp-vscode"), true);
}
function ResetExtension() {
    exports.jsonData.firstRun = true;
    exports.jsonData.secondRun = true;
    exports.jsonData.isGlistInstalled = false;
    exports.jsonData.uninstall = false;
    FileProcesses.SaveExtensionJson();
    WorkspaceProcesses.ReloadWorkspace();
}
async function Uninstall(consent = 'No') {
    if (!exports.jsonData.isGlistInstalled) {
        vscode.window.showErrorMessage("Glist Engine Is Not Installed!");
        return;
    }
    let result;
    consent == 'Yes' ? result = consent : result = await vscode.window.showInformationMessage('Do you want to uninstall Glist Engine? This action will erase all your projects, plugins and engine itself.', { modal: true }, 'Yes', 'No');
    if (result == 'Yes') {
        if (!exports.jsonData.uninstall) {
            exports.jsonData.uninstall = true;
            FileProcesses.SaveExtensionJson();
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
            await vscode.commands.executeCommand('vscode.newWindow', { reuseWindow: true });
            return;
        }
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
            title: 'Uninstalling Glist Engine'
        }, async (progress) => {
            while (fs.pathExistsSync(globals.glistPath)) {
                try {
                    await FileProcesses.DeleteFolder(globals.glistPath);
                }
                catch (err) {
                    console.log(err);
                    vscode.window.showErrorMessage(`An error occurred while uninstalling Glist Engine: ${err}`);
                    progress.report({ message: "Cannot Uninstall! Please close everything running under /dev/glist/ folder" });
                }
            }
            vscode.window.showInformationMessage("Glist Engine Uninstalled.");
            ResetExtension();
        });
    }
}
function InitializeJsonFile() {
    if (!fs.existsSync(exports.dataFilePath)) {
        let initialData = { firstRun: true, secondRun: true, installGlistEngine: false, isGlistInstalled: false, uninstall: false };
        fs.writeFileSync(exports.dataFilePath, JSON.stringify(initialData, null, 2));
    }
    let data = fs.readFileSync(exports.dataFilePath, 'utf8');
    exports.jsonData = JSON.parse(data);
}
async function CloneGlistAppTemplate() {
    try {
        return await GitProcessses.CloneRepository(globals.glistAppUrl, exports.extensionPath, false, "Cloning GlistApp Template");
    }
    catch (err) {
        console.log(`An error occurred while cloning GlistApp Template: ${err}`);
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map