import type { ApiError } from './types';

const BASE_URL = '/api';

class ApiClient {
	private token: string | null = null;

	constructor() {
		if (typeof window !== 'undefined') {
			this.token = localStorage.getItem('token');
		}
	}

	setToken(token: string | null) {
		this.token = token;
		if (typeof window !== 'undefined') {
			if (token) {
				localStorage.setItem('token', token);
			} else {
				localStorage.removeItem('token');
			}
		}
	}

	async request<T>(
		path: string,
		options: RequestInit = {}
	): Promise<T> {
		const url = `${BASE_URL}${path}`;
		const headers = new Headers(options.headers || {});

		if (this.token) {
			headers.set('Authorization', `Bearer ${this.token}`);
		}

		if (options.body && !(options.body instanceof FormData)) {
			headers.set('Content-Type', 'application/json');
		}

		const response = await fetch(url, {
			...options,
			headers
		});

		if (response.status === 204) {
			return {} as T;
		}

		const data = await response.json();

		if (!response.ok) {
			const error = data as ApiError;
			throw new Error(error.detail?.message || 'API request failed');
		}

		return data as T;
	}

	async get<T>(path: string, options: RequestInit = {}): Promise<T> {
		return this.request<T>(path, { ...options, method: 'GET' });
	}

	async post<T>(path: string, body?: any, options: RequestInit = {}): Promise<T> {
		return this.request<T>(path, {
			...options,
			method: 'POST',
			body: body instanceof FormData ? body : JSON.stringify(body)
		});
	}

	async put<T>(path: string, body?: any, options: RequestInit = {}): Promise<T> {
		return this.request<T>(path, {
			...options,
			method: 'PUT',
			body: body instanceof FormData ? body : JSON.stringify(body)
		});
	}

	async delete<T>(path: string, options: RequestInit = {}): Promise<T> {
		return this.request<T>(path, { ...options, method: 'DELETE' });
	}
}

export const apiClient = new ApiClient();
