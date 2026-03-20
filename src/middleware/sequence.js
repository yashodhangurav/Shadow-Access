// src/middleware/sequence.js

const userPaths = {};

const checkSequence = (req, res, next) => {
    const sessionId = req.sessionID || "guest";
    const currentPath = req.path;

    // Only track API requests to analyze behavior sequences
    if (!currentPath.startsWith('/api')) return next();

    if (!userPaths[sessionId]) userPaths[sessionId] = [];

    userPaths[sessionId].push(currentPath);
    // Keep a rolling window of the last 4 endpoints
    if (userPaths[sessionId].length > 4) userPaths[sessionId].shift();

    const sequence = userPaths[sessionId].join(' -> ');

    // Known risky or impossible sequences indicative of bot scraping
    const riskySequences = [
        "/api/login -> /api/export-data",
        "/api/me -> /api/export-data",
        "/api/analyze-behavior -> /api/export-data",
        "/api/analyze-mouse -> /api/export-data",
        "/api/export-data -> /api/export-data" // Spamming sensitive route
    ];

    let isRisky = false;
    riskySequences.forEach(risk => {
        if (sequence.includes(risk)) isRisky = true;
    });

    // Catch isolated jumps: If they take a valid session cookie from their browser into Postman, 
    // but they hit /export-data as their very first request, the sequence length is only 1.
    if (userPaths[sessionId].length === 1 && currentPath === '/api/export-data') {
        isRisky = true;
    }

    if (isRisky) {
        console.log(`🚨 SUSPICIOUS API SEQUENCE DETECTED: ${sequence}`);
        
        // Secure the session immediately
        if (req.user) {
            const User = require('../models/User'); // inline require
            User.findByIdAndUpdate(req.user._id, { isFlagged: true }).exec();
            if (req.logout) req.logout(() => {}); 
        }

        return res.status(403).json({ 
            status: "ANOMALY_DETECTED", 
            action: "FORCE_LOCKOUT",
            reason: sequence,
            message: "Impossible Navigation/API Sequence Detected" 
        });
    }

    next();
};

module.exports = checkSequence;
