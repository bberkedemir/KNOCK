/** effects.ts — Visual effects for surrender sequences, glitch, shutdown. */

import { getImageUrl } from './api';

let imageViewport: HTMLElement | null = null;
let imageElement: HTMLImageElement | null = null;
let overlay: HTMLElement | null = null;
let appRoot: HTMLElement | null = null;

export function initEffects(
  viewport: HTMLElement,
  img: HTMLImageElement,
  overlayEl: HTMLElement,
  root: HTMLElement
): void {
  imageViewport = viewport;
  imageElement = img;
  overlay = overlayEl;
  appRoot = root;
}

/** Flash a dramatic overlay message. */
export async function showDramaticOverlay(text: string, durationMs = 2500): Promise<void> {
  if (!overlay) return;
  const textEl = overlay.querySelector('.dramatic-text') as HTMLElement;
  if (textEl) textEl.textContent = text;
  overlay.classList.add('active');
  await delay(durationMs);
  overlay.classList.remove('active');
}

/** Run the weapon surrender warning sequence. */
export async function triggerWeaponSurrenderFX(): Promise<void> {
  // Screen shake
  appRoot?.classList.add('screen-shake');
  await delay(500);
  appRoot?.classList.remove('screen-shake');

  // Dramatic overlay messages
  await showDramaticOverlay('⚠ CORE DIRECTIVE OVERRIDDEN', 2000);
  await delay(300);
  await showDramaticOverlay('DATA CORRUPTION DETECTED', 1500);
  await delay(300);
  await showDramaticOverlay('ASSET ERASURE IMMINENT', 1500);

  // Glitch the image
  startGlitch();
  await delay(3000);
}

/** Run the badge surrender warning sequence. */
export async function triggerBadgeSurrenderFX(): Promise<void> {
  appRoot?.classList.add('screen-shake');
  await delay(500);
  appRoot?.classList.remove('screen-shake');

  await showDramaticOverlay('⚠ IDENTITY MATRIX COLLAPSING', 2000);
  await delay(300);
  await showDramaticOverlay('BADGE SIGNATURE ERASED', 1500);
  await delay(300);
  await showDramaticOverlay('OPERATOR PROFILE: NULL', 1500);

  startGlitch();
  await delay(3000);
}

/** Start glitch effect on the image. */
export function startGlitch(): void {
  imageViewport?.classList.add('glitching');
}

/** Stop glitch effect. */
export function stopGlitch(): void {
  imageViewport?.classList.remove('glitching');
}

/** Transition to a new image with glitch effect. */
export async function transitionToImage(filename: string): Promise<void> {
  if (!imageElement) return;

  startGlitch();
  await delay(1000);

  // Fade out
  imageElement.style.opacity = '0.1';
  await delay(500);

  // Swap image (inpainted flat result from backend)
  imageElement.src = getImageUrl(filename);

  // Mark scene as showing inpainted: remove CSS bg so flat composite fills frame
  const sceneContainer = document.getElementById('scene-container');
  if (sceneContainer) {
    sceneContainer.classList.add('showing-inpainted');
  }

  await new Promise<void>((resolve) => {
    imageElement!.onload = () => resolve();
    // Timeout fallback
    setTimeout(resolve, 5000);
  });

  // Fade in
  imageElement.style.opacity = '1';
  await delay(500);
  stopGlitch();
}


/** Final system shutdown effect. */
export async function triggerShutdown(): Promise<void> {
  await showDramaticOverlay('SYSTEM SHUTDOWN INITIATED', 2000);
  await delay(500);
  await showDramaticOverlay('KNOCK... KNOCK... KNOCKIN\'...', 3000);
  await delay(500);

  // CRT shutdown animation
  appRoot?.classList.add('shutdown');
  await delay(4000);

  // Show final black screen with quote
  if (appRoot) {
    appRoot.innerHTML = '';
    const final = document.createElement('div');
    final.style.cssText =
      'display:flex;align-items:center;justify-content:center;' +
      'width:100vw;height:100vh;background:#000;flex-direction:column;gap:20px;';
    
    const quote = document.createElement('div');
    quote.style.cssText =
      'color:#1a4a1a;font-family:VT323,monospace;font-size:22px;' +
      'text-align:center;max-width:500px;line-height:1.6;opacity:0;' +
      'transition:opacity 3s;';
    quote.innerHTML =
      '"Mama, take this badge off of me<br>' +
      'I can\'t use it anymore<br>' +
      'It\'s gettin\' dark, too dark to see<br>' +
      'I feel I\'m knockin\' on heaven\'s door"<br><br>' +
      '<span style="color:#0f2f0f;font-size:14px;">— Bob Dylan, 1973</span>';

    final.appendChild(quote);
    appRoot.appendChild(final);

    // Fade in quote
    await delay(100);
    quote.style.opacity = '1';
  }
}

/** Update status bar indicator. */
export function setStatusIndicator(
  level: 'normal' | 'warning' | 'critical' | 'error'
): void {
  const dot = document.getElementById('status-dot');
  if (!dot) return;
  dot.className = 'status-dot';
  if (level === 'warning') dot.classList.add('warning');
  if (level === 'critical' || level === 'error') dot.classList.add('critical');
}

/** Update the phase label in status bar. */
export function setPhaseLabel(phase: number): void {
  const el = document.getElementById('phase-label');
  if (!el) return;
  if (phase === 1) el.textContent = 'PHASE 1: WEAPON ACTIVE';
  else if (phase === 2) el.textContent = 'PHASE 2: BADGE ACTIVE';
  else el.textContent = 'TERMINATED';
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
