<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { potService } from '$lib/api/pots';
	import type { Pot } from '$lib/api/types';
	import { ArrowLeft, Camera, Box } from 'lucide-svelte';
	import { onMount } from 'svelte';

	// Check if we're in edit mode
	const editId = page.url.searchParams.get('edit');
	const isEditMode = !!editId;

	let name = $state('');
	let diameter = $state('');
	let height = $state('');
	let photos: FileList | null = $state(null);
	let photoPreview = $state<string | null>(null);
	let existingPhotoUrl = $state<string | null>(null);
	let isSubmitting = $state(false);
	let isLoading = $state(isEditMode);
	let error = $state<string | null>(null);

	onMount(async () => {
		if (editId) {
			try {
				const pot = await potService.getPot(editId);
				name = pot.name;
				diameter = pot.diameter_cm.toString();
				height = pot.height_cm.toString();
				// Use primary photo if available
				const primaryPhoto = pot.photos?.find(p => p.is_primary) || pot.photos?.[0];
				if (primaryPhoto) {
					existingPhotoUrl = primaryPhoto.url;
				}
			} catch (err) {
				console.error('Failed to fetch pot:', err);
				error = 'Failed to load pot data';
			} finally {
				isLoading = false;
			}
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
		if (!name.trim() || !diameter || !height) {
			error = 'All fields are required';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const potData = {
				name: name.trim(),
				diameter_cm: parseFloat(diameter),
				height_cm: parseFloat(height)
			};

			let pot: Pot;
			if (isEditMode && editId) {
				pot = await potService.updatePot(editId, potData);
			} else {
				pot = await potService.createPot(potData);
			}

			// Upload photo if new one was selected
			if (photos && photos[0]) {
				await potService.uploadPhoto(pot.id, photos[0], true);
			}

			goto(`/pots/${pot.id}`);
		} catch (err: any) {
			error = err.message || `Failed to ${isEditMode ? 'update' : 'create'} pot`;
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if isLoading}
	<div class="animate-pulse space-y-4">
		<div class="h-8 bg-surface-200 rounded w-1/4"></div>
		<div class="h-48 bg-surface-200 rounded-lg"></div>
	</div>
{:else}
	<div class="space-y-6">
		<a href={isEditMode ? `/pots/${editId}` : '/pots'} class="inline-flex items-center gap-2 text-primary-600 hover:underline">
			<ArrowLeft class="w-4 h-4" />
			{isEditMode ? 'Back to Pot' : 'Back to Pots'}
		</a>

		<div class="card p-6 bg-surface-50">
			<h1 class="text-2xl font-bold mb-6">{isEditMode ? 'Edit Pot' : 'Add New Pot'}</h1>

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
								class="w-32 h-32 object-cover rounded-lg border-4 border-primary-500"
							/>
						{:else if existingPhotoUrl}
							<img 
								src={existingPhotoUrl} 
								alt="Current pot" 
								class="w-32 h-32 object-cover rounded-lg border-4 border-surface-300 group-hover:border-primary-500 transition-colors"
							/>
						{:else}
							<div class="w-32 h-32 rounded-lg bg-surface-200 flex items-center justify-center border-4 border-dashed border-surface-300 group-hover:border-primary-500 transition-colors">
								<Camera class="w-10 h-10 text-surface-400 group-hover:text-primary-500" />
							</div>
						{/if}
						<p class="text-center text-sm text-surface-500 mt-2">Click to {existingPhotoUrl || photoPreview ? 'change' : 'add'} photo</p>
					</label>
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
					<a href={isEditMode ? `/pots/${editId}` : '/pots'} class="btn variant-soft flex-1">Cancel</a>
					<button 
						type="submit" 
						class="btn variant-filled-primary flex-1"
						disabled={isSubmitting}
					>
						{isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Pot' : 'Create Pot')}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
