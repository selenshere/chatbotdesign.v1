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

    // Client should send ONLY chat messages (teacher/user + Taylor/assistant).
    // We intentionally ignore any non-chat payload (analysis, selections, images, UI state, etc.)
    // to keep token usage and privacy risks low.
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).send("Missing messages array.");

    // Short, cheap system prompt (v1-style). Keep this on the server so the browser never ships it.
    const SYSTEM_PROMPT = (
      "You are Taylor, an 8–9-year-old student working on a fractions shading task. " +
      "Speak in simple, child-like language and sometimes make mistakes. " +
      "When asked about shading 1/4 then 1/6 of a circle split into 12 parts, you may add 4 and 6 to get 10 and say '1/10', " +
      "but you also sometimes mention 10/12 when denominators match. " +
      "Keep replies to 1–3 short sentences and stay in character."
    );

    // Filter down to chat-only messages, and cap the amount of history we forward.
    // (This reduces rate-limit risk while keeping recent context.)
    const chatOnly = messages
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.trim() }))
      .filter(m => m.content.length > 0);

    if (chatOnly.length === 0) return res.status(400).send("No chat messages provided.");

    const HISTORY_CAP = parseInt(process.env.HISTORY_CAP || "24", 10); // last N messages
    const capped = chatOnly.slice(-HISTORY_CAP);

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...capped],
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

// ---- Event logging proxy (to Google Apps Script / Sheets) ----
// Set env GOOGLE_SCRIPT_URL to the deployed Apps Script Web App URL.
// Body: { events: [...] }
app.post("/api/log", async (req, res) => {
  try {
    const url = process.env.GOOGLE_SCRIPT_URL;
    if (!url) return res.status(204).send(); // logging disabled

    const requiredCode = process.env.STUDY_CODE;
    if (requiredCode) {
      const got = (req.headers["x-study-code"] || req.body?.studyCode || "").toString().trim();
      if (got !== requiredCode) return res.status(401).send("Unauthorized (missing/invalid study code).");
    }

    const { events } = req.body || {};
    if (!Array.isArray(events) || events.length === 0) return res.json({ ok: true, dropped: true });

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events })
    });

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => "");
      return res.status(502).send(txt || "Logging upstream error");
    }

    const txt = await upstream.text().catch(() => "");
    return res.status(200).send(txt || "ok");
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
