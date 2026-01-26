<script lang="ts">
	import { goto } from '$app/navigation';
	import { potService } from '$lib/api/pots';
	import { ArrowLeft, Box } from 'lucide-svelte';

	let name = $state('');
	let diameter = $state('');
	let height = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!name.trim() || !diameter || !height) {
			error = 'All fields are required';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const formData = new FormData();
			formData.append('name', name.trim());
			formData.append('diameter_cm', diameter);
			formData.append('height_cm', height);

			const newPot = await potService.createPot(formData);
			goto(`/pots/${newPot.id}`);
		} catch (err: any) {
			error = err.message || 'Failed to create pot';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="space-y-6">
	<a href="/pots" class="inline-flex items-center gap-2 text-primary-600 hover:underline">
		<ArrowLeft class="w-4 h-4" />
		Back to Pots
	</a>

	<div class="card p-6 bg-surface-50">
		<h1 class="text-2xl font-bold mb-6">Add New Pot</h1>

		<form onsubmit={handleSubmit} class="space-y-6">
			<div class="flex justify-center mb-4">
				<div class="w-32 h-32 rounded-lg bg-surface-200 flex items-center justify-center">
					<Box class="w-12 h-12 text-surface-400" />
				</div>
			</div>

			<label class="label">
				<span class="label-text font-medium">Name *</span>
				<input 
					type="text" 
					class="input" 
					placeholder="e.g., Large Terracotta"
					bind:value={name}
					required
				/>
			</label>

			<div class="grid grid-cols-2 gap-4">
				<label class="label">
					<span class="label-text font-medium">Diameter (cm) *</span>
					<input 
						type="number" 
						step="0.1"
						class="input" 
						placeholder="e.g., 20"
						bind:value={diameter}
						required
					/>
				</label>

				<label class="label">
					<span class="label-text font-medium">Height (cm) *</span>
					<input 
						type="number" 
						step="0.1"
						class="input" 
						placeholder="e.g., 18"
						bind:value={height}
						required
					/>
				</label>
			</div>

			{#if error}
				<div class="alert variant-filled-error">
					<p>{error}</p>
				</div>
			{/if}

			<div class="flex gap-3">
				<a href="/pots" class="btn variant-soft flex-1">Cancel</a>
				<button 
					type="submit" 
					class="btn variant-filled-primary flex-1"
					disabled={isSubmitting}
				>
					{isSubmitting ? 'Creating...' : 'Create Pot'}
				</button>
			</div>
		</form>
	</div>
</div>
