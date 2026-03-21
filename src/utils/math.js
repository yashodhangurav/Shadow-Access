// src/utils/math.js

/**
 * Calculates how "weird" the current behavior is compared to the profile.
 * We use Z-Score: (Value - Mean) / Standard Deviation
 */
const calculateAnomalyScore = (currentAvg, profileMean, profileStdDev) => {
    const minStdDev = 25; // Raised to 25ms to accommodate slower user typing (like Wallet Addresses)
    const stdDev = Math.max(profileStdDev, minStdDev);
    return Math.abs((currentAvg - profileMean) / stdDev);
};



/**
 * Basic Euclidean Distance for multiple features 
 */
const getEuclideanDistance = (point1, point2) => {
    return Math.sqrt(
        Math.pow(point1.avgKeyTime - point2.avgKeyTime, 2) +
        Math.pow(point1.avgMouseSpeed - point2.avgMouseSpeed, 2)
    );
};

/**
 * Mouse Linearity - A perfectly straight line has 0 deviation.
 * Humans move in slight curves. Bots move mathematically straight.
 */
const calculateLinearity = (points) => {
    const n = points.length;
    if (n < 2) return 0;

    const start = points[0];
    const end = points[n - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const denominator = Math.sqrt(dx * dx + dy * dy);

    if (denominator === 0) return 0;

    let totalDeviation = 0;
    // Use a standard for-loop for speed
    for (let i = 0; i < n; i++) {
        const p = points[i];
        const numerator = Math.abs(dy * p.x - dx * p.y + end.x * start.y - end.y * start.x);
        totalDeviation += (numerator / denominator);
    }

    return totalDeviation / n;
};

module.exports = { calculateAnomalyScore, getEuclideanDistance, calculateLinearity };