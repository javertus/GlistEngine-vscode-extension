import * as path from 'path';
import * as os from 'os';



export const currentDirectory = process.cwd();
export const currentDrive = path.parse(currentDirectory).root;

export const tempPath = path.join(os.tmpdir(), "GlistVSCodeInstaller");
export const glistappsPath = path.join(currentDrive, "\\dev\\glist\\myglistapps\\");
export const glistEnginePath = path.join(currentDrive, "\\dev\\glist\\GlistEngine\\engine");
export const glistZbinPath = path.join(currentDrive, "\\dev\\glist\\zbin\\glistzbin-win64");
export const workspaceFilePath = path.join(currentDrive, "\\dev\\glist\\Glist.code-workspace");
export const glistpluginsPath = path.join(currentDrive, "\\dev\\glist\\glistplugins");
export const glistPath = path.join(currentDrive, "\\dev\\glist");

export const glistAppUrl = "https://codeload.github.com/javertus/GlistApp-vscode/zip/refs/heads/main";
export const glistEngineUrl = "https://codeload.github.com/GlistEngine/GlistEngine/zip/refs/heads/main";
export const glistClangUrl = "https://github.com/javertus/glistzbin-win64-vscode/releases/download/Dependencies/clang64.zip";
export const glistCmakeUrl = "https://github.com/javertus/glistzbin-win64-vscode/releases/download/Dependencies/CMake.zip";
export const ninjaUrl = "https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip";