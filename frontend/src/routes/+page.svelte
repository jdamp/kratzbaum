<script lang="ts">
	import { onMount } from 'svelte';
	import { plantService } from '$lib/api/plants';
	import type { Plant } from '$lib/api/types';
	import PlantCard from '$lib/components/PlantCard.svelte';
	import { Plus, Search, Filter } from 'lucide-svelte';

	let plants: Plant[] = $state([]);
	let isLoading = $state(true);
	let searchQuery = $state('');

	onMount(async () => {
		try {
			const response = await plantService.getPlants();
			plants = response.items;
		} catch (err) {
			console.error('Failed to fetch plants:', err);
		} finally {
			isLoading = false;
		}
	});

	let filteredPlants = $derived(
		plants.filter(p => 
			p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
			(p.species && p.species.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);
</script>

<div class="space-y-6 pb-24">
	<!-- Search and Filter -->
	<div class="flex flex-col sm:flex-row gap-4 items-center">
		<div class="relative flex-1 w-full">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
			<input 
				type="text" 
				placeholder="Search plants..." 
				class="input pl-10 w-full"
				bind:value={searchQuery}
			/>
		</div>
		<button class="btn variant-soft flex items-center gap-2 w-full sm:w-auto">
			<Filter class="w-4 h-4" />
			<span>Filter</span>
		</button>
	</div>

	<!-- Plant Grid -->
	{#if isLoading}
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{#each Array(4) as _}
				<div class="card h-64 animate-pulse bg-surface-200"></div>
			{/each}
		</div>
	{:else if filteredPlants.length > 0}
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{#each filteredPlants as plant}
				<PlantCard {plant} />
			{/each}
		</div>
	{:else}
		<div class="text-center py-20 px-4">
			<p class="text-surface-500 mb-4">No plants found.</p>
			<a href="/plants/new" class="btn variant-filled-primary">
				<Plus class="w-4 h-4 mr-2" />
				Add Your First Plant
			</a>
		</div>
	{/if}

	<!-- Floating Action Button -->
	<a 
		href="/plants/new" 
		class="btn-icon btn-icon-lg variant-filled-primary fixed right-6 bottom-24 sm:bottom-6 shadow-xl z-20"
	>
		<Plus class="w-8 h-8" />
	</a>
</div>
