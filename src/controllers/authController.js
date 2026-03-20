const bcrypt = require('bcryptjs');
const passport = require('passport');
const User = require('../models/User');

exports.signup = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Missing fields" });
        
        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ error: "Username already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ username, password: hashedPassword });
        
        req.login(newUser, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ message: "Signup successful", user: { username, id: newUser._id } });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.login = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ error: info.message });
        req.login(user, (err) => {
            if (err) return next(err);
            return res.json({ message: "Login successful", user: { username: req.user.username, id: req.user._id } });
        });
    })(req, res, next);
};

exports.logout = (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ error: err.message });
        req.session.destroy();
        res.json({ message: "Logged out" });
    });
};

exports.getMe = (req, res) => {
    if (req.isAuthenticated()) {
        const u = req.user;
        const profileExists = u.behaviorProfile && u.behaviorProfile.sampleCount > 0;
        return res.json({ user: { username: u.username, id: u._id, isFlagged: u.isFlagged }, profileExists });
    }
    return res.status(401).json({ error: "Not authenticated" });
};

exports.unlockAccount = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { isFlagged: false });
        res.json({ message: "Account Unlocked" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
