const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Tambahkan ini
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000; // Gunakan env port Vercel

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        const db = await mongoose.connect(process.env.MONGO_URI, {
            // Opsi timeout dihapus karena mongoose versi baru sudah otomatis
            bufferCommands: false, // Penting untuk serverless
        });
        isConnected = db.connections[0].readyState;
        console.log("✅ DATABASE: Connected");
    } catch (error) { console.log("❌ DB Error:", error); }
};

// Skema Database
const logSchema = new mongoose.Schema({
    level: String,
    message: String,
    ip: String,
    timestamp: { type: Date, default: Date.now }
});
const Log = mongoose.models.Log || mongoose.model('Log', logSchema); // Cek model exist dulu

// --- ROUTES HALAMAN ---
// [PERBAIKAN] Membaca index.html secara sinkronus agar path terbaca di Vercel
app.get('/', (req, res) => {
    const htmlPath = path.join(process.cwd(), 'index.html'); // Gunakan process.cwd() untuk Vercel
    try {
        const html = fs.readFileSync(htmlPath, 'utf8');
        res.send(html);
    } catch (err) {
        res.status(500).send('Error loading dashboard: ' + err.message);
    }
});

// --- API UTAMA ---
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

app.get('/api/logs', async (req, res) => {
    try {
        await connectDB();
        const logs = await Log.find().sort({ timestamp: -1 }).limit(50).lean();
        const totalCount = await Log.countDocuments(); 
        res.json({ logs: logs, total: totalCount });
    } catch (err) { 
        res.json({ logs: [], total: 0 }); 
    }
});

app.delete('/api/logs/clear', async (req, res) => {
    await connectDB();
    await Log.deleteMany({});
    res.json({ success: true });
});

// Export app untuk Vercel
module.exports = app;

// Hanya listen jika dijalankan lokal (bukan di Vercel)
if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 SERVER READY ON PORT ${PORT}`));
}