/** terminal.ts — Chat log rendering and typing effects. */

let chatLog: HTMLElement | null = null;

export function initTerminal(logElement: HTMLElement): void {
  chatLog = logElement;
}

/** Add a system message (dim green). */
export function appendSystemMessage(text: string): void {
  const line = createLine('system');
  line.textContent = `[SYS] ${text}`;
  appendAndScroll(line);
}

/** Add a user message with > prefix. */
export function appendUserMessage(text: string): void {
  const line = createLine('user');
  line.textContent = text;
  appendAndScroll(line);
}

/** Add a warning message (amber). */
export function appendWarning(text: string): void {
  const line = createLine('warning');
  line.textContent = `⚠ ${text}`;
  appendAndScroll(line);
}

/** Add a critical/error message (red). */
export function appendCritical(text: string): void {
  const line = createLine('critical');
  line.textContent = `█ ${text}`;
  appendAndScroll(line);
}

/** Add an AI message with character-by-character typing effect. */
export function appendAIMessage(text: string): Promise<void> {
  return new Promise((resolve) => {
    const line = createLine('ai');
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    line.appendChild(cursor);
    appendAndScroll(line);

    let i = 0;
    const speed = 25; // ms per character

    function type() {
      if (i < text.length) {
        // Insert character before cursor
        const charNode = document.createTextNode(text[i]);
        line.insertBefore(charNode, cursor);
        i++;
        scrollToBottom();
        setTimeout(type, speed + Math.random() * 15);
      } else {
        // Remove cursor when done
        cursor.remove();
        resolve();
      }
    }

    type();
  });
}

/** Add multiple warning lines with delays between them. */
export async function typeWarningSequence(messages: string[]): Promise<void> {
  for (const msg of messages) {
    appendWarning(msg);
    await delay(400);
  }
}

/** Add multiple critical lines with delays. */
export async function typeCriticalSequence(messages: string[]): Promise<void> {
  for (const msg of messages) {
    appendCritical(msg);
    await delay(300);
  }
}

/** Add an empty line separator. */
export function appendSeparator(): void {
  const line = createLine('system');
  line.textContent = '─'.repeat(50);
  line.style.opacity = '0.3';
  appendAndScroll(line);
}

/** Add a clickable button to the terminal. */
export function appendRetryButton(label: string, onClick: () => void): void {
  const line = createLine('system');
  const btn = document.createElement('button');
  btn.className = 'debug-btn'; // Re-use existing button style
  btn.style.marginTop = '10px';
  btn.style.display = 'inline-block';
  btn.textContent = label;
  btn.onclick = () => {
    btn.disabled = true;
    btn.textContent = 'PROCESSING...';
    onClick();
  };
  line.appendChild(btn);
  appendAndScroll(line);
}

// Helpers
function createLine(className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `chat-line ${className}`;
  return el;
}

function appendAndScroll(el: HTMLElement): void {
  if (!chatLog) return;
  chatLog.appendChild(el);
  scrollToBottom();
}

function scrollToBottom(): void {
  if (!chatLog) return;
  chatLog.scrollTop = chatLog.scrollHeight;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
