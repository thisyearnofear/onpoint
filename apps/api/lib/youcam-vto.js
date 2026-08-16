/**
 * YouCam API (Perfect Corp) — Apparel Virtual Try-On provider.
 *
 * REST integration against https://yce-api-01.makeupar.com (docs:
 * https://docs.perfectcorp.com/develop/introduction). Implements the
 * cloth-v4 task pipeline:
 *
 *   1. File API (/s2s/v2.0/file)      → presigned upload URL + file_id
 *      (only for base64/data-URI inputs; public URLs are passed through)
 *   2. Task API (/s2s/v2.0/task/cloth-v4)
 *      body {src_file_id|src_file_url, ref_file_id|ref_file_url,
 *            garment_category}        → task_id
 *   3. Poll  GET /s2s/v2.0/task/cloth-v4/{task_id}
 *      until task_status is success   → data.results.url
 *
 * Built for the YouCam API Skin AI & Apparel VTO Hackathon (Devpost,
 * deadline 2026-08-17 11:45 EDT): OnPoint routes its paid agent try-on
 * tier through YouCam's generative Apparel VTO when YOUCAM_API_KEY is
 * configured, falling back to Replicate IDM-VTON then Venice.
 *
 * Env:
 *   YOUCAM_API_KEY        (required — bearer token)
 *   YOUCAM_API_BASE_URL   (default https://yce-api-01.makeupar.com)
 *   YOUCAM_TIMEOUT_MS     (default 120000)
 */

const logger = require('./logger');

const YOUCAM_BASE = process.env.YOUCAM_API_BASE_URL || 'https://yce-api-01.makeupar.com';
const DEFAULT_TIMEOUT_MS = Number(process.env.YOUCAM_TIMEOUT_MS) || 120000;
const POLL_INTERVAL_MS = 1500;

function isConfigured() {
  return Boolean(process.env.YOUCAM_API_KEY);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.YOUCAM_API_KEY}`,
    'content-type': 'application/json',
  };
}

async function youcamFetch(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${YOUCAM_BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // non-JSON body (e.g. WAF interstitial) — surfaced below
  }

  if (!response.ok) {
    const errorCode = (payload && payload.error_code) || null;
    const detail = (payload && (payload.error || payload.message)) || '';
    const error = new Error(`YouCam API ${method} ${path} failed: ${response.status}${detail ? ` ${detail}` : ''}`);
    error.code = response.status === 401 ? 'YOUCAM_UNAUTHORIZED' : response.status === 429 ? 'YOUCAM_RATE_LIMITED' : 'YOUCAM_REQUEST_FAILED';
    error.status = response.status;
    error.youcamErrorCode = errorCode;
    throw error;
  }
  return payload;
}

/**
 * Upload a data URI (or raw base64) through the File API.
 * Returns the YouCam file_id.
 */
async function uploadImage(dataUri, fileName = 'image.jpg') {
  const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/s.exec(dataUri);
  if (!match) {
    throw new Error('YouCam upload requires a data URI (base64)');
  }
  const [, contentType, b64] = match;
  const buffer = Buffer.from(b64, 'base64');

  const init = await youcamFetch('/s2s/v2.0/file', {
    method: 'POST',
    body: {
      files: [
        {
          content_type: contentType,
          file_name: fileName,
          file_size: buffer.length,
        },
      ],
    },
  });

  const file = init?.data?.files?.[0];
  if (!file?.file_id || !file?.requests?.[0]?.url) {
    throw new Error('YouCam File API response missing file_id or upload URL');
  }

  const upload = file.requests[0];
  const putResponse = await fetch(upload.url, {
    method: upload.method || 'PUT',
    headers: {
      'Content-Type': upload.headers?.['Content-Type'] || contentType,
      ...(upload.headers?.['Content-Length'] ? { 'Content-Length': upload.headers['Content-Length'] } : {}),
    },
    body: buffer,
  });
  if (!putResponse.ok) {
    throw new Error(`YouCam file upload failed: ${putResponse.status}`);
  }
  return file.file_id;
}

/**
 * Resolve an image input (data URI or public URL) into the request field
 * pair expected by the cloth task API.
 */
async function resolveImage(input, role) {
  if (!input) {
    throw new Error(`YouCam try-on missing ${role} image`);
  }
  if (typeof input === 'string' && input.startsWith('http')) {
    return { [`${role}_file_url`]: input };
  }
  const fileId = await uploadImage(input, `${role}.jpg`);
  return { [`${role}_file_id`]: fileId };
}

/**
 * Create a cloth-v4 task and poll until completion.
 *
 * @param {object} opts
 * @param {string} opts.personImage   data URI or public URL (full-body person)
 * @param {string} opts.garmentImage  data URI or public URL (garment reference)
 * @param {string} [opts.garmentCategory='auto']  full_body|upper_body|lower_body|shoes|outer|auto
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{renderUrl: string, taskId: string, latencyMs: number, taskStatus: string}>}
 */
async function runClothTryOn({ personImage, garmentImage, garmentCategory = 'auto', timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const startedAt = Date.now();

  const [src, ref] = await Promise.all([
    resolveImage(personImage, 'src'),
    resolveImage(garmentImage, 'ref'),
  ]);

  const created = await youcamFetch('/s2s/v2.0/task/cloth-v4', {
    method: 'POST',
    body: { ...src, ...ref, garment_category: garmentCategory },
  });
  const taskId = created?.data?.task_id;
  if (!taskId) {
    throw new Error('YouCam cloth task created without task_id');
  }

  // Poll — the docs warn against abandoning a task mid-window (units still
  // charged), so we poll the full timeout, not a few attempts.
  let last = null;
  while (Date.now() - startedAt < timeoutMs) {
    last = await youcamFetch(`/s2s/v2.0/task/cloth-v4/${encodeURIComponent(taskId)}`);
    const status = last?.data?.task_status;
    if (status === 'success') {
      const renderUrl = last?.data?.results?.url;
      if (!renderUrl) {
        throw new Error('YouCam task succeeded but returned no result URL');
      }
      return { renderUrl, taskId, latencyMs: Date.now() - startedAt, taskStatus: status };
    }
    if (status === 'error') {
      const detail = last?.data?.error || 'unknown';
      const error = new Error(`YouCam cloth task failed: ${detail}`);
      error.code = 'YOUCAM_TASK_FAILED';
      error.status = 422;
      error.taskId = taskId;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const error = new Error('YouCam cloth task timed out');
  error.code = 'YOUCAM_TIMEOUT';
  error.status = 504;
  error.taskId = taskId;
  throw error;
}

/**
 * High-level entry used by the try-on engine: returns the rendered image
 * URL on success, throws on any failure (caller decides the fallback).
 */
async function tryOn({ personImage, garmentImage, garmentCategory = 'auto', timeoutMs }) {
  const result = await runClothTryOn({ personImage, garmentImage, garmentCategory, timeoutMs });
  logger.info('YouCam Apparel VTO render complete', {
    component: 'youcam-vto',
    taskId: result.taskId,
    latencyMs: result.latencyMs,
  });
  return result;
}

module.exports = {
  isConfigured,
  uploadImage,
  runClothTryOn,
  tryOn,
};
