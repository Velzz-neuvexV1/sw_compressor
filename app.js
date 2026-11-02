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

// Compress Engine via Native Browser Canvas & MediaRecorder
btnCompress.addEventListener('click', async () => {
  if (!rawFile) return;

  processSection.classList.add('hidden');
  progressSection.classList.remove('hidden');

  try {
    statusText.textContent = "Menyiapkan video...";
    progressBar.style.width = '10%';
    progressPercent.textContent = '10%';

    const videoEl = document.createElement('video');
    videoEl.src = URL.createObjectURL(rawFile);
    videoEl.muted = true;
    videoEl.playsInline = true;

    await new Promise((resolve, reject) => {
      videoEl.onloadedmetadata = resolve;
      videoEl.onerror = reject;
    });

    // Tentukan target resolusi
    const targetRes = resolutionSelect.value;
    let targetWidth = videoEl.videoWidth;
    let targetHeight = videoEl.videoHeight;

    if (targetRes !== 'original') {
      const targetH = parseInt(targetRes);
      if (videoEl.videoHeight > targetH) {
        const ratio = targetH / videoEl.videoHeight;
        targetHeight = targetH;
        targetWidth = Math.round(videoEl.videoWidth * ratio);
      }
    }

    // Tentukan target bitrate berdasarkan kualitas
    const crfVal = qualitySelect.value;
    let targetBitrate = 1500000; // Default ~1.5 Mbps
    if (crfVal === '21') targetBitrate = 2500000; // High quality
    else if (crfVal === '24') targetBitrate = 1200000; // Medium
    else if (crfVal === '28') targetBitrate = 600000;  // Low size

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    
    // Ambil track audio jika ada
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const sourceNode = audioContext.createMediaElementSource(videoEl);
    const destNode = audioContext.createMediaStreamDestination();
    sourceNode.connect(destNode);
    sourceNode.connect(audioContext.destination);

    if (destNode.stream.getAudioTracks().length > 0) {
      stream.addTrack(destNode.stream.getAudioTracks()[0]);
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : (MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm');

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: targetBitrate
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const compressedBlob = new Blob(chunks, { type: mimeType });
      sizeBeforeEl.textContent = formatBytes(rawFile.size);
      sizeAfterEl.textContent = formatBytes(compressedBlob.size);

      if (downloadLink.href) URL.revokeObjectURL(downloadLink.href);
      downloadLink.href = URL.createObjectURL(compressedBlob);
      downloadLink.download = `compressed_sw.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;

      progressSection.classList.add('hidden');
      resultSection.classList.remove('hidden');
      audioContext.close();
    };

    statusText.textContent = "Mengompresi video...";
    mediaRecorder.start();
    await videoEl.play();

    // Render frame ke canvas & jalankan progress
    const renderFrame = () => {
      if (!videoEl.ended && !videoEl.paused) {
        ctx.drawImage(videoEl, 0, 0, targetWidth, targetHeight);
        const pct = Math.min(Math.round((videoEl.currentTime / videoEl.duration) * 100), 99);
        progressBar.style.width = `${pct}%`;
        progressPercent.textContent = `${pct}%`;
        requestAnimationFrame(renderFrame);
      }
    };
    renderFrame();

    videoEl.onended = () => {
      mediaRecorder.stop();
      progressBar.style.width = '100%';
      progressPercent.textContent = '100%';
    };

  } catch (err) {
    console.error("Error compression:", err);
    alert("Gagal memproses video: " + err.message);
    progressSection.classList.add('hidden');
    processSection.classList.remove('hidden');
  }
});

function getFileExtension(filename) {
  return filename.substring(filename.lastIndexOf('.'));
}
