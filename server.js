const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION MANAGER (ANTI-CRASH) ---
// Kita simpan status koneksi di luar function supaya tidak konek berulang-ulang
let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        return; // Jika sudah konek, pakai jalur lama (jangan buka baru)
    }

    try {
        const db = await mongoose.connect(process.env.MONGO_URI, {
            // Opsi ini mencegah loading abadi
            serverSelectionTimeoutMS: 5000, 
            socketTimeoutMS: 45000,
        });
        isConnected = db.connections[0].readyState;
        console.log("✅ DATABASE: Jalur Diamankan (Connected)");
    } catch (error) {
        console.log("❌ DATABASE ERROR:", error);
    }
};

// --- SCHEMA ---
const logSchema = new mongoose.Schema({
    level: String, method: String, url: String,
    status: Number, ip: String, message: String,
    timestamp: { type: Date, default: Date.now }
});
const Log = mongoose.model('Log', logSchema);

// --- MIDDLEWARE PINTAR ---
// Sebelum memproses APAPUN, pastikan database konek dulu
app.use(async (req, res, next) => {
    await connectDB();
    
    // Logger logic
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
            // Cek lagi koneksi sebelum menulis
            if(isConnected) {
                await Log.create({
                    level, method: req.method, url: req.url,
                    status: status, ip: req.headers['x-forwarded-for'] || req.ip || '::1',
                    message: `${req.method} ${req.url} - Status: ${status} [${duration}ms]`
                });
            }
        } catch (e) { console.error("Gagal tulis log:", e); }
    });
    next();
});

// --- ROUTES ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => res.status(403).send('🚫 ACCESS DENIED'));
app.get('/login', (req, res) => res.status(200).send('Login Page'));
app.post('/upload', (req, res) => res.status(500).send('Server Error'));

// --- API DATA ---
app.get('/api/logs', async (req, res) => {
    try {
        await connectDB(); // Pastikan konek
        const logs = await Log.find().sort({ timestamp: -1 }).limit(50);
        res.json(logs);
    } catch (err) {
        // Jika error, kirim array kosong biar Dashboard gak hang
        console.error(err);
        res.json([]); 
    }
});

app.delete('/api/logs/clear', async (req, res) => {
    await connectDB();
    await Log.deleteMany({});
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`🚀 MARKAS PUSAT SIAP`);
});

module.exports = app;