import * as path from 'path';
import * as os from 'os';
import * as FileProcesses from './FileProcesses';



export const currentDrive = FileProcesses.GetGlistDrive();

export const tempPath = path.join(os.tmpdir(), "GlistVSCodeInstaller");
export const glistappsPath = path.join(currentDrive, "\\dev\\glist\\myglistapps\\");
export const glistEnginePath = path.join(currentDrive, "\\dev\\glist\\GlistEngine\\engine");
export const glistZbinPath = path.join(currentDrive, "\\dev\\glist\\zbin\\glistzbin-win64");
export const workspaceFilePath = path.join(currentDrive, "\\dev\\glist\\Glist.code-workspace");
export const glistpluginsPath = path.join(currentDrive, "\\dev\\glist\\glistplugins");
export const glistPath = path.join(currentDrive, "\\dev\\glist");

export const glistAppUrl = "https://github.com/javertus/GlistApp-vscode";
export const glistPluginsUrl = "https://github.com/GlistPlugins/"
export const pluginReposUrl = `https://api.github.com/orgs/GlistPlugins/repos`;
export const glistEngineUrl = "https://github.com/GlistEngine/GlistEngine";
export const glistClangUrl = "https://github.com/javertus/glistzbin-win64-vscode/releases/download/Dependencies/clang64.zip";
export const glistCmakeUrl = "https://github.com/javertus/glistzbin-win64-vscode/releases/download/Dependencies/CMake.zip";
export const gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/MinGit-2.45.2-64-bit.zip";
export const ninjaUrl = "https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip";

export const vscodeSettings = {
    "extensions.ignoreRecommendations": true,
    /*"cmake.options.statusBarVisibility": "visible",
    "cmake.showOptionsMovedNotification": false,
    "cmake.configureOnOpen": true,*/
    "security.workspace.trust.enabled": false,
    "security.workspace.trust.banner": "never",
    "security.workspace.trust.untrustedFiles": "open",
    "security.workspace.trust.startupPrompt": "never",
    "C_Cpp.debugShortcut": false,
    "git.openRepositoryInParentFolders": "never",
    "C_Cpp.default.compilerPath": currentDrive.at(0) + ":\\dev\\glist\\zbin\\glistzbin-win64\\clang64\\bin\\clang++.exe",
    "C_Cpp.default.includePath": [
        "${workspaceFolder}/**",
        "${workspaceFolder}/../../glistplugins/**",
        "${workspaceFolder}/../../GlistEngine/**",
        "${workspaceFolder}/../../zbin/glistzbin-win64/clang64/include/**"
    ],
    "terminal.integrated.env.windows": {
        "Path": "${env:PATH};" + glistPath.split(path.sep).join("/") + "/zbin/glistzbin-win64/CMake/bin;" + glistPath.split(path.sep).join("/") + "/zbin/glistzbin-win64/clang64/bin"
    }
};

export const vscodeSettingsPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    'AppData/Roaming/Code/User/settings.json' // This path might differ based on OS and VS Code distribution
);
