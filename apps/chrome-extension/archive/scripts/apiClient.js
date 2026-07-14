// OnPoint Extension Server API Client
// NOTE: Set BASE_URL to your deployed web app domain.
// For local development, use: http://localhost:3000
const BASE_URL = 'http://localhost:3000';

async function postJSON(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function getJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

 window.OnPointAPI = {
   status: () => getJSON('/api/ai/status'),
   generate: (prompt, type = 'design', provider = 'auto', model = 'flash') =>
     postJSON('/api/ai/generate', { prompt, type, provider, model }),
   chat: (prompt, provider = 'auto', model = 'flash') =>
     postJSON('/api/ai/generate', { prompt, type: 'chat', provider, model }),
   design: (prompt, type = 'design', provider = 'auto', model = 'flash') =>
     postJSON('/api/ai/design', { prompt, type, provider, model }),
   analyze: (prompt, provider = 'auto', model = 'pro') =>
     postJSON('/api/ai/analyze', { prompt, provider, model }),
   colorPalette: (description, style = 'modern', season = 'all-season', provider = 'auto', model = 'flash-lite') =>
     postJSON('/api/ai/color-palette', { description, style, season, provider, model }),
   virtualTryOn: (analysisType, data, provider = 'auto', model = 'pro') =>
     postJSON('/api/ai/virtual-tryon', { type: analysisType, data, provider, model }),
   analyzeImage: (imageUrl, provider = 'auto', model = 'flash') =>
     postJSON('/api/ai/analyze-image', { imageUrl, provider, model }),
 };