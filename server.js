const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- SESSION MEMORY ---
let activeSessions = []; 

// --- DATABASE ---
const logSchema = new mongoose.Schema({
    level: String, method: String, url: String,
    status: Number, ip: String, message: String,
    timestamp: { type: Date, default: Date.now }
});
const Log = mongoose.model('Log', logSchema);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ SERVER ONLINE: Database Connected"))
    .catch(err => console.log("❌ DB Error:", err));

// --- LOGGER MIDDLEWARE ---
app.use(async (req, res, next) => {
    if (req.url.includes('/api/log')) return next(); // Jangan catat request dashboard

    const start = Date.now();
    res.on('finish', async () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        
        // Klasifikasi Level Log
        let level = "INFO";
        if (status >= 500) level = "ERROR";
        else if (status >= 400 || req.url.includes('admin')) level = "WARN"; // Admin access is suspicious
        else if (status >= 200) level = "SUCCESS";

        // Filter log spam (opsional: matikan jika ingin mencatat semuanya)
        if (req.url === '/api/log' && status === 401) return;

        try {
            await Log.create({
                level, method: req.method, url: req.url,
                status: status, ip: req.headers['x-forwarded-for'] || req.ip || '::1',
                message: `${req.method} ${req.url} - Status: ${status} [${duration}ms] - ${req.get('User-Agent')}`
            });
        } catch (e) { console.error(e); }
    });
    next();
});

// --- ROUTES ---
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/home', (req, res) => res.send('<h1>Welcome Home</h1>'));
app.get('/products', (req, res) => res.json({ id: 1, name: "CyberDeck v2" }));
app.get('/contact', (req, res) => res.send('Contact Us'));

// 🚫 Forbidden Areas (Untuk memancing log WARN)
app.get('/admin', (req, res) => res.status(403).send('🚫 ACCESS DENIED'));
app.get('/config.json', (req, res) => res.status(404).send('Not Found'));
app.post('/upload', (req, res) => res.status(500).send('Server Error: Disk Full'));

// --- API LOGIN ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin') {
        const token = "SECURE_" + Date.now();
        activeSessions.push(token);
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, message: "Invalid Credentials" });
    }
});

// --- API LOG (PROTECTED) ---
const requireAuth = (req, res, next) => {
    if (activeSessions.includes(req.headers['authorization'])) next();
    else res.status(401).json({ error: "Session Expired" });
};

app.get('/api/log', requireAuth, async (req, res) => {
    const logs = await Log.find().sort({ timestamp: -1 }).limit(50);
    res.json(logs);
});

app.delete('/api/log/clear', requireAuth, async (req, res) => {
    await Log.deleteMany({});
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`🚀 MARKAS PUSAT (SERVER) SIAP di http://localhost:${PORT}`);
    console.log(`📡 Menunggu koneksi dari User atau Bot...`);
});

module.exports = app;