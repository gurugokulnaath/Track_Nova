/**
 * RAILGUARD - AI-Powered Railway Track Inspection Dashboard
 * Application Entry Point & Global Event Bindings
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('[RAILGUARD] Initializing Railway Inspection Control System...');

    // 1. Initialize ESP32-CAM module
    initCameraModule();

    // 2. Bind Live Data Source Dispatcher (Waiting for ESP32 hardware data)
    connectToDataSource((parsedPacket) => {
        updateDashboard(parsedPacket);
        renderAllCharts();
    });

    // 3. Attach UI Event Listeners
    setupNavigation();
    setupControls();
    setupTableFilters();
    setupUptimeClock();

    // Re-render charts on window resize
    window.addEventListener('resize', () => {
        renderAllCharts();
    });

    console.log('[RAILGUARD] Dashboard Ready. WAITING FOR ESP32 SENSOR DATA.');
});

/**
 * Binds Sidebar Navigation Tabs
 */
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            const targetId = item.getAttribute('data-target');
            if (targetId) {
                const section = document.getElementById(targetId);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });
}

/**
 * Binds Control Buttons, Inputs, Toggles & Modals
 */
function setupControls() {
    // Mode Switch Toggle (DEMO vs LIVE HARDWARE)
    const modeToggle = document.getElementById('toggle-demo-mode');
    if (modeToggle) {
        modeToggle.addEventListener('change', (e) => {
            const isDemo = e.target.checked;
            RailGuardState.isDemoMode = isDemo;
            const modeLabel = document.getElementById('lbl-current-mode');

            if (isDemo) {
                if (modeLabel) {
                    modeLabel.textContent = 'DEMO MODE';
                    modeLabel.className = 'badge badge-cyan';
                }
                startMockDataStream();
            } else {
                if (modeLabel) {
                    modeLabel.textContent = 'LIVE HARDWARE MODE';
                    modeLabel.className = 'badge badge-warning';
                }
                if (RailGuardState.dataTimer) {
                    clearInterval(RailGuardState.dataTimer);
                    RailGuardState.dataTimer = null;
                }
            }
        });
    }

    // Stream Pause / Resume Toggle
    const btnPause = document.getElementById('btn-toggle-pause');
    if (btnPause) {
        btnPause.addEventListener('click', () => {
            RailGuardState.isPaused = !RailGuardState.isPaused;
            btnPause.textContent = RailGuardState.isPaused ? 'Resume Stream' : 'Pause Data';
            btnPause.className = RailGuardState.isPaused ? 'btn btn-warning' : 'btn btn-secondary';
        });
    }

    // Clear Alerts Button
    const btnClearAlerts = document.getElementById('btn-clear-alerts');
    if (btnClearAlerts) {
        btnClearAlerts.addEventListener('click', () => {
            clearAllAlerts();
        });
    }

    // Clear History Button
    const btnClearHistory = document.getElementById('btn-clear-history');
    if (btnClearHistory) {
        btnClearHistory.addEventListener('click', () => {
            clearAllHistory();
        });
    }

    // Export CSV Button
    const btnExportCSV = document.getElementById('btn-export-csv');
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            exportDataToCSV();
        });
    }

    // Copy Raw Packet Button
    const btnCopyPacket = document.getElementById('btn-copy-raw-packet');
    if (btnCopyPacket) {
        btnCopyPacket.addEventListener('click', () => {
            const text = document.getElementById('raw-packet-terminal-text')?.textContent;
            if (text) {
                navigator.clipboard.writeText(text).then(() => {
                    btnCopyPacket.textContent = 'Copied!';
                    setTimeout(() => { btnCopyPacket.textContent = 'Copy Packet'; }, 2000);
                });
            }
        });
    }

    // Obstacle Threshold Input
    const inputThreshold = document.getElementById('input-obstacle-threshold');
    if (inputThreshold) {
        inputThreshold.addEventListener('change', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                RailGuardState.obstacleThresholdCM = val;
                const lbl = document.getElementById('lbl-threshold-val');
                if (lbl) lbl.textContent = `${val} cm`;
            }
        });
    }

    // Camera IP Apply Button
    const btnApplyCamIp = document.getElementById('btn-apply-cam-ip');
    if (btnApplyCamIp) {
        btnApplyCamIp.addEventListener('click', () => {
            const ipVal = document.getElementById('camera-ip-input')?.value;
            if (ipVal) {
                updateCameraStreamUrl(ipVal);
            }
        });
    }

    // Camera Snapshot Button
    const btnCamSnap = document.getElementById('btn-cam-snapshot');
    if (btnCamSnap) {
        btnCamSnap.addEventListener('click', () => {
            captureCameraSnapshot();
        });
    }

    // Camera Fullscreen Button
    const btnCamFs = document.getElementById('btn-cam-fullscreen');
    if (btnCamFs) {
        btnCamFs.addEventListener('click', () => {
            toggleCameraFullscreen();
        });
    }

    // Browser Notification Toggle Button
    const btnEnableNotif = document.getElementById('btn-enable-notifications');
    if (btnEnableNotif) {
        btnEnableNotif.addEventListener('click', () => {
            requestNotificationPermission();
        });
    }
}

/**
 * Table Filter Buttons Handler
 */
function setupTableFilters() {
    const filterBtns = document.querySelectorAll('.btn-filter');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filterCat = btn.getAttribute('data-filter');
            renderEventHistoryTable(filterCat);
        });
    });
}

/**
 * Tracks and updates system uptime counter
 */
function setupUptimeClock() {
    let secondsElapsed = 0;
    setInterval(() => {
        secondsElapsed++;
        const hrs = Math.floor(secondsElapsed / 3600).toString().padStart(2, '0');
        const mins = Math.floor((secondsElapsed % 3600) / 60).toString().padStart(2, '0');
        const secs = (secondsElapsed % 60).toString().padStart(2, '0');

        const uptimeEl = document.getElementById('lbl-system-uptime');
        if (uptimeEl) {
            uptimeEl.textContent = `${hrs}:${mins}:${secs}`;
        }
    }, 1000);
}
