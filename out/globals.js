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
exports.vscodeSettingsPath = exports.vscodeSettings = exports.ninjaUrl = exports.gitUrl = exports.glistCmakeUrl = exports.glistClangUrl = exports.glistEngineUrl = exports.PluginReposUrl = exports.glistPluginsUrl = exports.glistAppUrl = exports.glistPath = exports.glistpluginsPath = exports.workspaceFilePath = exports.glistZbinPath = exports.glistEnginePath = exports.glistappsPath = exports.tempPath = exports.currentDrive = exports.currentDirectory = void 0;
const path = __importStar(require("path"));
const os = __importStar(require("os"));
exports.currentDirectory = process.cwd();
exports.currentDrive = path.parse(exports.currentDirectory).root;
exports.tempPath = path.join(os.tmpdir(), "GlistVSCodeInstaller");
exports.glistappsPath = path.join(exports.currentDrive, "\\dev\\glist\\myglistapps\\");
exports.glistEnginePath = path.join(exports.currentDrive, "\\dev\\glist\\GlistEngine\\engine");
exports.glistZbinPath = path.join(exports.currentDrive, "\\dev\\glist\\zbin\\glistzbin-win64");
exports.workspaceFilePath = path.join(exports.currentDrive, "\\dev\\glist\\Glist.code-workspace");
exports.glistpluginsPath = path.join(exports.currentDrive, "\\dev\\glist\\glistplugins");
exports.glistPath = path.join(exports.currentDrive, "\\dev\\glist");
exports.glistAppUrl = "https://codeload.github.com/javertus/GlistApp-vscode/zip/refs/heads/main";
exports.glistPluginsUrl = "https://github.com/GlistPlugins/";
exports.PluginReposUrl = `https://api.github.com/orgs/GlistPlugins/repos`;
exports.glistEngineUrl = "https://github.com/GlistEngine/GlistEngine";
exports.glistClangUrl = "https://github.com/javertus/glistzbin-win64-vscode/releases/download/Dependencies/clang64.zip";
exports.glistCmakeUrl = "https://github.com/javertus/glistzbin-win64-vscode/releases/download/Dependencies/CMake.zip";
exports.gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/MinGit-2.45.2-64-bit.zip";
exports.ninjaUrl = "https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip";
exports.vscodeSettings = {
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
    "C_Cpp.default.compilerPath": exports.currentDrive.at(0) + ":\\dev\\glist\\zbin\\glistzbin-win64\\clang64\\bin\\clang++.exe",
    "C_Cpp.default.includePath": [
        "${workspaceFolder}/**",
        "${workspaceFolder}/../../glistplugins/**",
        "${workspaceFolder}/../../GlistEngine/**",
        "${workspaceFolder}/../../zbin/glistzbin-win64/clang64/include/**"
    ],
    "terminal.integrated.env.windows": {
        "Path": "${env:PATH};" + exports.glistPath.split(path.sep).join("/") + "/zbin/glistzbin-win64/CMake/bin"
    }
};
exports.vscodeSettingsPath = path.join(process.env.HOME || process.env.USERPROFILE || '', 'AppData/Roaming/Code/User/settings.json' // This path might differ based on OS and VS Code distribution
);
//# sourceMappingURL=globals.js.map