const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

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

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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

export function createWebSocket(token?: string): WebSocket {
  const wsUrl = API_BASE_URL.replace('http', 'ws');
  const url = token ? `${wsUrl}/ws?token=${token}` : `${wsUrl}/ws`;
  return new WebSocket(url);
}
