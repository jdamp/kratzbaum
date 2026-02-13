<script lang="ts">
	import { goto } from '$app/navigation';
	import { plantService } from '$lib/api/plants';
	import { potService } from '$lib/api/pots';
	import { apiClient } from '$lib/api/client';
	import type { IdentifyResponse, IdentificationResult, Pot } from '$lib/api/types';
	import { ArrowLeft, Camera, Upload, Leaf, Search } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let name = $state('');
	let species = $state('');
	let potId = $state('');
	let photos: FileList | null = $state(null);
	let photoPreview = $state<string | null>(null);

	let availablePots: Pot[] = $state([]);
	let isSubmitting = $state(false);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Species identification state
	let isIdentifying = $state(false);
	let identificationResults = $state<IdentificationResult[]>([]);
	let identifyError = $state<string | null>(null);
	let identifyMissingApiKey = $state(false);

	onMount(async () => {
		try {
			availablePots = await potService.getAvailablePots();
		} catch (err) {
			console.error('Failed to fetch pots:', err);
		} finally {
			isLoading = false;
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
			// Reset identification results when a new photo is selected
			identificationResults = [];
			identifyError = null;
		}
	}

	async function handleIdentify() {
		if (!photos || !photos[0]) {
			identifyError = 'Please select a photo first';
			return;
		}

		isIdentifying = true;
		identifyError = null;
		identifyMissingApiKey = false;

		try {
			const formData = new FormData();
			formData.append('image', photos[0]);
			formData.append('organ', 'leaf'); // Default to leaf

			const response = await apiClient.post<IdentifyResponse>('/identify', formData);
			
			if (response.error_code === 'MISSING_API_KEY') {
				identifyMissingApiKey = true;
				identifyError = 'PlantNet API key is missing. Add your key in Settings to continue.';
			} else if (response.error) {
				identifyError = response.error;
			} else {
				identificationResults = response.results || [];
				if (identificationResults.length === 0) {
					identifyError = 'No species matches found';
				}
			}
		} catch (err: any) {
			identifyError = err.message || 'Identification failed';
		} finally {
			isIdentifying = false;
		}
	}

	function selectSpecies(result: IdentificationResult) {
		// Use common name if available, otherwise scientific name
		species = result.common_names.length > 0 
			? result.common_names[0] 
			: result.scientific_name;
		identificationResults = [];
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

{#if isLoading}
	<div class="animate-pulse space-y-4">
		<div class="h-8 bg-surface-200 rounded w-1/4"></div>
		<div class="h-48 bg-surface-200 rounded-lg"></div>
	</div>
{:else}
	<div class="space-y-6">
		<a href="/" class="inline-flex items-center gap-2 text-primary-600 hover:underline">
			<ArrowLeft class="w-4 h-4" />
			Back to Plants
		</a>

		<div class="card p-6 bg-surface-50 max-w-2xl mx-auto">
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
			<div class="space-y-2">
				<label class="label">
					<span class="label-text font-medium">Species (optional)</span>
					<div class="flex gap-2">
						<input 
							type="text" 
							class="input flex-1" 
							placeholder="e.g., Monstera deliciosa"
							bind:value={species}
						/>
						{#if photoPreview}
							<button 
								type="button"
								class="btn variant-soft-primary flex items-center gap-1"
								onclick={handleIdentify}
								disabled={isIdentifying}
							>
								<Search class="w-4 h-4" />
								<span class="hidden sm:inline">{isIdentifying ? 'Identifying...' : 'Identify'}</span>
							</button>
						{/if}
					</div>
				</label>

				{#if identifyError}
					<div class="alert variant-soft-warning text-sm">
						<p>{identifyError}</p>
						{#if identifyMissingApiKey}
							<a href="/settings" class="mt-2 inline-flex text-primary-700 underline">Open Settings</a>
						{/if}
					</div>
				{/if}

				{#if identificationResults.length > 0}
					<div class="bg-white rounded-lg border border-surface-200 p-3 space-y-2">
						<p class="text-sm font-medium text-surface-600">Select a species:</p>
						{#each identificationResults as result}
							<div class="w-full p-3 bg-surface-50 rounded-lg border border-surface-200 hover:border-primary-500 hover:bg-primary-50 transition-colors">
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-2 min-w-0">
										<Leaf class="w-4 h-4 text-primary-600 flex-shrink-0" />
										<div class="min-w-0">
											<p class="font-medium text-sm truncate select-text">{result.scientific_name}</p>
											{#if result.common_names.length > 0}
												<p class="text-xs text-surface-500 truncate select-text">{result.common_names[0]}</p>
											{/if}
										</div>
									</div>
									<div class="flex items-center gap-2 flex-shrink-0">
										<span class="text-sm font-bold text-primary-600">
											{Math.round(result.score * 100)}%
										</span>
										<button
											type="button"
											class="btn variant-soft-primary btn-sm"
											onclick={() => selectSpecies(result)}
										>
											Use
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

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
{/if}
