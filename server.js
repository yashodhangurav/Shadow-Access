require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const passport = require('passport');
const connectDB = require('./src/config/db');
const path = require('path');

// Import Middleware
const checkSequence = require('./src/middleware/sequence');

// Load Route Modules
const authRoutes = require('./src/routes/authRoutes');
const behaviorRoutes = require('./src/routes/behaviorRoutes');
const demoRoutes = require('./src/routes/demoRoutes');
const htmlRoutes = require('./src/routes/htmlRoutes');
const EventEmitter = require('events');
const threatEmitter = new EventEmitter();

const app = express();
app.set('threatEmitter', threatEmitter);


// 1. Connect MongoDB
connectDB();

// 2. Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// EJS Template Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views/pages'));

app.use('/', htmlRoutes); // Handle Clean UI Routing First
app.use(express.static('public')); // Serve CSS/JS assets

// 3. Session & Passport Config
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI || "mongodb://localhost:27017/shadowaccess" }),
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

app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sessionUserId = req.user ? req.user._id.toString() : null;

    const listener = (data) => {
        if (sessionUserId && data.userId === sessionUserId) {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    };
    
    threatEmitter.on('threat', listener);
    
    const interval = setInterval(() => res.write(':keepalive\n\n'), 15000);
    
    req.on('close', () => {
        threatEmitter.removeListener('threat', listener);
        clearInterval(interval);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ShadowAccess Engine live on port ${PORT}`));