import { exportBackup, importBackup } from './backup-data.mjs';

const dialog = document.getElementById('backup-dialog');
const open = document.getElementById('open-backup');
const close = document.getElementById('close-backup');
const download = document.getElementById('export-backup');
const form = document.getElementById('backup-import-form');
const input = document.getElementById('backup-file');
const restore = document.getElementById('import-backup');
const refresh = document.getElementById('refresh-after-backup');
const status = document.getElementById('backup-status');

let busy = false;
let hasChanges = false;

function showStatus(message, error = false) {
  status.toggleAttribute('data-error', error);
  status.textContent = message;
}

function syncControls() {
  for (const control of [close, download, input, refresh]) control.disabled = busy;
  restore.disabled = busy || !input.files.length;
  refresh.hidden = !hasChanges;
}

function closeDialog() {
  if (hasChanges) location.reload();
  else dialog.close();
}

open.addEventListener('click', () => {
  showStatus('');
  dialog.showModal();
});
open.hidden = false;
close.addEventListener('click', closeDialog);
refresh.addEventListener('click', () => location.reload());
dialog.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') event.stopPropagation();
});
dialog.addEventListener('cancel', (event) => {
  if (!busy && !hasChanges) return;
  event.preventDefault();
  if (!busy) closeDialog();
});
input.addEventListener('change', syncControls);

download.addEventListener('click', async () => {
  busy = true;
  syncControls();
  showStatus('正在准备备份…');
  try {
    const blob = await exportBackup();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'beiki-map-相册备份-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    showStatus('备份已生成。请在新网址打开「相册备份与迁移」，选择下载的文件导入。');
  } catch (error) {
    showStatus(error.message || '无法导出相册备份。', true);
  } finally {
    busy = false;
    syncControls();
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const [file] = input.files;
  if (!file || busy) return;
  busy = true;
  syncControls();
  showStatus('正在读取备份…');
  try {
    const { addedPlaces, addedPhotos, addedEdits, skippedPhotos } = await importBackup(file);
    hasChanges ||= Boolean(addedPlaces || addedPhotos || addedEdits);
    input.value = '';
    const added = `已导入 ${addedPlaces} 个地点、${addedPhotos} 张照片和 ${addedEdits} 条编辑记录。`;
    const skipped = skippedPhotos ? `已保留 ${skippedPhotos} 张重复照片。` : '';
    showStatus(added + skipped + (hasChanges ? '刷新后可在地图和旅程中查看。' : ''));
  } catch (error) {
    showStatus(error.message || '无法导入相册备份。', true);
  } finally {
    busy = false;
    syncControls();
    if (hasChanges && !input.files.length) refresh.focus();
  }
});
