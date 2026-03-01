This extension provides a set of tools for Glist development in Visual Studio Code, including:
* [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)
* [C/C++](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools)

This extension is designed for the [Glist Engine](https://github.com/GlistEngine/GlistEngine) to improve the development experience and make Visual Studio Code a practical alternative to Eclipse IDE. This extension is only compatible with Windows.

# Features

- Glist Engine Installer & Uninstaller
- Creates empty Glist projects
- Creates a workspace for your projects
- Clones projects or plugins
- Adds a project to the workspace when it's copied into the `myglistapps` folder
- Automatically create launch configurations
- Improved Indexing
- Closes the tabs of non-existent files
- Includes debugger for better debugging

And many more features...

# Known Issues

- Removing the engine folder from the workspace causes the extension host to restart. See [Issue](https://github.com/microsoft/vscode/issues/46048)
- All terminals are disposed of to prevent folder locks when deleting a project, which can also terminate unrelated running processes.