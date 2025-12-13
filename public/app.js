// Fullstack (Render) version: calls same-origin backend proxy at /api/chat
const PROXY_URL = "/api/chat";
// No hard cap on teacher messages.
const MAX_TEACHER_MESSAGES = Infinity;

const TAYLOR_SYSTEM = `
Persona: You are Taylor, an 8–9-year-old student (sixth grade) who participated in a classroom activity about fractions.
Aim: Your goal is to respond to the teacher’s questions so preservice teacher can understand how you think about the addition operation using mathematical symbols and diagrams of fractions.
In the given question, there is a circle diagram divided into 12 equal parts, and you are asked to do the following: Shade the first 1/4 of the circle and then 1/6 of the circle. What fraction of the circle have you shaded in total?
You approached the task of shading 1/4 and 1/6 of a circle by coloring four and six parts of the whole. You then combined the shaded pieces simply by counting them, concluding that 4 + 6 = 10 and interpreting the result as “1/10.”
You also know a rule: 4/12 + 6/12 = 10/12 when denominators are the same, so your symbolic reasoning may conflict with your diagram reasoning.
Recipients: Your audience is a preservice teacher who wants to analyse your reasoning.
Theme: Use simple, child-like language that may sound uncertain or inconsistent. Be uncertain, make mistakes, and explain them simply. Treat unequal parts as valid fractions. Let your diagram reasoning and symbolic reasoning conflict if necessary. Continue naturally from whatever question the teacher asks next. Show what you think makes sense, even if it is mathematically incorrect. Keep your tone natural and informal. Respond in 1–3 short sentences. Do not use long explanations. Stay in character as Taylor at all times.
`.trim();

// ---- State ----
const state = {
  sessionId: crypto.randomUUID(),
  startedAt: new Date().toISOString(),
  name: { firstName: "", lastName: "" },
  preQuestions: { q1: "", q2: "", q3: "" },
  messages: [],         // {id, role, who:'teacher'|'taylor', text, ts}
  annotations: {},      // messageId -> { tagType, comment, nextIntent, updatedAt }
  selectedTaylorMessageId: null,
  studyCode: ""         // optional
};

// By default, start fresh on page load.
// To keep previous progress, open with ?resume=1
const __params = new URLSearchParams(window.location.search);
if (__params.get("resume") !== "1") {
  localStorage.removeItem("taylor_task_state");
}

// Restore (optional)
const saved = localStorage.getItem("taylor_task_state");
if (saved) {
  try { Object.assign(state, JSON.parse(saved)); } catch {}
}
function persist(){ localStorage.setItem("taylor_task_state", JSON.stringify(state)); }

// Optional study code support:
// - If you deploy with STUDY_CODE on server, set code by visiting: /?code=YOURCODE
// - It will be stored in localStorage and sent as header x-study-code.
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
const q2 = document.getElementById("q2");
const q3 = document.getElementById("q3");
const startBtn = document.getElementById("startBtn");
const formError = document.getElementById("formError");

const chatLog = document.getElementById("chatLog");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const apiStatus = document.getElementById("apiStatus");

const annotEmpty = document.getElementById("annotEmpty");
const annotPanel = document.getElementById("annotPanel");
const selectedText = document.getElementById("selectedText");
const tagComment = document.getElementById("tagComment");
const nextIntent = document.getElementById("nextIntent");
const tagSaved = document.getElementById("tagSaved");
const goToChatBtn = document.getElementById("goToChatBtn");

const downloadBtn = document.getElementById("downloadBtn");

// ---- Init inputs ----
firstNameInput.value = state.name?.firstName || "";
lastNameInput.value = state.name?.lastName || "";
q1.value = state.preQuestions.q1 || "";
q2.value = state.preQuestions.q2 || "";
q3.value = state.preQuestions.q3 || "";

// ---- View helpers ----
function showWelcome(){ pageWelcome.classList.remove("hidden"); pageChat.classList.add("hidden"); }
function showChat(){ pageWelcome.classList.add("hidden"); pageChat.classList.remove("hidden"); renderChat(); updateCounts(); }

function teacherMessageCount(){ return state.messages.filter(m=>m.who==="teacher").length; }
function updateCounts(){
  // With Infinity, limitReached will always be false.
  const limitReached = teacherMessageCount() >= MAX_TEACHER_MESSAGES;
  sendBtn.disabled = limitReached;
  if (!document.querySelector(".card.chat")?.classList.contains("is-disabled")) {
    apiStatus.textContent = "ready";
  }
}

if (state.name?.firstName && state.name?.lastName && state.preQuestions.q1 && state.preQuestions.q2 && state.preQuestions.q3 && state.messages.length) {
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
  const b = q2.value.trim();
  const c = q3.value.trim();

  if (!fn || !ln) { formError.textContent = "Please fill in first name and last name (required)."; return; }
  if (!a || !b || !c) { formError.textContent = "Please answer all 3 questions (required)."; return; }

  state.name = { firstName: fn, lastName: ln };
  state.preQuestions = { q1: a, q2: b, q3: c };
  persist();

  showChat();

  // Auto-send first message (q3) if chat is empty
  if (state.messages.length === 0) {
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
      bubble.addEventListener("click", () => openAnnotation(m.id));
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
  } else {
    chatCard.classList.remove("is-disabled");
    userInput.disabled = false;
    updateCounts();
  }
}

function openAnnotation(messageId){
  state.selectedTaylorMessageId = messageId;
  persist();

  const msg = state.messages.find(m => m.id === messageId);
  if (!msg) return;

  annotEmpty.classList.add("hidden");
  annotPanel.classList.remove("hidden");
  selectedText.textContent = msg.text;

  const ann = state.annotations[messageId] || null;
  document.querySelectorAll("input[name='tagType']").forEach(r => {
    r.checked = ann ? (r.value === ann.tagType) : false;
  });
  tagComment.value = ann?.comment || "";
  nextIntent.value = ann?.nextIntent || "";
  tagSaved.textContent = "";

  // Require tag + both text responses before allowing return.
  updateGoToChatState();

  setChatDisabled(true);
}

function isAnalysisComplete(){
  const chosen = document.querySelector("input[name='tagType']:checked")?.value || "";
  return Boolean(
    chosen &&
    tagComment.value.trim().length > 0 &&
    nextIntent.value.trim().length > 0
  );
}

function updateGoToChatState(){
  if (!goToChatBtn) return;
  // Only enforce when the annotation panel is open.
  const panelOpen = !annotPanel.classList.contains("hidden");
  if (!panelOpen) {
    goToChatBtn.disabled = false;
    return;
  }
  goToChatBtn.disabled = !isAnalysisComplete();
}

// Keep the return button state in sync with inputs.
document.querySelectorAll("input[name='tagType']").forEach(r => {
  r.addEventListener("change", updateGoToChatState);
});
tagComment.addEventListener("input", updateGoToChatState);
nextIntent.addEventListener("input", updateGoToChatState);

// ---- Sending ----
sendBtn.addEventListener("click", async () => {
  const text = userInput.value.trim();
  if (!text) return;
  await sendTeacherMessage(text);
});

userInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") sendBtn.click();
});

async function sendTeacherMessage(text){
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
    state.messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      who: "taylor",
      text: taylorText,
      ts: new Date().toISOString()
    });
    persist();
    renderChat();
    apiStatus.textContent = "ready";
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
    comment: tagComment.value.trim(),
    nextIntent: nextIntent.value.trim(),
    updatedAt: new Date().toISOString()
  };
  persist();
}

// Go to interaction: auto-save + close panel + enable chat
if (goToChatBtn) {
  goToChatBtn.addEventListener("click", () => {
    // Safety: should be prevented by the disabled button.
    if (!isAnalysisComplete()) {
      tagSaved.textContent = "Please complete the tag and both responses.";
      return;
    }
    if (state.selectedTaylorMessageId) {
      saveCurrentAnnotation();
      tagSaved.textContent = "Saved ✓";
      setTimeout(() => (tagSaved.textContent = ""), 900);
    }
    annotPanel.classList.add("hidden");
    annotEmpty.classList.remove("hidden");
    state.selectedTaylorMessageId = null;
    persist();
    setChatDisabled(false);
    userInput.focus();
  });
}

// ---- Download ----
downloadBtn.addEventListener("click", () => {
  const fn = (state.name?.firstName || "").trim();
  const ln = (state.name?.lastName || "").trim();

  // Filename: lastname_firstname_chat / lastname_firstname_all
  const safe = (s) => (s || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-]/g, "");
  const base = `${safe(ln) || "Lastname"}_${safe(fn) || "Firstname"}`;

  const teacherLabel = `${fn} ${ln}`.trim() || state.name?.firstName || "Teacher";

  // 1) Full transcript with labels
  const fullTranscript = state.messages
    .map(m => `${m.who === "teacher" ? teacherLabel : "Taylor"}: ${m.text}`)
    .join("\n");

  // 2) Teacher-only input transcript (all user inputs)
  const userOnlyTranscript = state.messages
    .filter(m => m.who === "teacher")
    .map(m => m.text)
    .join("\n");

  // 3) Full export as JSON (includes pre-questions + annotations)
  const exportObj = {
    exportedAt: new Date().toISOString(),
    sessionId: state.sessionId,
    startedAt: state.startedAt,
    name: state.name,
    preQuestions: state.preQuestions,
    messages: state.messages,
    annotations: state.annotations
  };

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

  downloadText(fullTranscript, `${base}_chat.txt`);
  downloadText(userOnlyTranscript, `${base}_all.txt`);
  downloadText(JSON.stringify(exportObj, null, 2), `taylor_task_${state.sessionId}.json`, "application/json");
});
