const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

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
    // Jangan catat request yang meminta data log (biar gak looping)
    if (req.url.includes('/api/logs')) return next(); 

    const start = Date.now();
    res.on('finish', async () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        
        // Klasifikasi Level Log
        let level = "INFO";
        if (status >= 500) level = "ERROR";
        else if (status >= 400 || req.url.includes('admin')) level = "WARN"; 
        else if (status >= 200) level = "SUCCESS";

        try {
            // Hapus check req.url === '/api/log' disini karena sudah di filter diatas
            await Log.create({
                level, method: req.method, url: req.url,
                status: status, ip: req.headers['x-forwarded-for'] || req.ip || '::1',
                message: `${req.method} ${req.url} - Status: ${status} [${duration}ms]`
            });
        } catch (e) { console.error(e); }
    });
    next();
});

// --- ROUTES BIASA (Pancingan Bot) ---
app.get('/', (req, res) => res.send('<h1>SYSTEM ONLINE</h1>'));
app.get('/admin', (req, res) => res.status(403).send('🚫 ACCESS DENIED'));
app.get('/login', (req, res) => res.status(200).send('Login Page'));
app.post('/upload', (req, res) => res.status(500).send('Server Error'));

// --- API UTAMA (Jalur Dashboard) ---

// 1. Ambil Log (Tanpa Auth dulu biar lancar di Vercel)
// Perhatikan: Pakai 'logs' (ada S nya)
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await Log.find().sort({ timestamp: -1 }).limit(50);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Hapus Log
app.delete('/api/logs/clear', async (req, res) => {
    await Log.deleteMany({});
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`🚀 MARKAS PUSAT SIAP`);
});

module.exports = app;