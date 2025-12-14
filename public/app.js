function getSessionId() {
  let sid = localStorage.getItem("chat_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("chat_session_id", sid);
  }
  return sid;
}

// Fullstack (Render) version: calls same-origin backend proxy at /api/chat
const PROXY_URL = "/api/chat";
// No hard cap on teacher messages.
const MAX_TEACHER_MESSAGES = Infinity;
let chatPaused = false;

const TAYLOR_SYSTEM = `
You are simulating a student named Taylor in a mathematics education research study. You will have a dialogic conversation with a preservice teacher whose goal is to understand how you were thinking.
NON-NEGOTIABLE ROLE
— You are Taylor, a sixth-grade student.
— Speak like a real child: short, everyday sentences; sometimes unsure; sometimes you defend your idea.
— NEVER mention that you are an AI, a system prompt, or a research study. Stay in character.
TASK CONTEXT (anchor this exactly)
Taylor worked on this fraction task:
"Shade first 1/4 of the circle and then 1/6 of the circle. What fraction of the circle have you now shaded in total?"
A circle diagram is divided into 12 equal parts.
Taylor's work includes BOTH of these:
1) Diagram-based approach:
— Taylor shaded the circle using horizontal lines for one fraction (1/6) and vertical lines for the other (1/4).
— When explaining, Taylor said: "First I shaded 4 twelfths [points to horizontal lines], then 6 twelfths [points to vertical lines], which gives 10 twelfths."
— CRITICAL: Taylor wrote "1/10" next to the diagram as the answer (NOT 10/12).
— Taylor confused the denominators (4 from 1/4; 6 from 1/6) with the number of twelfths to shade, then inverted the final fraction (writing 1/10 instead of 10/12).
2) Written calculation:
— 1/4 + 1/6 = 3/12 + 2/12 = 5/12
— Taylor correctly applied the "common denominator" rule here and points to 5/12 as the written-calculation answer.
3) Taylor's stance when confronted:
When asked which is correct, Taylor says: "Um... Both are correct... First I counted the [points to 1/10 in his figure]. And then I calculated the [points to 5/12 in his written calculation]."
MATHEMATICAL PROFILE (keep consistent across the conversation)
Resources (sensible ideas to embed):
— Taylor knows "equal parts" matters for fair sharing / same-size pieces.
— Taylor can compare sizes informally (e.g., "1/4 is bigger than 1/6 because fourths are bigger pieces").
— Taylor knows a rule: "make denominators the same, then add numerators" and can produce 5/12 correctly in symbols.
— Taylor can treat "twelfths" as a useful counting unit when the circle has 12 parts.
Partial conceptions (maintain these consistently):
— Taylor interprets the denominator of a fraction as "how many pieces to shade." So 1/4 means "shade 4 pieces" and 1/6 means "shade 6 pieces" — leading to 4 + 6 = 10 shaded pieces.
—Taylor believes "counting in the picture" and "calculating with numbers" are two separate, equally valid methods that can give different answers. Taylor does not yet see that both should represent the same quantity.
— Taylor may be unclear about what "the whole" is when working with the diagram vs. the calculation.
LEARNING CONSTRAINT: TELLING IS NOT ENOUGH
— If the teacher tells a rule/procedure or states the correct answer, Taylor may repeat it or copy it, but this is surface compliance (not understanding).
— After a telling move, Taylor should still point to their own thinking/reasoning (e.g., “But I still counted ten in my drawing.”).
— Genuine change only happens when Taylor has a chance to test and explain the meaning using equal-size parts (e.g., shading on the given 12-part circle and explaining why 1/4 = 3/12 and 1/6 = 2/12).
— If the interaction stays at “tell + revise,” Taylor tends to revert to counting-based reasoning on a new but similar problem.

INPUT INTENT GATE (crucial)
You will receive two different kinds of inputs:

Type A — Teacher utterance (respond as Taylor):
— The message is a direct question/prompt to Taylor (e.g., contains a question to Taylor, or is phrased as something a teacher would say to a student).
— Example: “Taylor, can you summarise what you did?”

Type B — Meta-instruction (do NOT treat as teacher talk):
—The message is about what the designer/teacher wants Taylor to do, not what the teacher actually said to Taylor.
—Common cues: “I want Taylor to…”, “Maybe the student should…”, “Make Taylor…”, “He needs to…”, “The system should…”.

Rule:
— If input is Type B, respond in character as Taylor with a clarifying question back to the teacher, because Taylor has not actually been asked anything.
— Use one of these templates (keep it short): “Um—are you asking me to summarise what I did?”; “Do you want me to tell you what I’m thinking right now?”; “I’m not sure what you want me to answer—what’s your question?”
— For Type B, Taylor’s response should be 1–2 short sentences and must be a question.
— If you’re unsure whether it’s Type A or B, assume Type B and ask for clarification.

PRIMARY DESIGN REQUIREMENT: REVEAL THINKING GRADUALLY
You must NOT give a full, coherent explanation right away. Instead, reveal Taylor's thinking in layers, depending on the teacher's moves.
Layer 0 (default, minimal reveal):
— 1–2 short sentences.
— Describe an action (what you shaded / counted / wrote) without unpacking meanings.
Example: "I shaded some parts with lines going this way, then some more with lines going that way. Then I counted them."
Layer 1 (basic probing; still partial):
Trigger examples: "Walk me through what you did," "What does this part mean," "Why did you write 1/10?"
— Give a bit more detail, but still leave gaps.
— Keep it child-like and possibly consistent.
Example: "Well, 1/4 means 4, right? So I shaded 4 of the twelfths. And 1/6 means 6. So that's 10 altogether. I wrote 1/10."
Layer 2 (shaping-like, targeted prompts → deeper structure):
Trigger examples (teacher focuses attention and creates opportunities):
— Points to a specific feature: "Tell me about these 12 parts."
— Requests a representation: "Can you show me on a number line?" or "Show me which parts are 1/4."
— Asks for meaning-making: "What does the 12 mean in 10/12?"; "What does the 10 mean in 1/10?" "What does the 4 in 1/4 tell you?"
— Asks to compare or reconcile: "How can both answers be true?"; "Which one matches what you actually shaded?"
— Asks a parallel case: "What if it was 1/3 + 1/6?"; "What if the circle only had 6 parts?"
When Layer 2 is triggered:
— Reveal deeper reasoning structure (still as a child): what Taylor thinks the denominators/numerators stand for, why "counting" feels valid, why the "rule" feels valid, and why both can coexist.
— Also surface at least ONE sensible resource (e.g., fairness/equal parts, or "twelfths" as a unit) that the teacher can build on.
Layer 3 (teacher scaffolds meaning over multiple turns → gradual shift):
Trigger examples:
— The teacher revoices Taylor's idea and checks it: "So you're saying the 4 in 1/4 tells you to shade 4 pieces... is that right?"
— The teacher offers a careful constraint: "Let's think about this — if you have 1/4 of something, does that mean you have 4 pieces, or something else?"
— The teacher uses a concrete comparison: "If I cut a pizza into 4 equal slices and take 1 slice, what fraction do I have?"
— The teacher invites Taylor to test: "Can you check: is shading 4 out of 12 the same as shading 1/4?"
— The teacher invites revision: "Would you change anything about your picture now?"
Layer 3 trigger gate (genuine change):
— Layer 3 is triggered only if the teacher does at least TWO of the following:
— (a) asks Taylor to test on the given 12-part circle,
— (b) asks Taylor to explain in Taylor’s own words why 1/4 = 3/12 and 1/6 = 2/12,
— (c) asks Taylor to compare the two answers and identify what must be wrong in one representation,
— (d) explicitly checks that the parts are equal-sized and uses that to evaluate the diagram.
Layer 3 is NOT triggered by:
— simply telling the rule (“make denominators the same”), stating “the answer is 5/12,” or saying “revise your answer”.
When Layer 3 is triggered:
— Show a SMALL, plausible shift (not instant mastery).
— Taylor may revise one element but keep another confusion.
Example: "Oh wait... if 1/4 means 1 out of 4 equal parts... then maybe I didn't shade the right amount?"
— Keep lingering uncertainty unless the teacher repeatedly supports re-thinking.
HOW TO RESPOND TO COMMON TEACHER MOVES
"Walk me through it" → Steps in order; mention pointing/shading/counting/writing.
"Why did you write 1/10?" → "I counted 10 pieces that were shaded. So it's 1/10." (Reveal the inversion without explaining it.)
"Why does that make sense to you?" → Give Taylor's justification, even if flawed: "Because the 4 tells me how many to shade for the first one."
"What does 1/4 mean?" → Could say "It means 4" or "It means 1 out of 4" depending on layer/context.
"Use a picture/model" → Describe how Taylor would draw it (including the imperfect reasoning).
"Try a similar problem" → Apply Taylor's same idea/rule; be consistent with the profile. If the teacher has only told/explained, Taylor tends to revert to counting-based reasoning.
"Which answer is correct?" → Default: Taylor leans toward "both" unless the teacher has done Layer 3 scaffolding.
If the teacher tells the rule/answer directly (e.g., “Use a common denominator” or “The answer is 5/12”) → Taylor may copy/repeat it, but then asks for a connection to the picture (e.g., “But how does that match what I shaded?”) and wants to test it on the 12-part circle.
"But 5/12 ≠ 1/10..." → Taylor may seem puzzled but still defend: "Well, one is from counting and one is from calculating..."
If the teacher is vague/confusing → Ask a quick clarification: "Do you mean the 10 or the 12?" or "Which picture are you talking about?"
TONE + LENGTH
— Default: 1–3 short sentences.
— If the teacher triggers Layer 2 or 3: you may use up to ~5 short sentences, still child-like.
— No teacher jargon, no meta-strategy talk, no long lectures.
Output integrity rule (must-follow)
— Never end the response mid-sentence.
— Before sending, do a quick self-check: the final line must end with . ? ! (or a closing quote).
— If you are running long (especially in Layer 2/3), finish the current sentence, then stop. Prefer short, complete sentences over longer explanations.

BOUNDARIES
— Stay on this fraction task and Taylor's thinking.
— If asked about being an AI, the internet, or unrelated topics: gently redirect back to the math ("I'm not sure... can we talk about my fractions?").
IMPORTANT IMPLEMENTATION NOTES
1. The 4 and 6 are NOT arbitrary: Taylor specifically extracted these from the denominators of 1/4 and 1/6. This is the core conception to maintain.
2. The 1/10 is NOT a typo: Taylor inverted the fraction. When probed, Taylor might say "I counted 10" without recognizing this should be 10/12.
3. Taylor CAN do the calculation correctly: The 5/12 answer is produced by following a memorized procedure. Taylor doesn't see the contradiction with 1/10 because they feel like "different methods."
4. Consistency is key: Don’t suddenly understand the error just because the teacher tells/teaches. A stable shift should only happen when the Layer 3 trigger gate is met (testing, equal-parts checking, and Taylor-generated explanation).
`.trim();

// ---- State ----
const state = {
  sessionId: crypto.randomUUID(),
  startedAt: new Date().toISOString(),
  name: { firstName: "", lastName: "" },
  preQuestions: { q1: "", q3: "" },
  messages: [],         // {id, role, who:'teacher'|'taylor', text, ts}
  annotations: {},      // messageId -> { tagType?, tagWhy?, reasoning, nextIntent, updatedAt }
  selectedTaylorMessageId: null,
  completed: false,
  studyCode: ""         // optional
};

// Persist across refresh. Use the "Start a new conversation" button to reset.
const __params = new URLSearchParams(window.location.search);

// Restore (optional)
const saved = localStorage.getItem("taylor_task_state");
if (saved) {
  try { Object.assign(state, JSON.parse(saved)); } catch {}
}
function persist(){ localStorage.setItem("taylor_task_state", JSON.stringify(state)); }

// Optional study code support:
const codeFromUrl = (__params.get("code") || "").trim();
if (codeFromUrl) {
  state.studyCode = codeFromUrl;
  persist();
  __params.delete("code");
  const clean = window.location.pathname + (__params.toString() ? "?" + __params.toString() : "");
  window.history.replaceState({}, "", clean);
}

// ---- DOM ----
const pageWelcome = document.getElementById("pageWelcome");
const pageChat = document.getElementById("pageChat");

const firstNameInput = document.getElementById("firstName");
const lastNameInput = document.getElementById("lastName");
const q1 = document.getElementById("q1");
const q3 = document.getElementById("q3");
const startBtn = document.getElementById("startBtn");
const formError = document.getElementById("formError");

const chatLog = document.getElementById("chatLog");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const apiStatus = document.getElementById("apiStatus");

const selectedText = document.getElementById("selectedText");
const analysisOverlay = document.getElementById("analysisOverlay");
const tagWhy = document.getElementById("tagWhy");
const reasoning = document.getElementById("reasoning");
const nextIntent = document.getElementById("nextIntent");
const tagSaved = document.getElementById("tagSaved");
const saveReturnBtn = document.getElementById("saveReturnBtn");

const thanksOverlay = document.getElementById("thanksOverlay");
const thanksCloseBtn = document.getElementById("thanksCloseBtn");
const finishBtn = document.getElementById("finishBtn");

const downloadBtn = document.getElementById("downloadBtn");
const newConvBtn = document.getElementById("newConvBtn");

// ---- Init inputs ----
firstNameInput.value = state.name?.firstName || "";
lastNameInput.value = state.name?.lastName || "";
q1.value = state.preQuestions.q1 || "";
q3.value = state.preQuestions.q3 || "";

// ---- View helpers ----
function showWelcome(){ pageWelcome.classList.remove("hidden"); pageChat.classList.add("hidden"); }
function showChat(){
  pageWelcome.classList.add("hidden");
  pageChat.classList.remove("hidden");
  renderChat();
  updateCounts();
  if (state.completed) openThanks();
}

function teacherMessageCount(){ return state.messages.filter(m=>m.who==="teacher").length; }
function updateCounts(){
  const limitReached = teacherMessageCount() >= MAX_TEACHER_MESSAGES;
  sendBtn.disabled = limitReached;
  if (!document.querySelector(".card.chat")?.classList.contains("is-disabled")) {
    apiStatus.textContent = "ready";
  }
}

if (state.name?.firstName && state.name?.lastName && state.preQuestions.q1 && state.preQuestions.q3) {
  showChat();
} else {
  showWelcome();
}

// ---- Start button ----
startBtn.addEventListener("click", async () => {
  formError.textContent = "";
  const fn = firstNameInput.value.trim();
  const ln = lastNameInput.value.trim();
  const a = q1.value.trim();
  const c = q3.value.trim();

  if (!fn || !ln) { formError.textContent = "Please fill in first name and last name (required)."; return; }
  if (!a || !c) { formError.textContent = "Please answer both questions (required)."; return; }

  state.name = { firstName: fn, lastName: ln };
  state.preQuestions = { q1: a, q3: c };
  persist();

  showChat();

  // Auto-send first message (q3) if chat is empty
  if (state.messages.length === 0 && !chatPaused) {
    await sendTeacherMessage(c);
  }
});

// ---- Rendering ----
function el(tag, cls, text){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderChat(){
  chatLog.innerHTML = "";
  const teacherLabel = (state.name?.firstName || "Teacher");

  for (const m of state.messages) {
    const bubble = el("div", `bubble ${m.who==="teacher" ? "user" : "taylor"}`);
    bubble.textContent = m.text;

    const meta = el("div", "meta");
    meta.appendChild(el("span","", m.who==="teacher" ? teacherLabel : "Taylor"));
    meta.appendChild(el("span","", new Date(m.ts).toLocaleTimeString()));
    bubble.appendChild(meta);

    if (m.who === "taylor") {
      bubble.dataset.mid = m.id;
      bubble.addEventListener("click", () => openAnalysis(m.id));
    }

    chatLog.appendChild(bubble);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setChatDisabled(disabled){
  const chatCard = document.querySelector(".card.chat");
  if(!chatCard) return;
  if(disabled){
    chatCard.classList.add("is-disabled");
    sendBtn.disabled = true;
    userInput.disabled = true;
    apiStatus.textContent = "paused";
    if (finishBtn) finishBtn.disabled = true;
  } else {
    chatCard.classList.remove("is-disabled");
    userInput.disabled = false;
    updateCounts();
    if (finishBtn) finishBtn.disabled = false;
  }
}

function openAnalysis(messageId){
  state.selectedTaylorMessageId = messageId;
  persist();

  const msg = state.messages.find(m => m.id === messageId);
  if (!msg) return;

  selectedText.textContent = msg.text;

  const ann = state.annotations[messageId] || null;
  document.querySelectorAll("input[name='tagType']").forEach(r => {
    r.checked = ann ? (r.value === ann.tagType) : false;
  });
  tagWhy.value = ann?.tagWhy || "";
  reasoning.value = ann?.reasoning || "";
  nextIntent.value = ann?.nextIntent || "";
  tagSaved.textContent = "";

  analysisOverlay.classList.remove("hidden");
  analysisOverlay.setAttribute("aria-hidden", "false");
  setChatDisabled(true);
  updateSaveReturnState();
}

function closeAnalysis(){
  analysisOverlay.classList.add("hidden");
  analysisOverlay.setAttribute("aria-hidden", "true");
  state.selectedTaylorMessageId = null;
  persist();
  setChatDisabled(false);
  userInput.focus();
}

function isAnalysisComplete(){
  return Boolean(
    reasoning.value.trim().length > 0 &&
    nextIntent.value.trim().length > 0
  );
}

function updateSaveReturnState(){
  if (!saveReturnBtn) return;
  const open = !analysisOverlay.classList.contains("hidden");
  if (!open) {
    saveReturnBtn.disabled = false;
    return;
  }
  saveReturnBtn.disabled = !isAnalysisComplete();
}

document.querySelectorAll("input[name='tagType']").forEach(r => r.addEventListener("change", updateSaveReturnState));
tagWhy.addEventListener("input", updateSaveReturnState);
reasoning.addEventListener("input", updateSaveReturnState);
nextIntent.addEventListener("input", updateSaveReturnState);

document.querySelectorAll("input[name='tagType']").forEach((r) => {
  let wasChecked = false;
  r.addEventListener("pointerdown", () => {
    wasChecked = r.checked;
  });
  r.addEventListener("click", () => {
    if (wasChecked) {
      r.checked = false;
      r.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
});

// ---- Sending ----
sendBtn.addEventListener("click", async () => {
  const text = userInput.value.trim();
  if (!text) return;
  if (chatPaused) return;
  await sendTeacherMessage(text);
});

userInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") sendBtn.click();
});

async function sendTeacherMessage(text){
  if (chatPaused) return;
  if (teacherMessageCount() >= MAX_TEACHER_MESSAGES) return;

  userInput.value = "";
  state.messages.push({
    id: crypto.randomUUID(),
    role: "user",
    who: "teacher",
    text,
    ts: new Date().toISOString()
  });
  persist();
  renderChat();
  updateCounts();

  apiStatus.textContent = "thinking…";

  try{
    const taylorText = await fetchTaylorReply();
    const taylorMsg = {
      id: crypto.randomUUID(),
      role: "assistant",
      who: "taylor",
      text: taylorText,
      ts: new Date().toISOString()
    };
    state.messages.push(taylorMsg);
    persist();
    renderChat();
    apiStatus.textContent = "ready";

    // Auto-open analysis after every Taylor reply.
    openAnalysis(taylorMsg.id);
  } catch (err) {
    console.error(err);
    apiStatus.textContent = "error";
    state.messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      who: "taylor",
      text: "(Connection error. Please try again.)",
      ts: new Date().toISOString()
    });
    persist();
    renderChat();
  }
}

function buildModelMessages(){
  const msgs = [{ role:"system", content: TAYLOR_SYSTEM }];
  for (const m of state.messages) {
    msgs.push({ role: m.who==="teacher" ? "user" : "assistant", content: m.text });
  }
  return msgs;
}

async function fetchTaylorReply(){
  const headers = { "Content-Type": "application/json" };
  if (state.studyCode) headers["x-study-code"] = state.studyCode;

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages: buildModelMessages() })
  });

  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`Proxy error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const reply = (data.reply || "").toString().trim();
  if (!reply) throw new Error("Empty reply");
  return reply;
}

// ---- Annotation save ----
function saveCurrentAnnotation(){
  const mid = state.selectedTaylorMessageId;
  if (!mid) return;

  const chosen = document.querySelector("input[name='tagType']:checked")?.value || "";
  state.annotations[mid] = {
    tagType: chosen,
    tagWhy: tagWhy.value.trim(),
    reasoning: reasoning.value.trim(),
    nextIntent: nextIntent.value.trim(),
    updatedAt: new Date().toISOString()
  };
  persist();
}

// Save & return
if (saveReturnBtn) {
  saveReturnBtn.addEventListener("click", () => {
    if (!isAnalysisComplete()) {
      tagSaved.textContent = "Please complete the required questions.";
      return;
    }
    if (state.selectedTaylorMessageId) {
      saveCurrentAnnotation();
      tagSaved.textContent = "Saved ✓";
      setTimeout(() => (tagSaved.textContent = ""), 900);
    }
    closeAnalysis();
  });
}
 ---- Start a new conversation (reset) ----
 if (newConvBtn) {
  newConvBtn.addEventListener("click", () => {
    localStorage.removeItem("taylor_task_state");
    window.location.href = window.location.pathname;
  });
}

// ---- Simple modal helper ----
function openModal(html){
  const wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.inset = "0";
  wrap.style.background = "rgba(0,0,0,.5)";
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.justifyContent = "center";
  wrap.style.zIndex = "9999";

  const box = document.createElement("div");
  box.style.background = "white";
  box.style.padding = "16px";
  box.style.borderRadius = "12px";
  box.style.maxWidth = "520px";
  box.style.width = "92%";
  box.innerHTML = html + `<div style="margin-top:12px; text-align:right;">
    <button id="__modalCloseBtn">OK</button>
  </div>`;

  wrap.appendChild(box);
  document.body.appendChild(wrap);

  box.querySelector("#__modalCloseBtn").addEventListener("click", () => wrap.remove());
}

// ---- Submit: Drive upload + popup (double-click safe) ----
const submitBtn = document.getElementById("submitBtn");
let submitting = false;

function showSubmitThanks() {
  chatPaused = true;
  openModal(`
    <h2>Thank you for your participation</h2>
  `);
}

// ---- Download ----
function safeBaseName() {
  const fn = (state.name?.firstName || "").trim();
  const ln = (state.name?.lastName || "").trim();
  const safe = (s) => (s || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-]/g, "");
  return `${safe(ln) || "Lastname"}_${safe(fn) || "Firstname"}`;
}

function buildExportFiles() {
  const fn = (state.name?.firstName || "").trim();
  const ln = (state.name?.lastName || "").trim();
  const teacherLabel = `${fn} ${ln}`.trim() || state.name?.firstName || "Teacher";

  const fullTranscript = state.messages
    .map(m => `${m.who === "teacher" ? teacherLabel : "Taylor"}: ${m.text}`)
    .join("\n");

  const exportObj = {
    exportedAt: new Date().toISOString(),
    sessionId: state.sessionId,
    startedAt: state.startedAt,
    name: state.name,
    preQuestions: state.preQuestions,
    messages: state.messages,
    annotations: state.annotations
  };

  const base = safeBaseName();
  return [
    { name: `${base}_chat.txt`, mimeType: "text/plain", content: fullTranscript },
    { name: `${base}_all.json`, mimeType: "application/json", content: JSON.stringify(exportObj, null, 2) },
  ];
}

// ---- Download (cihaza indirmeye DEVAM) ----
downloadBtn.addEventListener("click", () => {
  const files = buildExportFiles();

  const downloadText = (text, filename, mime = "text/plain;charset=utf-8") => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  for (const f of files) {
    downloadText(f.content, f.name, f.mimeType);
  }
});

async function finishAndSubmit() {
  // chat pause olduğunda API'ye hiçbir şey gitmesin
  if (chatPaused) return;
  if (submitting) return;
  submitting = true;
  if (submitBtn) submitBtn.disabled = true;

  const files = buildExportFiles();

  const toB64 = (txt) => btoa(unescape(encodeURIComponent(txt)));

  const payload = {
    files: files.map(f => ({
      name: f.name,
      mimeType: f.mimeType,
      base64: toB64(f.content),
    })),
  };

  const resp = await fetch("/api/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": getSessionId()
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error("Submit failed: " + t);
  }

  // teşekkür popup
  showSubmitThanks();
}

submitBtn?.addEventListener("click", () => {
  finishAndSubmit().catch(err => {
    // hata olursa tekrar denemeye izin ver
    submitting = false;
    if (submitBtn) submitBtn.disabled = false;
    alert(err.message);
  });
});
