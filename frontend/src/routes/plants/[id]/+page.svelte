<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { plantService } from '$lib/api/plants';
	import type { PlantDetail, CareEvent } from '$lib/api/types';
	import { Droplet, Leaf, Flower2, ArrowLeft, Edit2, Trash2, Camera, X } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let plant: PlantDetail | null = $state(null);
	let careEvents: CareEvent[] = $state([]);
	let isLoading = $state(true);

	const plantId = page.params.id ?? '';

	onMount(async () => {
		if (!plantId) {
			isLoading = false;
			return;
		}
		try {
			plant = await plantService.getPlant(plantId);
			careEvents = await plantService.getCareHistory(plantId);
		} catch (err) {
			console.error('Failed to fetch plant:', err);
		} finally {
			isLoading = false;
		}
	});

	async function handleCareEvent(type: 'WATERED' | 'FERTILIZED' | 'REPOTTED') {
		if (!plant) return;
		try {
			await plantService.recordCareEvent(plant.id, type as any);
			// Refresh care events
			careEvents = await plantService.getCareHistory(plant.id);
		} catch (err) {
			console.error(err);
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
				plant = await plantService.getPlant(plant.id);
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
		<div class="relative">
			{#if plant.photos && plant.photos.length > 0}
				<img 
					src={plant.photos[0].url.startsWith('/') ? plant.photos[0].url : `/uploads/${plant.photos[0].url}`}
					alt={plant.name}
					class="w-full h-64 object-cover rounded-lg"
				/>
			{:else}
				<div class="w-full h-64 bg-surface-200 rounded-lg flex items-center justify-center">
					<Leaf class="w-16 h-16 text-surface-400" />
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
					<button class="btn btn-sm variant-soft">
						<Edit2 class="w-4 h-4" />
					</button>
					<button class="btn btn-sm variant-soft-error" onclick={handleDelete}>
						<Trash2 class="w-4 h-4" />
					</button>
				</div>
			</div>

			{#if plant.pot}
				<div class="text-sm text-surface-600 mb-4">
					<span class="font-medium">Pot:</span> {plant.pot.name}
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
					onclick={() => handleCareEvent('WATERED')}
				>
					<Droplet class="w-4 h-4" />
					<span>Water</span>
				</button>
				<button 
					class="btn variant-soft flex-1"
					onclick={() => handleCareEvent('FERTILIZED')}
				>
					<Leaf class="w-4 h-4" />
					<span>Fertilize</span>
				</button>
				<button 
					class="btn variant-soft flex-1"
					onclick={() => handleCareEvent('REPOTTED')}
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
