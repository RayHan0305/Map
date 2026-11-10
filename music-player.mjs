const player = document.getElementById('music-player');
const audio = document.getElementById('music-audio');
const input = document.getElementById('music-file');
const status = document.getElementById('music-status');
let objectUrl;

if (audio.hasAttribute('src')) {
  audio.hidden = false;
  status.textContent = '点播放开始。';
}

input.addEventListener('change', () => {
  const [file] = input.files;
  if (!file) return;

  const previous = objectUrl;
  objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  audio.preload = 'metadata';
  audio.hidden = false;
  status.textContent = '已选择 ' + file.name + '，点播放开始。';
  if (previous) URL.revokeObjectURL(previous);
});

audio.addEventListener('play', () => player.setAttribute('data-playing', ''));
audio.addEventListener('pause', () => player.removeAttribute('data-playing'));
audio.addEventListener('error', () => {
  player.removeAttribute('data-playing');
  input.value = '';
  status.textContent = '这个音频无法播放。可以重新选择 MP3 或 M4A 文件。';
});

document.addEventListener('pointerdown', (event) => {
  if (player.open && !player.contains(event.target)) player.open = false;
});
player.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !player.open) return;
  event.stopPropagation();
  player.open = false;
  player.querySelector('summary').focus();
});
