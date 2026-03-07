export async function summarize(transcript) {
  const response = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(body.error || `Error ${response.status}`);
  }

  return response.json();
}
