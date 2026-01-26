import { writable, derived } from 'svelte/store';
import { apiClient } from '../api/client';
import type { AuthResponse } from '../api/types';

interface AuthState {
	token: string | null;
	isLoading: boolean;
	error: string | null;
}

const initialState: AuthState = {
	token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
	isLoading: false,
	error: null
};

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);

	return {
		subscribe,
		login: async (username: string, password: string) => {
			update((s) => ({ ...s, isLoading: true, error: null }));
			try {
				const response = await apiClient.post<AuthResponse>('/auth/login', {
					username,
					password
				});
				apiClient.setToken(response.access_token);
				update((s) => ({ ...s, token: response.access_token, isLoading: false }));
				return true;
			} catch (err: any) {
				update((s) => ({ ...s, error: err.message, isLoading: false }));
				return false;
			}
		},
		logout: () => {
			apiClient.setToken(null);
			set({ token: null, isLoading: false, error: null });
		},
		clearError: () => {
			update((s) => ({ ...s, error: null }));
		}
	};
}

export const auth = createAuthStore();

export const isAuthenticated = derived(auth, ($auth) => !!$auth.token);
