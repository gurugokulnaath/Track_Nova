/**
 * RAILGUARD - LoRa Packet & AI Result Parser
 * 
 * Packet Structure:
 * RG,packetNumber,IR1,IR2,IR3,IR4,crackCount,distanceCM,obstacle,vibrationDO,vibrationAO
 * Example: RG,1024,0,1,0,0,1,142.5,0,1,512
 */

/**
 * Parses raw LoRa packet string into a structured JavaScript object.
 * @param {string} packetString - The raw comma-separated packet payload
 * @returns {Object} Structured packet data object
 */
function parseLoRaPacket(packetString) {
    if (!packetString || typeof packetString !== 'string') {
        return { valid: false, error: 'Empty or invalid packet data' };
    }

    const trimmed = packetString.trim();
    const parts = trimmed.split(',');

    // Validate header and minimum fields (11 parameters)
    if (parts[0] !== 'RG' || parts.length < 11) {
        return { valid: false, error: `Invalid packet format: ${trimmed}` };
    }

    const packetNumber = parseInt(parts[1], 10) || 0;
    const ir1 = parseInt(parts[2], 10) || 0;
    const ir2 = parseInt(parts[3], 10) || 0;
    const ir3 = parseInt(parts[4], 10) || 0;
    const ir4 = parseInt(parts[5], 10) || 0;
    const crackCount = parseInt(parts[6], 10) || 0;
    const distanceCM = parseFloat(parts[7]);
    const obstacle = parseInt(parts[8], 10) || 0;
    const vibrationDO = parseInt(parts[9], 10) || 0;
    const vibrationAO = parseInt(parts[10], 10) || 0;

    // Determine list of specifically cracked IR sensors
    const crackedSensors = [];
    if (ir1 === 1) crackedSensors.push('IR1');
    if (ir2 === 1) crackedSensors.push('IR2');
    if (ir3 === 1) crackedSensors.push('IR3');
    if (ir4 === 1) crackedSensors.push('IR4');

    const isValidDistance = !isNaN(distanceCM) && distanceCM >= 0;
    const distanceM = isValidDistance ? (distanceCM / 100).toFixed(2) : 'N/A';

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    return {
        valid: true,
        header: 'RG',
        packetNumber,
        ir1,
        ir2,
        ir3,
        ir4,
        crackCount: crackedSensors.length || crackCount,
        crackedSensors,
        hasCrack: crackedSensors.length > 0,
        distanceCM: isValidDistance ? parseFloat(distanceCM.toFixed(1)) : null,
        distanceM: isValidDistance ? parseFloat(distanceM) : null,
        hasValidDistance: isValidDistance,
        obstacle: obstacle === 1,
        vibrationDO: vibrationDO === 1,
        vibrationAO: vibrationAO,
        timestamp: timeStr,
        isoTimestamp: now.toISOString(),
        raw: trimmed
    };
}

/**
 * Parses incoming AI vision backend payload.
 * @param {Object|string} payload - AI vision JSON string or object
 * @returns {Object} Normalized AI inspection result
 */
function parseAIResult(payload) {
    let data = payload;
    if (typeof payload === 'string') {
        try {
            data = JSON.parse(payload);
        } catch (e) {
            console.error('Failed to parse AI JSON:', e);
            return {
                detected: false,
                class: 'Unknown',
                confidence: 0,
                latencyMs: 0,
                timestamp: new Date().toTimeString().split(' ')[0]
            };
        }
    }

    const confidence = typeof data.confidence === 'number' ? data.confidence : 0;
    const confidencePct = confidence <= 1 ? (confidence * 100).toFixed(1) : confidence.toFixed(1);

    return {
        detected: Boolean(data.detected),
        class: data.class || (data.detected ? 'Crack' : 'Clear'),
        confidence: parseFloat(confidencePct),
        latencyMs: data.inferenceMs || data.latencyMs || 42,
        detectedObjects: data.objects || (data.detected ? ['Surface Defect / Rail Crack'] : ['Smooth Track']),
        timestamp: data.timestamp || new Date().toTimeString().split(' ')[0]
    };
}

// Export for module or browser global use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseLoRaPacket, parseAIResult };
}
