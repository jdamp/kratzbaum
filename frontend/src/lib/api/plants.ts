import { apiClient } from './client';
import type {
	PlantListItem,
	PlantDetail,
	CareEvent,
	CareEventType,
	PlantCreate,
	PlantUpdate
} from './types';

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
		return apiClient.get<PlantListItem[]>(`/plants${query ? `?${query}` : ''}`);
	},

	getPlant: (id: string) => {
		return apiClient.get<PlantDetail>(`/plants/${id}`);
	},

	createPlant: (data: PlantCreate) => {
		return apiClient.post<PlantListItem>('/plants', data);
	},

	uploadPhoto: (plantId: string, file: File, isPrimary: boolean = false) => {
		const formData = new FormData();
		formData.append('file', file);
		if (isPrimary) formData.append('is_primary', 'true');
		return apiClient.post<{ id: string; url: string }>(`/plants/${plantId}/photos?is_primary=${isPrimary}`, formData);
	},

	deletePhoto: (plantId: string, photoId: string) => {
		return apiClient.delete(`/plants/${plantId}/photos/${photoId}`);
	},

	setPrimaryPhoto: (plantId: string, photoId: string) => {
		return apiClient.post(`/plants/${plantId}/photos/${photoId}/primary`);
	},

	updatePlant: (id: string, data: PlantUpdate) => {
		return apiClient.put<PlantListItem>(`/plants/${id}`, data);
	},

	deletePlant: (id: string) => {
		return apiClient.delete(`/plants/${id}`);
	},

	recordCareEvent: (plantId: string, type: CareEventType, notes?: string, eventDate?: Date) => {
		return apiClient.post<CareEvent>(`/plants/${plantId}/care-events`, {
			event_type: type,
			event_date: (eventDate || new Date()).toISOString(),
			notes
		});
	},

	getCareHistory: (plantId: string) => {
		return apiClient.get<CareEvent[]>(`/plants/${plantId}/care-events`);
	},

	deleteCareEvent: (plantId: string, eventId: string) => {
		return apiClient.delete(`/plants/${plantId}/care-events/${eventId}`);
	}
};
