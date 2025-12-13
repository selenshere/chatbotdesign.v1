import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(express.json({ limit: "1mb" }));

// ---- Simple in-memory rate limit (per instance) ----
// Env:
//  - RATE_LIMIT_WINDOW_MS (default 600000 = 10 min)
//  - RATE_LIMIT_MAX (default 40)
// Notes: Render free plan may run a single instance. This is best-effort, not a distributed limiter.
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "600000", 10);
const MAX_REQ = parseInt(process.env.RATE_LIMIT_MAX || "40", 10);
const hits = new Map(); // ip -> {count, resetAt}

function rateLimit(req, res, next) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim() || "unknown";
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  rec.count += 1;
  if (rec.count > MAX_REQ) {
    const retryAfterSec = Math.max(1, Math.ceil((rec.resetAt - now) / 1000));
    res.setHeader("Retry-After", retryAfterSec.toString());
    return res.status(429).send("Too many requests. Please wait and try again.");
  }
  return next();
}

// ---- Static frontend ----
app.use(express.static("public"));

// ---- Health ----
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ---- OpenAI proxy endpoint ----
// IMPORTANT: Keep OPENAI_API_KEY only on server (Render env var).
// Optional access code:
//  - STUDY_CODE (if set, require header 'x-study-code' or body.studyCode to match)
app.post("/api/chat", rateLimit, async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).send("Missing OPENAI_API_KEY env var on server.");

    const requiredCode = process.env.STUDY_CODE;
    if (requiredCode) {
      const got = (req.headers["x-study-code"] || req.body?.studyCode || "").toString().trim();
      if (got !== requiredCode) return res.status(401).send("Unauthorized (missing/invalid study code).");
    }

    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).send("Missing messages array.");

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 120
      })
    });

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => "");
      return res.status(upstream.status).send(txt || "Upstream error");
    }

    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return res.json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});

// SPA fallback (optional): always serve index.html for unknown routes
app.get("*", (_req, res) => {
  res.sendFile(new URL("./public/index.html", import.meta.url).pathname);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
