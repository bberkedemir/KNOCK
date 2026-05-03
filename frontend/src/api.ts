/** api.ts — Backend API client for Terminal '73. */

const API_BASE = '/api';

export interface ChatResponse {
  text: string;
  phase: number;
  surrendered: boolean;
  surrender_type: string | null;
  current_image: string;
  pose: string;
}

export interface InpaintStatus {
  status: string | null;
  current_image: string;
  phase: number;
}

export async function sendMessage(
  sessionId: string,
  message: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chat API error (${res.status}): ${err}`);
  }
  return res.json();
}

export async function checkInpaintStatus(
  sessionId: string
): Promise<InpaintStatus> {
  const res = await fetch(`${API_BASE}/inpaint-status/${sessionId}`);
  if (!res.ok) throw new Error('Failed to check inpaint status');
  return res.json();
}

export function getImageUrl(filename: string): string {
  return `${API_BASE}/image/${filename}`;
}

export function getPoseUrl(pose: string, phase: number = 1): string {
  const valid = ['angry', 'idle', 'sad', 'tense', 'surrender'];
  let p = valid.includes(pose) ? pose : 'idle';
  
  if (phase >= 2) {
    const unarmedValid = ['angry', 'idle', 'tense', 'sad'];
    if (!unarmedValid.includes(p)) p = 'idle';
    return getImageUrl(`poses/soldier_unarmed_${p}.png`);
  }
  return getImageUrl(`poses/soldier_${p}.png`);
}

export async function triggerDebugInpaint(
  sessionId: string,
  target: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/debug/inpaint/${target}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message: 'DEBUG_TRIGGER' }),
  });
  if (!res.ok) throw new Error('Failed to trigger debug inpaint');
}
