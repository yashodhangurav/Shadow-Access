const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');

// Sensitive Route Demo
router.post('/transfer-funds', isAuthenticated, (req, res) => {
    res.json({ message: "Transfer of funds cryptographically signed and executed." });
});

module.exports = router;
