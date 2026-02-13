import { apiClient } from './client';
import type { PlantNetSettings, PlantNetSettingsUpdate } from './types';

export const settingsService = {
	getPlantNetSettings: () => {
		return apiClient.get<PlantNetSettings>('/settings/plantnet');
	},

	updatePlantNetSettings: (data: PlantNetSettingsUpdate) => {
		return apiClient.put<PlantNetSettings>('/settings/plantnet', data);
	}
};
