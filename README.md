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

## New session (sıfırdan başlat)
Sağ üstteki **New session** butonu bu cihazdaki kaydı temizler ve yeni bir oturum başlatır.
Ayrıca URL ile de yapılabilir: `/?reset=1`

## Otomatik veri kaydı (Google Sheets / Drive)
Uygulama, bağlantı kesilse ya da sayfa yenilense bile veri kaybını önlemek için:
- Veriyi tarayıcıda **localStorage** ile saklar
- Olayları (event) **kuyruğa** alır ve internet gelince sunucuya gönderir

Google Sheets'e yazdırmak için:
1) Google Apps Script ile bir Web App deploy edin (aşağıdaki örnek kodu kullanabilirsiniz)
2) Render env var ekleyin:
   - `GOOGLE_SCRIPT_URL` = Apps Script Web App URL

Bu env var set değilse logging kapalıdır (uygulama normal çalışır).

### Apps Script örnek (Sheet'e append)
```js
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.openById("SHEET_ID");
  const sh = ss.getSheetByName("events");
  const events = body.events || [];
  events.forEach(evt => {
    sh.appendRow([
      new Date(),
      evt.sessionId,
      evt.eventType,
      JSON.stringify(evt.data || {}),
      evt.clientTs || "",
      evt.userAgent || ""
    ]);
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```


## Güvenlik (önerilen)
- Rate limit env vars:
  - `RATE_LIMIT_WINDOW_MS` (default 600000)
  - `RATE_LIMIT_MAX` (default 40)
- Opsiyonel erişim kodu:
  - `STUDY_CODE` set ederseniz backend `x-study-code` header ister.
  - Kodu kullanıcıya vermek için: `https://YOURAPP.onrender.com/?code=KOD`
