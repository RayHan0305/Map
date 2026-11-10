const fullCrop = { x: 0, y: 0, width: 1, height: 1 };
const minimumCrop = 0.01;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const normalizeRotation = (angle) => Number.isFinite(angle) ? ((Math.round(angle / 90) * 90) % 360 + 360) % 360 : 0;
const tidy = (value) => Number(value.toFixed(6));

function normalizeCrop(crop) {
  if (!crop || ![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite)) return { ...fullCrop };
  const x = clamp(tidy(crop.x), 0, 1 - minimumCrop);
  const y = clamp(tidy(crop.y), 0, 1 - minimumCrop);
  return {
    x, y,
    width: clamp(tidy(crop.width), minimumCrop, tidy(1 - x)),
    height: clamp(tidy(crop.height), minimumCrop, tidy(1 - y)),
  };
}

function rotateCrop(crop, rotation) {
  let rectangle = crop;
  for (let turn = 0; turn < rotation; turn += 90) {
    const { x, y, width, height } = rectangle;
    rectangle = { x: 1 - y - height, y: x, width: height, height: width };
  }
  return normalizeCrop(rectangle);
}

function equalCrop(first, second) {
  return first.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(action, text, kind = 'secondary') {
  const node = element('button', 'button ' + kind, text);
  node.type = 'button';
  node.dataset.editAction = action;
  return node;
}

function drawImage(canvas, image, rotation, source) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  const { width, height } = canvas;
  const swap = rotation % 180 !== 0;
  const targetWidth = swap ? height : width;
  const targetHeight = swap ? width : height;
  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(width / 2, height / 2);
  context.rotate(rotation * Math.PI / 180);
  context.drawImage(image, source.x, source.y, source.width, source.height,
    -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
  context.restore();
  return context;
}

async function renderImage(image, rotation, crop, type) {
  const originalWidth = image.naturalWidth;
  const originalHeight = image.naturalHeight;
  const x = clamp(Math.round(crop.x * originalWidth), 0, originalWidth - 1);
  const y = clamp(Math.round(crop.y * originalHeight), 0, originalHeight - 1);
  const width = clamp(Math.round((crop.x + crop.width) * originalWidth) - x, 1, originalWidth - x);
  const height = clamp(Math.round((crop.y + crop.height) * originalHeight) - y, 1, originalHeight - y);
  const swap = rotation % 180 !== 0;
  // Keep very large edited renders within browser canvas limits. The original stays intact.
  const scale = Math.min(1, 8192 / Math.max(width, height), Math.sqrt(24000000 / (width * height)));
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round((swap ? height : width) * scale));
  output.height = Math.max(1, Math.round((swap ? width : height) * scale));
  drawImage(output, image, rotation, { x, y, width, height });
  const format = type === 'image/jpeg' || type === 'image/webp' ? type : 'image/png';
  const blob = await new Promise((resolve) => output.toBlob(resolve, format, 0.94));
  if (!blob) throw new Error('Photo encoding failed');
  return blob;
}

/** Crop is relative to the original displayed image, before user rotation. */
export function openPhotoEditor(photo, { onSave }) {
  const existing = document.getElementById('photo-editor');
  if (existing?.open) return existing;
  existing?.remove();

  const previousFocus = document.activeElement;
  const initialRotation = normalizeRotation(photo.edit?.rotation || 0);
  const initialCrop = normalizeCrop(photo.edit?.crop);
  let rotation = initialRotation;
  let crop = { ...initialCrop };
  let busy = false;
  let ready = false;
  let gesture = null;
  const objectUrl = photo.blob instanceof Blob ? URL.createObjectURL(photo.blob) : null;
  const image = new Image();

  const dialog = element('dialog', 'photo-editor');
  dialog.id = 'photo-editor';
  dialog.setAttribute('aria-labelledby', 'photo-editor-title');
  const header = element('div', 'dialog-top photo-editor-header');
  const heading = element('div');
  const title = element('h2', '', '编辑照片');
  title.id = 'photo-editor-title';
  const name = element('p', 'photo-editor-filename', photo.name || '旅行照片');
  heading.append(title, name);
  const cancel = button('cancel', '取消', 'quiet');
  cancel.autofocus = true;
  header.append(heading, cancel);

  const viewfinder = element('div', 'photo-editor-viewfinder');
  const preview = element('canvas', 'photo-editor-preview');
  preview.id = 'photo-edit-preview';
  preview.setAttribute('role', 'img');
  preview.setAttribute('aria-label', '照片裁剪预览，可在下方输入精确范围');
  preview.hidden = true;
  const loading = element('p', 'photo-editor-loading', '正在读取照片…');
  loading.setAttribute('role', 'status');
  viewfinder.append(loading, preview);

  const transform = element('div', 'photo-editor-transform');
  const left = button('rotate-left', '向左旋转');
  const right = button('rotate-right', '向右旋转');
  const resetCrop = button('reset-crop', '重设裁剪', 'quiet');
  const angle = element('output', 'photo-editor-angle');
  angle.setAttribute('aria-live', 'polite');
  transform.append(left, right, resetCrop, angle);

  const cropControls = element('fieldset', 'photo-editor-crop');
  const legend = element('legend', '', '裁剪范围（%）');
  const hint = element('p', 'photo-editor-hint', '在照片上拖出裁剪框，或输入下方的百分比。');
  hint.id = 'photo-crop-hint';
  cropControls.setAttribute('aria-describedby', hint.id);
  const fields = element('div', 'photo-editor-crop-fields');
  const inputs = new Map();
  for (const [key, label] of [['x', '距左边'], ['y', '距上边'], ['width', '宽度'], ['height', '高度']]) {
    const wrapper = element('label', '', label);
    const input = element('input', 'text-input');
    input.type = 'number';
    input.min = key === 'width' || key === 'height' ? '1' : '0';
    input.max = '100';
    input.step = 'any';
    input.dataset.cropField = key;
    input.setAttribute('aria-label', label + '百分比');
    input.addEventListener('change', updateCropFromFields);
    inputs.set(key, input);
    wrapper.append(input);
    fields.append(wrapper);
  }
  cropControls.append(legend, hint, fields);

  const noteLabel = element('label', 'photo-editor-note', '照片备注');
  const note = element('textarea', 'text-input');
  note.id = 'photo-edit-note';
  note.rows = 2;
  note.maxLength = 160;
  note.placeholder = '写一句当时的回忆';
  note.value = photo.edit?.note ?? photo.note ?? '';
  noteLabel.append(note);
  const errorMessage = element('p', 'photo-editor-error');
  errorMessage.setAttribute('role', 'alert');
  errorMessage.hidden = true;

  const footer = element('div', 'dialog-actions photo-editor-footer');
  const restore = button('restore', '恢复原图', 'quiet');
  restore.setAttribute('aria-label', '恢复原图和原备注');
  restore.title = '恢复原图和原备注';
  const save = button('save', '保存编辑', 'primary');
  footer.append(restore, save);
  dialog.append(header, viewfinder, transform, cropControls, noteLabel, errorMessage, footer);
  document.body.append(dialog);

  function updateControls() {
    for (const control of [left, right, resetCrop, cropControls, save]) control.disabled = !ready || busy;
    cancel.disabled = restore.disabled = note.disabled = busy;
    save.textContent = busy ? '正在保存…' : '保存编辑';
    dialog.setAttribute('aria-busy', String(busy));
  }

  function updateCropFromFields(event) {
    const shown = rotateCrop(crop, rotation);
    const input = event.currentTarget;
    if (Number.isFinite(input.valueAsNumber)) shown[input.dataset.cropField] = input.valueAsNumber / 100;
    crop = rotateCrop(normalizeCrop(shown), normalizeRotation(-rotation));
    renderPreview();
  }

  function renderPreview() {
    const shown = rotateCrop(crop, rotation);
    for (const [key, input] of inputs) input.value = String(Number((shown[key] * 100).toFixed(2)));
    angle.textContent = '旋转 ' + rotation + '°';
    preview.dataset.rotation = String(rotation);
    if (!ready) return;

    const swap = rotation % 180 !== 0;
    const width = swap ? image.naturalHeight : image.naturalWidth;
    const height = swap ? image.naturalWidth : image.naturalHeight;
    const scale = Math.min(1, 1050 / Math.max(width, height));
    const previewWidth = Math.max(1, Math.round(width * scale));
    const previewHeight = Math.max(1, Math.round(height * scale));
    if (preview.width !== previewWidth || preview.height !== previewHeight) {
      preview.width = previewWidth;
      preview.height = previewHeight;
    }
    const context = drawImage(preview, image, rotation, { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight });
    if (equalCrop(shown, fullCrop)) return;
    const x = shown.x * previewWidth;
    const y = shown.y * previewHeight;
    const w = shown.width * previewWidth;
    const h = shown.height * previewHeight;
    context.fillStyle = 'rgba(22, 15, 40, 0.64)';
    context.fillRect(0, 0, previewWidth, y);
    context.fillRect(0, y + h, previewWidth, previewHeight - y - h);
    context.fillRect(0, y, x, h);
    context.fillRect(x + w, y, previewWidth - x - w, h);
    context.strokeStyle = '#fff0fa';
    context.lineWidth = 2;
    context.strokeRect(x, y, w, h);
    context.beginPath();
    for (const fraction of [1 / 3, 2 / 3]) {
      context.moveTo(x + w * fraction, y);
      context.lineTo(x + w * fraction, y + h);
      context.moveTo(x, y + h * fraction);
      context.lineTo(x + w, y + h * fraction);
    }
    context.lineWidth = 1;
    context.strokeStyle = 'rgba(255, 240, 250, 0.48)';
    context.stroke();
  }

  function turn(amount) {
    rotation = normalizeRotation(rotation + amount);
    renderPreview();
  }

  function pointerPosition(event) {
    const bounds = preview.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
  }

  preview.addEventListener('pointerdown', (event) => {
    if (busy || gesture || event.button !== 0) return;
    gesture = { id: event.pointerId, ...pointerPosition(event) };
    preview.setPointerCapture(event.pointerId);
  });
  function dragCrop(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const position = pointerPosition(event);
    const width = Math.abs(position.x - gesture.x);
    const height = Math.abs(position.y - gesture.y);
    if (width < minimumCrop || height < minimumCrop) return;
    const shown = { x: Math.min(position.x, gesture.x), y: Math.min(position.y, gesture.y), width, height };
    crop = rotateCrop(shown, normalizeRotation(-rotation));
    renderPreview();
  }
  preview.addEventListener('pointermove', dragCrop);
  preview.addEventListener('pointerup', (event) => {
    dragCrop(event);
    if (event.pointerId === gesture?.id) gesture = null;
  });
  for (const eventName of ['pointercancel', 'lostpointercapture']) {
    preview.addEventListener(eventName, (event) => { if (event.pointerId === gesture?.id) gesture = null; });
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = !message;
  }

  async function commit(restoreOriginal) {
    if (busy || (!restoreOriginal && !ready)) return;
    busy = true;
    updateControls();
    showError('');
    try {
      let edit = null;
      if (!restoreOriginal) {
        const cropped = !equalCrop(crop, fullCrop);
        edit = { rotation, crop: cropped ? { ...crop } : null, note: note.value.trim() };
        if (rotation || cropped) {
          const canReuse = rotation === initialRotation && equalCrop(crop, initialCrop) && photo.edit?.blob instanceof Blob;
          edit.blob = canReuse ? photo.edit.blob : await renderImage(image, rotation, crop, photo.blob?.type);
        }
      }
      await onSave(edit);
      dialog.close();
    } catch {
      showError('照片编辑保存失败，请重试。');
    } finally {
      busy = false;
      updateControls();
    }
  }

  left.addEventListener('click', () => turn(-90));
  right.addEventListener('click', () => turn(90));
  resetCrop.addEventListener('click', () => {
    crop = { ...fullCrop };
    renderPreview();
  });
  cancel.addEventListener('click', () => { if (!busy) dialog.close(); });
  restore.addEventListener('click', () => { void commit(true); });
  save.addEventListener('click', () => { void commit(false); });
  dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (previousFocus?.isConnected && !document.getElementById('photo-editor')) {
      previousFocus.focus({ preventScroll: true });
    }
  }, { once: true });

  updateControls();
  renderPreview();
  dialog.showModal();
  image.src = objectUrl || photo.src || '';
  void image.decode().then(() => {
    if (!dialog.open) return;
    ready = true;
    loading.hidden = true;
    preview.hidden = false;
    updateControls();
    renderPreview();
  }).catch(() => {
    if (!dialog.open) return;
    ready = false;
    preview.hidden = true;
    loading.hidden = false;
    loading.textContent = '无法打开原始照片。';
    updateControls();
  });
  return dialog;
}
