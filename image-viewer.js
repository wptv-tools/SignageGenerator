const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    ipcRenderer.on('display-image', (event, imagePath) => {
        document.getElementById('image').src = imagePath;
    });
});
