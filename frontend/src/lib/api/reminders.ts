import { apiClient } from './client';
import type { Reminder } from './types';

export const reminderService = {
	getReminders: () => {
		return apiClient.get<Reminder[]>(`/reminders`);
	},

	getUpcomingReminders: () => {
		return apiClient.get<Reminder[]>(`/reminders/upcoming`);
	},

	getOverdueReminders: () => {
		return apiClient.get<Reminder[]>(`/reminders/overdue`);
	},

	getReminder: (id: string) => {
		return apiClient.get<Reminder>(`/reminders/${id}`);
	},

	createReminder: (data: any) => {
		return apiClient.post<Reminder>('/reminders', data);
	},

	updateReminder: (id: string, data: any) => {
		return apiClient.put<Reminder>(`/reminders/${id}`, data);
	},

	deleteReminder: (id: string) => {
		return apiClient.delete(`/reminders/${id}`);
	},

	completeReminder: (id: string) => {
		return apiClient.post(`/reminders/${id}/complete`);
	},

	snoozeReminder: (id: string, hours: number) => {
		return apiClient.post(`/reminders/${id}/snooze`, { snooze_hours: hours });
	},

	subscribeToPush: (subscription: PushSubscription) => {
		return apiClient.post('/push/subscribe', subscription);
	},

	unsubscribeFromPush: (endpoint: string) => {
		return apiClient.delete(`/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`);
	}
};
