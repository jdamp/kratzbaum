<script lang="ts">
	import { goto } from '$app/navigation';
	import { plantService } from '$lib/api/plants';
	import { potService } from '$lib/api/pots';
	import type { Pot } from '$lib/api/types';
	import { ArrowLeft, Camera, Upload, Leaf } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let name = $state('');
	let species = $state('');
	let potId = $state('');
	let photos: FileList | null = $state(null);
	let photoPreview = $state<string | null>(null);

	let availablePots: Pot[] = $state([]);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			availablePots = await potService.getAvailablePots();
		} catch (err) {
			console.error('Failed to fetch pots:', err);
		}
	});

	function handlePhotoChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			photos = input.files;
			const reader = new FileReader();
			reader.onload = (e) => {
				photoPreview = e.target?.result as string;
			};
			reader.readAsDataURL(input.files[0]);
		}
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!name.trim()) {
			error = 'Name is required';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const plantData = {
				name: name.trim(),
				species: species.trim() || undefined,
				pot_id: potId || undefined
			};

			const newPlant = await plantService.createPlant(plantData);

			if (photos && photos[0]) {
				await plantService.uploadPhoto(newPlant.id, photos[0], true);
			}

			goto(`/plants/${newPlant.id}`);
		} catch (err: any) {
			error = err.message || 'Failed to create plant';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="space-y-6">
	<a href="/" class="inline-flex items-center gap-2 text-primary-600 hover:underline">
		<ArrowLeft class="w-4 h-4" />
		Back to Plants
	</a>

	<div class="card p-6 bg-surface-50">
		<h1 class="text-2xl font-bold mb-6">Add New Plant</h1>

		<form onsubmit={handleSubmit} class="space-y-6">
			<!-- Photo Upload -->
			<div class="flex flex-col items-center">
				<label class="cursor-pointer group">
					<input 
						type="file" 
						accept="image/*" 
						class="hidden" 
						onchange={handlePhotoChange}
					/>
					{#if photoPreview}
						<img 
							src={photoPreview} 
							alt="Preview" 
							class="w-40 h-40 object-cover rounded-full border-4 border-primary-500"
						/>
					{:else}
						<div class="w-40 h-40 rounded-full bg-surface-200 flex items-center justify-center border-4 border-dashed border-surface-300 group-hover:border-primary-500 transition-colors">
							<Camera class="w-10 h-10 text-surface-400 group-hover:text-primary-500" />
						</div>
					{/if}
					<p class="text-center text-sm text-surface-500 mt-2">Click to add photo</p>
				</label>
			</div>

			<!-- Name -->
			<label class="label">
				<span class="label-text font-medium">Name *</span>
				<input 
					type="text" 
					class="input" 
					placeholder="e.g., My Monstera"
					bind:value={name}
					required
				/>
			</label>

			<!-- Species -->
			<label class="label">
				<span class="label-text font-medium">Species (optional)</span>
				<input 
					type="text" 
					class="input" 
					placeholder="e.g., Monstera deliciosa"
					bind:value={species}
				/>
			</label>

			<!-- Pot Selection -->
			<label class="label">
				<span class="label-text font-medium">Assign to Pot (optional)</span>
				<select class="select" bind:value={potId}>
					<option value="">No pot assigned</option>
					{#each availablePots as pot}
						<option value={pot.id}>{pot.name} ({pot.diameter_cm}cm)</option>
					{/each}
				</select>
			</label>

			{#if error}
				<div class="alert variant-filled-error">
					<p>{error}</p>
				</div>
			{/if}

			<div class="flex gap-3">
				<a href="/" class="btn variant-soft flex-1">Cancel</a>
				<button 
					type="submit" 
					class="btn variant-filled-primary flex-1"
					disabled={isSubmitting}
				>
					{isSubmitting ? 'Creating...' : 'Create Plant'}
				</button>
			</div>
		</form>
	</div>
</div>
