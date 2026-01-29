const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path'); // Penting untuk mencari file html
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
    // Jangan catat request dashboard atau request icon
    if (req.url.includes('/api/logs') || req.url.includes('favicon')) return next(); 

    const start = Date.now();
    res.on('finish', async () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        
        let level = "INFO";
        if (status >= 500) level = "ERROR";
        else if (status >= 400 || req.url.includes('admin')) level = "WARN"; 
        else if (status >= 200) level = "SUCCESS";

        try {
            await Log.create({
                level, method: req.method, url: req.url,
                status: status, ip: req.headers['x-forwarded-for'] || req.ip || '::1',
                message: `${req.method} ${req.url} - Status: ${status} [${duration}ms]`
            });
        } catch (e) { console.error(e); }
    });
    next();
});

// --- ROUTES UTAMA ---

// INI PERBAIKANNYA: Kirim file index.html saat buka web utama
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Pancingan buat Bot
app.get('/admin', (req, res) => res.status(403).send('🚫 ACCESS DENIED'));
app.get('/login', (req, res) => res.status(200).send('Login Page'));
app.post('/upload', (req, res) => res.status(500).send('Server Error'));

// --- API DATA ---
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await Log.find().sort({ timestamp: -1 }).limit(50);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/logs/clear', async (req, res) => {
    await Log.deleteMany({});
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`🚀 MARKAS PUSAT SIAP`);
});

module.exports = app;