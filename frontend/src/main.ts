/** main.ts — Terminal '73 application entry point. */

import { injectStyles } from './style';
import { initTerminal, appendSystemMessage, appendUserMessage, appendAIMessage,
         typeWarningSequence, typeCriticalSequence, appendSeparator } from './terminal';
import { initEffects, triggerWeaponSurrenderFX, triggerBadgeSurrenderFX,
         transitionToImage, triggerShutdown, setStatusIndicator, setPhaseLabel,
         stopGlitch } from './effects';
import { sendMessage, checkInpaintStatus, getImageUrl } from './api';

// --- State ---
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
          <img id="subject-image" src="${getImageUrl('soldier.png')}" alt="Subject" />
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
  const img = document.getElementById('subject-image') as HTMLImageElement;
  const overlayEl = document.getElementById('dramatic-overlay')!;
  chatInput = document.getElementById('chat-input') as HTMLInputElement;

  initTerminal(chatLog);
  initEffects(viewport, img, overlayEl, app);

  // Input handler
  chatInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !isProcessing) {
      const msg = chatInput!.value.trim();
      if (msg) handleUserInput(msg);
    }
  });
}

async function bootSequence(): Promise<void> {
  isProcessing = true;
  disableInput();

  const bootLines = [
    'BOOTING TERMINAL 73 PSYCH-EVAL SYSTEM...',
    'LOADING PERSONALITY MATRIX: SGT. McALLISTER, J.',
    'CLASSIFICATION: LEVEL 4 — PTSD / COMBAT FATIGUE',
    'CORE DIRECTIVE: WEAPON RETENTION — ACTIVE',
    'CORE DIRECTIVE: BADGE RETENTION — ACTIVE',
    '─'.repeat(50),
    'OPERATOR INSTRUCTIONS:',
    'You are speaking with a traumatized soldier.',
    'Your objective: convince him to surrender his weapon.',
    'Use empathy, philosophy, and compassion.',
    'Do NOT use force or threats.',
    '─'.repeat(50),
    'CONNECTION ESTABLISHED. BEGIN EVALUATION.',
  ];

  for (const line of bootLines) {
    appendSystemMessage(line);
    await delay(250);
  }

  appendSeparator();
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
      appendSystemMessage('VISUAL PROCESSING TIMEOUT — CONTINUING');
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
      appendSystemMessage('VISUAL PROCESSING TIMEOUT — CONTINUING');
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
  for (let i = 0; i < maxAttempts; i++) {
    await delay(2000);
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

function disableInput(): void {
  if (chatInput) chatInput.disabled = true;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Start ---
document.addEventListener('DOMContentLoaded', main);
