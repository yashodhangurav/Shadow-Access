const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // The "ShadowAccess" Profile
    behaviorProfile: {
        avgFlightTime: { type: Number, default: 0 }, // Average time between keys
        avgDwellTime: { type: Number, default: 0 },  // Average time key is held down
        stdDeviation: { type: Number, default: 0 },  // The "buffer" for natural variation
        stdDevDwell: { type: Number, default: 0 },   // Standard deviation for dwell time
        sampleCount: { type: Number, default: 0 }    // How many samples we've collected
    },
    isFlagged: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', UserSchema);