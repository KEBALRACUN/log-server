const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION MANAGER ---
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

const logSchema = new mongoose.Schema({
    level: String, method: String, url: String,
    status: Number, ip: String, message: String,
    timestamp: { type: Date, default: Date.now }
});
const Log = mongoose.model('Log', logSchema);

// --- LOGGER MIDDLEWARE ---
app.use(async (req, res, next) => {
    await connectDB();
    if (req.url.includes('/api/logs') || req.url.includes('favicon')) return next(); 

    const start = Date.now();
    res.on('finish', async () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        let level = (status >= 500) ? "ERROR" : (status >= 400 || req.url.includes('admin')) ? "WARN" : "SUCCESS";

        try {
            if(isConnected) {
                await Log.create({
                    level, method: req.method, url: req.url, status,
                    ip: req.headers['x-forwarded-for'] || req.ip || '::1',
                    message: `${req.method} ${req.url} - Status: ${status} [${duration}ms]`
                });
            }
        } catch (e) { console.error(e); }
    });
    next();
});

// --- ROUTES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html'))); // SERVE DASHBOARD
app.get('/admin', (req, res) => res.status(403).send('🚫 ACCESS DENIED'));
app.get('/login', (req, res) => res.status(200).send('Login Page'));
app.post('/upload', (req, res) => res.status(500).send('Server Error'));

// --- API (OPTIMIZED) ---
app.get('/api/logs', async (req, res) => {
    try {
        await connectDB();
        // Ambil 20 data terakhir, mode LEAN (Cepat)
        const logs = await Log.find().sort({ timestamp: -1 }).limit(20).lean(); 
        res.json(logs);
    } catch (err) { res.json([]); }
});

app.delete('/api/logs/clear', async (req, res) => {
    await connectDB();
    await Log.deleteMany({});
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 SERVER READY`));
module.exports = app;