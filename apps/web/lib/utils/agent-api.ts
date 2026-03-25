/**
 * Agent API Client
 * 
 * Utilities for calling agent API endpoints.
 * Supports both Vercel serverless (default) and Hetzner backend.
 * 
 * Configure via environment variable:
 * - NEXT_PUBLIC_AGENT_API_URL=https://api.onpoint.famile.xyz (Hetzner)
 * - Leave empty to use Vercel serverless functions (default)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || '';

/**
 * Build full API URL for agent endpoint
 * If NEXT_PUBLIC_AGENT_API_URL is not set, uses relative path (Vercel)
 */
export function getAgentApiUrl(endpoint: string): string {
  if (API_BASE_URL) {
    // Remove trailing slash from base and leading slash from endpoint
    const base = API_BASE_URL.replace(/\/$/, '');
    const path = endpoint.replace(/^\//, '');
    return `${base}/${path}`;
  }
  // Relative path for Vercel serverless
  return `/${endpoint}`;
}

/**
 * Fetch wrapper for agent API calls
 * Automatically handles base URL and CORS headers
 */
export async function fetchAgentApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = getAgentApiUrl(endpoint);
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add CORS header for cross-origin requests
  if (API_BASE_URL) {
    defaultHeaders['Accept'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: API_BASE_URL ? 'omit' : 'same-origin',
  });

  return response;
}

/**
 * Typed fetch wrapper for GET requests
 */
export async function getAgentApi<T>(endpoint: string): Promise<T> {
  const response = await fetchAgentApi(endpoint, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * Typed fetch wrapper for POST requests
 */
export async function postAgentApi<T, B = unknown>(
  endpoint: string,
  body?: B
): Promise<T> {
  const response = await fetchAgentApi(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * Typed fetch wrapper for PATCH requests
 */
export async function patchAgentApi<T, B = unknown>(
  endpoint: string,
  body?: B
): Promise<T> {
  const response = await fetchAgentApi(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  
  return response.json();
}
