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

	private async parseResponseBody(response: Response): Promise<unknown> {
		const contentType = response.headers.get('content-type');

		if (contentType?.includes('application/json')) {
			try {
				return await response.json();
			} catch {
				return null;
			}
		}

		const text = await response.text();
		if (!text) {
			return null;
		}

		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}

	private extractErrorMessage(payload: unknown): string {
		if (typeof payload === 'string' && payload.trim()) {
			return payload;
		}

		if (!payload || typeof payload !== 'object') {
			return 'API request failed';
		}

		const error = payload as ApiError;

		if (typeof error.detail === 'string' && error.detail.trim()) {
			return error.detail;
		}

		if (error.detail && typeof error.detail === 'object') {
			const message = error.detail.message;
			if (typeof message === 'string' && message.trim()) {
				return message;
			}
		}

		if (typeof error.message === 'string' && error.message.trim()) {
			return error.message;
		}

		return 'API request failed';
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

		const data = response.status === 204 ? null : await this.parseResponseBody(response);

		if (!response.ok) {
			throw new Error(this.extractErrorMessage(data));
		}

		if (response.status === 204) {
			return {} as T;
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
