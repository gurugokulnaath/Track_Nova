/**
 * RAILGUARD - UI & Dashboard DOM Manipulation Engine
 * Handles real-time DOM updates for all cards, metrics, alerts, tables, and safety indicators.
 */

let browserNotificationsEnabled = false;

/**
 * Main master function called whenever a new sensor packet is processed
 * @param {Object} data - Parsed packet object from parseLoRaPacket()
 */
function updateDashboard(data) {
    if (!data || !data.valid) return;

    // Determine overall safety state first
    const safetyInfo = computeSafetyStatus(data);

    // Update individual UI modules
    updateTopHeaderIndicators();
    updateLiveStatusSummary(data);
    renderSafetyStatusBanner(safetyInfo, data);
    updateIRSection(data);
    updateUltrasonicSection(data);
    updateVibrationSection(data);
    updateLoRaSection(data);
    updateRawPacketSection(data.raw);
    updateGPSSection(RailGuardState.gps);
    updateAISection(RailGuardState.aiResult);

    // Event & Alert log generation
    processEventsAndAlerts(data, safetyInfo);
}

/**
 * Computes overall track safety classification (SAFE, WARNING, CRITICAL)
 */
function computeSafetyStatus(data) {
    const isObstacle = data.distanceCM !== null && data.distanceCM <= RailGuardState.obstacleThresholdCM;
    const isVibrationHigh = data.vibrationDO || data.vibrationAO > 650;
    const hasCrack = data.hasCrack;

    if (hasCrack) {
        return {
            status: 'CRITICAL',
            classCss: 'status-critical',
            reason: `CRACK DETECTED AT SENSOR(S): ${data.crackedSensors.join(', ')}`,
            severity: 'HIGH',
            sensors: data.crackedSensors
        };
    }

    if (isObstacle || isVibrationHigh) {
        let reasons = [];
        if (isObstacle) reasons.push(`Obstacle Detected (${data.distanceCM} cm)`);
        if (isVibrationHigh) reasons.push(`Abnormal Vibration (AO: ${data.vibrationAO})`);

        return {
            status: 'WARNING',
            classCss: 'status-warning',
            reason: reasons.join(' & '),
            severity: 'MEDIUM',
            sensors: []
        };
    }

    return {
        status: 'SAFE',
        classCss: 'status-safe',
        reason: 'Track Nominal - All Sensors Clear',
        severity: 'NORMAL',
        sensors: []
    };
}

/**
 * Updates top header status badges
 */
function updateTopHeaderIndicators() {
    const sysBadge = document.getElementById('sys-status-badge');
    const loraBadge = document.getElementById('lora-status-badge');
    const espBadge = document.getElementById('esp-status-badge');
    const camBadge = document.getElementById('cam-status-badge');
    const batteryText = document.getElementById('battery-level-text');
    const batteryFill = document.getElementById('battery-level-fill');
    const lastDataTime = document.getElementById('last-data-timestamp');

    if (sysBadge) {
        sysBadge.textContent = RailGuardState.systemStatus;
        sysBadge.className = `badge badge-${RailGuardState.systemStatus.toLowerCase()}`;
    }
    if (loraBadge) {
        loraBadge.textContent = RailGuardState.loraStatus;
        loraBadge.className = `badge badge-${RailGuardState.loraStatus === 'CONNECTED' ? 'safe' : 'critical'}`;
    }
    if (espBadge) {
        espBadge.textContent = RailGuardState.esp32Status;
        espBadge.className = `badge badge-${RailGuardState.esp32Status === 'CONNECTED' ? 'safe' : 'critical'}`;
    }
    if (camBadge) {
        camBadge.textContent = RailGuardState.cameraStatus;
        camBadge.className = `badge badge-${RailGuardState.cameraStatus === 'ONLINE' ? 'safe' : 'critical'}`;
    }
    if (batteryText && batteryFill) {
        batteryText.textContent = `${RailGuardState.batteryLevel}%`;
        batteryFill.style.width = `${RailGuardState.batteryLevel}%`;
    }
    if (lastDataTime) {
        lastDataTime.textContent = RailGuardState.lastPacketTime;
    }
}

/**
 * Updates Live System Status bar metrics
 */
function updateLiveStatusSummary(data) {
    setElementText('lbl-last-packet-no', `#${data.packetNumber}`);
    setElementText('lbl-rssi-val', `${RailGuardState.rssi} dBm`);
    setElementText('lbl-snr-val', `${RailGuardState.snr} dB`);
    setElementText('lbl-freq-val', `${RailGuardState.dataFrequencyHz.toFixed(1)} Hz`);
    setElementText('lbl-stream-status', RailGuardState.isPaused ? 'PAUSED' : 'LIVE');
}

/**
 * Renders the Central Track Safety Banner
 */
function renderSafetyStatusBanner(safety, data) {
    const banner = document.getElementById('central-safety-banner');
    const statusTxt = document.getElementById('safety-status-text');
    const detailTxt = document.getElementById('safety-detail-text');
    const alertBox = document.getElementById('safety-critical-alert-box');

    if (!banner || !statusTxt || !detailTxt) return;

    banner.className = `safety-banner ${safety.classCss}`;
    statusTxt.textContent = `TRACK SAFETY STATUS: ${safety.status}`;
    detailTxt.textContent = safety.reason;

    if (alertBox) {
        if (safety.status === 'CRITICAL') {
            alertBox.style.display = 'block';
            setElementText('alert-box-reason', safety.reason);
            setElementText('alert-box-sensors', data.crackedSensors.length > 0 ? data.crackedSensors.join(', ') : 'None');
            setElementText('alert-box-confidence', `${RailGuardState.aiResult.confidence}%`);
        } else {
            alertBox.style.display = 'none';
        }
    }
}

/**
 * Updates 4 individual IR Crack Sensors UI
 */
function updateIRSection(data) {
    const irSensors = [
        { id: 'ir1', val: data.ir1, label: 'IR 1' },
        { id: 'ir2', val: data.ir2, label: 'IR 2' },
        { id: 'ir3', val: data.ir3, label: 'IR 3' },
        { id: 'ir4', val: data.ir4, label: 'IR 4' }
    ];

    irSensors.forEach(sensor => {
        const card = document.getElementById(`card-${sensor.id}`);
        const badge = document.getElementById(`badge-${sensor.id}`);
        const indicator = document.getElementById(`indicator-${sensor.id}`);

        const isDetected = sensor.val === 1;

        if (card) card.className = `sensor-card ${isDetected ? 'card-critical' : 'card-safe'}`;
        if (badge) {
            badge.textContent = isDetected ? 'CRACK DETECTED' : 'CLEAR';
            badge.className = `badge ${isDetected ? 'badge-critical' : 'badge-safe'}`;
        }
        if (indicator) {
            indicator.className = `status-dot ${isDetected ? 'dot-red-pulse' : 'dot-green'}`;
        }
    });

    setElementText('lbl-total-ir-count', '4');
    setElementText('lbl-cracked-ir-count', `${data.crackCount} / 4`);
    setElementText('lbl-overall-ir-status', data.hasCrack ? 'CRACK DETECTED' : 'CLEAR');
    setElementText('lbl-cracked-sensor-list', data.crackedSensors.length > 0 ? data.crackedSensors.join(', ') : 'None');
    
    const overallBadge = document.getElementById('badge-overall-ir');
    if (overallBadge) {
        overallBadge.textContent = data.hasCrack ? 'CRACK DETECTED' : 'CLEAR';
        overallBadge.className = `badge ${data.hasCrack ? 'badge-critical' : 'badge-safe'}`;
    }
}

/**
 * Updates Ultrasonic Obstacle Detection UI
 */
function updateUltrasonicSection(data) {
    const distMText = document.getElementById('lbl-distance-m');
    const distCMText = document.getElementById('lbl-distance-cm');
    const statusBadge = document.getElementById('badge-obstacle-status');
    const barFill = document.getElementById('obstacle-gauge-fill');

    if (!data.hasValidDistance) {
        if (distMText) distMText.textContent = '-- m';
        if (distCMText) distCMText.textContent = 'NO VALID READING';
        if (statusBadge) {
            statusBadge.textContent = 'NO VALID READING';
            statusBadge.className = 'badge badge-warning';
        }
        if (barFill) barFill.style.width = '0%';
        return;
    }

    const distCm = data.distanceCM;
    const isObstacle = distCm <= RailGuardState.obstacleThresholdCM;

    if (distMText) distMText.textContent = `${(distCm / 100).toFixed(2)} m`;
    if (distCMText) distCMText.textContent = `${distCm.toFixed(1)} cm`;

    if (statusBadge) {
        if (isObstacle) {
            statusBadge.textContent = 'OBSTACLE DETECTED';
            statusBadge.className = 'badge badge-critical';
        } else {
            statusBadge.textContent = 'NO OBSTACLE';
            statusBadge.className = 'badge badge-safe';
        }
    }

    // Gauge bar visual (0 to 400cm max range)
    if (barFill) {
        const pct = Math.min(100, Math.max(0, (distCm / 400) * 100));
        barFill.style.width = `${pct}%`;
        barFill.style.backgroundColor = isObstacle ? '#ef4444' : '#10b981';
    }
}

/**
 * Updates Vibration Monitor section UI
 */
function updateVibrationSection(data) {
    const statusBadge = document.getElementById('badge-vibration-digital');
    const analogValText = document.getElementById('lbl-vibration-analog');

    if (statusBadge) {
        const isVibe = data.vibrationDO || data.vibrationAO > 650;
        statusBadge.textContent = isVibe ? 'VIBRATION DETECTED' : 'NORMAL';
        statusBadge.className = `badge ${isVibe ? 'badge-warning' : 'badge-safe'}`;
    }

    if (analogValText) {
        analogValText.textContent = data.vibrationAO;
    }
}

/**
 * Updates LoRa Communication metrics UI
 */
function updateLoRaSection(data) {
    setElementText('lbl-lora-packets-received', RailGuardState.packetsReceived);
    setElementText('lbl-lora-packet-loss', `${RailGuardState.packetsLost}%`);
    setElementText('lbl-lora-rssi', `${RailGuardState.rssi} dBm`);
    setElementText('lbl-lora-snr', `${RailGuardState.snr} dB`);
    setElementText('lbl-lora-last-rx', data.timestamp);

    const healthBadge = document.getElementById('badge-lora-transfer-health');
    if (healthBadge) {
        healthBadge.textContent = 'SUCCESS';
        healthBadge.className = 'badge badge-safe';
    }
}

/**
 * Updates Raw Packet Terminal view
 */
function updateRawPacketSection(rawString) {
    const termBox = document.getElementById('raw-packet-terminal-text');
    if (termBox) {
        termBox.textContent = rawString;
    }
}

/**
 * Updates Rover GPS Location section UI & Canvas map
 */
function updateGPSSection(gps) {
    setElementText('lbl-gps-lat', gps.lat.toFixed(5));
    setElementText('lbl-gps-lng', gps.lng.toFixed(5));
    setElementText('lbl-gps-acc', `±${gps.accuracy} m`);
    setElementText('lbl-gps-status', gps.status);

    renderVisualMapCanvas(gps.lat, gps.lng);
}

/**
 * Render visual railway track map canvas
 */
function renderVisualMapCanvas(lat, lng) {
    const canvas = document.getElementById('gps-map-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth || 400;
    const h = canvas.height = 220;

    // Dark Map background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, 0, w, h);

    // Draw Gridlines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Draw Railway Track Path
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, h - 30);
    ctx.quadraticCurveTo(w / 2, 40, w - 20, h - 30);
    ctx.stroke();

    // Draw Track Sleepers (Ties)
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const x = (1 - t) * (1 - t) * 20 + 2 * (1 - t) * t * (w / 2) + t * t * (w - 20);
        const y = (1 - t) * (1 - t) * (h - 30) + 2 * (1 - t) * t * 40 + t * t * (h - 30);
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 6);
        ctx.lineTo(x + 6, y + 6);
        ctx.stroke();
    }

    // Compute Rover Position along simulated path based on lat/lng micro-offset
    const normX = Math.abs((lng - 76.9550) * 20000) % (w - 60) + 30;
    const normY = Math.abs((lat - 11.0160) * 20000) % (h - 60) + 30;

    // Draw Rover Pulse Ring
    ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.beginPath();
    ctx.arc(normX, normY, 18, 0, Math.PI * 2);
    ctx.fill();

    // Draw Rover Pin Icon
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(normX, normY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Rover Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('ROVER-01', normX + 12, normY + 4);
}

/**
 * Updates AI Vision Analysis Panel UI
 */
function updateAISection(ai) {
    const badge = document.getElementById('badge-ai-detection');
    const classText = document.getElementById('lbl-ai-class');
    const confText = document.getElementById('lbl-ai-confidence');
    const confFill = document.getElementById('ai-confidence-gauge-fill');
    const latencyText = document.getElementById('lbl-ai-latency');

    if (badge) {
        badge.textContent = ai.detected ? 'CRACK DETECTED' : 'NO CRACK';
        badge.className = `badge ${ai.detected ? 'badge-critical' : 'badge-safe'}`;
    }
    if (classText) classText.textContent = ai.class;
    if (confText) confText.textContent = `${ai.confidence}%`;
    if (latencyText) latencyText.textContent = `${ai.latencyMs} ms`;

    if (confFill) {
        confFill.style.width = `${ai.confidence}%`;
        if (ai.confidence >= 90) {
            confFill.style.backgroundColor = ai.detected ? '#ef4444' : '#10b981';
        } else if (ai.confidence >= 70) {
            confFill.style.backgroundColor = '#f59e0b';
        } else {
            confFill.style.backgroundColor = '#3b82f6';
        }
    }
}

/**
 * Processes incoming packet events and pushes to History Table and Alert Log
 */
function processEventsAndAlerts(data, safety) {
    // 1. Log event if crack, obstacle, or vibration occurs
    if (data.hasCrack || data.obstacle || data.vibrationDO || Math.random() < 0.2) {
        let statusStr = 'CLEAR';
        let sensorStr = 'SYSTEM';
        let severity = 'LOW';

        if (data.hasCrack) {
            statusStr = 'CRACK DETECTED';
            sensorStr = data.crackedSensors.join(', ');
            severity = 'HIGH';
        } else if (data.obstacle) {
            statusStr = `OBSTACLE (${data.distanceCM} cm)`;
            sensorStr = 'ULTRASONIC';
            severity = 'MEDIUM';
        } else if (data.vibrationDO) {
            statusStr = 'HIGH VIBRATION';
            sensorStr = 'VIBRATION';
            severity = 'MEDIUM';
        }

        const eventObj = {
            id: Date.now(),
            time: data.timestamp,
            packetNo: data.packetNumber,
            sensor: sensorStr,
            status: statusStr,
            severity: severity,
            location: `${RailGuardState.gps.lat.toFixed(4)}, ${RailGuardState.gps.lng.toFixed(4)}`,
            raw: data.raw
        };

        RailGuardState.eventHistory.unshift(eventObj);
        if (RailGuardState.eventHistory.length > 100) RailGuardState.eventHistory.pop();

        renderEventHistoryTable();
    }

    // 2. Generate Alert Card if severity is MEDIUM or HIGH
    if (safety.status === 'CRITICAL' || safety.status === 'WARNING') {
        const alertObj = {
            id: Date.now(),
            time: data.timestamp,
            message: safety.reason,
            severity: safety.status === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
            type: safety.status
        };

        // Prevent exact duplicate consecutive alert flood
        const lastAlert = RailGuardState.alerts[0];
        if (!lastAlert || lastAlert.message !== alertObj.message) {
            RailGuardState.alerts.unshift(alertObj);
            if (RailGuardState.alerts.length > 30) RailGuardState.alerts.pop();

            renderAlertsList();
            triggerBrowserNotification(alertObj.message);
        }
    }
}

/**
 * Renders Filterable Event History Table
 */
function renderEventHistoryTable(filterCategory = 'ALL') {
    const tbody = document.getElementById('event-history-tbody');
    if (!tbody) return;

    let filtered = RailGuardState.eventHistory;

    if (filterCategory === 'CRACKS') {
        filtered = filtered.filter(e => e.status.includes('CRACK'));
    } else if (filterCategory === 'CLEAR') {
        filtered = filtered.filter(e => e.status === 'CLEAR');
    } else if (filterCategory === 'HIGH') {
        filtered = filtered.filter(e => e.severity === 'HIGH');
    } else if (filterCategory === 'MEDIUM') {
        filtered = filtered.filter(e => e.severity === 'MEDIUM');
    } else if (filterCategory === 'LOW') {
        filtered = filtered.filter(e => e.severity === 'LOW');
    }

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#9ca3af; padding:15px;">No telemetry events recorded for selected filter.</td></tr>';
        return;
    }

    filtered.slice(0, 15).forEach(e => {
        const tr = document.createElement('tr');
        const badgeCss = e.severity === 'HIGH' ? 'badge-critical' : (e.severity === 'MEDIUM' ? 'badge-warning' : 'badge-safe');
        
        tr.innerHTML = `
            <td>${e.time}</td>
            <td>#${e.packetNo}</td>
            <td><strong>${e.sensor}</strong></td>
            <td>${e.status}</td>
            <td><span class="badge ${badgeCss}">${e.severity}</span></td>
            <td><code>${e.location}</code></td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Renders Live Alerts Panel list
 */
function renderAlertsList() {
    const listContainer = document.getElementById('alerts-feed-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (RailGuardState.alerts.length === 0) {
        listContainer.innerHTML = '<div class="empty-alert-msg">No active safety alerts. All systems nominal.</div>';
        return;
    }

    RailGuardState.alerts.slice(0, 8).forEach(alert => {
        const item = document.createElement('div');
        const cssClass = alert.severity === 'HIGH' ? 'alert-item-high' : 'alert-item-medium';
        item.className = `alert-item ${cssClass}`;
        
        item.innerHTML = `
            <div class="alert-item-header">
                <span class="alert-severity-tag">${alert.severity} ALERT</span>
                <span class="alert-time">${alert.time}</span>
            </div>
            <div class="alert-msg-body">${alert.message}</div>
        `;
        listContainer.appendChild(item);
    });
}

/**
 * Clears recorded alerts
 */
function clearAllAlerts() {
    RailGuardState.alerts = [];
    renderAlertsList();
}

/**
 * Clears recorded history table
 */
function clearAllHistory() {
    RailGuardState.eventHistory = [];
    renderEventHistoryTable();
}

/**
 * Triggers Browser Notification if permitted
 */
function triggerBrowserNotification(message) {
    if (browserNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('RAILGUARD SAFETY ALERT', {
            body: message,
            icon: 'assets/icons/alert.png'
        });
    }
}

/**
 * Requests browser notification permissions upon explicit user action
 */
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                browserNotificationsEnabled = true;
                alert('Browser notifications enabled for RAILGUARD critical track alerts.');
            } else {
                browserNotificationsEnabled = false;
                alert('Notification permission was denied.');
            }
        });
    }
}

/**
 * Helper to update element text by ID safely
 */
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
