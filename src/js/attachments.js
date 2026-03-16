import { UI } from './strings.js';

const MAX_FILES = 5;
const MAX_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = ['image/', 'video/'];

export class AttachmentManager {
  constructor(containerEl) {
    this._container = containerEl;
    this._files = [];
    this._objectUrls = [];
  }

  getFiles() {
    return [...this._files];
  }

  getCount() {
    return this._files.length;
  }

  addFiles(fileList) {
    const incoming = Array.from(fileList);

    for (const file of incoming) {
      if (!ALLOWED_TYPES.some(t => file.type.startsWith(t))) {
        return UI.ATTACH_TYPE_NOT_ALLOWED(file.name);
      }
      if (file.size > MAX_SIZE_BYTES) {
        return UI.ATTACH_TOO_LARGE(file.name);
      }
    }

    if (this._files.length + incoming.length > MAX_FILES) {
      return UI.ATTACH_MAX_FILES(MAX_FILES, this._files.length);
    }

    this._files.push(...incoming);
    this.render();
    return null;
  }

  removeFile(index) {
    if (index < 0 || index >= this._files.length) return;
    this._files.splice(index, 1);
    if (this._objectUrls[index]) {
      URL.revokeObjectURL(this._objectUrls[index]);
      this._objectUrls.splice(index, 1);
    }
    this.render();
  }

  clear() {
    this._objectUrls.forEach(url => URL.revokeObjectURL(url));
    this._files = [];
    this._objectUrls = [];
    this._container.innerHTML = '';
  }

  render() {
    this._objectUrls.forEach(url => URL.revokeObjectURL(url));
    this._objectUrls = [];
    this._container.innerHTML = '';

    if (this._files.length === 0) return;

    const grid = document.createElement('div');
    grid.className = 'attachment-grid';

    this._files.forEach((file, i) => {
      const url = URL.createObjectURL(file);
      this._objectUrls.push(url);

      const thumb = document.createElement('div');
      thumb.className = 'attachment-thumb';

      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = file.name;
        thumb.appendChild(img);
      } else {
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        thumb.appendChild(video);
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'attachment-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', () => this.removeFile(i));
      thumb.appendChild(removeBtn);

      const name = document.createElement('span');
      name.className = 'attachment-name';
      const displayName = file.name.length > 15
        ? file.name.slice(0, 12) + '...'
        : file.name;
      name.textContent = displayName;
      thumb.appendChild(name);

      grid.appendChild(thumb);
    });

    this._container.appendChild(grid);
  }
}
