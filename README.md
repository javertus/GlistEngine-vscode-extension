This extension includes a set of extensions for Glist development in Visual Studio Code:
* [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)
* [C/C++](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools)

This extension is made for [Glist Engine](https://github.com/GlistEngine/GlistEngine). 

# Features

- Installs the Glist Engine<br>
- Updates the Glist Engine (Coming Soon)<br>
- Installs the required extensions if doesn't exist<br>
- Installs Glist Plugins (Coming Soon)<br>
- Creates workspace for Glist Engine<br>
- Creates empty Glist Project<br>
- Quick switch into Glist Engine workspace<br>
- Adds all Glist projects in /myglistapps folder into your workspace<br>
- Deletes Project by given name<br>
- Creates new canvas or empty class to given project<br>
- Closes non-existent file tabs<br>
- Checks whether Glist projects in /myglistapps folder have necessary launch configurations for VS Code and creates the launch configuration files if doesn't exist<br>
- Debugging

# Known Issues

- After installing the engine, Visual Studio Code should be restarted manually because CMake cannot be found at path of old terminals.