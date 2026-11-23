export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9080/api';

export async function apiRequest(path, { method = 'GET', body, token, signal } = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  try {
    const response = await fetch(`${API_URL}${normalizedPath}`, {
      method,
      signal,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.message || `Request failed (${response.status})`), { status: response.status });
    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message?.toLowerCase().includes('fetch')) {
      throw Object.assign(new Error(`Could not connect to API server (${API_URL}). Please verify backend is running.`), { status: 503 });
    }
    throw error;
  }
}
