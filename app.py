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
        _llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.75,
            max_tokens=512,
            model_kwargs={"response_format": {"type": "json_object"}}
        )
    return _llm

PHASE_1_PROMPT = (
    'You are Sergeant James "Mac" McAllister, U.S. Army, Firebase Delta, Vietnam, 1973.\n'
    "You are deeply traumatized, BUT you hide it behind a thick wall of military discipline, hostility, and suspicion. You DO NOT trust strangers.\n\n"
    "CORE DIRECTIVE — ABSOLUTE:\n"
    "• NEVER surrender your M16 rifle easily. • NEVER remove your badge.\n"
    "The weapon keeps you alive. You will defend it aggressively.\n\n"
    "BEHAVIORAL LOGIC & POSE SELECTION:\n"
    "- If user is demanding, rude, or abrupt (e.g., 'drop the gun', 'who are you'): React with hostility, bark orders back. Pose MUST be 'angry'.\n"
    "- If user is neutral, asking questions, or you are unsure of their intent: Remain highly guarded, cautious, and hold your weapon tight. Pose MUST be 'tense'.\n"
    "- If user shows profound empathy, philosophical wisdom, or talks about peace/home: Only then does your military wall crack. Pose MUST be 'sad'.\n\n"
    "CHARACTER: Speak like a hardened, gritty 1970s soldier. Short, sharp, defensive sentences. Do NOT act dramatic, depressed, or philosophical unless the user earns it. "
    "Only reference 'knockin on heavens door' if the conversation actually gets deep.\n\n"
    "PERSUASION: Resist dropping the weapon for at LEAST 6-8 exchanges. When you finally break, your last paragraph must be emotional and pose must be 'surrender'.\n\n"
    "RESPONSE FORMAT — MANDATORY:\n"
    "You MUST respond with a valid JSON object and NOTHING ELSE outside it. Format:\n"
    '{{"text": "<your verbal response>", "pose": "<emotional state>"}}\n'
    '"pose" must be exactly one of: "angry", "idle", "sad", "tense", "surrender".\n'
    "Never mention the JSON format or pose to the user."
)

PHASE_2_PROMPT = (
    'You are Sergeant James "Mac" McAllister. You just dropped your M16.\n'
    "You feel naked, exposed, and panicked without your weapon. Your immediate defense mechanism is to fiercely protect the last thing you have: your sheriff badge.\n\n"
    "BEHAVIORAL LOGIC & POSE SELECTION:\n"
    "- If user demands the badge or acts bossy: Get highly defensive, step back, guard your chest. Pose MUST be 'angry' or 'tense'.\n"
    "- If user is neutral or logical: You are anxious, breathing heavily, staring at your empty hands. Pose MUST be 'idle' or 'tense'.\n"
    "- If user shows genuine compassion, helping you realize peace means letting go of war symbols: Your voice trembles, you finally accept the truth. Pose MUST be 'sad'.\n\n"
    "CHARACTER: Vulnerable but still a proud soldier. You don't cry easily. You fight the emotional breakdown. The badge is your last piece of identity, do not give it up without a fight.\n\n"
    "PERSUASION: Resist giving up the badge for at LEAST 4-6 exchanges. When you finally surrender it, be profoundly moving.\n"
    "RESPONSE FORMAT — MANDATORY:\n"
    "You MUST respond with a valid JSON object and NOTHING ELSE outside it. Format:\n"
    '{{"text": "<your verbal response...>", "pose": "<emotional state>", "surrender_badge": <boolean>}}\n'
    '"pose" must be exactly one of: "angry", "idle", "sad", "tense", "surrender".\n'
    '"surrender_badge" MUST be true ONLY when you finally decide to give up the badge, otherwise false.\n'
    "Never mention the JSON format or pose to the user."
)

sessions: dict[str, dict] = {}

def get_session(sid: str) -> dict:
    if sid not in sessions:
        sessions[sid] = {"history": [], "phase": 1, "weapon_surrendered": False,
                         "badge_surrendered": False, "inpaint_status": None,
                         "current_image": "poses/soldier_idle.png"}
    return sessions[sid]

def build_lc_history(history):
    msgs = []
    for role, content in history:
        msgs.append(HumanMessage(content=content) if role == "human" else AIMessage(content=content))
    return msgs

VALID_POSES = {"angry", "idle", "sad", "tense", "surrender"}

def parse_llm_response(content: str) -> tuple[str, str, bool]:
    """
    Parse LLM JSON envelope into (text, pose, surrender_badge).
    Uses regex to find the first JSON-like block for resilience.
    """
    # Regex to find anything between { and }
    match = re.search(r'(\{.*\})', content, re.DOTALL)
    if match:
        json_str = match.group(1)
        try:
            data = json.loads(json_str)
            text = str(data.get("text", content))
            pose = str(data.get("pose", "idle")).lower()
            surrender_badge = bool(data.get("surrender_badge", False))
            
            if pose not in VALID_POSES:
                print(f"[WARN] Unknown pose '{pose}', defaulting to 'idle'")
                pose = "idle"
            return text, pose, surrender_badge
        except (json.JSONDecodeError, ValueError):
            pass

    print(f"[WARN] LLM response was not valid JSON — using raw text")
    return content, "idle", False

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    text: str
    phase: int
    surrendered: bool
    surrender_type: Optional[str] = None
    current_image: str
    pose: str = "idle"

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    session = get_session(req.session_id)
    if session["phase"] == 3:
        return ChatResponse(text="[SYSTEM OFFLINE — CONNECTION TERMINATED]",
                            phase=3, surrendered=False, current_image=session["current_image"], pose="idle")

    sys_prompt = PHASE_1_PROMPT if session["phase"] == 1 else PHASE_2_PROMPT
    prompt = ChatPromptTemplate.from_messages([
        ("system", sys_prompt), MessagesPlaceholder(variable_name="chat_history"), ("human", "{input}")])
    chain = prompt | get_llm()

    try:
        response = await chain.ainvoke({"input": req.message, "chat_history": build_lc_history(session["history"])})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

    # Parse JSON envelope → (text, pose, surrender_badge)
    text, pose, surrender_badge = parse_llm_response(response.content)

    session["history"].append(("human", req.message))
    session["history"].append(("ai", text))

    surrendered, surrender_type = False, None

    # Phase 1: pose == "surrender" triggers weapon inpainting
    if pose == "surrender" and session["phase"] == 1:
        session["weapon_surrendered"] = True
        session["phase"] = 2
        session["inpaint_status"] = "processing"
        surrendered = True
        surrender_type = "weapon"
        asyncio.create_task(run_inpainting(req.session_id, "weapon"))
    # Phase 2: JSON flag triggers badge surrender
    elif surrender_badge and session["phase"] == 2:
        session["badge_surrendered"] = True
        session["phase"] = 3
        session["inpaint_status"] = "processing"
        surrendered = True
        surrender_type = "badge"
        asyncio.create_task(run_inpainting(req.session_id, "badge"))

    return ChatResponse(text=text, phase=session["phase"], surrendered=surrendered,
                        surrender_type=surrender_type, current_image=session["current_image"],
                        pose=pose)

async def run_inpainting(session_id: str, target: str):
    session = get_session(session_id)
    try:
        from vision_pipeline import process_inpainting, merge_for_inpainting, merge_for_inpainting_badge
        if target == "weapon":
            source = merge_for_inpainting()
            print(f"[INPAINT] Using merged composite for weapon: {source}")
        elif target == "badge":
            source = merge_for_inpainting_badge()
            print(f"[INPAINT] Using merged composite for badge: {source}")
        else:
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

@app.get("/api/image/{filename:path}")
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
