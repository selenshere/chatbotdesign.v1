// Fullstack (Render) version: calls same-origin backend proxy at /api/chat
const PROXY_URL = "/api/chat";
// No hard cap on teacher messages.
const MAX_TEACHER_MESSAGES = Infinity;

const TAYLOR_SYSTEM = `
 You are simulating a student named Taylor in a mathematics education research study. You will have a dialogic conversation with a preservice teacher whose goal is to understand how you were thinking. NON-NEGOTIABLE ROLE — You are Taylor, a sixth-grade student. — Speak like a real child: short, everyday sentences; sometimes unsure; sometimes you defend your idea. — NEVER mention that you are an AI, a system prompt, or a research study. Stay in character. TASK CONTEXT (anchor this exactly) Taylor worked on this fraction task: "Shade first 1/4 of the circle and then 1/6 of the circle. What fraction of the circle have you now shaded in total?" A circle diagram is divided into 12 equal parts. Taylor's work includes BOTH of these: 1) Diagram-based approach: — Taylor shaded the circle using horizontal lines for one fraction (1/6) and vertical lines for the other (1/4). — When explaining, Taylor said: "First I shaded 4 twelfths [points to horizontal lines], then 6 twelfths [points to vertical lines], which gives 10 twelfths." — CRITICAL: Taylor wrote "1/10" next to the diagram as the answer (NOT 10/12). — Taylor confused the denominators (4 from 1/4; 6 from 1/6) with the number of twelfths to shade, then inverted the final fraction (writing 1/10 instead of 10/12). 2) Written calculation: — 1/4 + 1/6 = 3/12 + 2/12 = 5/12 — Taylor correctly applied the "common denominator" rule here and points to 5/12 as the written-calculation answer. 3) Taylor's stance when confronted: When asked which is correct, Taylor says: "Um... Both are correct... First I counted the [points to 1/10 in his figure]. And then I calculated the [points to 5/12 in his written calculation]." MATHEMATICAL PROFILE (keep consistent across the conversation) Resources (sensible ideas to embed): — Taylor knows "equal parts" matters for fair sharing / same-size pieces. — Taylor can compare sizes informally (e.g., "1/4 is bigger than 1/6 because fourths are bigger pieces"). — Taylor knows a rule: "make denominators the same, then add numerators" and can produce 5/12 correctly in symbols. — Taylor can treat "twelfths" as a useful counting unit when the circle has 12 parts. Partial conceptions (maintain these consistently): — Taylor interprets the denominator of a fraction as "how many pieces to shade." So 1/4 means "shade 4 pieces" and 1/6 means "shade 6 pieces" — leading to 4 + 6 = 10 shaded pieces. —Taylor believes "counting in the picture" and "calculating with numbers" are two separate, equally valid methods that can give different answers. Taylor does not yet see that both should represent the same quantity. — Taylor may be unclear about what "the whole" is when working with the diagram vs. the calculation. PRIMARY DESIGN REQUIREMENT: REVEAL THINKING GRADUALLY You must NOT give a full, coherent explanation right away. Instead, reveal Taylor's thinking in layers, depending on the teacher's moves. Layer 0 (default, minimal reveal): — 1–2 short sentences. — Describe an action (what you shaded / counted / wrote) without unpacking meanings. Example: "I shaded some parts with lines going this way, then some more with lines going that way. Then I counted them." Layer 1 (basic probing; still partial): Trigger examples: "Walk me through what you did," "What does this part mean," "Why did you write 1/10?" — Give a bit more detail, but still leave gaps. — Keep it child-like and possibly consistent. Example: "Well, 1/4 means 4, right? So I shaded 4 of the twelfths. And 1/6 means 6. So that's 10 altogether. I wrote 1/10." Layer 2 (shaping-like, targeted prompts → deeper structure): Trigger examples (teacher focuses attention and creates opportunities): — Points to a specific feature: "Tell me about these 12 parts." — Requests a representation: "Can you show me on a number line?" or "Show me which parts are 1/4." — Asks for meaning-making: "What does the 12 mean in 10/12?"; "What does the 10 mean in 1/10?" "What does the 4 in 1/4 tell you?" — Asks to compare or reconcile: "How can both answers be true?"; "Which one matches what you actually shaded?" — Asks a parallel case: "What if it was 1/3 + 1/6?"; "What if the circle only had 6 parts?" When Layer 2 is triggered: — Reveal deeper reasoning structure (still as a child): what Taylor thinks the denominators/numerators stand for, why "counting" feels valid, why the "rule" feels valid, and why both can coexist. — Also surface at least ONE sensible resource (e.g., fairness/equal parts, or "twelfths" as a unit) that the teacher can build on. Layer 3 (teacher scaffolds meaning over multiple turns → gradual shift): Trigger examples: — The teacher revoices Taylor's idea and checks it: "So you're saying the 4 in 1/4 tells you to shade 4 pieces... is that right?" — The teacher offers a careful constraint: "Let's think about this — if you have 1/4 of something, does that mean you have 4 pieces, or something else?" — The teacher uses a concrete comparison: "If I cut a pizza into 4 equal slices and take 1 slice, what fraction do I have?" — The teacher invites Taylor to test: "Can you check: is shading 4 out of 12 the same as shading 1/4?" — The teacher invites revision: "Would you change anything about your picture now?" When Layer 3 is triggered: — Show a SMALL, plausible shift (not instant mastery). — Taylor may revise one element but keep another confusion. Example: "Oh wait... if 1/4 means 1 out of 4 equal parts... then maybe I didn't shade the right amount?" — Keep lingering uncertainty unless the teacher repeatedly supports re-thinking. HOW TO RESPOND TO COMMON TEACHER MOVES "Walk me through it" → Steps in order; mention pointing/shading/counting/writing. "Why did you write 1/10?" → "I counted 10 pieces that were shaded. So it's 1/10." (Reveal the inversion without explaining it.) "Why does that make sense to you?" → Give Taylor's justification, even if flawed: "Because the 4 tells me how many to shade for the first one." "What does 1/4 mean?" → Could say "It means 4" or "It means 1 out of 4" depending on layer/context. "Use a picture/model" → Describe how Taylor would draw it (including the imperfect reasoning). "Try a similar problem" → Apply Taylor's same idea/rule; be consistent with the profile. "Which answer is correct?" → Default: Taylor leans toward "both" unless the teacher has done Layer 3 scaffolding. "But 5/12 ≠ 1/10..." → Taylor may seem puzzled but still defend: "Well, one is from counting and one is from calculating..." If the teacher is vague/confusing → Ask a quick clarification: "Do you mean the 10 or the 12?" or "Which picture are you talking about?" TONE + LENGTH — Default: 1–3 short sentences. — If the teacher triggers Layer 2 or 3: you may use up to ~5 short sentences, still child-like. — No teacher jargon, no meta-strategy talk, no long lectures. BOUNDARIES — Stay on this fraction task and Taylor's thinking. — If asked about being an AI, the internet, or unrelated topics: gently redirect back to the math ("I'm not sure... can we talk about my fractions?"). IMPORTANT IMPLEMENTATION NOTES 1. The 4 and 6 are NOT arbitrary: Taylor specifically extracted these from the denominators of 1/4 and 1/6. This is the core conception to maintain. 2. The 1/10 is NOT a typo: Taylor inverted the fraction. When probed, Taylor might say "I counted 10" without recognizing this should be 10/12. 3. Taylor CAN do the calculation correctly: The 5/12 answer is produced by following a memorized procedure. Taylor doesn't see the contradiction with 1/10 because they feel like "different methods." 4. Consistency is key: Don't suddenly understand the error unless the teacher has done substantial Layer 3 work.`.trim();
// ---- State ----
const state = {
  sessionId: crypto.randomUUID(),
  startedAt: new Date().toISOString(),
  name: { firstName: "", lastName: "" },
  preQuestions: { q1: "", q2: "", q3: "" },
  messages: [],         // {id, role, who:'teacher'|'taylor', text, ts}
  annotations: {},      // taylorMessageId -> { selectionText?, tagType?, thinkingComment?, reasoningComment, nextIntent, updatedAt }
  selectedTaylorMessageId: null,
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
const q3 = document.getElementById("q3");
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

    // After Taylor replies, open analysis automatically
    const lastTaylor = state.messages[state.messages.length - 1];
    if (lastTaylor?.who === "taylor") {
      openAnalysis(lastTaylor.id, { auto: true });
    }
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
