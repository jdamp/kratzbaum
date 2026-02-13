<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { plantService } from '$lib/api/plants';
	import { potService } from '$lib/api/pots';
	import type { PlantDetail, CareEvent, CareEventType, PlantPhoto, Pot } from '$lib/api/types';
	import { Droplet, Leaf, Flower2, ArrowLeft, Edit2, Trash2, X, Check, Plus, Calendar } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let plant: PlantDetail | null = $state(null);
	let potName: string | null = $state(null);
	let careEvents: CareEvent[] = $state([]);
	let isLoading = $state(true);

	// Edit modal state
	let showEditModal = $state(false);
	let editName = $state('');
	let editSpecies = $state('');
	let editPotId = $state('');
	let editPotOptions: Pot[] = $state([]);
	let isLoadingEditPots = $state(false);
	let isSaving = $state(false);

	// Photo management state
	let selectedPhotoIndex = $state(0);
	let isUploadingPhoto = $state(false);
	let deletingPhotoId = $state<string | null>(null);

	// Care event modal state
	let showCareEventModal = $state(false);
	let careEventType = $state<'WATERED' | 'FERTILIZED' | 'REPOTTED'>('WATERED');
	let careEventDate = $state('');
	let isRecordingCareEvent = $state(false);

	const plantId = page.params.id ?? '';

	async function loadPlant(plantIdToLoad: string) {
		const plantData = await plantService.getPlant(plantIdToLoad);
		plant = plantData;
		potName = null;

		if (plantData.pot_id) {
			try {
				const pot = await potService.getPot(plantData.pot_id);
				potName = pot.name;
			} catch (err) {
				console.error('Failed to fetch pot details:', err);
			}
		}
	}

	onMount(async () => {
		if (!plantId) {
			isLoading = false;
			return;
		}
		try {
			await loadPlant(plantId);
			careEvents = await plantService.getCareHistory(plantId);
		} catch (err) {
			console.error('Failed to fetch plant:', err);
		} finally {
			isLoading = false;
		}
	});

	function openEditModal() {
		if (!plant) return;
		editName = plant.name;
		editSpecies = plant.species || '';
		editPotId = plant.pot_id || '';
		void loadEditPotOptions(plant.pot_id);
		showEditModal = true;
	}

	function closeEditModal() {
		showEditModal = false;
		editName = '';
		editSpecies = '';
		editPotId = '';
		editPotOptions = [];
		isLoadingEditPots = false;
	}

	async function loadEditPotOptions(currentPotId: string | null) {
		isLoadingEditPots = true;
		try {
			const availablePots = await potService.getAvailablePots();
			if (!currentPotId) {
				editPotOptions = availablePots;
				return;
			}

			const currentPotInAvailable = availablePots.find((potOption) => potOption.id === currentPotId);
			if (currentPotInAvailable) {
				editPotOptions = availablePots;
				return;
			}

			try {
				const currentPot = await potService.getPot(currentPotId);
				editPotOptions = [currentPot, ...availablePots];
			} catch (err) {
				console.error('Failed to fetch currently assigned pot:', err);
				editPotOptions = availablePots;
			}
		} catch (err) {
			console.error('Failed to fetch available pots:', err);
			editPotOptions = [];
		} finally {
			isLoadingEditPots = false;
		}
	}

	async function handleSaveEdit() {
		if (!plant || !editName.trim()) return;
		isSaving = true;
		try {
			await plantService.updatePlant(plant.id, {
				name: editName.trim(),
				species: editSpecies.trim() || null,
				pot_id: editPotId || null
			});
			// Refresh plant data
			await loadPlant(plant.id);
			closeEditModal();
		} catch (err) {
			console.error('Failed to update plant:', err);
		} finally {
			isSaving = false;
		}
	}

	async function handleNewPhotoChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];
			// Upload immediately
			await handleUploadPhotoFile(file);
			// Reset the input so the same file can be selected again
			input.value = '';
		}
	}

	async function handleUploadPhotoFile(file: File) {
		if (!plant) return;
		isUploadingPhoto = true;
		try {
			const isPrimary = plant.photos.length === 0;
			await plantService.uploadPhoto(plant.id, file, isPrimary);
			// Refresh plant data
			await loadPlant(plant.id);
		} catch (err) {
			console.error('Failed to upload photo:', err);
		} finally {
			isUploadingPhoto = false;
		}
	}



	async function handleDeletePhoto(photoId: string) {
		if (!plant) return;
		if (!confirm('Are you sure you want to delete this photo?')) return;
		deletingPhotoId = photoId;
		try {
			await plantService.deletePhoto(plant.id, photoId);
			// Refresh plant data
			await loadPlant(plant.id);
			// Reset selected index if needed
			if (plant && selectedPhotoIndex >= plant.photos.length) {
				selectedPhotoIndex = Math.max(0, plant.photos.length - 1);
			}
		} catch (err) {
			console.error('Failed to delete photo:', err);
		} finally {
			deletingPhotoId = null;
		}
	}

	function getPhotoUrl(photo: PlantPhoto): string {
		return photo.url.startsWith('/') ? photo.url : `/uploads/${photo.url}`;
	}

	function openCareEventModal(type: 'WATERED' | 'FERTILIZED' | 'REPOTTED') {
		careEventType = type;
		// Default to today's date in local timezone
		const now = new Date();
		careEventDate = now.toISOString().split('T')[0];
		showCareEventModal = true;
	}

	function closeCareEventModal() {
		showCareEventModal = false;
		careEventDate = '';
	}

	async function handleRecordCareEvent(useNow: boolean = false) {
		if (!plant) return;
		isRecordingCareEvent = true;
		try {
			let eventDate: Date;
			if (useNow) {
				eventDate = new Date();
			} else {
				// Parse the date as local time at noon to avoid timezone issues
				eventDate = new Date(careEventDate + 'T12:00:00');
			}
			await plantService.recordCareEvent(plant.id, careEventType as CareEventType, undefined, eventDate);
			// Refresh care events and plant data
			careEvents = await plantService.getCareHistory(plant.id);
			await loadPlant(plant.id);
			closeCareEventModal();
		} catch (err) {
			console.error(err);
		} finally {
			isRecordingCareEvent = false;
		}
	}

	async function handleDelete() {
		if (!plant) return;
		if (confirm('Are you sure you want to delete this plant?')) {
			await plantService.deletePlant(plant.id);
			goto('/');
		}
	}

	async function handleDeleteCareEvent(eventId: string) {
		if (!plant) return;
		if (confirm('Are you sure you want to delete this care event?')) {
			try {
				await plantService.deleteCareEvent(plant.id, eventId);
				// Refresh care events and plant data (for updated last_watered, etc.)
				careEvents = await plantService.getCareHistory(plant.id);
				await loadPlant(plant.id);
			} catch (err) {
				console.error('Failed to delete care event:', err);
			}
		}
	}
</script>

{#if isLoading}
	<div class="animate-pulse space-y-4">
		<div class="h-64 bg-surface-200 rounded-lg"></div>
		<div class="h-8 bg-surface-200 rounded w-1/2"></div>
	</div>
{:else if plant}
	<div class="space-y-6">
		<!-- Back Button -->
		<a href="/" class="inline-flex items-center gap-2 text-primary-600 hover:underline">
			<ArrowLeft class="w-4 h-4" />
			Back to Plants
		</a>

		<!-- Photo Gallery -->
		<div class="space-y-3">
			<!-- Main Photo Display -->
			<div class="relative">
				{#if plant.photos && plant.photos.length > 0}
					<img 
						src={getPhotoUrl(plant.photos[selectedPhotoIndex])}
						alt={plant.name}
						class="w-full h-64 object-cover rounded-lg"
					/>
					{#if plant.photos[selectedPhotoIndex].is_primary}
						<span class="absolute top-2 left-2 bg-primary-500 text-white text-xs px-2 py-1 rounded-full">
							Primary
						</span>
					{/if}
				{:else}
					<div class="w-full h-64 bg-surface-200 rounded-lg flex items-center justify-center">
						<Leaf class="w-16 h-16 text-surface-400" />
					</div>
				{/if}
			</div>

			<!-- Photo Thumbnails -->
			{#if plant.photos && plant.photos.length > 1}
				<div class="flex gap-2 overflow-x-auto pb-2">
					{#each plant.photos as photo, index}
						<button
							type="button"
							class="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all {selectedPhotoIndex === index ? 'border-primary-500 ring-2 ring-primary-200' : 'border-surface-200 hover:border-primary-300'}"
							onclick={() => selectedPhotoIndex = index}
						>
							<img 
								src={getPhotoUrl(photo)}
								alt="{plant.name} photo {index + 1}"
								class="w-full h-full object-cover"
							/>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Plant Info -->
		<div class="card p-6 bg-surface-50">
			<div class="flex justify-between items-start mb-4">
				<div>
					<h1 class="text-2xl font-bold text-surface-900">{plant.name}</h1>
					<p class="text-surface-600 italic">{plant.species || 'Unknown species'}</p>
				</div>
				<div class="flex gap-2">
					<button class="btn btn-sm variant-soft" onclick={openEditModal}>
						<Edit2 class="w-4 h-4" />
					</button>
					<button class="btn btn-sm variant-soft-error" onclick={handleDelete}>
						<Trash2 class="w-4 h-4" />
					</button>
				</div>
			</div>

			{#if plant.pot_id}
				<div class="text-sm text-surface-600 mb-4">
					<span class="font-medium">Pot:</span>
					<a href="/pots/{plant.pot_id}" class="ml-1 text-primary-600 hover:underline">
						{potName || 'View assigned pot'}
					</a>
				</div>
			{/if}

			<!-- Last Care Dates -->
			<div class="grid grid-cols-3 gap-4 text-center text-sm mb-6">
				<div class="p-3 bg-sky-50 rounded-lg">
					<Droplet class="w-5 h-5 text-sky-500 mx-auto mb-1" />
					<p class="font-medium">Watered</p>
					<p class="text-surface-500">
						{plant.last_watered ? new Date(plant.last_watered).toLocaleDateString() : 'Never'}
					</p>
				</div>
				<div class="p-3 bg-amber-50 rounded-lg">
					<Leaf class="w-5 h-5 text-amber-500 mx-auto mb-1" />
					<p class="font-medium">Fertilized</p>
					<p class="text-surface-500">
						{plant.last_fertilized ? new Date(plant.last_fertilized).toLocaleDateString() : 'Never'}
					</p>
				</div>
				<div class="p-3 bg-green-50 rounded-lg">
					<Flower2 class="w-5 h-5 text-green-500 mx-auto mb-1" />
					<p class="font-medium">Repotted</p>
					<p class="text-surface-500">
						{plant.last_repotted ? new Date(plant.last_repotted).toLocaleDateString() : 'Never'}
					</p>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="flex gap-3">
				<button 
					class="btn variant-filled-primary flex-1"
					onclick={() => openCareEventModal('WATERED')}
				>
					<Droplet class="w-4 h-4" />
					<span>Water</span>
				</button>
				<button 
					class="btn variant-soft flex-1"
					onclick={() => openCareEventModal('FERTILIZED')}
				>
					<Leaf class="w-4 h-4" />
					<span>Fertilize</span>
				</button>
				<button 
					class="btn variant-soft flex-1"
					onclick={() => openCareEventModal('REPOTTED')}
				>
					<Flower2 class="w-4 h-4" />
					<span>Repot</span>
				</button>
			</div>
		</div>

		<!-- Care History -->
		<div class="card p-6 bg-surface-50">
			<h2 class="text-lg font-bold mb-4">Care History</h2>
			{#if careEvents.length > 0}
				<div class="space-y-3">
					{#each careEvents.slice(0, 10) as event}
						<div class="flex items-center gap-3 p-3 bg-white rounded-lg border border-surface-200">
							{#if event.event_type === 'WATERED'}
								<Droplet class="w-5 h-5 text-sky-500" />
							{:else if event.event_type === 'FERTILIZED'}
								<Leaf class="w-5 h-5 text-amber-500" />
							{:else}
								<Flower2 class="w-5 h-5 text-green-500" />
							{/if}
							<div class="flex-1">
								<p class="font-medium capitalize">{event.event_type.toLowerCase()}</p>
								<p class="text-sm text-surface-500">{new Date(event.event_date).toLocaleString()}</p>
								{#if event.notes}
									<p class="text-sm text-surface-600">{event.notes}</p>
								{/if}
							</div>
							<button 
								class="p-1 text-surface-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
								onclick={() => handleDeleteCareEvent(event.id)}
								title="Delete this entry"
							>
								<X class="w-4 h-4" />
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-surface-500 text-center py-4">No care events recorded yet.</p>
			{/if}
		</div>
	</div>
{:else}
	<div class="text-center py-20">
		<p class="text-surface-500">Plant not found.</p>
		<a href="/" class="btn variant-soft-primary mt-4">Back to Plants</a>
	</div>
{/if}

<!-- Edit Modal -->
{#if showEditModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-xl font-bold">Edit Plant</h2>
				<button 
					class="p-1 text-surface-400 hover:text-surface-600 rounded-full"
					onclick={closeEditModal}
				>
					<X class="w-5 h-5" />
				</button>
			</div>
			
			<form onsubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} class="space-y-4">
				<div>
					<label for="edit-name" class="block text-sm font-medium text-surface-700 mb-1">Name</label>
					<input
						id="edit-name"
						type="text"
						bind:value={editName}
						class="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
						placeholder="Plant name"
						required
					/>
				</div>
				
				<div>
					<label for="edit-species" class="block text-sm font-medium text-surface-700 mb-1">Species</label>
					<input
						id="edit-species"
						type="text"
						bind:value={editSpecies}
						class="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
						placeholder="e.g. Monstera deliciosa"
					/>
				</div>

				<div>
					<label for="edit-pot" class="block text-sm font-medium text-surface-700 mb-1">Pot</label>
					{#if isLoadingEditPots}
						<p class="text-sm text-surface-500 py-2">Loading available pots...</p>
					{:else}
						<select
							id="edit-pot"
							bind:value={editPotId}
							class="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
						>
							<option value="">No pot assigned</option>
							{#each editPotOptions as potOption}
								<option value={potOption.id}>{potOption.name} ({potOption.diameter_cm}cm)</option>
							{/each}
						</select>
					{/if}
				</div>
				
				<!-- Photo Management -->
				<div>
					<label class="block text-sm font-medium text-surface-700 mb-2">Photos</label>
					
					<!-- Existing Photos -->
					{#if plant && plant.photos && plant.photos.length > 0}
						<div class="grid grid-cols-3 gap-2 mb-3">
							{#each plant.photos as photo}
								<div class="relative group">
									<img 
										src={getPhotoUrl(photo)}
										alt="Plant photo"
										class="w-full h-20 object-cover rounded-lg"
									/>
									{#if photo.is_primary}
										<span class="absolute bottom-1 left-1 bg-primary-500 text-white text-[10px] px-1 py-0.5 rounded">
											Primary
										</span>
									{/if}
									<button
										type="button"
										class="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
										onclick={() => handleDeletePhoto(photo.id)}
										disabled={deletingPhotoId === photo.id}
										title="Delete photo"
									>
										<X class="w-3 h-3" />
									</button>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-surface-500 mb-3">No photos yet</p>
					{/if}
					
					<!-- Add New Photo -->
					{#if isUploadingPhoto}
						<div class="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-primary-300 rounded-lg bg-primary-50">
							<div class="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
							<span class="text-sm text-primary-600">Uploading...</span>
						</div>
					{:else}
						<label class="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-surface-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
							<input 
								type="file" 
								accept="image/*" 
								class="hidden" 
								onchange={handleNewPhotoChange}
							/>
							<Plus class="w-4 h-4 text-surface-500" />
							<span class="text-sm text-surface-600">Add photo</span>
						</label>
					{/if}
				</div>
				
				<div class="flex gap-3 pt-2">
					<button
						type="button"
						class="btn variant-soft flex-1"
						onclick={closeEditModal}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="btn variant-filled-primary flex-1"
						disabled={isSaving || !editName.trim()}
					>
						{#if isSaving}
							Saving...
						{:else}
							<Check class="w-4 h-4" />
							<span>Save</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Care Event Modal -->
{#if showCareEventModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
			<div class="flex justify-between items-center mb-4">
				<div class="flex items-center gap-2">
					{#if careEventType === 'WATERED'}
						<div class="p-2 bg-sky-100 rounded-lg">
							<Droplet class="w-5 h-5 text-sky-500" />
						</div>
						<h2 class="text-xl font-bold">Record Watering</h2>
					{:else if careEventType === 'FERTILIZED'}
						<div class="p-2 bg-amber-100 rounded-lg">
							<Leaf class="w-5 h-5 text-amber-500" />
						</div>
						<h2 class="text-xl font-bold">Record Fertilizing</h2>
					{:else}
						<div class="p-2 bg-green-100 rounded-lg">
							<Flower2 class="w-5 h-5 text-green-500" />
						</div>
						<h2 class="text-xl font-bold">Record Repotting</h2>
					{/if}
				</div>
				<button 
					class="p-1 text-surface-400 hover:text-surface-600 rounded-full"
					onclick={closeCareEventModal}
				>
					<X class="w-5 h-5" />
				</button>
			</div>
			
			<p class="text-sm text-surface-600 mb-4">
				When did this happen?
			</p>
			
			<div class="space-y-3">
				<!-- Now Button -->
				<button
					type="button"
					class="btn variant-filled-primary w-full"
					onclick={() => handleRecordCareEvent(true)}
					disabled={isRecordingCareEvent}
				>
					{#if isRecordingCareEvent}
						<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
						<span>Recording...</span>
					{:else}
						<Check class="w-4 h-4" />
						<span>Just now</span>
					{/if}
				</button>
				
				<!-- Or Divider -->
				<div class="flex items-center gap-3">
					<div class="flex-1 h-px bg-surface-200"></div>
					<span class="text-sm text-surface-400">or select a date</span>
					<div class="flex-1 h-px bg-surface-200"></div>
				</div>
				
				<!-- Date Picker -->
				<div class="flex gap-2">
					<div class="flex-1 relative">
						<Calendar class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
						<input
							type="date"
							bind:value={careEventDate}
							class="w-full pl-10 pr-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
						/>
					</div>
					<button
						type="button"
						class="btn variant-soft"
						onclick={() => handleRecordCareEvent(false)}
						disabled={isRecordingCareEvent || !careEventDate}
					>
						<Check class="w-4 h-4" />
					</button>
				</div>
			</div>
			
			<button
				type="button"
				class="btn variant-ghost w-full mt-4"
				onclick={closeCareEventModal}
			>
				Cancel
			</button>
		</div>
	</div>
{/if}
