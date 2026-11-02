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
dropZone.addEventListener('dragover', (e) => { 
  e.preventDefault(); 
  dropZone.classList.add('dragover'); 
});
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

// Engine Kompresi Native Canvas & MediaRecorder yang dioptimalkan agar tidak Out of Memory
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

    // Batasi durasi maksimal 30 detik untuk WhatsApp Status agar RAM tidak jebol
    const maxDuration = Math.min(videoEl.duration, 30);

    const targetRes = resolutionSelect.value;
    let targetWidth = videoEl.videoWidth;
    let targetHeight = videoEl.videoHeight;

    // Turunkan resolusi otomatis ke 720p jika video aslinya terlalu besar agar RAM aman
    if (targetRes === 'original' && targetHeight > 720) {
      const ratio = 720 / targetHeight;
      targetHeight = 720;
      targetWidth = Math.round(targetWidth * ratio);
    } else if (targetRes !== 'original') {
      const targetH = parseInt(targetRes);
      if (targetHeight > targetH) {
        const ratio = targetH / targetHeight;
        targetHeight = targetH;
        targetWidth = Math.round(targetWidth * ratio);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(24); // Turunkan ke 24fps agar ringan

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
      : 'video/webm';

    // Gunakan bitrate yang ramah memori (~800kbps cukup jernih untuk SW)
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 800000 
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const compressedBlob = new Blob(chunks, { type: mimeType });
      sizeBeforeEl.textContent = formatBytes(rawFile.size);
      sizeAfterEl.textContent = formatBytes(compressedBlob.size);

      if (downloadLink.href) URL.revokeObjectURL(downloadLink.href);
      downloadLink.href = URL.createObjectURL(compressedBlob);
      downloadLink.download = `compressed_sw.webm`;

      progressSection.classList.add('hidden');
      resultSection.classList.remove('hidden');
      audioContext.close();
    };

    statusText.textContent = "Mengompresi video (Maks 30 detik untuk SW)...";
    mediaRecorder.start(1000); // Ambil data per 1 detik agar tidak menumpuk di memori
    await videoEl.play();

    const renderFrame = () => {
      if (!videoEl.ended && videoEl.currentTime < maxDuration) {
        ctx.drawImage(videoEl, 0, 0, targetWidth, targetHeight);
        const pct = Math.min(Math.round((videoEl.currentTime / maxDuration) * 100), 99);
        progressBar.style.width = `${pct}%`;
        progressPercent.textContent = `${pct}%`;
        requestAnimationFrame(renderFrame);
      } else {
        videoEl.pause();
        mediaRecorder.stop();
        progressBar.style.width = '100%';
        progressPercent.textContent = '100%';
      }
    };
    renderFrame();

  } catch (err) {
    console.error("Error kompresi:", err);
    alert("Gagal memproses video: " + err.message);
    progressSection.classList.add('hidden');
    processSection.classList.remove('hidden');
  }
});

    // Menentukan target resolusi
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

    // Menentukan bitrate target berdasarkan opsi kualitas
    const modeVal = qualitySelect.value;
    let targetBitrate = 1200000; // Seimbang (~1.2 Mbps)
    if (modeVal === '21') targetBitrate = 2200000; // High Quality
    else if (modeVal === '28') targetBitrate = 600000;  // Low Size

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);

    // Audio Routing (Mengambil track suara jika ada)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const sourceNode = audioContext.createMediaElementSource(videoEl);
    const destNode = audioContext.createMediaStreamDestination();
    sourceNode.connect(destNode);
    sourceNode.connect(audioContext.destination);

    if (destNode.stream.getAudioTracks().length > 0) {
      stream.addTrack(destNode.stream.getAudioTracks()[0]);
    }

    // Format output browser
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

    // Render frame per frame ke canvas & jalankan indikator progress
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
    console.error("Error kompresi:", err);
    alert("Gagal memproses video: " + err.message);
    progressSection.classList.add('hidden');
    processSection.classList.remove('hidden');
  }
});

function getFileExtension(filename) {
  return filename.substring(filename.lastIndexOf('.'));
}
