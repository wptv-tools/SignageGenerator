const { ipcRenderer } = require('electron');

document.querySelector('.confirm').addEventListener('click', () => {
    ipcRenderer.send('confirm-dialog-response', true);
    window.close(); // Schließt das Dialogfenster
});

document.querySelector('.cancel').addEventListener('click', () => {
    ipcRenderer.send('confirm-dialog-response', false);
    window.close(); // Schließt das Dialogfenster
});
