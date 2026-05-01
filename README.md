# Terminal '73: Override the Core Directive

> *"Mama, take this badge off of me / I can't use it anymore"*  
> — Bob Dylan, "Knockin' on Heaven's Door" (1973)

An interactive AI art experience where you talk to a traumatized 1973 Vietnam War soldier through a retro CRT terminal. Your mission: use empathy and philosophy to convince him to surrender his weapon and badge.

## 🎯 AI Techniques Used

1. **LLM Dialogue** (LangChain + Groq Llama 3.3 70B) — Conversational AI with a deeply role-played system prompt
2. **Computer Vision** (YOLOv8 Segmentation) — Object detection and mask generation
3. **Generative AI** (Stable Diffusion Inpainting via HuggingFace) — Visual modification of the soldier image

## 🏗️ Architecture

- **Frontend**: Vite + TypeScript (vanilla), inline CSS CRT effects
- **Backend**: FastAPI (Python), LangChain + Groq API
- **Vision**: Ultralytics YOLOv8 + HuggingFace Inference API

## ⚡ Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Groq API key (free): https://console.groq.com/
- HuggingFace token (free): https://huggingface.co/settings/tokens

### 1. Clone and configure
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 2. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 3. Install frontend dependencies
```bash
cd frontend
npm install
```

### 4. Run (Development)
Terminal 1 — Backend:
```bash
python app.py
```

Terminal 2 — Frontend:
```bash
cd frontend
npm run dev
```

Open http://localhost:5173

## 🎮 How to Play
1. You are an "operator" at a military psych-eval terminal
2. Sergeant McAllister appears on the left screen — armed and paranoid
3. Talk to him in the command line on the right
4. Use compassion, empathy, philosophy to convince him to drop his weapon (Phase 1)
5. Then convince him to remove his badge (Phase 2)
6. When he surrenders, the system "corrupts" — his weapon/badge visually disappear

## 📂 Project Structure
```
├── app.py                 # FastAPI + LLM logic
├── vision_pipeline.py     # YOLOv8 + inpainting
├── requirements.txt
├── static/soldier.png     # Initial soldier image
├── .env                   # API keys (not committed)
└── frontend/              # Vite + TypeScript
    └── src/
        ├── main.ts        # App entry + DOM
        ├── style.ts       # Inline CSS (CRT effects)
        ├── terminal.ts    # Chat rendering
        ├── effects.ts     # Visual effects
        └── api.ts         # API client
```
