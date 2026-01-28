const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 1. Schema Database
const logSchema = new mongoose.Schema({
    level: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});
const Log = mongoose.model('Log', logSchema);

// 2. Koneksi Database & Robot
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("✅ Terkoneksi ke MongoDB Atlas");
        console.log("🤖 Robot Log Raw Mode aktif...");

        // ==========================================
        // 🤖 ROBOT PENGIRIM PESAN TEKNIS (SISTEM)
        // ==========================================
        setInterval(async () => {
            try {
                // Tentukan Level (Lebih banyak INFO daripada ERROR, biar realistis)
                const levels = ["INFO", "INFO", "INFO", "WARN", "ERROR"];
                const rndLvl = levels[Math.floor(Math.random() * levels.length)];
                
                // Daftar Pesan ala System Admin / Server Log
                const sysMessages = [
                    "Starting Backup Manager 5.0.0 build 18268",
                    "Operating System: Windows Server 2022 R2",
                    "Architecture: amd64 / Processors Detected: 8",
                    "Total Physical Memory: 16.0 GB / Free: 4.2 GB",
                    "Database Service starting...",
                    "Creating embedded database 10.8.2.2",
                    "Object-Relational Mapping Service started",
                    "Message Event Service wrapper starting",
                    "General Service starting...",
                    "Index 'STATEINDEX' already exists in schema",
                    "Connection established to 192.168.1.55:27017",
                    "Garbage Collection: freed 45MB in 12ms",
                    "Packet received from 10.0.0.12, verifying checksum..."
                ];
                
                // Pesan Error/Warn khusus
                const errMessages = [
                    "!!! missing resource message key=[InvalidCredentials]",
                    "Connection timeout: remote host not responding",
                    "Unsuccessful: create index stateIndex on Table",
                    "Disk usage warning: Volume C: is 92% full"
                ];

                let pesanJadi = "";
                if (rndLvl === "ERROR" || rndLvl === "WARN") {
                     pesanJadi = errMessages[Math.floor(Math.random() * errMessages.length)];
                } else {
                     pesanJadi = sysMessages[Math.floor(Math.random() * sysMessages.length)];
                }
                
                const logBaru = new Log({
                    level: rndLvl,
                    message: pesanJadi
                });
                
                await logBaru.save();
                // console.log("Log saved"); // Diamkan CMD biar bersih

            } catch (e) { }
        }, 1000); // Setiap 1 detik

    }).catch(err => console.log("❌ Gagal konek DB:", err));

// 3. API Routes
app.get('/api/log', async (req, res) => {
    const logs = await Log.find().sort({ timestamp: -1 }).limit(30);
    res.json(logs);
});

app.post('/api/log', async (req, res) => {
    const newLog = new Log(req.body);
    await newLog.save();
    res.json(newLog);
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});