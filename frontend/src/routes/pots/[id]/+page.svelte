<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { potService } from '$lib/api/pots';
	import type { PotDetail } from '$lib/api/types';
	import { ArrowLeft, Edit2, Trash2, Box, Leaf } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let pot: PotDetail | null = $state(null);
	let isLoading = $state(true);

	const potId = page.params.id ?? '';

	onMount(async () => {
		if (!potId) {
			isLoading = false;
			return;
		}
		try {
			pot = await potService.getPot(potId);
		} catch (err) {
			console.error('Failed to fetch pot:', err);
		} finally {
			isLoading = false;
		}
	});

	async function handleDelete() {
		if (!pot) return;
		if (confirm('Are you sure you want to delete this pot?')) {
			await potService.deletePot(pot.id);
			goto('/pots');
		}
	}
</script>

{#if isLoading}
	<div class="animate-pulse space-y-4">
		<div class="h-48 bg-surface-200 rounded-lg"></div>
		<div class="h-8 bg-surface-200 rounded w-1/2"></div>
	</div>
{:else if pot}
	<div class="space-y-6">
		<a href="/pots" class="inline-flex items-center gap-2 text-primary-600 hover:underline">
			<ArrowLeft class="w-4 h-4" />
			Back to Pots
		</a>

		<!-- Pot Photo -->
		{#if pot.photos && pot.photos.length > 0}
			<img 
				src={pot.photos.find(p => p.is_primary)?.url || pot.photos[0].url}
				alt={pot.name}
				class="w-full h-48 object-cover rounded-lg"
			/>
		{:else}
			<div class="w-full h-48 bg-surface-200 rounded-lg flex items-center justify-center">
				<Box class="w-16 h-16 text-surface-400" />
			</div>
		{/if}

		<div class="card p-6 bg-surface-50">
			<div class="flex justify-between items-start mb-4">
				<div>
					<h1 class="text-2xl font-bold text-surface-900">{pot.name}</h1>
					<p class="text-surface-600">
						{pot.diameter_cm}cm diameter × {pot.height_cm}cm height
					</p>
				</div>
				<div class="flex gap-2">
					<a href="/pots/new?edit={pot.id}" class="btn btn-sm variant-soft">
						<Edit2 class="w-4 h-4" />
					</a>
					<button class="btn btn-sm variant-soft-error" onclick={handleDelete}>
						<Trash2 class="w-4 h-4" />
					</button>
				</div>
			</div>

			{#if pot.plant_id}
				<div class="p-4 bg-primary-50 rounded-lg">
					<p class="text-sm text-surface-600 mb-1">Currently assigned to:</p>
					<a href="/plants/{pot.plant_id}" class="flex items-center gap-2 text-primary-600 font-medium hover:underline">
						<Leaf class="w-4 h-4" />
						{pot.plant_name ?? 'Unnamed plant'}
					</a>
				</div>
			{:else}
				<div class="p-4 bg-surface-100 rounded-lg text-center">
					<p class="text-surface-500">This pot is available for assignment.</p>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="text-center py-20">
		<p class="text-surface-500">Pot not found.</p>
		<a href="/pots" class="btn variant-soft-primary mt-4">Back to Pots</a>
	</div>
{/if}
