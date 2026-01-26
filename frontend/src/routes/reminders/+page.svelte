<script lang="ts">
	import { onMount } from 'svelte';
	import { reminderService } from '$lib/api/reminders';
	import type { Reminder } from '$lib/api/types';
	import { Droplet, Leaf, Clock, CheckCircle, Bell } from 'lucide-svelte';

	let reminders: Reminder[] = $state([]);
	let isLoading = $state(true);

	onMount(async () => {
		try {
			reminders = await reminderService.getReminders();
		} catch (err) {
			console.error('Failed to fetch reminders:', err);
		} finally {
			isLoading = false;
		}
	});

	async function handleComplete(id: string) {
		try {
			await reminderService.completeReminder(id);
			reminders = await reminderService.getReminders();
		} catch (err) {
			console.error(err);
		}
	}

	async function handleSnooze(id: string, hours: number) {
		try {
			await reminderService.snoozeReminder(id, hours);
			reminders = await reminderService.getReminders();
		} catch (err) {
			console.error(err);
		}
	}

	function isOverdue(nextDue: string): boolean {
		return new Date(nextDue) < new Date();
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">Reminders</h1>

	{#if isLoading}
		<div class="space-y-4">
			{#each Array(3) as _}
				<div class="card h-20 animate-pulse bg-surface-200"></div>
			{/each}
		</div>
	{:else if reminders.length > 0}
		<div class="space-y-4">
			{#each reminders as reminder}
				{@const overdue = isOverdue(reminder.next_due)}
				<div class="card p-4 bg-surface-50 {overdue ? 'border-l-4 border-amber-500' : ''}">
					<div class="flex items-center gap-4">
						<div class="p-3 rounded-full {reminder.reminder_type === 'WATERING' ? 'bg-sky-100' : 'bg-amber-100'}">
							{#if reminder.reminder_type === 'WATERING'}
								<Droplet class="w-6 h-6 text-sky-500" />
							{:else}
								<Leaf class="w-6 h-6 text-amber-500" />
							{/if}
						</div>

						<div class="flex-1">
							<p class="font-medium capitalize">{reminder.reminder_type.toLowerCase()}</p>
							<p class="text-sm text-surface-500">
								{#if overdue}
									<span class="text-amber-600 font-medium">Overdue</span> · 
								{/if}
								Due: {new Date(reminder.next_due).toLocaleString()}
							</p>
						</div>

						<div class="flex gap-2">
							<button 
								class="btn btn-sm variant-filled-primary"
								onclick={() => handleComplete(reminder.id)}
							>
								<CheckCircle class="w-4 h-4" />
								<span class="hidden sm:inline">Done</span>
							</button>
							<button 
								class="btn btn-sm variant-soft"
								onclick={() => handleSnooze(reminder.id, 3)}
							>
								<Clock class="w-4 h-4" />
								<span class="hidden sm:inline">Snooze</span>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-20 px-4">
			<Bell class="w-16 h-16 text-surface-300 mx-auto mb-4" />
			<p class="text-surface-500">No reminders set up yet.</p>
			<p class="text-sm text-surface-400 mt-2">Add reminders from your plant's detail page.</p>
		</div>
	{/if}
</div>
