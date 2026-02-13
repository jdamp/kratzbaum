import { apiClient } from './client';
import { ReminderType, type ReminderListItem } from './types';

function isReminderListItem(value: unknown): value is ReminderListItem {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const reminder = value as Record<string, unknown>;
	return (
		typeof reminder.id === 'string' &&
		typeof reminder.plant_id === 'string' &&
		typeof reminder.plant_name === 'string' &&
		(reminder.reminder_type === ReminderType.WATERING ||
			reminder.reminder_type === ReminderType.FERTILIZING) &&
		typeof reminder.next_due === 'string' &&
		typeof reminder.is_enabled === 'boolean' &&
		typeof reminder.created_at === 'string'
	);
}

function parseReminderList(payload: unknown): ReminderListItem[] {
	if (!Array.isArray(payload) || !payload.every(isReminderListItem)) {
		throw new Error('Invalid reminder list response from API');
	}

	return payload;
}

function parseReminder(payload: unknown): ReminderListItem {
	if (!isReminderListItem(payload)) {
		throw new Error('Invalid reminder response from API');
	}

	return payload;
}

export const reminderService = {
	getReminders: async () => {
		const response = await apiClient.get<unknown>(`/reminders`);
		return parseReminderList(response);
	},

	getUpcomingReminders: async (days: number = 7) => {
		const response = await apiClient.get<unknown>(`/reminders/upcoming?days=${days}`);
		return parseReminderList(response);
	},

	deleteReminder: (id: string) => {
		return apiClient.delete(`/reminders/${id}`);
	},

	snoozeReminder: async (id: string, hours: number) => {
		const response = await apiClient.post<unknown>(`/reminders/${id}/snooze`, {
			snooze_hours: hours
		});
		return parseReminder(response);
	}
};
