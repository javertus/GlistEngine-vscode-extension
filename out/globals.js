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
exports.ninjaUrl = exports.glistCmakeUrl = exports.glistClangUrl = exports.glistEngineUrl = exports.glistAppUrl = exports.glistPath = exports.glistpluginsPath = exports.workspaceFilePath = exports.glistZbinPath = exports.glistEnginePath = exports.glistappsPath = exports.tempPath = exports.currentDrive = exports.currentDirectory = void 0;
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
exports.glistEngineUrl = "https://codeload.github.com/GlistEngine/GlistEngine/zip/refs/heads/main";
exports.glistClangUrl = "https://github.com/javertus/glistzbin-win64-vscode/releases/download/Dependencies/clang64.zip";
exports.glistCmakeUrl = "https://github.com/javertus/glistzbin-win64-vscode/releases/download/Dependencies/CMake.zip";
exports.ninjaUrl = "https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip";
//# sourceMappingURL=globals.js.map