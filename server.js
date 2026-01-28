require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- 1. KONEKSI DATABASE ---
// Nanti URL database kita taruh di Environment Variable agar aman
const mongoURI = process.env.MONGO_URI; 

if (!mongoURI) {
    console.error("❌ FATAL ERROR: MONGO_URI belum disetting!");
    process.exit(1);
}

mongoose.connect(mongoURI)
    .then(() => console.log('✅ Terkoneksi ke MongoDB Atlas'))
    .catch(err => console.error('❌ Gagal konek DB:', err));

// Buat Skema Database (Struktur Data)
const LogSchema = new mongoose.Schema({
    level: String,
    message: String,
    service: String,
    timestamp: { type: Date, default: Date.now }
});
const LogModel = mongoose.model('Log', LogSchema);

// --- 2. MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Agar bisa baca file HTML/CSS

// --- 3. ROUTES ---

// Endpoint Menerima Log
app.post('/api/log', async (req, res) => {
    try {
        const newLog = new LogModel({
            level: req.body.level || 'INFO',
            message: req.body.message || 'No message',
            service: req.body.service || 'Unknown'
        });

        // Simpan ke Database (Asynchronous)
        await newLog.save();

        // Pancarkan ke Web (Realtime)
        io.emit('new_log', newLog);

        res.status(200).send({ status: 'saved', id: newLog._id });
    } catch (error) {
        res.status(500).send({ error: 'Gagal menyimpan log' });
    }
});

// Endpoint untuk mengambil history log (saat pertama buka web)
app.get('/api/history', async (req, res) => {
    // Ambil 50 log terakhir
    const logs = await LogModel.find().sort({ timestamp: -1 }).limit(50);
    res.json(logs.reverse()); // Balik urutan agar yang lama di atas
});

// Jalankan Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server berjalan di Port ${PORT}`);
});