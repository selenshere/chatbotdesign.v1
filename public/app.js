// Fullstack (Render) version: calls same-origin backend proxy at /api/chat
const PROXY_URL = "/api/chat";
// No hard cap on teacher messages.
const MAX_TEACHER_MESSAGES = Infinity;
// IMPORTANT: We send the full conversation history to preserve consistency.

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
  // Welcome page has 2 required prompts:
  //  q1) what to understand about Taylor's thinking
  //  q2) first message to Taylor
  preQuestions: { q1: "", q2: "" },
  messages: [],         // {id, role, who:'teacher'|'taylor', text, ts}
  annotations: {},      // taylorMessageId -> { selectionText?, tagType?, thinkingComment?, reasoningComment, nextIntent, updatedAt }
  selectedTaylorMessageId: null,
  // After each Taylor response, the user MUST complete analysis before sending another chat message.
  analysisGate: { required: false, pendingTaylorId: null },
  taskImageDataUrl: "", // optional user-uploaded task image (data URL)
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
const startBtn = document.getElementById("startBtn");
const formError = document.getElementById("formError");

const chatLog = document.getElementById("chatLog");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const apiStatus = document.getElementById("apiStatus");

// Task image (left) — drag & drop / click upload
const taskDropzone = document.getElementById("taskDropzone");
const taskImg = document.getElementById("taskImg");
const taskFile = document.getElementById("taskFile");

// Analysis modal
const analysisModal = document.getElementById("analysisModal");
const closeAnalysisX = document.getElementById("closeAnalysisX");
const saveAndReturnBtn = document.getElementById("saveAndReturnBtn");
const selectedText = document.getElementById("selectedText");
const tagType = document.getElementById("tagType");
const tagComment = document.getElementById("tagComment");
const reasoningComment = document.getElementById("reasoningComment");
const nextIntent = document.getElementById("nextIntent");
const tagSaved = document.getElementById("tagSaved");

const downloadBtn = document.getElementById("downloadBtn");

// ---- Init inputs ----
firstNameInput.value = state.name?.firstName || "";
lastNameInput.value = state.name?.lastName || "";
q1.value = state.preQuestions.q1 || "";
q2.value = state.preQuestions.q2 || "";

// ---- View helpers ----
function showWelcome(){ pageWelcome.classList.remove("hidden"); pageChat.classList.add("hidden"); }
function showChat(){
  pageWelcome.classList.add("hidden");
  pageChat.classList.remove("hidden");
  renderChat();
  updateCounts();
  enforceAnalysisGateOnLoad();
}

function isAnnotationCompleteFor(messageId){
  const ann = state.annotations?.[messageId];
  return Boolean(ann?.reasoningComment && ann.reasoningComment.trim().length > 0 && ann?.nextIntent && ann.nextIntent.trim().length > 0);
}

function lastTaylorMessageId(){
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const m = state.messages[i];
    if (m?.who === "taylor") return m.id;
  }
  return null;
}

function enforceAnalysisGateOnLoad(){
  // If we resumed a session and the last Taylor response hasn't been analyzed,
  // force the modal open and pause chat.
  const lastTid = lastTaylorMessageId();
  if (!lastTid) return;

  if (!isAnnotationCompleteFor(lastTid)) {
    state.analysisGate = { required: true, pendingTaylorId: lastTid };
    persist();
    // Only auto-open when we're on the chat page.
    setTimeout(() => openAnalysis(lastTid, { auto: true }), 50);
  } else {
    state.analysisGate = { required: false, pendingTaylorId: null };
    persist();
    setChatDisabled(false);
  }
}

function teacherMessageCount(){ return state.messages.filter(m=>m.who==="teacher").length; }
function updateCounts(){
  // With Infinity, limitReached will always be false.
  const limitReached = teacherMessageCount() >= MAX_TEACHER_MESSAGES;
  const hardPaused = Boolean(state.analysisGate?.required) ||
    document.querySelector(".card.chat")?.classList.contains("is-disabled");

  // Never allow updateCounts() to re-enable the composer while analysis is required.
  if (hardPaused) {
    sendBtn.disabled = true;
    userInput.disabled = true;
    apiStatus.textContent = "paused";
    return;
  }

  sendBtn.disabled = limitReached;
  userInput.disabled = false;
  apiStatus.textContent = "ready";
}

if (state.name?.firstName && state.name?.lastName && state.preQuestions.q1 && state.preQuestions.q2 && state.messages.length) {
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

  if (!fn || !ln) { formError.textContent = "Please fill in first name and last name (required)."; return; }
  if (!a || !b) { formError.textContent = "Please answer both questions (required)."; return; }

  state.name = { firstName: fn, lastName: ln };
  state.preQuestions = { q1: a, q2: b };
  persist();

  showChat();

  // Auto-send first message (q2) if chat is empty
  if (state.messages.length === 0) {
    await sendTeacherMessage(b);
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
      // Allow re-opening analysis for any Taylor message
      bubble.addEventListener("click", () => openAnalysis(m.id, { auto: false }));
    }

    chatLog.appendChild(bubble);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setChatDisabled(disabled){
  const chatCard = document.querySelector(".card.chat");
  if(!chatCard) return;
  // Hard gate: if analysis is required, chat must stay disabled.
  if (state.analysisGate?.required) disabled = true;
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

// ---- Task image (drag & drop / click) ----
function applyTaskImage(){
  if (!taskImg) return;
  const src = (state.taskImageDataUrl || "").trim() || "images/task.png";
  taskImg.src = src;
}

applyTaskImage();

function handleTaskFile(file){
  if (!file || !file.type || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.taskImageDataUrl = (reader.result || "").toString();
    persist();
    applyTaskImage();
  };
  reader.readAsDataURL(file);
}

if (taskDropzone) {
  taskDropzone.addEventListener("click", () => taskFile?.click());
  taskDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    taskDropzone.classList.add("is-dragover");
  });
  taskDropzone.addEventListener("dragleave", () => taskDropzone.classList.remove("is-dragover"));
  taskDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    taskDropzone.classList.remove("is-dragover");
    const f = e.dataTransfer?.files?.[0];
    handleTaskFile(f);
  });
}
if (taskFile) {
  taskFile.addEventListener("change", () => {
    const f = taskFile.files?.[0];
    handleTaskFile(f);
    taskFile.value = "";
  });
}

// ---- Analysis modal helpers ----
function showAnalysisModal(auto = true){
  if (!analysisModal) return;
  analysisModal.classList.remove("hidden");
  analysisModal.setAttribute("aria-hidden", "false");
  setChatDisabled(true);
  updateSaveState();
  // If it popped up automatically, move cursor to the first required box.
  if (auto) setTimeout(() => reasoningComment?.focus(), 50);
}

function hideAnalysisModal(){
  if (!analysisModal) return;
  analysisModal.classList.add("hidden");
  analysisModal.setAttribute("aria-hidden", "true");
  setChatDisabled(false);
  state.selectedTaylorMessageId = null;
  persist();
  userInput?.focus();
}

// Close actions
if (analysisModal) {
  analysisModal.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close === "true") {
      // Don't allow closing without required fields.
      if (!isAnalysisComplete()) {
        tagSaved.textContent = "Please complete the required questions before returning to chat.";
        return;
      }
      saveAndReturnBtn?.click();
    }
  });
}
closeAnalysisX?.addEventListener("click", () => {
  if (!isAnalysisComplete()) {
    tagSaved.textContent = "Please complete the required questions before returning to chat.";
    return;
  }
  saveAndReturnBtn?.click();
});

function openAnalysis(messageId, { auto } = { auto: true }){
  const msg = state.messages.find(m => m.id === messageId && m.who === "taylor");
  if (!msg) return;

  state.selectedTaylorMessageId = messageId;
  persist();

  // Populate optional selection
  selectedText.textContent = msg.text;

  const ann = state.annotations[messageId] || null;
  tagType.value = ann?.tagType || "";
  tagComment.value = ann?.thinkingComment || "";
  reasoningComment.value = ann?.reasoningComment || "";
  nextIntent.value = ann?.nextIntent || "";
  tagSaved.textContent = "";

  showAnalysisModal(auto);
}

function isAnalysisComplete(){
  return Boolean(
    reasoningComment.value.trim().length > 0 &&
    nextIntent.value.trim().length > 0
  );
}

function updateSaveState(){
  if (!saveAndReturnBtn) return;
  saveAndReturnBtn.disabled = !isAnalysisComplete();
}

tagType.addEventListener("change", updateSaveState);
tagComment.addEventListener("input", updateSaveState);
reasoningComment.addEventListener("input", updateSaveState);
nextIntent.addEventListener("input", updateSaveState);

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
  // If the last Taylor response hasn't been analyzed yet, force analysis first.
  if (state.analysisGate?.required) {
    const tid = state.analysisGate.pendingTaylorId || lastTaylorMessageId();
    if (tid) openAnalysis(tid, { auto: true });
    // Hard stop: do not allow composing/sending until analysis is completed.
    setChatDisabled(true);
    return;
  }
  if (teacherMessageCount() >= MAX_TEACHER_MESSAGES) return;

  // Prevent rapid-fire submissions.
  sendBtn.disabled = true;
  userInput.disabled = true;

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
  // While we fetch Taylor's reply, pause the chat UI (prevents double-sends).
  setChatDisabled(true);
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

    // After ANY Taylor reply, analysis is required before continuing.
    const lastTaylor = state.messages[state.messages.length - 1];
    if (lastTaylor?.who === "taylor") {
      state.analysisGate = { required: true, pendingTaylorId: lastTaylor.id };
      persist();
      setChatDisabled(true);
      openAnalysis(lastTaylor.id, { auto: true });
    }
  } catch (err) {
    console.error(err);
    const msg = (err?.message || "").toString();
    // Even on error, we still show a Taylor bubble so the flow is consistent,
    // and we still REQUIRE analysis before the teacher can send again.
    const errTaylorId = crypto.randomUUID();
    if (msg.includes("rate_limit") || msg.includes("Rate limit") || msg.includes("429")) {
      apiStatus.textContent = "rate limited";
      state.messages.push({
        id: errTaylorId,
        role: "assistant",
        who: "taylor",
        text: "(I can't answer right now — the system is rate-limited. Please try again later.)",
        ts: new Date().toISOString()
      });
    } else {
      apiStatus.textContent = "error";
      state.messages.push({
        id: errTaylorId,
        role: "assistant",
        who: "taylor",
        text: "(Connection error. Please try again.)",
        ts: new Date().toISOString()
      });
    }
    persist();
    renderChat();

    // Require analysis after the (error) Taylor message too.
    state.analysisGate = { required: true, pendingTaylorId: errTaylorId };
    persist();
    setChatDisabled(true);
    openAnalysis(errTaylorId, { auto: true });
  }
  // Do NOT re-enable the chat composer here.
  // It will only unlock after required analysis is saved.
}

function buildModelMessages(){
  const msgs = [{ role:"system", content: TAYLOR_SYSTEM }];
  // Send the full conversation history to preserve consistency.
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

// ---- Analysis save (modal) ----
function saveCurrentAnnotation(){
  const mid = state.selectedTaylorMessageId;
  if (!mid) return;

  state.annotations[mid] = {
    selectionText: (selectedText?.textContent || "").trim(),
    tagType: (tagType?.value || "").trim(),
    thinkingComment: (tagComment?.value || "").trim(),
    reasoningComment: (reasoningComment?.value || "").trim(),
    nextIntent: (nextIntent?.value || "").trim(),
    updatedAt: new Date().toISOString()
  };
  persist();
}

if (saveAndReturnBtn) {
  saveAndReturnBtn.addEventListener("click", () => {
    if (!isAnalysisComplete()) {
      tagSaved.textContent = "Please complete the required questions.";
      updateSaveState();
      return;
    }
    saveCurrentAnnotation();
    // Unlock chat only after required analysis is saved.
    state.analysisGate = { required: false, pendingTaylorId: null };
    persist();
    tagSaved.textContent = "Saved ✓";
    setTimeout(() => (tagSaved.textContent = ""), 700);
    hideAnalysisModal();
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

  // 2) Full export as JSON (includes pre-questions + annotations)
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
  downloadText(JSON.stringify(exportObj, null, 2), `${base}_all.json`, "application/json");
});
