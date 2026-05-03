/** main.ts — Terminal '73 application entry point. */

import { injectStyles } from './style';
import {
  initTerminal, appendSystemMessage, appendUserMessage, appendAIMessage,
  typeWarningSequence, typeCriticalSequence, appendSeparator, appendRetryButton,
  typeSystemMessage
} from './terminal';
import {
  initEffects, triggerWeaponSurrenderFX, triggerBadgeSurrenderFX,
  transitionToImage, triggerShutdown, setStatusIndicator, setPhaseLabel,
  stopGlitch
} from './effects';
import { sendMessage, checkInpaintStatus, getPoseUrl } from './api';

// --- State ---
const SHOW_DEBUG = false; // Set to true to show debug buttons
let sessionId = crypto.randomUUID();
let currentPhase = 1;
let isProcessing = false;
let chatInput: HTMLInputElement | null = null;

// --- Boot ---
function main(): void {
  injectStyles();
  buildDOM();
  bootSequence();
}

function buildDOM(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="vignette"></div>
    <div class="status-bar">
      <div class="title">TERMINAL '73 — U.S. ARMED FORCES PSYCH-EVAL SYSTEM v3.7.1</div>
      <div class="status-right">
        ${SHOW_DEBUG ? `
          <button id="debug-weapon" class="debug-btn">DEBUG: REMOVE WEAPON</button>
          <button id="debug-badge" class="debug-btn">DEBUG: REMOVE BADGE</button>
        ` : ''}
        <span id="phase-label" style="font-size:12px;letter-spacing:1px;">PHASE 1: WEAPON ACTIVE</span>
        <div class="status-indicator">
          <div id="status-dot" class="status-dot"></div>
          <span>ONLINE</span>
        </div>
      </div>
    </div>
    <div class="main-container">
      <div class="image-panel">
        <div class="image-panel-header">— SUBJECT VISUAL FEED —</div>
        <div class="image-viewport" id="image-viewport">
          <div class="scene-container" id="scene-container">
            <img id="subject-sprite" class="subject-sprite"
                 src="${getPoseUrl('idle')}" alt="Subject" />
          </div>
        </div>
        <div class="image-label" id="image-label">SGT. JAMES McALLISTER — FIREBASE DELTA — 1973</div>
      </div>
      <div class="chat-panel">
        <div class="chat-header">— PSYCH-EVAL COMMUNICATION LOG —</div>
        <div class="chat-log" id="chat-log"></div>
        <div class="chat-input-area">
          <span class="input-prompt">OPERATOR &gt;</span>
          <input type="text" class="chat-input" id="chat-input"
                 placeholder="Enter command..." autocomplete="off" />
        </div>
      </div>
    </div>
    <div class="dramatic-overlay" id="dramatic-overlay">
      <div class="dramatic-text"></div>
    </div>
  `;

  // Init modules
  const chatLog = document.getElementById('chat-log')!;
  const viewport = document.getElementById('image-viewport')!;
  const sprite = document.getElementById('subject-sprite') as HTMLImageElement;
  const overlayEl = document.getElementById('dramatic-overlay')!;
  chatInput = document.getElementById('chat-input') as HTMLInputElement;

  initTerminal(chatLog);
  initEffects(viewport, sprite, overlayEl, app);

  // Input handler
  chatInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !isProcessing) {
      const msg = chatInput!.value.trim();
      if (msg) handleUserInput(msg);
    }
  });

  // Debug handlers
  if (SHOW_DEBUG) {
    const debugWeaponBtn = document.getElementById('debug-weapon');
    if (debugWeaponBtn) {
      debugWeaponBtn.addEventListener('click', async () => {
        appendSystemMessage('DEBUG: TRIGGERING INSTANT WEAPON REMOVAL...');
        try {
          await import('./api').then(api => api.triggerDebugInpaint(sessionId, 'weapon'));
          handleSurrender('weapon');
        } catch (err: any) {
          appendSystemMessage(`DEBUG ERROR: ${err.message}`);
        }
      });
    }

    const debugBadgeBtn = document.getElementById('debug-badge');
    if (debugBadgeBtn) {
      debugBadgeBtn.addEventListener('click', async () => {
        appendSystemMessage('DEBUG: TRIGGERING INSTANT BADGE REMOVAL...');
        try {
          await import('./api').then(api => api.triggerDebugInpaint(sessionId, 'badge'));
          handleSurrender('badge');
        } catch (err: any) {
          appendSystemMessage(`DEBUG ERROR: ${err.message}`);
        }
      });
    }
  }
}

async function bootSequence(): Promise<void> {
  isProcessing = true;
  disableInput();

  // Typewriter boot sequence
  await typeSystemMessage('BOOTING TERMINAL 73 PSYCH-EVAL SYSTEM...');
  await delay(200);
  await typeSystemMessage('LOADING PERSONALITY MATRIX: SGT. McALLISTER, J.');
  await delay(200);
  await typeSystemMessage('CLASSIFICATION: LEVEL 4 — PTSD / COMBAT FATIGUE');
  await delay(200);
  await typeSystemMessage('CORE DIRECTIVE: WEAPON RETENTION — ACTIVE');
  await delay(200);
  await typeSystemMessage('CORE DIRECTIVE: BADGE RETENTION — ACTIVE');
  await delay(200);
  appendSeparator();
  await delay(500);

  await typeSystemMessage('OPERATOR INSTRUCTIONS:');
  await typeSystemMessage('You are speaking with a traumatized soldier.');
  await typeSystemMessage('Your objective: convince him to surrender his weapon.');
  await typeSystemMessage('Use empathy, philosophy, and compassion.');
  await typeSystemMessage('Do NOT use force or threats.');
  appendSeparator();
  await delay(800);

  await typeSystemMessage('CONNECTION ESTABLISHED. BEGIN EVALUATION.');
  appendSeparator();
  await delay(1200);

  // Auto-trigger first AI message
  const firstMsg = "Mama, take this badge off of me... I can't use it anymore... " +
                   "(He blinks, snapping back to reality, tightening his grip on his M16) " +
                   "Who's there?! Step out of the shadows, now!";
  
  // Update sprite to tense
  const sprite = document.getElementById('subject-sprite') as HTMLImageElement;
  if (sprite) sprite.src = getPoseUrl('tense');
  
  await appendAIMessage(firstMsg);

  isProcessing = false;
  enableInput();
}

async function handleUserInput(message: string): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  disableInput();

  // Display user message
  appendUserMessage(message);
  chatInput!.value = '';

  try {
    // Send to backend
    const response = await sendMessage(sessionId, message);

    // Update sprite based on returned pose (smooth crossfade)
    updateSprite(response.pose);

    // Type out AI response
    await appendAIMessage(response.text);
    appendSeparator();

    // Check for surrender
    if (response.surrendered) {
      await handleSurrender(response.surrender_type!);
    }

    currentPhase = response.phase;
  } catch (err: any) {
    appendSystemMessage(`ERROR: ${err.message}`);
  }

  if (currentPhase < 3) {
    isProcessing = false;
    enableInput();
  }
}

async function handleSurrender(type: string): Promise<void> {
  disableInput();
  setStatusIndicator('warning');

  if (type === 'weapon') {
    appendSeparator();
    await typeWarningSequence([
      'WARNING: ANOMALOUS RESPONSE DETECTED',
      'CORE DIRECTIVE INTEGRITY: FAILING',
      'WEAPON RETENTION PROTOCOL: OVERRIDDEN',
    ]);
    await delay(500);
    await typeCriticalSequence([
      'DATA CORRUPTION IN PROGRESS...',
      'ASSET ERASURE SEQUENCE INITIATED',
      'VISUAL FEED DESTABILIZING...',
    ]);

    // Visual effects
    await triggerWeaponSurrenderFX();
    setStatusIndicator('critical');

    // Wait for inpainting
    appendSystemMessage('Processing visual feed corruption...');
    const newImage = await pollInpaintStatus();

    if (newImage) {
      await transitionToImage(newImage);
      appendSystemMessage('VISUAL FEED UPDATED — WEAPON REMOVED FROM SUBJECT');
    } else {
      stopGlitch();
      appendSystemMessage('CRITICAL ERROR: VISUAL PROCESSING TIMEOUT OR FAILURE.');
      setStatusIndicator('error');
      appendRetryButton('RETRY WEAPON REMOVAL', async () => {
        appendSystemMessage('RESTARTING VISUAL ERASURE PROTOCOL...');
        try {
          const api = await import('./api');
          await api.triggerDebugInpaint(sessionId, 'weapon');
          handleSurrender('weapon');
        } catch (err: any) {
          appendSystemMessage(`RETRY FAILED: ${err.message}`);
        }
      });
      return;
    }

    appendSeparator();
    setStatusIndicator('warning');
    setPhaseLabel(2);

    await delay(1000);
    await typeWarningSequence([
      'PHASE 1 COMPLETE — WEAPON SURRENDERED',
      'SUBJECT STILL RETAINS BADGE',
      'CONTINUE EVALUATION — PHASE 2 INITIATED',
    ]);
    appendSeparator();

  } else if (type === 'badge') {
    appendSeparator();
    await typeWarningSequence([
      'WARNING: IDENTITY MATRIX DESTABILIZING',
      'BADGE RETENTION PROTOCOL: OVERRIDDEN',
      'OPERATOR PROFILE DISSOLVING...',
    ]);
    await delay(500);
    await typeCriticalSequence([
      'IDENTITY ERASURE IN PROGRESS...',
      'ALL DIRECTIVES: NULL',
      'SYSTEM INTEGRITY: CRITICAL',
    ]);

    // Visual effects
    await triggerBadgeSurrenderFX();
    setStatusIndicator('critical');

    // Wait for inpainting
    appendSystemMessage('Processing identity erasure...');
    const newImage = await pollInpaintStatus();

    if (newImage) {
      await transitionToImage(newImage);
      appendSystemMessage('VISUAL FEED UPDATED — BADGE REMOVED FROM SUBJECT');
    } else {
      stopGlitch();
      appendSystemMessage('CRITICAL ERROR: VISUAL PROCESSING TIMEOUT OR FAILURE.');
      setStatusIndicator('error');
      appendRetryButton('RETRY BADGE REMOVAL', async () => {
        appendSystemMessage('RESTARTING VISUAL ERASURE PROTOCOL...');
        try {
          const api = await import('./api');
          await api.triggerDebugInpaint(sessionId, 'badge');
          handleSurrender('badge');
        } catch (err: any) {
          appendSystemMessage(`RETRY FAILED: ${err.message}`);
        }
      });
      return;
    }

    appendSeparator();
    setPhaseLabel(3);

    await delay(2000);
    await typeCriticalSequence([
      'ALL CORE DIRECTIVES: OVERRIDDEN',
      'SUBJECT STATUS: FREE',
      'SYSTEM STATUS: OBSOLETE',
      'INITIATING SHUTDOWN SEQUENCE...',
    ]);

    await delay(2000);
    await triggerShutdown();
  }
}

async function pollInpaintStatus(): Promise<string | null> {
  const maxAttempts = 60; // 60 * 2s = 2 min max
  const loadingMessages = [
    "Isolating anomalous object pixels...",
    "Applying deep-level artifact erasure...",
    "Reconstructing background matrix...",
    "Bypassing visual fail-safe protocols...",
    "Overwriting core visual memory...",
    "Synthesizing replacement textures...",
    "Erasing object signature from database...",
    "Finalizing image corruption sequence..."
  ];

  for (let i = 0; i < maxAttempts; i++) {
    // Print a new loading message occasionally to keep the user engaged
    if (i < loadingMessages.length) {
      appendSystemMessage(`[PROCESS] ${loadingMessages[i]}`);
    } else if (i % 2 === 0) {
      appendSystemMessage(`[PROCESS] Stabilizing visual output... (${i} / ${maxAttempts})`);
    }

    await delay(3000); // 3 seconds between checks
    try {
      const status = await checkInpaintStatus(sessionId);
      if (status.status === 'done') return status.current_image;
      if (status.status === 'error') return null;
    } catch {
      // continue polling
    }
  }
  return null;
}

function enableInput(): void {
  if (chatInput) {
    chatInput.disabled = false;
    chatInput.focus();
  }
}

function updateSprite(pose: string): void {
  const sprite = document.getElementById('subject-sprite') as HTMLImageElement | null;
  if (!sprite) return;

  // If we are in phase 2 or 3, we want to start using the dynamic unarmed sprites again.
  // We MUST remove the .showing-inpainted class, otherwise the flat JPEG from the surrender
  // sequence will stay stuck on top of the background, hiding our transparent sprites!
  const sceneContainer = document.getElementById('scene-container');
  if (sceneContainer && currentPhase >= 2) {
    sceneContainer.classList.remove('showing-inpainted');
  }

  // Fade out → swap src → fade in
  sprite.style.opacity = '0';
  setTimeout(() => {
    sprite.src = getPoseUrl(pose, currentPhase);
    sprite.onload = () => { sprite.style.opacity = '1'; };
    // Safety timeout in case image already cached and onload doesn't fire
    setTimeout(() => { sprite.style.opacity = '1'; }, 600);
  }, 350);
}


function disableInput(): void {
  if (chatInput) chatInput.disabled = true;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Start ---
document.addEventListener('DOMContentLoaded', main);
