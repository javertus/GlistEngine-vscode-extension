import * as child_process from 'child_process';
import * as process from 'process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import * as extension from './extension';
import * as FileProcesses from "./FileProcesses";
import * as WorkspaceProcesses from "./WorkspaceProcesses";
import * as ProjectProcesses from './ProjectProcesses';
import * as globals from './globals';
import kill from 'tree-kill';
import axios from 'axios';
import simpleGit from 'simple-git';
import { rimraf } from 'rimraf';

let installation = false;

export async function CheckGitInstallation(): Promise<boolean> {
    try {
        if (!process.env.PATH?.includes(extension.extensionPath + "\\git\\cmd")) process.env.PATH += ";" + extension.extensionPath + "\\git\\cmd";
        console.log(child_process.execSync("git --version").toString());
        return true;
    }
    catch {
        const result = await vscode.window.showInformationMessage(
            'Git is not found! Install, clone or update actions require Git. Do you want to install?',
            { modal: true },
            'Yes',
            'No',
        );
        if (result == 'Yes') {
            await InstallGit();
            return true;
        }
        else return false;
    }
}

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

export async function CheckRepoUpdates() {
    if (!WorkspaceProcesses.IsUserInWorkspace()) return;
    if (!(await CheckGitInstallation())) return;
    let folders = []
    folders.push({ name: "{UPDATE ALL}", path: "" });
    if (fs.existsSync(path.join(globals.glistPath, "GlistEngine", ".git"))) folders.push({ name: "GlistEngine", path: path.join(globals.glistPath, "GlistEngine") });
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
        folders.map(async folder => {
            if (folder.name + ` (${folder.path})` == selection) {
                await UpdateRepository(folder.path);
            }
        })
    }
}

async function FetchRepository(repoPath: string, silentMode: boolean = false) {
    let repoName = path.basename(repoPath);
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: silentMode ? "" : 'Fetching Updates for ' + repoName,
        cancellable: true
    }, async (progress, token) => {
        return new Promise<void>((resolve, reject) => {
            let gitProcess = child_process.spawn('git', ['fetch', '--progress'], { cwd: `${repoPath}` });
            let lastIncrementVal = 0;
            gitProcess.stderr.on('data', (data: Buffer) => {
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
            })

            token.onCancellationRequested(() => {
                if (!gitProcess.pid) return;
                kill(gitProcess.pid);
                reject("User Cancelled");
            });
        });
    });
}

async function PullRepository(repoPath: string) {
    let repoName = path.basename(repoPath);
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Updating ' + repoName,
        cancellable: true
    }, async (progress, token) => {
        return new Promise<void>((resolve, reject) => {
            let gitProcess = child_process.spawn('git', ['pull', '--progress'], { cwd: `${repoPath}` });
            gitProcess.stdout.on('data', (data: Buffer) => {
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
            })

            token.onCancellationRequested(() => {
                if (!gitProcess.pid) return;
                kill(gitProcess.pid);
                reject("User Cancelled");
            });
        });
    });
}

export async function UpdateRepository(repoPath: string, autoUpdate: boolean = false) {
    let repoName = path.basename(repoPath);
    try {
        await FetchRepository(repoPath, autoUpdate);
        const git = simpleGit(repoPath);
        const status = await git.status();
        if (status.behind > 0) {
            let update;
            autoUpdate ? update = 'Yes' : update = await vscode.window.showWarningMessage(
                repoName + ` is ${status.behind} commits behind. Do you want to update?`,
                'Yes',
                'No',
                'Show Changes'
            );

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
            if (!autoUpdate) vscode.window.showInformationMessage(repoName + ' is up to date.');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Git error while updating ${repoName}: ${error}`);
    }
}


export async function ClonePlugin() {
    if (!WorkspaceProcesses.IsUserInWorkspace()) return;
    if (!(await CheckGitInstallation())) return;
    let selection;
    try {
        const response = await axios.get<{name: string}[]>(globals.PluginReposUrl);
        const repoNames = response.data.map(repo => repo.name);
        selection = await vscode.window.showQuickPick(repoNames, { title: "Select the plugin you want to clone" });
        if (!selection) return;
        await CloneRepository(globals.glistPluginsUrl + selection, globals.glistpluginsPath, selection);
    } catch (error) {
        if (error === "User Cancelled") {
            if (!selection) return;
            rimraf(path.join(globals.glistpluginsPath, selection));
            vscode.window.showWarningMessage('Cloning cancelled');
        }
        else {
            vscode.window.showErrorMessage(`An error occurred while cloning: ${error}`);
        }
    }
}

export async function CloneRepository(url: string, clonePath: string, repoName: string, cancellable = true) {
    if (!(await CheckGitInstallation())) return;
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Cloning Repository',
        cancellable: cancellable
    }, async (progress, token) => {
        return new Promise<void>((resolve, reject) => {
            let gitProcess = child_process.spawn('git', ['clone', '--progress', url, path.join(clonePath, repoName)]);
            let lastIncrementVal = 0;

            gitProcess.stderr.on('data', (data: Buffer) => {
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
            })

            token.onCancellationRequested(() => {
                if (!gitProcess.pid) return;
                kill(gitProcess.pid);
                reject("User Cancelled");
            });
        });
    });
}

export async function CloneProject() {
    if (!WorkspaceProcesses.IsUserInWorkspace(false)) return;
    let decision = await vscode.window.showInputBox({
        placeHolder: 'Paste the Project URL here.'
    });
    if (ProjectProcesses.CheckInput(decision)) return;
    decision = decision + "";
    let repoName = GetRepoNameFromUrl(decision);
    try {
        await CloneRepository(decision, globals.glistappsPath, repoName)
        await WorkspaceProcesses.AddNewProjectToWorkspace(repoName);
        const filesToOpen = [
            path.join(globals.glistappsPath, repoName, 'src', 'gCanvas.h'),
            path.join(globals.glistappsPath, repoName, 'src', 'gCanvas.cpp')
        ];
        await ProjectProcesses.OpenFiles(filesToOpen);
    }
    catch (err) {
        if (err === "User Cancelled") {
            rimraf(path.join(globals.glistappsPath, repoName));
            vscode.window.showWarningMessage('Cloning cancelled');
        }
        else {
            vscode.window.showErrorMessage(`An error occured while cloning ${repoName}: ${err}`);
        }
    }
}

function GetRepoNameFromUrl(url: string): string {
    const parts = url.split('/');
    const lastPart = parts.pop();
    return lastPart?.replace('.git', '') || '';
}