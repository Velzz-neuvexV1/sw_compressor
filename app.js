const { createFFmpeg, fetchFile } = FFmpeg;

// Inisialisasi FFmpeg v0.11 dengan pembatasan memori agar tidak error "could not allocate memory"
const ffmpeg = createFFmpeg({
  log: true,
  corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
  // Konfigurasi alokasi memori WebAssembly yang aman untuk browser
  mainScriptUrl: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
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

function formatBytes(bytes) {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(2) + ' MB';
}

// Drag and Drop Handler
dropZone.addEventListener('click', () => videoInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

videoInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
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
  
  try {
    statusText.textContent = "Memuat Engine FFmpeg (bisa beberapa detik)...";
    progressBar.style.width = '10%';
    progressPercent.textContent = '10%';

    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    statusText.textContent = "Menyiapkan file video...";
    progressBar.style.width = '30%';
    progressPercent.textContent = '30%';

    const inputName = 'input_video' + getFileExtension(rawFile.name);
    const outputName = 'output_compressed.mp4';

    ffmpeg.FS('writeFile', inputName, await fetchFile(rawFile));

    statusText.textContent = "Mengompresi Video...";
    
    // Progress listener untuk v0.11
    ffmpeg.setProgress(({ ratio }) => {
      const pct = Math.min(Math.max(Math.round(ratio * 70) + 30, 30), 100);
      progressBar.style.width = `${pct}%`;
      progressPercent.textContent = `${pct}%`;
    });

    const crf = qualitySelect.value;
    const res = resolutionSelect.value;

    let args = ['-i', inputName, '-c:v', 'libx264', '-crf', crf, '-preset', 'ultrafast'];

    if (res !== 'original') {
      args.push('-vf', `scale=-2:${res}`);
    }

    args.push('-c:a', 'aac', '-b:a', '96k', outputName);

    await ffmpeg.run(...args);

    statusText.textContent = "Menyelesaikan hasil...";
    progressBar.style.width = '100%';
    progressPercent.textContent = '100%';

    const data = ffmpeg.FS('readFile', outputName);
    const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });

    sizeBeforeEl.textContent = formatBytes(rawFile.size);
    sizeAfterEl.textContent = formatBytes(compressedBlob.size);

    if (downloadLink.href) {
      URL.revokeObjectURL(downloadLink.href);
    }
    downloadLink.href = URL.createObjectURL(compressedBlob);

    ffmpeg.FS('unlink', inputName);
    ffmpeg.FS('unlink', outputName);

    setTimeout(() => {
      progressSection.classList.add('hidden');
      resultSection.classList.remove('hidden');
    }, 500);

  } catch (error) {
    console.error("Detail Error:", error);
    alert('Terjadi kesalahan saat memproses video: ' + (error.message || error));
    progressSection.classList.add('hidden');
    processSection.classList.remove('hidden');
  }
});

function getFileExtension(filename) {
  return filename.substring(filename.lastIndexOf('.'));
}
