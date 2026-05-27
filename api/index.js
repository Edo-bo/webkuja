const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support data besar

// ENV Config Vercel (Wajib diisi di dashboard Vercel)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || 'Edo-bo';
const REPO = process.env.GITHUB_REPO || 'databa';
const PATH = process.env.GITHUB_FILE_PATH || 'databaseku';

const GITHUB_API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;

const getHeaders = () => ({
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
});

// GET: Ambil Data Real-time dari Repo
app.get('/api/database', async (req, res) => {
    try {
        const response = await axios.get(GITHUB_API_URL, { headers: getHeaders() });
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        res.json({
            success: true,
            sha: response.data.sha,
            data: JSON.parse(content)
        });
    } catch (error) {
        // Fallback baca RAW jika token tidak valid/belum diset
        try {
            const raw = await axios.get(`https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${PATH}`);
            res.json({ success: true, sha: null, data: raw.data, warning: "Membaca mode RAW (Token GitHub belum dikonfigurasi di Vercel)" });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Gagal membaca database dari GitHub.' });
        }
    }
});

// POST: Update Data Real-time ke Repo
app.post('/api/database', async (req, res) => {
    if (!GITHUB_TOKEN) return res.status(403).json({ success: false, message: 'GITHUB_TOKEN tidak diset di ENV Vercel!' });

    try {
        const { data, sha, commitMsg } = req.body;
        if (!sha) return res.status(400).json({ success: false, message: 'SHA tidak valid, silakan refresh halaman.' });

        const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
        
        const response = await axios.put(GITHUB_API_URL, {
            message: commitMsg || `Database Update | ${new Date().toISOString()}`,
            content: content,
            sha: sha,
            branch: 'main'
        }, { headers: getHeaders() });

        res.json({ success: true, newSha: response.data.content.sha });
    } catch (error) {
        res.status(500).json({ success: false, message: error.response?.data?.message || 'Gagal push ke GitHub.' });
    }
});

module.exports = app;
