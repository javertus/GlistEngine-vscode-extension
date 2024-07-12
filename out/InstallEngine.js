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
exports.createDirectories = exports.InstallGlistEngine = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const extension = __importStar(require("./extension"));
const FileProcesses = __importStar(require("./FileProcesses"));
const globals = __importStar(require("./globals"));
const ProjectProcesses = __importStar(require("./ProjectProcesses"));
const GitProcesses = __importStar(require("./GitProcesses"));
let installation = false;
async function InstallGlistEngine() {
    if (installation) {
        vscode.window.showErrorMessage("You can't run this action while installing is in process!");
        return;
    }
    extension.extensionJsonData.installGlistEngine = true;
    FileProcesses.SaveExtensionJson();
    if (await FileProcesses.UpdateVSCodeSettings())
        return;
    extension.extensionJsonData.installGlistEngine = false;
    FileProcesses.SaveExtensionJson();
    const result = await vscode.window.showInformationMessage('This action will install the Glist Engine and its dependencies. Current Glist Engine installation in /glist folder will be modified if exist. Your projects and plugins will not affected. Do you want to continue?', { modal: true }, 'Yes', 'No');
    if (result == 'Yes') {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
            title: 'Installing dependencies for Glist Engine'
        }, async (progress) => {
            installation = true;
            if (!(await GitProcesses.CheckGitInstallation())) {
                installation = false;
                return;
            }
            progress.report({ increment: 0 });
            createDirectories();
            progress.report({ increment: 20 });
            await InstallEngine(progress);
            progress.report({ increment: 20 });
            await InstallCmake(progress);
            progress.report({ increment: 20 });
            await InstallClang(progress);
            progress.report({ increment: 20 });
            await createEmptyProject();
            progress.report({ increment: 20 });
            vscode.window.showInformationMessage("Glist Engine Installed Successfully.");
            installation = false;
        });
    }
}
exports.InstallGlistEngine = InstallGlistEngine;
function createDirectories() {
    fs.ensureDirSync(globals.glistappsPath);
    fs.ensureDirSync(globals.glistpluginsPath);
    fs.removeSync(globals.tempPath);
    fs.ensureDirSync(globals.tempPath);
}
exports.createDirectories = createDirectories;
async function InstallEngine(progress) {
    progress.report({ message: "Installing Engine", increment: 0 });
    await fs.remove(path.join(globals.glistPath, "GlistEngine"));
    await GitProcesses.CloneRepository(globals.glistEngineUrl, globals.glistPath, "GlistEngine", false);
}
async function InstallCmake(progress) {
    const zipFilePath = path.join(globals.tempPath, 'CMake.zip');
    await FileProcesses.DownloadFile(globals.glistCmakeUrl, zipFilePath, "Downloading CMake");
    progress.report({ message: "Extracting CMake", increment: 0 });
    await fs.remove(path.join(globals.glistZbinPath, 'CMake'));
    FileProcesses.ExtractArchive(zipFilePath, globals.glistZbinPath, "CMake Binaries Installed.");
}
async function InstallClang(progress) {
    const zipFilePath = path.join(globals.tempPath, 'clang64.zip');
    await FileProcesses.DownloadFile(globals.glistClangUrl, zipFilePath, "Downloading Clang");
    progress.report({ message: "Extracting Clang", increment: 0 });
    await fs.remove(path.join(globals.glistZbinPath, 'clang64'));
    FileProcesses.ExtractArchive(zipFilePath, globals.glistZbinPath, "Clang Binaries Installed.");
}
async function createEmptyProject() {
    vscode.window.showInformationMessage("Creating Empty Project");
    ProjectProcesses.CreateNewProject("GlistApp");
}
//# sourceMappingURL=InstallEngine.js.map