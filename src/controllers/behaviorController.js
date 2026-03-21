const User = require('../models/User');
const { calculateAnomalyScore, calculateLinearity } = require('../utils/math');

exports.enroll = async (req, res) => {
    try {
        const { pattern } = req.body;
        if (!pattern || pattern.length < 50) {
            return res.status(400).json({ error: "Need at least 50 keystrokes to build a profile." });
        }

        const n = pattern.length;
        const meanFlight = pattern.reduce((acc, curr) => acc + curr.flightTime, 0) / n;
        const varianceFlight = pattern.reduce((acc, curr) => acc + Math.pow(curr.flightTime - meanFlight, 2), 0) / n;
        const stdDevFlight = Math.sqrt(varianceFlight);

        const meanDwell = pattern.reduce((acc, curr) => acc + (curr.dwellTime || 0), 0) / n;
        const varianceDwell = pattern.reduce((acc, curr) => acc + Math.pow((curr.dwellTime || 0) - meanDwell, 2), 0) / n;
        const stdDevDwell = Math.sqrt(varianceDwell);

        const updated = await User.findByIdAndUpdate(req.user._id, {
            behaviorProfile: {
                avgFlightTime: meanFlight,
                stdDeviation: stdDevFlight,
                avgDwellTime: meanDwell,
                stdDevDwell: stdDevDwell,
                sampleCount: n
            }
        }, { new: true });

        res.json({ message: "Profile Created!", userId: updated._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.analyzeKeyboard = async (req, res) => {
    try {
        const { pattern } = req.body;
        const user = req.user;

        if (user.isFlagged) {
            return res.status(403).json({ error: "Account is locked due to Suspicious Activity." });
        }

        if (!user.behaviorProfile || user.behaviorProfile.sampleCount === 0) {
            return res.status(404).json({ error: "Profile not found. Train first." });
        }

        const profile = user.behaviorProfile;

        const currentAvgFlight = pattern.reduce((acc, curr) => acc + curr.flightTime, 0) / pattern.length;
        const anomalyScoreFlight = calculateAnomalyScore(currentAvgFlight, profile.avgFlightTime, profile.stdDeviation);

        const currentAvgDwell = pattern.reduce((acc, curr) => acc + (curr.dwellTime || 0), 0) / pattern.length;
        const anomalyScoreDwell = calculateAnomalyScore(currentAvgDwell, profile.avgDwellTime, profile.stdDevDwell || 0);

        // Use Math.max so an extreme anomaly in *either* metric triggers the alarm
        let anomalyScore = Math.max(anomalyScoreFlight, anomalyScoreDwell);

        // --- ROBOTIC PRECISION CHECK ---
        // Calculate the variance of the *current* batch of keystrokes.
        // Humans cannot type 5+ keys with exact millisecond precision.
        const currentVarFlight = pattern.reduce((acc, curr) => acc + Math.pow(curr.flightTime - currentAvgFlight, 2), 0) / pattern.length;
        if (currentVarFlight < 0.5 && pattern.length >= 8) {
            anomalyScore = 50.0; // Robotic Precision Lockout
        }


        const THRESHOLD = 15.0; // Increased tolerance threshold


        if (anomalyScore > THRESHOLD) {
            console.log(`🚨 HIJACK ALERT: User ${user.username} is behaving abnormally! (Score: ${anomalyScore.toFixed(2)})`);
            await User.findByIdAndUpdate(user._id, { isFlagged: true });

            return res.json({
                status: "ANOMALY_DETECTED",
                action: "FORCE_LOCKOUT",
                score: anomalyScore,
                message: "Behavioral mismatch detected. Session locked."
            });
        }

        res.json({ status: "OK", score: anomalyScore });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.analyzeMouse = async (req, res) => {
    try {
        const { points } = req.body;
        const user = req.user;

        if (user.isFlagged) {
            return res.status(403).json({ error: "Account is locked." });
        }

        if (!points || points.length < 10) return res.json({ status: "OK", deviation: 5.0 });

        const deviation = calculateLinearity(points);

        if (deviation < 0.5) {
            console.log(`🚨 MOUSE BOT ALERT: User ${user.username} moved rigidly! (Linearity Deviation: ${deviation.toFixed(2)})`);
            await User.findByIdAndUpdate(user._id, { isFlagged: true });

            return res.json({
                status: "ANOMALY_DETECTED",
                action: "FORCE_LOCKOUT",
                deviation: deviation,
                message: "Non-Human geometric mouse movement detected. Session locked."
            });
        }

        res.json({ status: "OK", deviation });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
