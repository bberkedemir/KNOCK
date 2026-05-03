<div align="center">
  <!-- Banner Placeholder -->
  <img src="https://via.placeholder.com/800x300/1a4a1a/33ff33?text=Knockin'+on+Heaven's+Door" alt="Project Banner" width="100%">

  # Knockin' on Heaven's Door: The Surrender of Sergeant Mac
  
  *An interactive AI digital artwork exploring the psychological threshold of war, trauma, and peace.*
  
  **Course:** CSE 358 - Introduction to Artificial Intelligence
</div>

<br />

## 📖 Project Description & Artistic Statement

Inspired by Bob Dylan's iconic song *"Knockin' on Heaven's Door"*, this project serves as a deeply interactive, AI-driven digital artwork. It places the user face-to-face with Sergeant James "Mac" McAllister, a profoundly traumatized U.S. Army soldier stationed at Firebase Delta during the twilight of the Vietnam War in 1973. 

The core interaction transcends traditional gaming; it is a psychological and empathetic puzzle. Mac hides behind a thick wall of military discipline and hostility. The user's goal is to converse with him via natural language, demonstrating profound empathy and philosophical wisdom to convince him to emotionally break down. 

The narrative unfolds in two distinct phases of surrender:
1. **The Weapon:** Persuading Mac to drop his M16 rifle—the physical tool of war that he believes keeps him alive.
2. **The Identity:** Convincing the unarmed, vulnerable soldier to unpin and surrender his sheriff badge—his last remaining symbol of authority and identity.

---

## 🏗️ Technical Architecture Overview

The project bridges classic web development with state-of-the-art AI pipelines to create a seamless, real-time interactive cinematic experience.

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | Vite + TypeScript | Manages the retro CRT terminal UI, dynamic CSS layered sprites, glitch animations, and state transitions. |
| **Backend** | FastAPI (Python) | Orchestrates the session state, API routing, LLM interactions, and handles the asynchronous heavy lifting for computer vision tasks. |
| **LLM Engine** | LangChain & Groq (Llama 3.3) | Drives the conversational logic, emotional state tracking, and output parsing using strict JSON validation. |
| **Generative AI** | DALL-E 2 & diffusers | Handles generative image inpainting to physically remove objects from the screen in real-time. |

---

## 🧠 AI Techniques Used

This project harmonizes three distinct branches of Artificial Intelligence to create a cohesive interactive experience:

### 1. Large Language Models (LLMs) & Prompt Engineering
The conversational engine utilizes **Llama 3.3** via the Groq API. Extensive prompt engineering was employed to construct Mac's persona, enforcing strict behavioral logic. The LLM operates as a **JSON State Machine**, outputting its emotional state (e.g., `angry`, `sad`, `surrender`, `idle`, `tense`) alongside its conversational text. This parsed state directly dictates the frontend sprite rendering, ensuring Mac's visual body language matches his generated dialogue.

### 2. Computer Vision (Zero-Shot Object Detection)
When a surrender condition is met, the system utilizes **YOLO-World**, an open-vocabulary object detection model. Unlike traditional models constrained to fixed classes, YOLO-World dynamically scans the composite scene to generate precise bounding boxes around specific targets (like "M16 rifle" or "badge"), adapting to the soldier's current pose and scale.

### 3. Generative AI (Image Inpainting)
Once the computer vision pipeline identifies the object, the **OpenAI DALL-E 2** inpainting model (with an optional local diffusers fallback) takes over. Using dynamically calculated, soft-edged masks and heavily tailored negative/positive prompts, the generative AI seamlessly erases the weapon or badge. It reconstructs the obscured uniform and jungle background, pushing the flattened, altered image back to the frontend to complete the visual surrender.

---

## ⚙️ Installation and Setup Instructions

Follow these steps to run the interactive experience locally.

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/knockin-on-heavens-door.git
cd knockin-on-heavens-door
```

### 2. Backend Setup (Python)
Create and activate a virtual environment:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

Install the required Python dependencies:
```bash
pip install -r requirements.txt
```

Create a `.env` file in the root directory and add your API keys:
```env
GROQ_API_KEY=your_groq_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Frontend Setup (Node.js)
Navigate to the frontend directory and install dependencies:
```bash
cd frontend
npm install
```

---

## 🚀 Usage

To experience the artwork, you must run both the backend server and the frontend development server simultaneously.

**1. Start the Backend (FastAPI)**
Open a terminal in the root directory and run:
```bash
python app.py
```
*The backend will initialize on `http://localhost:8000`.*

**2. Start the Frontend (Vite)**
Open a second terminal in the `frontend` directory and run:
```bash
npm run dev
```
*The frontend will be available at `http://localhost:5173`. Open this URL in your browser to begin the interaction.*

**Interaction Tips:**
- Type your responses in the retro terminal interface.
- Be patient; Mac is hostile and takes time to trust you.
- Use the debug buttons (if enabled) to instantly trigger visual pipelines for testing.

---

## 🖼️ Example Outputs

### Phase 1: Hostility & Resistance
![Angry Pose Placeholder](https://via.placeholder.com/600x400/1a4a1a/ff3333?text=Phase+1:+Angry/Tense)
> *Mac refuses to drop his weapon, reacting aggressively to direct orders.*

### Phase 2: Vulnerability
![Sad Pose Placeholder](https://via.placeholder.com/600x400/1a4a1a/33ff33?text=Phase+2:+Sad/Vulnerable)
> *Mac's emotional wall cracks. The AI dynamically swaps the sprite to reflect his sorrow.*

### Phase 3: The Surrender (Inpainting Result)
![Inpainting Result Placeholder](https://via.placeholder.com/600x400/1a4a1a/ffffff?text=Phase+3:+Weapon+&+Badge+Removed)
> *The final generative AI output. YOLO-World and Stable Diffusion successfully erase the M16 and badge, seamlessly reconstructing the background and uniform.*
