const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');

// Sensitive Route Demo
router.post('/export-data', isAuthenticated, (req, res) => {
    res.json({ message: "Sensitive Data exported successfully" });
});

module.exports = router;
