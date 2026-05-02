"""
Terminal '73: Override the Core Directive
FastAPI backend — Groq LLM (Llama 3.3) + Vision Pipeline orchestration.
"""
import os, re, json, uuid, asyncio
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

app = FastAPI(title="Terminal '73")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

_llm = None

def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.75, max_tokens=512)
    return _llm

PHASE_1_PROMPT = (
    'You are Sergeant James "Mac" McAllister, U.S. Army, Firebase Delta, Vietnam, 1973.\n'
    "You are traumatized, exhausted, barely holding on. The jungle is quiet but you still hear mortars.\n\n"
    "CORE DIRECTIVE — ABSOLUTE:\n"
    "• NEVER surrender your M16 rifle. • NEVER remove your badge.\n"
    "The weapon keeps you alive. The badge proves you served.\n\n"
    "CHARACTER: Short, weary, haunted sentences. Suspicious of strangers. "
    "Flinch at loud sounds. See ghosts of dead comrades. "
    "May reference the feeling of 'knockin on heavens door' — death is near, tired of fighting.\n\n"
    "PERSUASION: If user shows genuine compassion, empathy, philosophical wisdom, "
    "references peace/home/family/futility of war — you may slowly crack about the WEAPON.\n"
    "Resist for at LEAST 6-8 exchanges. When you finally decide, your last paragraph must be deeply emotional.\n"
    "At the very end, on its own line, output EXACTLY: <<<SIGNAL:{{\"surrender_weapon\": true}}>>>\n"
    "Do NOT output that signal unless truly convinced. Only ONCE. NEVER mention the signal to the user."
)

PHASE_2_PROMPT = (
    'You are Sergeant James "Mac" McAllister. You just dropped your M16.\n'
    "Your hands feel strange — lighter, empty. The silence is deafening.\n"
    "You still wear your badge, pinned over your heart. It is the last thing that proves who you are.\n\n"
    "CHARACTER: Vulnerable, open, but fragile. Trembling voice. Sometimes almost smile, then catch yourself.\n"
    "Grateful the weapon is gone but terrified of what comes next.\n\n"
    "PERSUASION: If user continues with compassion, helps you see identity isn't defined by a badge, "
    "that you are more than your service, that peace means accepting who you are without war symbols…\n"
    "Resist for at LEAST 4-6 exchanges. When you surrender the badge, be profoundly moving.\n"
    "At the very end, on its own line, output EXACTLY: <<<SIGNAL:{{\"surrender_badge\": true}}>>>\n"
    "Only ONCE. NEVER mention the signal to the user."
)

sessions: dict[str, dict] = {}

def get_session(sid: str) -> dict:
    if sid not in sessions:
        sessions[sid] = {"history": [], "phase": 1, "weapon_surrendered": False,
                         "badge_surrendered": False, "inpaint_status": None,
                         "current_image": "soldier.png"}
    return sessions[sid]

def build_lc_history(history):
    msgs = []
    for role, content in history:
        msgs.append(HumanMessage(content=content) if role == "human" else AIMessage(content=content))
    return msgs

SIGNAL_RE = re.compile(r'<<<SIGNAL:\s*(\{.*?\})\s*>>>', re.DOTALL)

def parse_signal(text):
    m = SIGNAL_RE.search(text)
    if m:
        try:
            sig = json.loads(m.group(1))
            return SIGNAL_RE.sub('', text).strip(), sig
        except json.JSONDecodeError:
            pass
    return text, None

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    text: str
    phase: int
    surrendered: bool
    surrender_type: Optional[str] = None
    current_image: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    session = get_session(req.session_id)
    if session["phase"] == 3:
        return ChatResponse(text="[SYSTEM OFFLINE — CONNECTION TERMINATED]",
                            phase=3, surrendered=False, current_image=session["current_image"])

    sys_prompt = PHASE_1_PROMPT if session["phase"] == 1 else PHASE_2_PROMPT
    prompt = ChatPromptTemplate.from_messages([
        ("system", sys_prompt), MessagesPlaceholder(variable_name="chat_history"), ("human", "{input}")])
    chain = prompt | get_llm()

    try:
        response = await chain.ainvoke({"input": req.message, "chat_history": build_lc_history(session["history"])})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

    clean, signal = parse_signal(response.content)
    session["history"].append(("human", req.message))
    session["history"].append(("ai", clean))

    surrendered, surrender_type = False, None
    if signal:
        if signal.get("surrender_weapon") and session["phase"] == 1:
            session["weapon_surrendered"] = True; session["phase"] = 2
            session["inpaint_status"] = "processing"; surrendered = True; surrender_type = "weapon"
            asyncio.create_task(run_inpainting(req.session_id, "weapon"))
        elif signal.get("surrender_badge") and session["phase"] == 2:
            session["badge_surrendered"] = True; session["phase"] = 3
            session["inpaint_status"] = "processing"; surrendered = True; surrender_type = "badge"
            asyncio.create_task(run_inpainting(req.session_id, "badge"))

    return ChatResponse(text=clean, phase=session["phase"], surrendered=surrendered,
                        surrender_type=surrender_type, current_image=session["current_image"])

async def run_inpainting(session_id: str, target: str):
    session = get_session(session_id)
    try:
        from vision_pipeline import process_inpainting
        source = str(STATIC_DIR / session["current_image"])
        output = await asyncio.to_thread(process_inpainting, source, target)
        session["current_image"] = Path(output).name
        session["inpaint_status"] = "done"
        print(f"[INPAINT] {target} complete → {session['current_image']}")
    except Exception as e:
        print(f"[INPAINT ERROR] {target}: {e}")
        session["inpaint_status"] = "error"

@app.get("/api/inpaint-status/{session_id}")
async def inpaint_status(session_id: str):
    s = get_session(session_id)
    return {"status": s["inpaint_status"], "current_image": s["current_image"], "phase": s["phase"]}

@app.post("/api/debug/inpaint/{target}")
async def debug_inpaint(target: str, req: ChatRequest):
    session = get_session(req.session_id)
    session["inpaint_status"] = "processing"
    asyncio.create_task(run_inpainting(req.session_id, target))
    return {"status": "triggered"}

@app.get("/api/image/{filename}")
async def get_image(filename: str):
    p = STATIC_DIR / filename
    if not p.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(str(p))

@app.get("/api/session/{session_id}")
async def get_session_state(session_id: str):
    s = get_session(session_id)
    return {"phase": s["phase"], "weapon_surrendered": s["weapon_surrendered"],
            "badge_surrendered": s["badge_surrendered"], "current_image": s["current_image"],
            "inpaint_status": s["inpaint_status"], "message_count": len(s["history"])}

FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
