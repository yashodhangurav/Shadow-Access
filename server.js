require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const connectDB = require('./src/config/db');

// Import Middleware
const checkSequence = require('./src/middleware/sequence');

// Load Route Modules
const authRoutes = require('./src/routes/authRoutes');
const behaviorRoutes = require('./src/routes/behaviorRoutes');
const demoRoutes = require('./src/routes/demoRoutes');

const app = express();

// 1. Connect MongoDB
connectDB();

// 2. Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 3. Session & Passport Config
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));
require('./src/config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// 4. Custom Sequence Threat Middleware
app.use(checkSequence);

// 5. Mount API Routes
app.use('/api', authRoutes);
app.use('/api', behaviorRoutes);
app.use('/api', demoRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ShadowAccess Engine live on port ${PORT}`));