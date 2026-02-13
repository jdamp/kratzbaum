<script lang="ts">
	import type { Pot } from '$lib/api/types';
	import { Box, Leaf } from 'lucide-svelte';

	let { pot }: { pot: Pot } = $props();
</script>

<a href="/pots/{pot.id}" class="card overflow-hidden bg-surface-50 shadow-sm hover:shadow-md transition-shadow block">
	<header>
		{#if pot.primary_photo_url}
			<img 
				src={pot.primary_photo_url}
				alt={pot.name}
				class="aspect-square object-cover w-full"
			/>
		{:else}
			<div class="aspect-square bg-surface-200 flex items-center justify-center">
				<Box class="w-12 h-12 text-surface-400" />
			</div>
		{/if}
	</header>
	
	<section class="p-4">
		<h3 class="font-bold text-lg text-surface-900 truncate">{pot.name}</h3>
		<p class="text-sm text-surface-600">{pot.diameter_cm}cm × {pot.height_cm}cm</p>
		
		<div class="mt-3">
			{#if pot.plant_name}
				<span class="chip variant-soft-primary text-xs">
					<Leaf class="w-3 h-3" />
					<span>{pot.plant_name}</span>
				</span>
			{:else}
				<span class="chip variant-soft text-xs">Available</span>
			{/if}
		</div>
	</section>
</a>
