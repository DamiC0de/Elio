import { supabase } from './supabase';

// VPS IP for dev, will be replaced by domain later
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://72.60.155.227:4000';

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export async function apiCall<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authToken = token ?? await getAuthToken();
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// Convenience wrapper matching axios-like interface used by hooks
export const api = {
  async get(path: string, token?: string) {
    const data = await apiCall(path, { token });
    return { data };
  },
  async patch(path: string, body: unknown, token?: string) {
    const data = await apiCall(path, { method: 'PATCH', body, token });
    return { data };
  },
  async delete(path: string, token?: string) {
    const data = await apiCall(path, { method: 'DELETE', token });
    return { data };
  },
  async post(path: string, body: unknown, token?: string) {
    const data = await apiCall(path, { method: 'POST', body, token });
    return { data };
  },
};

export function createWebSocket(token?: string): WebSocket {
  const wsUrl = API_BASE_URL.replace('http', 'ws');
  const url = token ? `${wsUrl}/ws?token=${token}` : `${wsUrl}/ws`;
  return new WebSocket(url);
}
