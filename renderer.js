const { ipcRenderer, remote } = require('electron');
const Sortable = require('sortablejs');
const path = require('path');

let projectFolder;

ipcRenderer.on('project-folder-selected', (event, folderPath) => {
    projectFolder = folderPath;
    console.log('Project folder selected:', projectFolder);
    loadImages();
});

window.ondragover = () => { return false; };
window.ondrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
        const filePath = e.dataTransfer.files[0].path;
        ipcRenderer.send('file-dropped', filePath);
    }
    return false;
};

ipcRenderer.on('file-copied', (event, filePath) => {
    const fileName = filePath.split(/(\\|\/)/g).pop();
    addImageToList(fileName);
});

ipcRenderer.on('delete-image-ui', (event, fileName) => {
    const listItems = document.querySelectorAll('#image-list li');
    listItems.forEach(item => {
        const span = item.querySelector('.fixed-width');
        if (span && span.innerText === fileName) {
            item.remove();
        }
    });
});

function loadImages() {
    ipcRenderer.send('load-images');
}

ipcRenderer.on('images-loaded', (event, images) => {
    const list = document.getElementById('image-list');
    list.innerHTML = '';
    images.forEach(image => addImageToList(image.name, image.alwaysShow, image.start, image.end));
});

function addImageToList(fileName, alwaysShow = true, start = null, end = null) {
    const list = document.getElementById('image-list');
    const listItem = document.createElement('li');
    listItem.innerHTML = `
        <i class="fas fa-bars handle"></i>
        <div class="thumbnail-container">
            <img src="${projectFolder}/${fileName}" alt="${fileName}" class="thumbnail">
        </div>
        <span class="fixed-width">${fileName}</span>
        <div class="field-container">
            <span class="label">Always Show</span>
            <input type="checkbox" ${alwaysShow ? 'checked' : ''} data-file="${fileName}">
        </div>
        <div class="right-aligned">
            <span class="label">Start</span>
            <input type="datetime-local" value="${start}" data-file="${fileName}" data-type="start">
        </div>
        <div class="right-aligned">
            <span class="label">End</span>
            <input type="datetime-local" value="${end}" data-file="${fileName}" data-type="end">
        </div>
        <i class="fas fa-trash delete-btn" data-file="${fileName}"></i>
    `;
    list.appendChild(listItem);

    listItem.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
        const file = e.target.dataset.file;
        const alwaysShow = e.target.checked;
        ipcRenderer.send('update-image', { file, alwaysShow });
    });

    listItem.querySelectorAll('input[type="datetime-local"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const file = e.target.dataset.file;
            const type = e.target.dataset.type;
            const value = e.target.value;
            ipcRenderer.send('update-image', { file, [type]: value });
        });
    });

    listItem.querySelector('.delete-btn').addEventListener('click', (e) => {
        const file = e.target.dataset.file;
        ipcRenderer.send('show-confirm-dialog', file);
    });

    listItem.querySelector('.thumbnail').addEventListener('click', () => {
        ipcRenderer.send('open-image', path.join(projectFolder, fileName));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('image-list');
    Sortable.create(list, {
        animation: 150,
        handle: '.handle',
        onEnd: () => {
            const items = list.querySelectorAll('li');
            const newOrder = Array.from(items).map(item => item.querySelector('.fixed-width').innerText);
            ipcRenderer.send('update-order', newOrder);
        }
    });
});
