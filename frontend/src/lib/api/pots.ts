import { apiClient } from './client';
import type { Pot, PotDetail } from './types';

export const potService = {
	getPots: () => {
		return apiClient.get<Pot[]>(`/pots`);
	},

	getAvailablePots: () => {
		return apiClient.get<Pot[]>(`/pots/available`);
	},

	getPot: (id: string) => {
		return apiClient.get<PotDetail>(`/pots/${id}`);
	},

	createPot: (data: FormData) => {
		return apiClient.post<Pot>('/pots', data);
	},

	updatePot: (id: string, data: any) => {
		return apiClient.put<Pot>(`/pots/${id}`, data);
	},

	deletePot: (id: string) => {
		return apiClient.delete(`/pots/${id}`);
	}
};
