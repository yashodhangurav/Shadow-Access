const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/', (req, res) => {
    res.render('landing');
});

router.get('/auth', (req, res) => {
    res.render('auth');
});

router.get('/enroll', (req, res) => {
    res.render('enroll');
});

router.get('/dashboard', (req, res) => {
    res.render('vault');
});

module.exports = router;
