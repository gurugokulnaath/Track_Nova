/**
 * RAILGUARD - Data Layer & Telemetry Management
 * Handles state, real ESP32 hardware data intake, WebSocket/Serial hookups, history buffers, and CSV exports.
 */

const RailGuardState = {
    isDemoMode: false, // Disabled by default - waiting for real ESP32 data
    isPaused: false,
    obstacleThresholdCM: 100,
    packetCounter: 0,
    packetsReceived: 0,
    packetsLost: 0,
    lastPacketTime: '--:--:--',
    dataFrequencyHz: 0,
    
    // Connectivity & Signals
    systemStatus: 'CONNECTING', // ONLINE, OFFLINE, CONNECTING
    esp32Status: 'WAITING',     // CONNECTED, DISCONNECTED, WAITING
    loraStatus: 'WAITING',      // CONNECTED, NO SIGNAL, WAITING
    cameraStatus: 'OFFLINE',     // ONLINE, OFFLINE
    rssi: '--',
    snr: '--',
    batteryLevel: '--',
    
    // Rover Location
    gps: {
        lat: 11.0168,
        lng: 76.9558,
        accuracy: 0.0,
        status: 'SEARCHING',
        satellites: 0
    },

    // AI Vision State
    aiResult: {
        detected: false,
        class: 'Awaiting Hardware Data',
        confidence: 0,
        latencyMs: 0,
        timestamp: '--:--:--',
        detectedObjects: []
    },

    // Buffer History (Up to 60 data points for smooth line charts)
    vibrationHistory: [],
    distanceHistory: [],
    irHistory: [],
    rssiHistory: [],
    packetRateHistory: [],
    
    // Log Stores
    eventHistory: [],
    alerts: [],
    
    // Interval References
    dataTimer: null,
    onPacketReceivedCallback: null,
    webSocket: null
};

if (typeof window !== 'undefined') {
    window.RailGuardState = RailGuardState;
}

/**
 * Direct global receiver function for ESP32 data.
 * Call this from anywhere (WebSocket, Web Serial, Fetch API, Node bridge) with your raw packet string:
 * Example: window.receiveLoRaPacket("RG,1024,0,1,0,0,1,142.5,0,1,512");
 */
window.receiveLoRaPacket = function(packetString) {
    if (!RailGuardState.isPaused) {
        RailGuardState.systemStatus = 'ONLINE';
        RailGuardState.esp32Status = 'CONNECTED';
        RailGuardState.loraStatus = 'CONNECTED';
        handleIncomingRawPacket(packetString);
    }
};

/**
 * Connects directly to an ESP32 WebSocket server or gateway.
 * @param {string} serverUrl - e.g. "ws://192.168.1.100:81" or "ws://localhost:8080/lora"
 */
function connectESP32WebSocket(serverUrl) {
    console.log(`[RAILGUARD ESP32] Connecting to WebSocket at: ${serverUrl}`);
    
    if (RailGuardState.webSocket) {
        RailGuardState.webSocket.close();
    }
    
    RailGuardState.systemStatus = 'CONNECTING';

    try {
        const socket = new WebSocket(serverUrl);
        RailGuardState.webSocket = socket;

        socket.onopen = () => {
            RailGuardState.systemStatus = 'ONLINE';
            RailGuardState.esp32Status = 'CONNECTED';
            RailGuardState.loraStatus = 'CONNECTED';
            console.log('[RAILGUARD ESP32] WebSocket Connected successfully!');
            updateTopHeaderIndicators();
        };

        socket.onmessage = (event) => {
            // Incoming ESP32 telemetry string: "RG,1024,0,1,0,0,1,142.5,0,1,512"
            window.receiveLoRaPacket(event.data);
        };

        socket.onerror = (err) => {
            RailGuardState.systemStatus = 'OFFLINE';
            RailGuardState.esp32Status = 'DISCONNECTED';
            console.error('[RAILGUARD ESP32] WebSocket Error:', err);
            updateTopHeaderIndicators();
        };

        socket.onclose = () => {
            RailGuardState.systemStatus = 'OFFLINE';
            RailGuardState.esp32Status = 'DISCONNECTED';
            console.warn('[RAILGUARD ESP32] WebSocket Connection Closed.');
            updateTopHeaderIndicators();
        };
    } catch (e) {
        console.error('[RAILGUARD ESP32] Failed to establish WebSocket connection:', e);
    }
}

/**
 * Backward compatible function name for wiring real backend
 */
function wireRealBackend(serverUrl) {
    connectESP32WebSocket(serverUrl);
}

/**
 * Initializes data intake dispatcher
 * @param {Function} callback - Function executed on each parsed packet
 */
function connectToDataSource(callback) {
    RailGuardState.onPacketReceivedCallback = callback;
    
    // Default mode: Wait for real ESP32 data via window.receiveLoRaPacket() or WebSocket
    if (RailGuardState.isDemoMode) {
        startMockDataStream();
    }
}

/**
 * Optional Manual Mock Data Stream generator (Only starts if user explicitly enables Demo Mode toggle)
 */
function startMockDataStream() {
    if (RailGuardState.dataTimer) clearInterval(RailGuardState.dataTimer);

    RailGuardState.systemStatus = 'ONLINE';
    RailGuardState.esp32Status = 'CONNECTED';
    RailGuardState.loraStatus = 'CONNECTED';
    RailGuardState.cameraStatus = 'ONLINE';

    // Dispatch mock packet every 1 second
    RailGuardState.dataTimer = setInterval(() => {
        if (RailGuardState.isPaused) return;

        const rawPacket = generateMockPacket();
        handleIncomingRawPacket(rawPacket);
    }, 1000);
}

/**
 * Generates realistic LoRa sensor telemetry packet strings
 * Example patterns:
 * Normal: RG,1001,0,0,0,0,0,245.2,0,1,420
 * Single Crack: RG,1002,0,1,0,0,1,238.5,0,1,430
 * Obstacle: RG,1003,0,0,0,0,0,68.4,1,1,415
 * Multiple Cracks: RG,1004,1,0,1,0,2,155.2,0,0,520
 */
function generateMockPacket() {
    RailGuardState.packetCounter++;
    const pktNum = RailGuardState.packetCounter;
    
    // Dynamic simulation probabilities
    const rand = Math.random();
    let ir1 = 0, ir2 = 0, ir3 = 0, ir4 = 0;
    let distanceCM = (150 + Math.sin(pktNum / 10) * 80 + (Math.random() * 20)).toFixed(1);
    let obstacle = 0;
    let vibrationDO = 0;
    let vibrationAO = Math.floor(350 + Math.random() * 120);

    // Occasional crack scenario (approx 12% probability)
    if (rand < 0.07) {
        ir2 = 1; // Crack detected at IR2
    } else if (rand >= 0.07 && rand < 0.11) {
        ir1 = 1;
        ir3 = 1; // Crack detected at IR1 and IR3
    } else if (rand >= 0.11 && rand < 0.14) {
        ir4 = 1; // Crack detected at IR4
    }

    // Occasional obstacle scenario (approx 10% probability)
    if (rand >= 0.20 && rand < 0.30) {
        distanceCM = (45 + Math.random() * 35).toFixed(1);
        obstacle = 1;
    }

    // Occasional high vibration scenario (approx 10% probability)
    if (rand >= 0.35 && rand < 0.45) {
        vibrationDO = 1;
        vibrationAO = Math.floor(750 + Math.random() * 200);
    }

    // Compute crack count sum
    const crackCount = ir1 + ir2 + ir3 + ir4;

    // Simulate subtle RSSI / SNR fluctuations
    RailGuardState.rssi = Math.floor(-78 + Math.random() * 14);
    RailGuardState.snr = parseFloat((7.5 + Math.random() * 3.5).toFixed(1));

    // Simulate realistic GPS Micro-movement along track
    RailGuardState.gps.lat = parseFloat((11.0168 + (pktNum % 100) * 0.00002).toFixed(5));
    RailGuardState.gps.lng = parseFloat((76.9558 + (pktNum % 100) * 0.00003).toFixed(5));

    // Simulate AI Vision alignment with IR crack detection
    if (crackCount > 0) {
        RailGuardState.aiResult = {
            detected: true,
            class: 'Surface Rail Crack',
            confidence: parseFloat((92.5 + Math.random() * 6.5).toFixed(1)),
            latencyMs: Math.floor(35 + Math.random() * 15),
            timestamp: new Date().toTimeString().split(' ')[0],
            detectedObjects: ['Structural Defect', `Track Discontinuity`]
        };
    } else {
        RailGuardState.aiResult = {
            detected: false,
            class: 'Clear Track',
            confidence: parseFloat((95.0 + Math.random() * 4.5).toFixed(1)),
            latencyMs: Math.floor(30 + Math.random() * 12),
            timestamp: new Date().toTimeString().split(' ')[0],
            detectedObjects: ['Smooth Rail']
        };
    }

    // Return exact LoRa CSV format string
    return `RG,${pktNum},${ir1},${ir2},${ir3},${ir4},${crackCount},${distanceCM},${obstacle},${vibrationDO},${vibrationAO}`;
}

/**
 * Handles incoming raw packet string from mock generator or live socket
 * @param {string} rawPacketStr 
 */
function handleIncomingRawPacket(rawPacketStr) {
    const parsed = parseLoRaPacket(rawPacketStr);
    if (!parsed.valid) {
        console.warn('Packet parse error:', parsed.error);
        return;
    }

    RailGuardState.packetsReceived++;
    RailGuardState.lastPacketTime = parsed.timestamp;

    // Push into time-series history buffers (Max 60 entries)
    pushHistory(RailGuardState.vibrationHistory, { time: parsed.timestamp, value: parsed.vibrationAO, digital: parsed.vibrationDO }, 60);
    pushHistory(RailGuardState.distanceHistory, { time: parsed.timestamp, value: parsed.distanceCM || 0 }, 60);
    pushHistory(RailGuardState.irHistory, { time: parsed.timestamp, crackCount: parsed.crackCount }, 60);
    pushHistory(RailGuardState.rssiHistory, { time: parsed.timestamp, rssi: RailGuardState.rssi, snr: RailGuardState.snr }, 60);

    // Invoke subscriber UI update callback
    if (RailGuardState.onPacketReceivedCallback) {
        RailGuardState.onPacketReceivedCallback(parsed);
    }
}

/**
 * Utility to maintain capped queue length for live chart historical data
 */
function pushHistory(array, item, maxLen = 60) {
    array.push(item);
    if (array.length > maxLen) {
        array.shift();
    }
}

/**
 * Exports current event history and telemetry buffer to CSV
 */
function exportDataToCSV() {
    if (RailGuardState.eventHistory.length === 0) {
        alert('No sensor telemetry event data recorded yet to export.');
        return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Time,PacketNo,Sensor,Status,Severity,GPS_Location,Raw_Packet\n';

    RailGuardState.eventHistory.forEach(row => {
        const line = `"${row.time}","${row.packetNo}","${row.sensor}","${row.status}","${row.severity}","${row.location}","${row.raw || ''}"`;
        csvContent += line + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `railguard_inspection_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
