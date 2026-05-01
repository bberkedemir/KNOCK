/** style.ts — All inline CSS for Terminal '73 CRT interface. */

export function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = CSS_CONTENT;
  document.head.appendChild(style);
}

const CSS_CONTENT = `
/* ================================================================
   RESET & BASE
   ================================================================ */
*, *::before, *::after {
  margin: 0; padding: 0; box-sizing: border-box;
}

html, body {
  width: 100%; height: 100%;
  overflow: hidden;
  background: #000;
  font-family: 'VT323', 'Share Tech Mono', monospace;
  color: #33ff33;
  font-size: 18px;
  line-height: 1.4;
}

/* ================================================================
   CRT SCREEN CONTAINER
   ================================================================ */
#app {
  width: 100vw; height: 100vh;
  position: relative;
  overflow: hidden;
}

/* Scanline overlay */
#app::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15) 0px,
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 3px
  );
  pointer-events: none;
  z-index: 1000;
  animation: scanlines 0.1s linear infinite;
}

/* CRT flicker */
#app::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 255, 0, 0.01);
  pointer-events: none;
  z-index: 999;
  animation: flicker 4s infinite;
}

@keyframes scanlines {
  0% { background-position: 0 0; }
  100% { background-position: 0 3px; }
}

@keyframes flicker {
  0%, 100% { opacity: 0.97; }
  5% { opacity: 0.95; }
  10% { opacity: 0.98; }
  50% { opacity: 0.96; }
  52% { opacity: 1; }
  53% { opacity: 0.94; }
  80% { opacity: 0.98; }
}

/* Vignette effect */
.vignette {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.7) 100%);
  pointer-events: none;
  z-index: 998;
}

/* ================================================================
   STATUS BAR (top)
   ================================================================ */
.status-bar {
  height: 48px;
  background: #0a0a0a;
  border-bottom: 1px solid #1a4a1a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  font-size: 14px;
  color: #22aa22;
  text-shadow: 0 0 8px rgba(51, 255, 51, 0.4);
  position: relative;
  z-index: 10;
}

.status-bar .title {
  font-size: 16px;
  color: #33ff33;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.status-bar .status-right {
  display: flex; gap: 20px; align-items: center;
}

.status-indicator {
  display: flex; align-items: center; gap: 6px;
}

.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #33ff33;
  box-shadow: 0 0 6px #33ff33;
  animation: pulse-dot 2s ease-in-out infinite;
}

.status-dot.warning { background: #ff9900; box-shadow: 0 0 6px #ff9900; }
.status-dot.critical { background: #ff3333; box-shadow: 0 0 6px #ff3333; animation: pulse-critical 0.5s infinite; }

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes pulse-critical {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

/* ================================================================
   MAIN LAYOUT — Two panels
   ================================================================ */
.main-container {
  display: grid;
  grid-template-columns: 40% 60%;
  height: calc(100vh - 48px);
  position: relative;
  z-index: 10;
}

/* ================================================================
   LEFT PANEL — Image Viewport
   ================================================================ */
.image-panel {
  background: #050505;
  border-right: 1px solid #1a4a1a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.image-panel-header {
  width: 100%;
  text-align: center;
  font-size: 12px;
  color: #1a8a1a;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.image-viewport {
  width: 100%;
  max-width: 820px;
  aspect-ratio: 1;
  position: relative;
  border: 2px solid #1a4a1a;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 0 30px rgba(51, 255, 51, 0.08),
              inset 0 0 60px rgba(0, 0, 0, 0.5);
}

.image-viewport img {
  width: 100%; height: 100%;
  object-fit: cover;
  filter: sepia(0.3) saturate(0.7) brightness(0.85) contrast(1.1);
  transition: filter 1s ease, opacity 1s ease;
}

/* Scanlines on image */
.image-viewport::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.12) 0px,
    rgba(0, 0, 0, 0.12) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  mix-blend-mode: multiply;
}

.image-label {
  width: 100%;
  text-align: center;
  font-size: 13px;
  color: #1a6a1a;
  margin-top: 12px;
  letter-spacing: 1px;
}

/* ================================================================
   RIGHT PANEL — Chat/Log Terminal
   ================================================================ */
.chat-panel {
  background: #050808;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.chat-header {
  padding: 10px 20px;
  border-bottom: 1px solid #1a4a1a;
  font-size: 13px;
  color: #1a8a1a;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.chat-log {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  scroll-behavior: smooth;
}

/* Scrollbar styling */
.chat-log::-webkit-scrollbar { width: 6px; }
.chat-log::-webkit-scrollbar-track { background: #0a0a0a; }
.chat-log::-webkit-scrollbar-thumb { background: #1a4a1a; border-radius: 3px; }
.chat-log::-webkit-scrollbar-thumb:hover { background: #33ff33; }

.chat-line {
  font-size: 17px;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.chat-line.system {
  color: #1a8a1a;
  font-size: 14px;
}

.chat-line.user {
  color: #33ff33;
  text-shadow: 0 0 4px rgba(51, 255, 51, 0.3);
}

.chat-line.user::before {
  content: '> ';
  color: #55ff55;
}

.chat-line.ai {
  color: #28cc28;
  padding-left: 8px;
  border-left: 2px solid #1a4a1a;
}

.chat-line.warning {
  color: #ff9900;
  text-shadow: 0 0 8px rgba(255, 153, 0, 0.5);
  font-size: 15px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.chat-line.critical {
  color: #ff3333;
  text-shadow: 0 0 12px rgba(255, 51, 51, 0.6);
  font-size: 16px;
  letter-spacing: 2px;
  text-transform: uppercase;
  animation: text-glitch 0.3s infinite;
}

@keyframes text-glitch {
  0%, 100% { transform: translate(0); }
  25% { transform: translate(-2px, 1px); }
  50% { transform: translate(1px, -1px); }
  75% { transform: translate(-1px, -1px); }
}

/* Typing cursor animation */
.cursor {
  display: inline-block;
  width: 10px;
  height: 18px;
  background: #33ff33;
  animation: cursor-blink 0.7s step-end infinite;
  vertical-align: text-bottom;
  margin-left: 2px;
}

@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* ================================================================
   INPUT AREA
   ================================================================ */
.chat-input-area {
  padding: 12px 20px;
  border-top: 1px solid #1a4a1a;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #080a0a;
}

.input-prompt {
  color: #55ff55;
  font-size: 18px;
  user-select: none;
  text-shadow: 0 0 6px rgba(51, 255, 51, 0.4);
}

.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #33ff33;
  font-family: 'VT323', monospace;
  font-size: 18px;
  caret-color: #33ff33;
  text-shadow: 0 0 4px rgba(51, 255, 51, 0.3);
}

.chat-input::placeholder {
  color: #1a4a1a;
}

.chat-input:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ================================================================
   DRAMATIC OVERLAY (for surrender sequences)
   ================================================================ */
.dramatic-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s;
}

.dramatic-overlay.active {
  opacity: 1;
  pointer-events: all;
}

.dramatic-text {
  font-size: 28px;
  color: #ff3333;
  text-shadow: 0 0 20px rgba(255, 51, 51, 0.8),
               0 0 40px rgba(255, 51, 51, 0.4);
  text-align: center;
  letter-spacing: 4px;
  text-transform: uppercase;
  animation: dramatic-pulse 1s ease-in-out infinite;
}

@keyframes dramatic-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.02); }
}

/* ================================================================
   GLITCH EFFECT on image
   ================================================================ */
.image-viewport.glitching img {
  animation: img-glitch 0.15s infinite;
  filter: sepia(0.1) saturate(0.5) brightness(0.6) contrast(1.3) hue-rotate(20deg);
}

@keyframes img-glitch {
  0% { transform: translate(0); clip-path: inset(0 0 0 0); }
  20% { transform: translate(-5px, 3px); clip-path: inset(20% 0 30% 0); }
  40% { transform: translate(3px, -2px); clip-path: inset(50% 0 10% 0); }
  60% { transform: translate(-2px, 5px); clip-path: inset(10% 0 60% 0); }
  80% { transform: translate(4px, -3px); clip-path: inset(40% 0 20% 0); }
  100% { transform: translate(0); clip-path: inset(0 0 0 0); }
}

/* Screen shake */
.screen-shake {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translate(0); }
  10% { transform: translate(-4px, 2px); }
  20% { transform: translate(3px, -3px); }
  30% { transform: translate(-2px, 4px); }
  40% { transform: translate(4px, -1px); }
  50% { transform: translate(-3px, 3px); }
  60% { transform: translate(2px, -4px); }
  70% { transform: translate(-4px, 1px); }
  80% { transform: translate(3px, -2px); }
  90% { transform: translate(-1px, 3px); }
}

/* Shutdown effect */
.shutdown .main-container {
  animation: shutdown-shrink 3s forwards;
}

@keyframes shutdown-shrink {
  0% { filter: brightness(1); transform: scale(1); }
  50% { filter: brightness(1.5); transform: scale(1, 0.005); }
  60% { filter: brightness(2); transform: scale(0.3, 0.005); }
  100% { filter: brightness(0); transform: scale(0, 0); }
}

/* ================================================================
   RESPONSIVE
   ================================================================ */
@media (max-width: 900px) {
  .main-container {
    grid-template-columns: 1fr;
    grid-template-rows: 35% 65%;
  }
  .image-panel {
    border-right: none;
    border-bottom: 1px solid #1a4a1a;
  }
}
`;
