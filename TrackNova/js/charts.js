/**
 * RAILGUARD - High-Performance Vanilla JS Canvas Charting Engine
 * Renders real-time hardware telemetry charts without external dependencies.
 */

function renderAllCharts() {
    drawVibrationChart();
    drawDistanceChart();
    drawIRChart();
    drawLoRaChart();
}

/**
 * Setup canvas for high DPI retina displays
 */
function prepareCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    
    const width = rect.width || 400;
    const height = 180;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    return { ctx, width, height };
}

/**
 * Draw background grid and axes
 */
function drawChartGrid(ctx, width, height, yMin, yMax, ySteps = 4) {
    // Background fill
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // Horizontal grid lines & Y labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    const paddingLeft = 35;
    const paddingBottom = 20;
    const chartW = width - paddingLeft - 10;
    const chartH = height - paddingBottom - 10;

    for (let i = 0; i <= ySteps; i++) {
        const yVal = yMin + (yMax - yMin) * (i / ySteps);
        const yPos = 10 + chartH - (i / ySteps) * chartH;

        ctx.beginPath();
        ctx.moveTo(paddingLeft, yPos);
        ctx.lineTo(width - 10, yPos);
        ctx.stroke();

        ctx.fillText(Math.round(yVal), paddingLeft - 5, yPos + 3);
    }

    return { paddingLeft, paddingBottom, chartW, chartH };
}

/**
 * 1. Vibration History Canvas Chart
 */
function drawVibrationChart() {
    const setup = prepareCanvas('canvas-vibration-chart');
    if (!setup) return;
    const { ctx, width, height } = setup;

    const data = RailGuardState.vibrationHistory;
    const yMin = 0, yMax = 1000;
    const { paddingLeft, chartW, chartH } = drawChartGrid(ctx, width, height, yMin, yMax);

    if (data.length < 2) return;

    // Draw DO threshold line (AO > 650)
    const thresholdY = 10 + chartH - (650 / yMax) * chartH;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, thresholdY);
    ctx.lineTo(width - 10, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Line Path
    ctx.beginPath();
    data.forEach((pt, idx) => {
        const x = paddingLeft + (idx / (data.length - 1)) * chartW;
        const y = 10 + chartH - (pt.value / yMax) * chartH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    // Stroke line
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Area Fill under line
    const lastX = paddingLeft + chartW;
    ctx.lineTo(lastX, 10 + chartH);
    ctx.lineTo(paddingLeft, 10 + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
    grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();
}

/**
 * 2. Ultrasonic Distance History Canvas Chart
 */
function drawDistanceChart() {
    const setup = prepareCanvas('canvas-distance-chart');
    if (!setup) return;
    const { ctx, width, height } = setup;

    const data = RailGuardState.distanceHistory;
    const yMin = 0, yMax = 400;
    const { paddingLeft, chartW, chartH } = drawChartGrid(ctx, width, height, yMin, yMax);

    if (data.length < 2) return;

    // Obstacle Threshold Line (default 100 cm)
    const threshCm = RailGuardState.obstacleThresholdCM;
    const threshY = 10 + chartH - (threshCm / yMax) * chartH;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, threshY);
    ctx.lineTo(width - 10, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance Line
    ctx.beginPath();
    data.forEach((pt, idx) => {
        const x = paddingLeft + (idx / (data.length - 1)) * chartW;
        const y = 10 + chartH - (pt.value / yMax) * chartH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill
    ctx.lineTo(paddingLeft + chartW, 10 + chartH);
    ctx.lineTo(paddingLeft, 10 + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(6, 182, 212, 0.2)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();
}

/**
 * 3. IR Crack Events History Chart
 */
function drawIRChart() {
    const setup = prepareCanvas('canvas-ir-chart');
    if (!setup) return;
    const { ctx, width, height } = setup;

    const data = RailGuardState.irHistory;
    const yMin = 0, yMax = 4;
    const { paddingLeft, chartW, chartH } = drawChartGrid(ctx, width, height, yMin, yMax, 4);

    if (data.length < 2) return;

    // Draw Bar Chart for IR Crack counts
    const barWidth = Math.max(3, (chartW / data.length) - 2);

    data.forEach((pt, idx) => {
        const x = paddingLeft + (idx / data.length) * chartW;
        const barH = (pt.crackCount / yMax) * chartH;
        const y = 10 + chartH - barH;

        ctx.fillStyle = pt.crackCount > 0 ? '#ef4444' : '#10b981';
        ctx.fillRect(x, y, barWidth, barH);
    });
}

/**
 * 4. LoRa Signal Quality RSSI & SNR Chart
 */
function drawLoRaChart() {
    const setup = prepareCanvas('canvas-lora-chart');
    if (!setup) return;
    const { ctx, width, height } = setup;

    const data = RailGuardState.rssiHistory;
    const yMin = -100, yMax = -50;
    const { paddingLeft, chartW, chartH } = drawChartGrid(ctx, width, height, yMin, yMax);

    if (data.length < 2) return;

    ctx.beginPath();
    data.forEach((pt, idx) => {
        const normRssi = Math.min(-50, Math.max(-100, pt.rssi));
        const x = paddingLeft + (idx / (data.length - 1)) * chartW;
        const y = 10 + chartH - ((normRssi - yMin) / (yMax - yMin)) * chartH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();
}
