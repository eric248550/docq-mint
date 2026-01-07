/**
 * API client utilities for making authenticated requests
 */

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        error: data.error || 'Request failed',
        status: response.status,
      };
    }

    return {
      data,
      status: response.status,
    };
  } catch (error) {
    console.error('API request error:', error);
    return {
      error: error instanceof Error ? error.message : 'Request failed',
      status: 500,
    };
  }
}

/**
 * Make authenticated request with Firebase token
 */
export async function authenticatedRequest<T = any>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

