const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/', (req, res) => {
    res.render('landing', { pageCss: 'landing.css' });
});

router.get('/auth', (req, res) => {
    res.render('auth', { pageCss: 'auth.css' });
});

router.get('/enroll', (req, res) => {
    res.render('enroll', { pageCss: 'enroll.css' });
});

router.get('/dashboard', (req, res) => {
    res.render('vault', { pageCss: 'vault.css' });
});

module.exports = router;
