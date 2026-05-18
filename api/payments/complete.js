/**
 * ============================================================
 *  api/payments/complete.js
 *  Vercel Serverless Function — Pi Network Complete Payment
 *  URL: /api/payments/complete
 *  Menggunakan native fetch (Node 18+) — tidak perlu axios
 * ============================================================
 */

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

async function piGet(path) {
    const res = await fetch(`${PI_API_BASE}${path}`, {
        method: "GET",
        headers: {
            "Authorization": `Key ${PI_API_KEY}`,
            "Content-Type": "application/json"
        },
        signal: AbortSignal.timeout(10000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data?.error_message || data?.message || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

async function piPost(path, body = {}) {
    const res = await fetch(`${PI_API_BASE}${path}`, {
        method: "POST",
        headers: {
            "Authorization": `Key ${PI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data?.error_message || data?.message || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

export default async function handler(req, res) {
    setCors(req, res);

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

    const { paymentId, txid } = req.body;

    if (!paymentId || !txid) {
        return res.status(400).json({ error: "paymentId dan txid wajib diisi" });
    }

    if (!PI_API_KEY) {
        return res.status(500).json({ error: "Server configuration error" });
    }

    try {
        // 1. Verifikasi payment dari Pi API
        const piPayment = await piGet(`/v2/payments/${paymentId}`);

        // 2. Cek sudah di-complete sebelumnya (idempotent)
        if (piPayment.status?.developer_completed) {
            console.log(`[Pi] Payment ${paymentId} sudah di-complete sebelumnya`);
            return res.status(200).json({ success: true, message: "Sudah di-complete sebelumnya" });
        }

        // 3. Verifikasi txid cocok (log warning kalau beda, tapi tetap lanjut)
        if (piPayment.transaction?.txid && piPayment.transaction.txid !== txid) {
            console.warn(`[Pi] txid mismatch: expected ${piPayment.transaction.txid}, got ${txid}`);
        }

        // 4. Complete di Pi API
        await piPost(`/v2/payments/${paymentId}/complete`, { txid });

        console.log(`[Pi] Payment ${paymentId} completed. txid: ${txid}`);

        return res.status(200).json({
            success:   true,
            paymentId,
            txid,
            amount:    piPayment.amount,
            memo:      piPayment.memo,
            type:      piPayment.metadata?.type || "unknown"
        });

    } catch (err) {
        const msg    = err.message || "Unknown error";
        const status = err.status  || 500;
        console.error(`[Pi] Complete error for ${paymentId}:`, msg);
        return res.status(status >= 400 && status < 600 ? status : 500).json({ error: msg });
    }
}
