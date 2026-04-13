// Centralized API helper for TrendHive v2
// Configure via VITE_API_URL (recommended) e.g. http://localhost:8000
const DEFAULT_API_URL = "http://localhost:8000";

export const API_BASE = (import.meta?.env?.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "");

/**
 * Fetch JSON from TrendHive backend.
 * @param {string} path - e.g. "/areas"
 */
export async function api(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (e) {
    // Keep UI resilient when backend isn't running.
    console.warn("API error:", path, e);
    return null;
  }
}
