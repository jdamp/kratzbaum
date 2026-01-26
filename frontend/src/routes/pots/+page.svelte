<script lang="ts">
	import { onMount } from 'svelte';
	import { potService } from '$lib/api/pots';
	import type { Pot } from '$lib/api/types';
	import PotCard from '$lib/components/PotCard.svelte';
	import { Plus } from 'lucide-svelte';

	let pots: Pot[] = $state([]);
	let isLoading = $state(true);

	onMount(async () => {
		try {
			pots = await potService.getPots();
		} catch (err) {
			console.error('Failed to fetch pots:', err);
		} finally {
			isLoading = false;
		}
	});
</script>

<div class="space-y-6 pb-24">
	<h1 class="text-2xl font-bold">Pots</h1>

	{#if isLoading}
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{#each Array(4) as _}
				<div class="card h-48 animate-pulse bg-surface-200"></div>
			{/each}
		</div>
	{:else if pots.length > 0}
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{#each pots as pot}
				<PotCard {pot} />
			{/each}
		</div>
	{:else}
		<div class="text-center py-20 px-4">
			<p class="text-surface-500 mb-4">No pots yet.</p>
			<a href="/pots/new" class="btn variant-filled-primary">
				<Plus class="w-4 h-4 mr-2" />
				Add Your First Pot
			</a>
		</div>
	{/if}

	<a 
		href="/pots/new" 
		class="btn-icon btn-icon-lg variant-filled-primary fixed right-6 bottom-24 sm:bottom-6 shadow-xl z-20"
	>
		<Plus class="w-8 h-8" />
	</a>
</div>
