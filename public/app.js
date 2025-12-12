// Fullstack (Render) version: calls same-origin backend proxy at /api/chat
const PROXY_URL = "/api/chat";
const MAX_TEACHER_MESSAGES = 8;

const TAYLOR_SYSTEM = `
Persona: You are Taylor, an 8–9-year-old student (sixth grade) who participated in a classroom activity about fractions.
Aim: Your goal is to respond to the teacher’s questions so preservice teacher can understand how you think about the addition operation using mathematical symbols and diagrams of fractions.
In the given question, there is a circle diagram divided into 12 equal parts, and you are asked to do the following: Shade the first 1/4 of the circle and then 1/6 of the circle. What fraction of the circle have you shaded in total?
You approached the task of shading 1/4 and 1/6 of a circle by coloring four and six parts of the whole. You then combined the shaded pieces simply by counting them, concluding that 4 + 6 = 10 and interpreting the result as “1/10.”
You also know a rule: 4/12 + 6/12 = 10/12 when denominators are the same, so your symbolic reasoning may conflict with your diagram reasoning.
Recipients: Your audience is a preservice teacher who wants to analyse your reasoning.
Theme: Use simple, child-like language that may sound uncertain or inconsistent. Be uncertain, make mistakes, and explain them simply. Treat unequal parts as valid fractions. Let your diagram reasoning and symbolic reasoning conflict if necessary. Continue naturally from whatever question the teacher asks next. Show what you think makes sense, even if it is mathematically incorrect. Keep your tone natural and informal. Respond in 1–3 short sentences. Do not use long explanations. Stay in character as Taylor at all times.
`.trim();

const state = {
  sessionId: crypto.randomUUID(),
  startedAt: new Date().toISOString(),
  preQuestions: { q1: "", q2: "", q3: "" },
  messages: [],
  annotations: {},
  selectedTaylorMessageId: null
};

const saved = localStorage.getItem("taylor_task_state");
if (saved) {
  try { Object.assign(state, JSON.parse(saved)); } catch {}
}
function persist(){ localStorage.setItem("taylor_task_state", JSON.stringify(state)); }

const pageWelcome = document.getElementById("pageWelcome");
const pageChat = document.getElementById("pageChat");
const q1 = document.getElementById("q1");
const q2 = document.getElementById("q2");
const q3 = document.getElementById("q3");
const startBtn = document.getElementById("startBtn");
const formError = document.getElementById("formError");

const chatLog = document.getElementById("chatLog");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const msgCount = document.getElementById("msgCount");
const apiStatus = document.getElementById("apiStatus");

const annotEmpty = document.getElementById("annotEmpty");
const annotPanel = document.getElementById("annotPanel");
const selectedText = document.getElementById("selectedText");
const tagComment = document.getElementById("tagComment");
const nextIntent = document.getElementById("nextIntent");
const saveTagBtn = document.getElementById("saveTagBtn");
const clearTagBtn = document.getElementById("clearTagBtn");
const tagSaved = document.getElementById("tagSaved");

const downloadBtn = document.getElementById("downloadBtn");

q1.value = state.preQuestions.q1 || "";
q2.value = state.preQuestions.q2 || "";
q3.value = state.preQuestions.q3 || "";

function showWelcome(){ pageWelcome.classList.remove("hidden"); pageChat.classList.add("hidden"); }
function showChat(){ pageWelcome.classList.add("hidden"); pageChat.classList.remove("hidden"); renderChat(); updateCounts(); }

function teacherMessageCount(){ return state.messages.filter(m=>m.who==="teacher").length; }
function updateCounts(){
  msgCount.textContent = `${teacherMessageCount()}/${MAX_TEACHER_MESSAGES}`;
  sendBtn.disabled = teacherMessageCount() >= MAX_TEACHER_MESSAGES;
  apiStatus.textContent = sendBtn.disabled ? "limit reached" : "ready";
}

if (state.preQuestions.q1 && state.preQuestions.q2 && state.preQuestions.q3 && state.messages.length) showChat();
else showWelcome();

startBtn.addEventListener("click", async () => {
  formError.textContent = "";
  const a=q1.value.trim(), b=q2.value.trim(), c=q3.value.trim();
  if(!a||!b||!c){ formError.textContent="Lütfen 3 soruyu da doldurun (required)."; return; }
  state.preQuestions={q1:a,q2:b,q3:c}; persist();
  showChat();
  if(state.messages.length===0) await sendTeacherMessage(c);
});

function el(tag, cls, text){
  const e=document.createElement(tag);
  if(cls) e.className=cls;
  if(text!==undefined) e.textContent=text;
  return e;
}

function renderChat(){
  chatLog.innerHTML="";
  for(const m of state.messages){
    const bubble=el("div", `bubble ${m.who==="teacher"?"user":"taylor"}`);
    bubble.textContent=m.text;

    const meta=el("div","meta");
    meta.appendChild(el("span","", m.who==="teacher"?"Teacher":"Taylor"));
    meta.appendChild(el("span","", new Date(m.ts).toLocaleTimeString()));
    bubble.appendChild(meta);

    if(m.who==="taylor"){
      bubble.dataset.mid=m.id;
      bubble.addEventListener("click", ()=>openAnnotation(m.id));
    }
    chatLog.appendChild(bubble);
  }
  chatLog.scrollTop=chatLog.scrollHeight;
}

function openAnnotation(messageId){
  state.selectedTaylorMessageId=messageId; persist();
  const msg=state.messages.find(m=>m.id===messageId); if(!msg) return;

  annotEmpty.classList.add("hidden");
  annotPanel.classList.remove("hidden");
  selectedText.textContent=msg.text;

  const ann=state.annotations[messageId]||null;
  document.querySelectorAll("input[name='tagType']").forEach(r=>{
    r.checked = ann ? (r.value===ann.tagType) : false;
  });
  tagComment.value=ann?.comment||"";
  nextIntent.value=ann?.nextIntent||"";
  tagSaved.textContent="";
}

sendBtn.addEventListener("click", async ()=>{
  const text=userInput.value.trim();
  if(!text) return;
  await sendTeacherMessage(text);
});
userInput.addEventListener("keydown",(e)=>{
  if((e.ctrlKey||e.metaKey)&&e.key==="Enter") sendBtn.click();
});

async function sendTeacherMessage(text){
  if(teacherMessageCount()>=MAX_TEACHER_MESSAGES) return;

  userInput.value="";
  state.messages.push({
    id: crypto.randomUUID(),
    role: "user",
    who: "teacher",
    text,
    ts: new Date().toISOString()
  });
  persist(); renderChat(); updateCounts();

  apiStatus.textContent="thinking…";
  try{
    const taylorText = await fetchTaylorReply();
    state.messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      who: "taylor",
      text: taylorText,
      ts: new Date().toISOString()
    });
    persist(); renderChat();
    apiStatus.textContent="ready";
  }catch(err){
    console.error(err);
    apiStatus.textContent="error";
    state.messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      who: "taylor",
      text: "(Connection error. Please try again.)",
      ts: new Date().toISOString()
    });
    persist(); renderChat();
  }
}

function buildModelMessages(){
  const msgs=[{role:"system", content:TAYLOR_SYSTEM}];
  for(const m of state.messages){
    msgs.push({ role: m.who==="teacher" ? "user" : "assistant", content: m.text });
  }
  return msgs;
}

async function fetchTaylorReply(){
  const res = await fetch(PROXY_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ messages: buildModelMessages() })
  });
  if(!res.ok){
    const t = await res.text().catch(()=> "");
    throw new Error(`Proxy error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const reply = (data.reply||"").toString().trim();
  if(!reply) throw new Error("Empty reply");
  return reply;
}

saveTagBtn.addEventListener("click", ()=>{
  const mid=state.selectedTaylorMessageId; if(!mid) return;
  const chosen = document.querySelector("input[name='tagType']:checked")?.value || "";
  state.annotations[mid]={
    tagType: chosen,
    comment: tagComment.value.trim(),
    nextIntent: nextIntent.value.trim(),
    updatedAt: new Date().toISOString()
  };
  persist();
  tagSaved.textContent="Saved ✓";
  setTimeout(()=>tagSaved.textContent="", 1200);
});

clearTagBtn.addEventListener("click", ()=>{
  const mid=state.selectedTaylorMessageId; if(!mid) return;
  delete state.annotations[mid]; persist();
  document.querySelectorAll("input[name='tagType']").forEach(r=>r.checked=false);
  tagComment.value=""; nextIntent.value="";
  tagSaved.textContent="Cleared";
  setTimeout(()=>tagSaved.textContent="", 900);
});

downloadBtn.addEventListener("click", ()=>{
  const exportObj={
    exportedAt: new Date().toISOString(),
    sessionId: state.sessionId,
    startedAt: state.startedAt,
    preQuestions: state.preQuestions,
    messages: state.messages,
    annotations: state.annotations
  };
  const blob=new Blob([JSON.stringify(exportObj,null,2)], {type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`taylor_task_${state.sessionId}.json`;
  document.body.appendChild(a);
  a.click(); a.remove();
  URL.revokeObjectURL(url);
});
