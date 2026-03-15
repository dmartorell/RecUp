import { apiError } from './strings.js';

export async function summarize(transcript) {
  const response = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'UNKNOWN' }));
    throw new Error(apiError(body.error));
  }

  return response.json();
}
