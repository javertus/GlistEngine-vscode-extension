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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloneProject = exports.CloneRepository = exports.ClonePlugin = exports.UpdateRepository = exports.CheckRepoUpdates = exports.CheckGitInstallation = void 0;
const child_process = __importStar(require("child_process"));
const process = __importStar(require("process"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const vscode = __importStar(require("vscode"));
const extension = __importStar(require("./extension"));
const FileProcesses = __importStar(require("./FileProcesses"));
const WorkspaceProcesses = __importStar(require("./WorkspaceProcesses"));
const ProjectProcesses = __importStar(require("./ProjectProcesses"));
const globals = __importStar(require("./globals"));
const tree_kill_1 = __importDefault(require("tree-kill"));
const axios_1 = __importDefault(require("axios"));
const simple_git_1 = __importDefault(require("simple-git"));
const rimraf_1 = require("rimraf");
let installation = false;
async function CheckGitInstallation() {
    try {
        if (!process.env.PATH?.includes(extension.extensionPath + "\\git\\cmd"))
            process.env.PATH += ";" + extension.extensionPath + "\\git\\cmd";
        console.log(child_process.execSync("git --version").toString());
        return true;
    }
    catch {
        const result = await vscode.window.showInformationMessage('Git is not found! Install, clone or update actions require Git. Do you want to install?', { modal: true }, 'Yes', 'No');
        if (result == 'Yes') {
            await InstallGit();
            return true;
        }
        else
            return false;
    }
}
exports.CheckGitInstallation = CheckGitInstallation;
async function InstallGit() {
    if (installation) {
        vscode.window.showErrorMessage("You can't run this action before Git is installed!");
        return;
    }
    installation = true;
    fs.ensureDirSync(globals.tempPath);
    const zipFilePath = path.join(globals.tempPath, 'git.zip');
    await FileProcesses.DownloadFile(globals.gitUrl, zipFilePath, "Downloading Git");
    fs.ensureDir(path.join(extension.extensionPath, "git"));
    FileProcesses.ExtractArchive(zipFilePath, path.join(extension.extensionPath, "git"), "Git Installed.");
    installation = false;
}
async function CheckRepoUpdates() {
    if (!WorkspaceProcesses.IsUserInWorkspace())
        return;
    if (!(await CheckGitInstallation()))
        return;
    let folders = [];
    folders.push({ name: "{UPDATE ALL}", path: "" });
    if (fs.existsSync(path.join(globals.glistPath, "GlistEngine", ".git")))
        folders.push({ name: "GlistEngine", path: path.join(globals.glistPath, "GlistEngine") });
    FileProcesses.GetSubfolders(globals.glistappsPath).map(folder => {
        if (fs.existsSync(path.join(folder, ".git"))) {
            folders.push({ name: path.basename(folder), path: folder });
        }
    });
    FileProcesses.GetSubfolders(globals.glistpluginsPath).map(folder => {
        if (fs.existsSync(path.join(folder, ".git"))) {
            folders.push({ name: path.basename(folder), path: folder });
        }
    });
    let selection = await vscode.window.showQuickPick(folders.map(folder => folder.name + ((folder.path) ? ` (${folder.path})` : "")), { title: "Select the repo you want to check updates" });
    if (selection == folders[0].name) {
        for (let i = 1; i < folders.length; i++) {
            await UpdateRepository(folders[i].path);
        }
    }
    else {
        folders.map(async (folder) => {
            if (folder.name + ` (${folder.path})` == selection) {
                await UpdateRepository(folder.path);
            }
        });
    }
}
exports.CheckRepoUpdates = CheckRepoUpdates;
async function FetchRepository(repoPath, silentMode = false) {
    let repoName = path.basename(repoPath);
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: silentMode ? "" : 'Fetching Updates for ' + repoName,
        cancellable: true
    }, async (progress, token) => {
        return new Promise((resolve, reject) => {
            let gitProcess = child_process.spawn('git', ['fetch', '--progress'], { cwd: `${repoPath}` });
            let lastIncrementVal = 0;
            gitProcess.stderr.on('data', (data) => {
                if (data.toString().match("error:") || data.toString().match("fatal:")) {
                    reject(data.toString());
                }
                const progressMatch = data.toString().match(/([0-9]+)%/);
                if (progressMatch) {
                    progress.report({
                        message: silentMode ? `Fetching Updates for ${repoName}: ${data}` : `${data}`,
                        increment: parseFloat(progressMatch[1]) - lastIncrementVal
                    });
                    lastIncrementVal = parseFloat(progressMatch[1]);
                }
            });
            gitProcess.on('close', (code) => {
                if (code == 0) {
                    resolve();
                }
            });
            token.onCancellationRequested(() => {
                if (!gitProcess.pid)
                    return;
                (0, tree_kill_1.default)(gitProcess.pid);
                reject("User Cancelled");
            });
        });
    });
}
async function PullRepository(repoPath) {
    let repoName = path.basename(repoPath);
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Updating ' + repoName,
        cancellable: true
    }, async (progress, token) => {
        return new Promise((resolve, reject) => {
            let gitProcess = child_process.spawn('git', ['pull', '--progress'], { cwd: `${repoPath}` });
            gitProcess.stdout.on('data', (data) => {
                if (data.toString().match("error:") || data.toString().match("fatal:")) {
                    reject(data.toString());
                }
                progress.report({ message: `${data}` });
            });
            gitProcess.on('close', (code) => {
                if (code == 0) {
                    vscode.window.showInformationMessage(repoName + ' is updated successfully');
                    resolve();
                }
            });
            token.onCancellationRequested(() => {
                if (!gitProcess.pid)
                    return;
                (0, tree_kill_1.default)(gitProcess.pid);
                reject("User Cancelled");
            });
        });
    });
}
async function UpdateRepository(repoPath, autoUpdate = false) {
    let repoName = path.basename(repoPath);
    try {
        await FetchRepository(repoPath, autoUpdate);
        const git = (0, simple_git_1.default)(repoPath);
        const status = await git.status();
        if (status.behind > 0) {
            let update;
            autoUpdate ? update = 'Yes' : update = await vscode.window.showWarningMessage(repoName + ` is ${status.behind} commits behind. Do you want to update?`, 'Yes', 'No', 'Show Changes');
            if (update == 'Yes') {
                PullRepository(repoPath);
            }
            else if (update == 'Show Changes') {
                const diff = await git.diff(['HEAD', 'origin/main']);
                const document = await vscode.workspace.openTextDocument({
                    content: diff,
                    language: 'diff'
                });
                await vscode.window.showTextDocument(document);
            }
        }
        else {
            if (!autoUpdate)
                vscode.window.showInformationMessage(repoName + ' is up to date.');
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Git error while updating ${repoName}: ${error}`);
    }
}
exports.UpdateRepository = UpdateRepository;
async function ClonePlugin() {
    if (!WorkspaceProcesses.IsUserInWorkspace())
        return;
    if (!(await CheckGitInstallation()))
        return;
    let selection;
    try {
        const response = await axios_1.default.get(globals.pluginReposUrl);
        const repoNames = response.data.map(repo => repo.name);
        selection = await vscode.window.showQuickPick(repoNames, { title: "Select the plugin you want to clone" });
        if (!selection)
            return;
        await CloneRepository(globals.glistPluginsUrl + selection, globals.glistpluginsPath, selection);
    }
    catch (error) {
        if (error === "User Cancelled") {
            if (!selection)
                return;
            (0, rimraf_1.rimraf)(path.join(globals.glistpluginsPath, selection));
            vscode.window.showWarningMessage('Cloning cancelled');
        }
        else {
            vscode.window.showErrorMessage(`An error occurred while cloning: ${error}`);
        }
    }
}
exports.ClonePlugin = ClonePlugin;
async function CloneRepository(url, clonePath, repoName, cancellable = true) {
    if (!(await CheckGitInstallation()))
        return;
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Cloning Repository',
        cancellable: cancellable
    }, async (progress, token) => {
        return new Promise((resolve, reject) => {
            let gitProcess = child_process.spawn('git', ['clone', '--progress', url, path.join(clonePath, repoName)]);
            let lastIncrementVal = 0;
            gitProcess.stderr.on('data', (data) => {
                if (data.toString().match("error:") || data.toString().match("fatal:")) {
                    reject(data.toString());
                }
                const progressMatch = data.toString().match(/([0-9]+)%/);
                if (progressMatch) {
                    progress.report({
                        message: `${data}`,
                        increment: parseFloat(progressMatch[1]) - lastIncrementVal
                    });
                    lastIncrementVal = parseFloat(progressMatch[1]);
                }
            });
            gitProcess.on('close', (code) => {
                if (code == 0) {
                    vscode.window.showInformationMessage(repoName + ' cloned successfully');
                    resolve();
                }
            });
            token.onCancellationRequested(() => {
                if (!gitProcess.pid)
                    return;
                (0, tree_kill_1.default)(gitProcess.pid);
                reject("User Cancelled");
            });
        });
    });
}
exports.CloneRepository = CloneRepository;
async function CloneProject() {
    if (!WorkspaceProcesses.IsUserInWorkspace(false))
        return;
    let decision = await vscode.window.showInputBox({
        placeHolder: 'Paste the Project URL here.'
    });
    if (ProjectProcesses.CheckInput(decision))
        return;
    decision = decision + "";
    let repoName = GetRepoNameFromUrl(decision);
    try {
        await CloneRepository(decision, globals.glistappsPath, repoName);
        await WorkspaceProcesses.AddNewProjectToWorkspace(repoName);
        const filesToOpen = [
            path.join(globals.glistappsPath, repoName, 'src', 'gCanvas.h'),
            path.join(globals.glistappsPath, repoName, 'src', 'gCanvas.cpp')
        ];
        await ProjectProcesses.OpenFiles(filesToOpen);
    }
    catch (err) {
        if (err === "User Cancelled") {
            (0, rimraf_1.rimraf)(path.join(globals.glistappsPath, repoName));
            vscode.window.showWarningMessage('Cloning cancelled');
        }
        else {
            vscode.window.showErrorMessage(`An error occured while cloning ${repoName}: ${err}`);
        }
    }
}
exports.CloneProject = CloneProject;
function GetRepoNameFromUrl(url) {
    const parts = url.split('/');
    const lastPart = parts.pop();
    return lastPart?.replace('.git', '') || '';
}
//# sourceMappingURL=GitProcesses.js.map