app.post('/api/enroll', async (req, res) => {
    const { pattern, userId } = req.body; // pattern is an array of ~100 keystrokes

    // 1. Calculate Mean (Average)
    const n = pattern.length;
    const mean = pattern.reduce((acc, curr) => acc + curr.flightTime, 0) / n;

    // 2. Calculate Standard Deviation (The "Spread" of their speed)
    const variance = pattern.reduce((acc, curr) => {
        return acc + Math.pow(curr.flightTime - mean, 2);
    }, 0) / n;
    const stdDev = Math.sqrt(variance);

    // 3. Save to MongoDB
    await User.findByIdAndUpdate(userId, {
        behaviorProfile: {
            avgFlightTime: mean,
            stdDeviation: stdDev,
            sampleCount: n
        }
    });

    res.json({ message: "Enrollment successful. ShadowAccess is now active." });
});