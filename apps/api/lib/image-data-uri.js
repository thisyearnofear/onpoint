/**
 * Normalize any render image form (data URI, http(s) URL, raw base64) into
 * a data URI. Throws if the input is unusable or a URL fetch fails.
 * Shared by render-persisting routes (agent-tryon, pair).
 */
async function ensureDataUri(image) {
  if (typeof image !== 'string' || image.length === 0) {
    throw new Error('Render image is empty');
  }
  if (image.startsWith('data:')) return image;
  if (image.startsWith('http://') || image.startsWith('https://')) {
    const response = await fetch(image);
    if (!response.ok) throw new Error(`Failed to fetch render image: ${response.status}`);
    const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  }
  // Raw base64 payload
  return `data:image/jpeg;base64,${image}`;
}

module.exports = { ensureDataUri };
