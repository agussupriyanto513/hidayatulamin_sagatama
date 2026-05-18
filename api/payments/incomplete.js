/**
 * ============================================================
 *  api/payments/incomplete.js
 *  Vercel Serverless Function — Handle Incomplete Pi Payment
 *  URL: /api/payments/incomplete
 * ============================================================
 */

const axios = require("axios");

const PI_API_KEY  = process.env.PI_SERVER_API_KEY;
const PI_API_BASE = "https://api.minepi.com";

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

export default async function handler(req, res) {
    setCors(req, res);

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

    const { paymentId } = req.body;

    if (!paymentId) {
        return res.status(400).json({ error: "paymentId wajib diisi" });
    }

    if (!PI_API_KEY) {
        return res.status(500).json({ error: "Server configuration error" });
    }

    const piHeaders = {
        "Authorization": `Key ${PI_API_KEY}`,
        "Content-Type":  "application/json"
    };

    try {
        // Ambil detail payment dari Pi API
        const piRes = await axios.get(
            `${PI_API_BASE}/v2/payments/${paymentId}`,
            { headers: piHeaders, timeout: 10000 }
        );
        const p = piRes.data;

        // Skenario 1: Sudah approved + ada txid tapi belum completed → complete
        if (p.status?.developer_approved && !p.status?.developer_completed && p.transaction?.txid) {
            await axios.post(
                `${PI_API_BASE}/v2/payments/${paymentId}/complete`,
                { txid: p.transaction.txid },
                { headers: piHeaders, timeout: 10000 }
            );
            console.log(`[Pi] Incomplete payment auto-completed: ${paymentId}`);
            return res.status(200).json({ success: true, action: "completed", paymentId });
        }

        // Skenario 2: Belum approved sama sekali → approve dulu
        if (!p.status?.developer_approved) {
            await axios.post(
                `${PI_API_BASE}/v2/payments/${paymentId}/approve`,
                {},
                { headers: piHeaders, timeout: 10000 }
            );
            console.log(`[Pi] Incomplete payment auto-approved: ${paymentId}`);
            return res.status(200).json({ success: true, action: "approved", paymentId });
        }

        // Skenario 3: Sudah approved tapi belum ada txid → tunggu user konfirmasi
        return res.status(200).json({ success: true, action: "no_action_needed", paymentId });

    } catch (err) {
        const msg = err.response?.data?.error_message || err.message || "Unknown error";
        console.error(`[Pi] handleIncomplete error for ${paymentId}:`, msg);
        return res.status(500).json({ error: msg });
    }
}
