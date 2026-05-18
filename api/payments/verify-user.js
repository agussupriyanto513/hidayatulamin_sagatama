/**
 * ============================================================
 *  api/payments/verify-user.js
 *  Vercel Serverless Function — Verifikasi User Pi Network
 *  URL: /api/payments/verify-user
 *  Menggunakan native fetch (Node 18+) — tidak perlu axios
 * ============================================================
 */

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

    const { accessToken } = req.body;

    if (!accessToken) {
        return res.status(400).json({ error: "accessToken wajib diisi" });
    }

    try {
        // Verifikasi access token ke Pi API
        const piRes = await fetch(`${PI_API_BASE}/v2/me`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type":  "application/json"
            },
            signal: AbortSignal.timeout(8000)
        });

        const piUser = await piRes.json().catch(() => ({}));

        if (!piRes.ok) {
            const msg = piUser?.message || piUser?.error || `HTTP ${piRes.status}`;
            console.error("[Pi] verifyUser error:", msg);
            return res.status(401).json({ error: msg });
        }

        console.log(`[Pi] User verified: @${piUser.username}`);

        return res.status(200).json({
            success:       true,
            piUsername:    piUser.username,
            piUid:         piUser.uid,
            walletAddress: piUser.wallet_address || ""
        });

    } catch (err) {
        const msg = err.message || "Verifikasi gagal";
        console.error("[Pi] verifyUser fetch error:", msg);
        return res.status(500).json({ error: msg });
    }
}
