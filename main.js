const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let projectFolder;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    const template = [
        {
            label: app.name,
            submenu: [
                {
                    label: 'Neues Projekt',
                    accelerator: 'CmdOrCtrl+N',
                    click() {
                        dialog.showOpenDialog(mainWindow, {
                            properties: ['openDirectory', 'createDirectory']
                        }).then(result => {
                            if (!result.canceled) {
                                projectFolder = result.filePaths[0];
                                mainWindow.webContents.send('project-folder-selected', projectFolder);
                            }
                        }).catch(err => {
                            console.error("Error selecting folder:", err);
                        });
                    }
                },
                {
                    label: 'Beenden',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
                    click() {
                        app.quit();
                    }
                }
            ]
        }
    ];

    if (process.platform === 'darwin') {
        template.unshift({
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });
    } else {
        template.push({
            label: 'Datei',
            submenu: [
                { role: 'quit', accelerator: 'Alt+F4' }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.on('files-dropped', (event, filePaths) => {
    if (projectFolder) {
        filePaths.forEach(filePath => {
            const fileName = path.basename(filePath);
            const destination = path.join(projectFolder, fileName);
            fs.copyFile(filePath, destination, (err) => {
                if (err) {
                    console.error('File copy failed:', err);
                } else {
                    updateJSON(fileName); // Ensure updateJSON is defined
                    event.reply('file-copied', destination);
                }
            });
        });
    }
});

ipcMain.on('load-images', (event) => {
    const jsonPath = path.join(projectFolder, 'images.json');
    if (fs.existsSync(jsonPath)) {
        const jsonData = fs.readFileSync(jsonPath, 'utf-8');
        let images = JSON.parse(jsonData);

        images = images.filter(image => {
            const imagePath = path.join(projectFolder, image.name);
            if (fs.existsSync(imagePath)) {
                return true;
            } else {
                console.log(`File ${image.name} does not exist, removing from JSON.`);
                return false;
            }
        });

        fs.writeFileSync(jsonPath, JSON.stringify(images, null, 2), 'utf-8');
        event.reply('images-loaded', images);
    }
});

ipcMain.on('update-image', (event, image) => {
    updateJSON(image.file, image);
});

ipcMain.on('update-order', (event, newOrder) => {
    const jsonPath = path.join(projectFolder, 'images.json');
    if (fs.existsSync(jsonPath)) {
        const jsonData = fs.readFileSync(jsonPath, 'utf-8');
        let images = JSON.parse(jsonData);
        images.sort((a, b) => newOrder.indexOf(a.name) - newOrder.indexOf(b.name));
        fs.writeFileSync(jsonPath, JSON.stringify(images, null, 2), 'utf-8');
    }
});

ipcMain.on('delete-image', (event, fileName) => {
    if (projectFolder) {
        const filePath = path.join(projectFolder, fileName);
        const jsonPath = path.join(projectFolder, 'images.json');
        let fileDeleted = false;
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            fileDeleted = true;
        }
        if (fs.existsSync(jsonPath)) {
            const jsonData = fs.readFileSync(jsonPath, 'utf-8');
            let images = JSON.parse(jsonData);
            const initialLength = images.length;
            images = images.filter(img => img.name !== fileName);
            if (images.length !== initialLength) {
                fs.writeFileSync(jsonPath, JSON.stringify(images, null, 2), 'utf-8');
            }
        }
        if (fileDeleted) {
            mainWindow.webContents.send('delete-image-ui', fileName);
        }
    }
});

ipcMain.on('open-image', (event, imagePath) => {
    const imageWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    imageWindow.loadFile('image-viewer.html');
    imageWindow.webContents.on('did-finish-load', () => {
        imageWindow.webContents.send('display-image', imagePath);
    });
});

ipcMain.on('show-confirm-dialog', (event, fileName) => {
    deleteFileName = fileName;
    confirmWindow = new BrowserWindow({
        width: 400,
        height: 300,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    confirmWindow.loadFile('confirm-dialog.html');
});

ipcMain.on('confirm-dialog-response', (event, response) => {
    if (response && deleteFileName) {
        ipcMain.emit('delete-image', null, deleteFileName);
    }
    deleteFileName = null;
    if (confirmWindow) {
        confirmWindow.close();
        confirmWindow = null;
    }
});

function updateJSON(fileName, update = null) {
    const jsonPath = path.join(projectFolder, 'images.json');
    let images = [];
    if (fs.existsSync(jsonPath)) {
        const jsonData = fs.readFileSync(jsonPath, 'utf-8');
        images = JSON.parse(jsonData);
    }
    const index = images.findIndex(img => img.name === fileName);
    if (index !== -1 && update) {
        const { file, ...rest } = update;
        images[index] = { ...images[index], ...rest };
    } else if (index === -1) {
        images.push({ name: fileName, alwaysShow: true, start: null, end: null });
    }
    fs.writeFileSync(jsonPath, JSON.stringify(images, null, 2), 'utf-8');
}
