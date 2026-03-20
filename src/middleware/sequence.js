// src/middleware/sequence.js

const checkSequence = (req, res, next) => {
    const currentPath = req.path;

    // Only track API requests to analyze behavior sequences
    if (!currentPath.startsWith('/api')) return next();

    // Attach sequence directly to robust database session object instead of RAM
    if (!req.session.apiSequence) req.session.apiSequence = [];

    req.session.apiSequence.push(currentPath);
    
    // Keep a rolling window of the last 4 endpoints
    if (req.session.apiSequence.length > 4) req.session.apiSequence.shift();

    const sequence = req.session.apiSequence.join(' -> ');

    // Known generic risky sequences (bypassing normal app flow)
    const riskySequences = [
        "/api/login -> /api/export-data",
        "/api/me -> /api/export-data"
    ];

    let isRisky = false;
    riskySequences.forEach(risk => {
        if (sequence.includes(risk)) isRisky = true;
    });

    // Catch isolated jumps: If they take a valid session cookie from their browser into Postman, 
    // but they hit /transfer-funds as their very first request, the sequence length is only 1.
    if (req.session.apiSequence.length === 1 && currentPath === '/api/transfer-funds') {
        isRisky = true;
    }

    // Strict Workflow Enforcement for High-Risk Routes
    if (currentPath === '/api/transfer-funds' && req.session.apiSequence.length > 1) {
        // A real human transfer must be immediately preceded by bio-telemetry processing
        const prevPath = req.session.apiSequence[req.session.apiSequence.length - 2];
        if (prevPath !== '/api/analyze-behavior' && prevPath !== '/api/analyze-mouse') {
            isRisky = true;
            console.log(`❌ Strict Workflow Violated: /api/transfer-funds was preceded by ${prevPath}`);
        }
    }

    if (isRisky) {
        console.log(`🚨 SUSPICIOUS API SEQUENCE DETECTED: ${sequence}`);
        
        // Secure the session immediately
        if (req.user) {
            const User = require('../models/User'); // inline require
            User.findByIdAndUpdate(req.user._id, { isFlagged: true }).exec();
        }
        
        req.session.destroy(); // Blow up the database session

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
