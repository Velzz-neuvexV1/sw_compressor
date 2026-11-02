const { createFFmpeg, fetchFile } = FFmpeg;

// Inisialisasi engine FFmpeg
const ffmpeg = createFFmpeg({
  log: false,
  corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

// DOM Elements
const dropZone = document.getElementById('dropZone');
const videoInput = document.getElementById('videoInput');
const processSection = document.getElementById('processSection');
const progressSection = document.getElementById('progressSection');
const resultSection = document.getElementById('resultSection');

const fileNameEl = document.getElementById('fileName');
const fileSizeEl = document.getElementById('fileSize');
const btnReset = document.getElementById('btnReset');
const btnCompress = document.getElementById('btnCompress');
const qualitySelect = document.getElementById('qualitySelect');
const resolutionSelect = document.getElementById('resolutionSelect');

const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const statusText = document.getElementById('statusText');

const sizeBeforeEl = document.getElementById('sizeBefore');
const sizeAfterEl = document.getElementById('sizeAfter');
const downloadLink = document.getElementById('downloadLink');

let rawFile = null;

// Helper: Format bytes to MB
function formatBytes(bytes) {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(2) + ' MB';
}

// Drag and Drop Handler
dropZone.addEventListener('click', () => videoInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
  }
});

videoInput.addEventListener('change', (e) => {
  if (e.target.files.length) {
    handleFile(e.target.files[0]);
  }
});

function handleFile(file) {
  if (!file.type.startsWith('video/')) {
    alert('Harap masukkan file video yang valid.');
    return;
  }
  rawFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);

  dropZone.classList.add('hidden');
  processSection.classList.remove('hidden');
}

btnReset.addEventListener('click', () => {
  rawFile = null;
  videoInput.value = '';
  processSection.classList.add('hidden');
  resultSection.classList.add('hidden');
  progressSection.classList.add('hidden');
  dropZone.classList.remove('hidden');
});

// Compress Engine Call
btnCompress.addEventListener('click', async () => {
  if (!rawFile) return;

  processSection.classList.add('hidden');
  progressSection.classList.remove('hidden');
  
  statusText.textContent = "Menyiapkan Engine...";
  progressBar.style.width = '0%';
  progressPercent.textContent = '0%';

  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }

  const inputName = 'input_video' + getFileExtension(rawFile.name);
  const outputName = 'output_compressed.mp4';

  ffmpeg.FS('writeFile', inputName, await fetchFile(rawFile));

  // Menghitung progress secara presisi
  ffmpeg.setProgress(({ ratio }) => {
    const pct = Math.min(Math.max(Math.round(ratio * 100), 0), 100);
    progressBar.style.width = `${pct}%`;
    progressPercent.textContent = `${pct}%`;
    statusText.textContent = "Mengompresi Video...";
  });

  const crf = qualitySelect.value;
  const res = resolutionSelect.value;

  // Menyusun argumen FFmpeg
  let args = ['-i', inputName, '-c:v', 'libx264', '-crf', crf, '-preset', 'medium'];

  // Mengatur penyesuaian resolusi jika dipilih
  if (res !== 'original') {
    args.push('-vf', `scale=-2:${res}`);
  }

  // Pengaturan audio AAC standar tinggi
  args.push('-c:a', 'aac', '-b:a', '128k', outputName);

  await ffmpeg.run(...args);

  const data = ffmpeg.FS('readFile', outputName);
  const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });

  // Update UI Hasil
  sizeBeforeEl.textContent = formatBytes(rawFile.size);
  sizeAfterEl.textContent = formatBytes(compressedBlob.size);

  const url = URL.revokeObjectURL(downloadLink.href);
  downloadLink.href = URL.createObjectURL(compressedBlob);

  // Unlink file internal FFmpeg untuk hemat memori
  ffmpeg.FS('unlink', inputName);
  ffmpeg.FS('unlink', outputName);

  progressSection.classList.add('hidden');
  resultSection.classList.remove('hidden');
});

function getFileExtension(filename) {
  return filename.substring(filename.lastIndexOf('.'));
}