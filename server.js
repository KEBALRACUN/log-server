const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        const db = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, 
            socketTimeoutMS: 45000,
        });
        isConnected = db.connections[0].readyState;
        console.log("✅ DATABASE: Connected");
    } catch (error) { console.log("❌ DB Error:", error); }
};

// Skema Database (Kita sesuaikan agar cocok dengan MikroTik)
const logSchema = new mongoose.Schema({
    level: String,      // INFO, WARN, ERROR, AUTH
    message: String,    // Pesan log asli
    ip: String,         // IP Router / Hacker
    timestamp: { type: Date, default: Date.now }
});
const Log = mongoose.model('Log', logSchema);

// --- LOGGER OTOMATIS (Hanya untuk akses web, bukan log MikroTik) ---
app.use(async (req, res, next) => {
    // Jangan catat request yang menuju API Log (biar gak double/looping)
    if (req.url.includes('/api/logs')) return next();
    if (req.url.includes('favicon')) return next();

    const start = Date.now();
    res.on('finish', async () => {
        // Ini mencatat aktivitas User yang buka dashboard (bukan log router)
        // Opsional, bisa dihapus kalau mau hemat database
    });
    next();
});

// --- ROUTES HALAMAN ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- API UTAMA (JANTUNG OPERASI) ---

// 1. TERIMA DATA DARI BRIDGE (POST)
// Ini adalah pintu masuk data dari Laptop -> Vercel
app.post('/api/logs', async (req, res) => {
    await connectDB();
    const { level, message, ip } = req.body;

    try {
        await Log.create({
            level: level || 'INFO',
            message: message || 'No Data',
            ip: ip || 'Unknown',
            timestamp: new Date()
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. KIRIM DATA KE DASHBOARD (GET)
app.get('/api/logs', async (req, res) => {
    try {
        await connectDB();
        // Ambil 50 log terakhir, urutkan dari yang terbaru
        const logs = await Log.find().sort({ timestamp: -1 }).limit(50).lean(); 
        res.json(logs);
    } catch (err) { res.json([]); }
});

// 3. HAPUS LOG (CLEAR)
app.delete('/api/logs/clear', async (req, res) => {
    await connectDB();
    await Log.deleteMany({});
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 SERVER READY`));
module.exports = app;