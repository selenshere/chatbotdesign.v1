# Taylor Task (Render) – Fullstack in One Repo

Bu repo:
- `public/` içinde frontend (welcome + 3 zorunlu soru + chat + tag/comment + download)
- `server.js` içinde backend proxy (OpenAI API key gizli kalır)

## Local çalıştırma
1) Node 18+ kurulu olsun
2) Terminal:
```bash
npm install
OPENAI_API_KEY="YOUR_KEY" npm start
```
3) Aç: http://localhost:3000

## Render deploy
1) Repo'yu GitHub'a pushla
2) Render -> New -> Web Service -> repo'yu seç
3) Environment Variables:
- `OPENAI_API_KEY` = (secret)
- (opsiyonel) `OPENAI_MODEL` = gpt-4o-mini

Deploy sonrası URL üzerinden uygulama çalışır.

## Download (Save)
Sağ üstteki **Save / Download** butonu:
- pre-questions
- tüm konuşma
- tüm tag/comment
hepsini tek bir `JSON` dosyası olarak indirir.
