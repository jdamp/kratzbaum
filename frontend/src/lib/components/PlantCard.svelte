<script lang="ts">
	import type { Plant } from '$lib/api/types';
	import { Droplet, Leaf, Flower2 } from 'lucide-svelte';
	import { plantService } from '$lib/api/plants';

	let { plant }: { plant: Plant } = $props();

	async function handleWater() {
		try {
			await plantService.recordCareEvent(plant.id, 'WATERED' as any);
			// Ideally trigger a refresh or local update
		} catch (err) {
			console.error(err);
		}
	}

	async function handleFertilize() {
		try {
			await plantService.recordCareEvent(plant.id, 'FERTILIZED' as any);
		} catch (err) {
			console.error(err);
		}
	}
</script>

<div class="card overflow-hidden bg-surface-50 shadow-sm hover:shadow-md transition-shadow">
	<a href="/plants/{plant.id}" class="block">
		<header>
			{#if plant.primary_photo_url}
				<img 
					src={plant.primary_photo_url.startsWith('/') ? plant.primary_photo_url : `/uploads/${plant.primary_photo_url}`} 
					alt={plant.name}
					class="aspect-square object-cover w-full"
				/>
			{:else}
				<div class="aspect-square bg-surface-200 flex items-center justify-center">
					<Leaf class="w-12 h-12 text-surface-400" />
				</div>
			{/if}
		</header>
		
		<section class="p-4">
			<h3 class="font-bold text-lg text-surface-900 truncate">{plant.name}</h3>
			<p class="text-sm text-surface-600 italic truncate">{plant.species || 'Unknown species'}</p>
			
			<div class="mt-4 flex flex-col gap-1 text-xs text-surface-500">
				{#if plant.last_watered}
					<div class="flex items-center gap-1">
						<Droplet class="w-3 h-3 text-sky-500" />
						<span>Watered: {new Date(plant.last_watered).toLocaleDateString()}</span>
					</div>
				{/if}
			</div>
		</section>
	</a>

	<footer class="p-4 pt-0 flex gap-2">
		<button 
			class="btn btn-sm variant-soft-primary flex-1"
			onclick={handleWater}
		>
			<Droplet class="w-4 h-4" />
			<span>Water</span>
		</button>
		<button 
			class="btn btn-sm variant-soft-secondary flex-1"
			onclick={handleFertilize}
		>
			<Leaf class="w-4 h-4" />
			<span>Fertilize</span>
		</button>
	</footer>
</div>
