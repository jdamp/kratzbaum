import { apiClient } from './client';
import type { Plant, PlantDetail, CareEvent, CareEventType } from './types';

export const plantService = {
	getPlants: (params?: {
		sort?: string;
		order?: string;
		species?: string;
		needs_water?: boolean;
	}) => {
		const searchParams = new URLSearchParams();
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) searchParams.append(key, value.toString());
			});
		}
		const query = searchParams.toString();
		return apiClient.get<{ items: Plant[]; total: number }>(`/plants${query ? `?${query}` : ''}`);
	},

	getPlant: (id: string) => {
		return apiClient.get<PlantDetail>(`/plants/${id}`);
	},

	createPlant: (data: FormData) => {
		return apiClient.post<Plant>('/plants', data);
	},

	updatePlant: (id: string, data: any) => {
		return apiClient.put<Plant>(`/plants/${id}`, data);
	},

	deletePlant: (id: string) => {
		return apiClient.delete(`/plants/${id}`);
	},

	recordCareEvent: (plantId: string, type: CareEventType, notes?: string) => {
		return apiClient.post<CareEvent>(`/plants/${plantId}/care-events`, {
			event_type: type,
			event_date: new Date().toISOString(),
			notes
		});
	},

	getCareHistory: (plantId: string) => {
		return apiClient.get<CareEvent[]>(`/plants/${plantId}/care-events`);
	}
};
