let rawApiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

// Ensures all requests go through the express /api route prefix
if (rawApiUrl && !rawApiUrl.endsWith('/api') && !rawApiUrl.endsWith('/api/')) {
  const cleanUrl = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
  rawApiUrl = `${cleanUrl}/api`;
}

const API_URL = rawApiUrl;

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  let token = '';
  try {
    token = localStorage.getItem('electromarket_token') || '';
  } catch (e) {
    // Evita crashes em SSR se aplicável
  }
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  if (options.params) {
    const cleanParamsObj: Record<string, string> = {};
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        cleanParamsObj[key] = val;
      }
    });
    const query = new URLSearchParams(cleanParamsObj).toString();
    if (query) {
      url += `?${query}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMsg = `Erro de rede HTTP (Código ${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMsg = errorData.error;
        }
      } catch (e) {
        // Se falhar ao parsear JSON
      }
      console.error(`[API Request Error] Falha na requisição para ${url}:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorMsg,
      });
      throw new Error(errorMsg);
    }

    return response.json() as Promise<T>;
  } catch (err: any) {
    console.warn(`[API Network Error] Falha de rede/conexão para ${url}:`, err);
    throw err;
  }
}

export const api = {
  get: async <T>(endpoint: string, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, { ...options, method: 'GET' });
  },
  post: async <T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
    });
  },
  put: async <T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
    });
  },
  delete: async <T>(endpoint: string, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, { ...options, method: 'DELETE' });
  }
};
