import express from "express";

const app = express();

// Render sets PORT; default for local dev:
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(express.json({ limit: "1mb" }));

// ---- Static frontend ----
app.use(express.static("public"));

// ---- Health ----
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ---- OpenAI proxy endpoint ----
// IMPORTANT: Keep OPENAI_API_KEY only on server (Render env var).
app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing OPENAI_API_KEY env var on server.");
    }

    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).send("Missing messages array.");
    }

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
