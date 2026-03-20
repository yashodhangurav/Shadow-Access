const express = require('express');
const router = express.Router();
const behaviorController = require('../controllers/behaviorController');
const { isAuthenticated } = require('../middleware/authMiddleware');

router.post('/enroll', isAuthenticated, behaviorController.enroll);
router.post('/analyze-behavior', isAuthenticated, behaviorController.analyzeKeyboard);
router.post('/analyze-mouse', isAuthenticated, behaviorController.analyzeMouse);

module.exports = router;
