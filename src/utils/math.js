// src/utils/math.js

/**
 * Calculates how "weird" the current behavior is compared to the profile.
 * We use Z-Score: (Value - Mean) / Standard Deviation
 */
const calculateAnomalyScore = (currentAvg, profileMean, profileStdDev) => {
    if (profileStdDev === 0) return 0; // Avoid division by zero
    return Math.abs((currentAvg - profileMean) / profileStdDev);
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
    if (!points || points.length < 2) return 0;
    
    let totalDeviation = 0;
    const start = points[0];
    const end = points[points.length - 1];

    const denominator = Math.sqrt(Math.pow(end.y - start.y, 2) + Math.pow(end.x - start.x, 2));
    
    // Prevent division by zero if starting and ending pixel are identical
    if (denominator === 0) return 0;

    // Formula for distance from point to line (Start -> End)
    points.forEach(p => {
        const numerator = Math.abs((end.y - start.y) * p.x - (end.x - start.x) * p.y + end.x * start.y - end.y * start.x);
        totalDeviation += (numerator / denominator);
    });

    return totalDeviation / points.length; // Average deviation from a straight line
};

module.exports = { calculateAnomalyScore, getEuclideanDistance, calculateLinearity };