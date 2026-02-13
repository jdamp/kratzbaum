import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FrequencyType, ReminderType, type Reminder } from '$lib/api/types';
import { reminderService } from '$lib/api/reminders';
import RemindersPage from './+page.svelte';

vi.mock('$lib/api/reminders', () => ({
	reminderService: {
		getReminders: vi.fn(),
		completeReminder: vi.fn(),
		snoozeReminder: vi.fn()
	}
}));

function createReminder(overrides: Partial<Reminder> = {}): Reminder {
	const now = new Date().toISOString();
	return {
		id: 'reminder-1',
		plant_id: 'plant-1',
		reminder_type: ReminderType.WATERING,
		frequency_type: FrequencyType.INTERVAL,
		frequency_value: 3,
		specific_days: null,
		preferred_time: '08:00:00',
		is_enabled: true,
		dormant_start: null,
		dormant_end: null,
		next_due: now,
		created_at: now,
		updated_at: now,
		...overrides
	};
}

describe('Reminders route', () => {
	const getRemindersMock = vi.mocked(reminderService.getReminders);
	const completeReminderMock = vi.mocked(reminderService.completeReminder);
	const snoozeReminderMock = vi.mocked(reminderService.snoozeReminder);

	beforeEach(() => {
		getRemindersMock.mockReset();
		completeReminderMock.mockReset();
		snoozeReminderMock.mockReset();

		getRemindersMock.mockResolvedValue([]);
		completeReminderMock.mockResolvedValue(undefined);
		snoozeReminderMock.mockResolvedValue(undefined);
	});

	it('renders empty state when no reminders are returned', async () => {
		render(RemindersPage);

		await waitFor(() => expect(getRemindersMock).toHaveBeenCalledTimes(1));
		expect(screen.getByText('No reminders set up yet.')).toBeInTheDocument();
	});

	it('renders reminders and supports snoozing', async () => {
		const reminder = createReminder({
			next_due: '2000-01-01T00:00:00Z'
		});

		getRemindersMock.mockResolvedValue([reminder]);
		render(RemindersPage);

		expect(await screen.findByText('watering')).toBeInTheDocument();
		expect(screen.getByText('Overdue')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /Snooze/i }));

		await waitFor(() => expect(snoozeReminderMock).toHaveBeenCalledWith(reminder.id, 3));
		await waitFor(() => expect(getRemindersMock).toHaveBeenCalledTimes(2));
	});
});
