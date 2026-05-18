/**
 * ============================================================
 *  api/payments/approve.js
 *  Vercel Serverless Function — Pi Network Approve Payment
 *  URL: /api/payments/approve
 * ============================================================
 */

const axios = require("axios");

// ── Konfigurasi Pi Network ────────────────────────────────
// Simpan di Vercel Dashboard → Project → Settings → Environment Variables
// PI_SERVER_API_KEY = key dari Pi Developer Portal
// PI_APP_ID         = App ID dari Pi Developer Portal
const PI_API_KEY  = process.env.PI_SERVER_API_KEY;
const PI_API_BASE = "https://api.minepi.com";

// ── CORS: izinkan kedua domain Vercel ────────────────────
const ALLOWED_ORIGINS = [
    "https://sagatama-mart.vercel.app",
    "https://hidayatulamin.vercel.app",
    "https://website-sagatama.vercel.app"
];

function setCors(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Vary", "Origin");
}

// ── Handler utama ─────────────────────────────────────────
export default async function handler(req, res) {
    setCors(req, res);

    // Handle preflight OPTIONS
    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { paymentId, metadata } = req.body;

    if (!paymentId) {
        return res.status(400).json({ error: "paymentId wajib diisi" });
    }

    if (!PI_API_KEY) {
        console.error("[Pi] PI_SERVER_API_KEY belum di-set di environment variables");
        return res.status(500).json({ error: "Server configuration error" });
    }

    try {
        // 1. Ambil detail payment dari Pi API untuk verifikasi
        const piRes = await axios.get(
            `${PI_API_BASE}/v2/payments/${paymentId}`,
            {
                headers: {
                    "Authorization": `Key ${PI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 10000
            }
        );
        const piPayment = piRes.data;

        // 2. Cek sudah di-approve sebelumnya
        if (piPayment.status?.developer_approved) {
            console.log(`[Pi] Payment ${paymentId} sudah di-approve sebelumnya`);
            return res.status(200).json({ success: true, message: "Sudah di-approve sebelumnya" });
        }

        // 3. Validasi amount
        if (!piPayment.amount || piPayment.amount <= 0) {
            return res.status(400).json({ error: "Amount tidak valid" });
        }

        // 4. Approve di Pi API
        await axios.post(
            `${PI_API_BASE}/v2/payments/${paymentId}/approve`,
            {},
            {
                headers: {
                    "Authorization": `Key ${PI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 10000
            }
        );

        console.log(`[Pi] Payment ${paymentId} approved. Amount: ${piPayment.amount} Pi`);

        return res.status(200).json({
            success:   true,
            paymentId,
            amount:    piPayment.amount,
            memo:      piPayment.memo
        });

    } catch (err) {
        const msg = err.response?.data?.error_message || err.message || "Unknown error";
        const status = err.response?.status || 500;
        console.error(`[Pi] Approve error for ${paymentId}:`, msg);
        return res.status(status >= 400 && status < 600 ? status : 500).json({ error: msg });
    }
}
