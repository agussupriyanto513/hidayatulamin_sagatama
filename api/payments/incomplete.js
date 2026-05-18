/**
 * ============================================================
 *  api/payments/incomplete.js
 *  Vercel Serverless Function — Handle Incomplete Pi Payment
 *  URL: /api/payments/incomplete
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

    const { paymentId } = req.body;

    if (!paymentId) {
        return res.status(400).json({ error: "paymentId wajib diisi" });
    }

    if (!PI_API_KEY) {
        return res.status(500).json({ error: "Server configuration error" });
    }

    try {
        // Ambil detail payment dari Pi API
        const p = await piGet(`/v2/payments/${paymentId}`);

        // Skenario 1: Sudah approved + ada txid tapi belum completed → complete
        if (p.status?.developer_approved && !p.status?.developer_completed && p.transaction?.txid) {
            await piPost(`/v2/payments/${paymentId}/complete`, { txid: p.transaction.txid });
            console.log(`[Pi] Incomplete payment auto-completed: ${paymentId}`);
            return res.status(200).json({ success: true, action: "completed", paymentId });
        }

        // Skenario 2: Belum approved sama sekali → approve dulu
        if (!p.status?.developer_approved) {
            await piPost(`/v2/payments/${paymentId}/approve`);
            console.log(`[Pi] Incomplete payment auto-approved: ${paymentId}`);
            return res.status(200).json({ success: true, action: "approved", paymentId });
        }

        // Skenario 3: Sudah approved tapi belum ada txid → tunggu user konfirmasi
        return res.status(200).json({ success: true, action: "no_action_needed", paymentId });

    } catch (err) {
        const msg    = err.message || "Unknown error";
        const status = err.status  || 500;
        console.error(`[Pi] handleIncomplete error for ${paymentId}:`, msg);
        return res.status(status >= 400 && status < 600 ? status : 500).json({ error: msg });
    }
}
