/**
 * RAILGUARD - ESP32-CAM Inspection Controller
 * Manages live video feed stream, offline fallback UI, frame snapshot captures, and stream settings.
 */

let CAMERA_STREAM_URL = 'http://192.168.1.100:81/stream';
let cameraSnapshots = [];

function initCameraModule() {
    const streamImg = document.getElementById('esp32-cam-stream');
    const ipInput = document.getElementById('camera-ip-input');
    
    if (ipInput) {
        ipInput.value = CAMERA_STREAM_URL;
    }

    if (streamImg) {
        // Attempt loading live camera stream image / fallback canvas simulator
        streamImg.onerror = () => {
            handleCameraOffline();
        };

        streamImg.onload = () => {
            handleCameraOnline();
        };

        // Initially load simulated visual canvas stream if no real camera hardware IP configured
        renderSimulatedCameraFeed();
    }
}

/**
 * Updates ESP32-CAM stream URL
 * @param {string} newUrl 
 */
function updateCameraStreamUrl(newUrl) {
    if (!newUrl) return;
    CAMERA_STREAM_URL = newUrl.trim();
    
    const streamImg = document.getElementById('esp32-cam-stream');
    const container = document.getElementById('camera-stream-container');
    const offlineMsg = document.getElementById('camera-offline-msg');

    if (streamImg) {
        if (offlineMsg) offlineMsg.style.display = 'none';
        streamImg.style.display = 'block';
        streamImg.src = `${CAMERA_STREAM_URL}?t=${Date.now()}`;
    }
}

/**
 * Renders simulated dark visual camera feed for testing without ESP32-CAM hardware
 */
function renderSimulatedCameraFeed() {
    const canvas = document.getElementById('simulated-cam-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width = 480;
    const h = canvas.height = 270;

    let frameCount = 0;

    function drawFrame() {
        frameCount++;

        // Camera background (Dark track vision)
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, w, h);

        // Perspective Railway Track lines
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;

        // Left rail
        ctx.beginPath(); ctx.moveTo(w * 0.35, h * 0.3); ctx.lineTo(40, h - 20); ctx.stroke();
        // Right rail
        ctx.beginPath(); ctx.moveTo(w * 0.65, h * 0.3); ctx.lineTo(w - 40, h - 20); ctx.stroke();

        // Track sleepers / ties
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        for (let i = 1; i <= 6; i++) {
            const y = h * 0.3 + (i / 6) * (h * 0.65);
            const xLeft = w * 0.35 - (i / 6) * (w * 0.35 - 40);
            const xRight = w * 0.65 + (i / 6) * (w - 40 - w * 0.65);
            ctx.beginPath(); ctx.moveTo(xLeft, y); ctx.lineTo(xRight, y); ctx.stroke();
        }

        // Animated scan line
        const scanY = (frameCount * 2) % h;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(w, scanY); ctx.stroke();

        // Simulated AI Bounding Box overlay if crack is detected
        if (RailGuardState.aiResult && RailGuardState.aiResult.detected) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';

            const bx = w * 0.42;
            const by = h * 0.55;
            const bw = 70;
            const bh = 50;

            ctx.fillRect(bx, by, bw, bh);
            ctx.strokeRect(bx, by, bw, bh);

            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(`AI: ${RailGuardState.aiResult.class} (${RailGuardState.aiResult.confidence}%)`, bx, by - 5);
        }

        // OSD Overlay
        ctx.fillStyle = '#10b981';
        ctx.font = '10px monospace';
        ctx.fillText(`ESP32-CAM LIVE [1080p 30fps] - ${new Date().toTimeString().split(' ')[0]}`, 10, 20);

        requestAnimationFrame(drawFrame);
    }

    drawFrame();
}

function handleCameraOffline() {
    RailGuardState.cameraStatus = 'OFFLINE';
    updateTopHeaderIndicators();

    const offlineMsg = document.getElementById('camera-offline-msg');
    const streamImg = document.getElementById('esp32-cam-stream');

    if (offlineMsg) offlineMsg.style.display = 'flex';
    if (streamImg) streamImg.style.display = 'none';
}

function handleCameraOnline() {
    RailGuardState.cameraStatus = 'ONLINE';
    updateTopHeaderIndicators();

    const offlineMsg = document.getElementById('camera-offline-msg');
    const streamImg = document.getElementById('esp32-cam-stream');

    if (offlineMsg) offlineMsg.style.display = 'none';
    if (streamImg) streamImg.style.display = 'block';
}

/**
 * Captures live camera snapshot and adds to gallery
 */
function captureCameraSnapshot() {
    const canvas = document.getElementById('simulated-cam-canvas');
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const timeStr = new Date().toLocaleTimeString();

    cameraSnapshots.unshift({ id: Date.now(), time: timeStr, image: dataUrl });

    renderSnapshotGallery();
    alert(`Inspection Snapshot Captured at ${timeStr}`);
}

/**
 * Renders captured snapshot gallery thumbnails
 */
function renderSnapshotGallery() {
    const gallery = document.getElementById('camera-snapshot-gallery');
    if (!gallery) return;

    gallery.innerHTML = '';
    if (cameraSnapshots.length === 0) {
        gallery.innerHTML = '<span style="color:#64748b; font-size:12px;">No snapshots captured yet.</span>';
        return;
    }

    cameraSnapshots.slice(0, 4).forEach((snap, idx) => {
        const item = document.createElement('div');
        item.className = 'snapshot-item';
        item.innerHTML = `
            <img src="${snap.image}" alt="Snapshot ${idx + 1}" />
            <span class="snapshot-time">${snap.time}</span>
        `;
        gallery.appendChild(item);
    });
}

/**
 * Toggles camera section fullscreen mode
 */
function toggleCameraFullscreen() {
    const elem = document.getElementById('camera-panel-card');
    if (!elem) return;

    if (!document.fullscreenElement) {
        if (elem.requestFullscreen) elem.requestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}
