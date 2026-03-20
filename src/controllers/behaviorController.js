const User = require('../models/User');
const { calculateAnomalyScore, calculateLinearity } = require('../utils/math');

exports.enroll = async (req, res) => {
    try {
        const { pattern } = req.body; 
        if (!pattern || pattern.length < 50) {
            return res.status(400).json({ error: "Need at least 50 keystrokes to build a profile." });
        }

        const n = pattern.length;
        const mean = pattern.reduce((acc, curr) => acc + curr.flightTime, 0) / n;
        const variance = pattern.reduce((acc, curr) => acc + Math.pow(curr.flightTime - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);

        const updated = await User.findByIdAndUpdate(req.user._id, {
            behaviorProfile: { avgFlightTime: mean, stdDeviation: stdDev, sampleCount: n }
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
        const currentAvg = pattern.reduce((acc, curr) => acc + curr.flightTime, 0) / pattern.length;
        const anomalyScore = calculateAnomalyScore(currentAvg, profile.avgFlightTime, profile.stdDeviation);
        const THRESHOLD = 3.0;

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
