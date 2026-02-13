<script lang="ts">
	import { onDestroy } from 'svelte';
	import { CareEventType, type PlantListItem } from '$lib/api/types';
	import { AlertCircle, Check, Droplet, Leaf, Loader2 } from 'lucide-svelte';
	import { plantService } from '$lib/api/plants';

	let { plant }: { plant: PlantListItem } = $props();
	type ActionState = 'idle' | 'pending' | 'success' | 'error';

	let waterState = $state<ActionState>('idle');
	let fertilizeState = $state<ActionState>('idle');
	let feedbackMessage = $state<string | null>(null);
	let waterResetTimeout: ReturnType<typeof setTimeout> | null = null;
	let fertilizeResetTimeout: ReturnType<typeof setTimeout> | null = null;
	let feedbackResetTimeout: ReturnType<typeof setTimeout> | null = null;

	onDestroy(() => {
		if (waterResetTimeout) clearTimeout(waterResetTimeout);
		if (fertilizeResetTimeout) clearTimeout(fertilizeResetTimeout);
		if (feedbackResetTimeout) clearTimeout(feedbackResetTimeout);
	});

	function resetActionState(action: 'water' | 'fertilize', delayMs: number) {
		const currentTimeout = action === 'water' ? waterResetTimeout : fertilizeResetTimeout;
		if (currentTimeout) clearTimeout(currentTimeout);

		const timeout = setTimeout(() => {
			if (action === 'water') {
				waterState = 'idle';
			} else {
				fertilizeState = 'idle';
			}
		}, delayMs);

		if (action === 'water') {
			waterResetTimeout = timeout;
		} else {
			fertilizeResetTimeout = timeout;
		}
	}

	async function runCareAction(action: 'water' | 'fertilize', eventType: CareEventType) {
		if (action === 'water' && waterState === 'pending') return;
		if (action === 'fertilize' && fertilizeState === 'pending') return;

		feedbackMessage = null;
		if (action === 'water') {
			waterState = 'pending';
		} else {
			fertilizeState = 'pending';
		}

		try {
			await plantService.recordCareEvent(plant.id, eventType);
			if (action === 'water') {
				waterState = 'success';
				resetActionState('water', 900);
			} else {
				fertilizeState = 'success';
				resetActionState('fertilize', 900);
			}
		} catch (err) {
			console.error(err);
			setTemporaryFeedbackMessage('Could not save care event. Please try again.', 2200);
			if (action === 'water') {
				waterState = 'error';
				resetActionState('water', 1400);
			} else {
				fertilizeState = 'error';
				resetActionState('fertilize', 1400);
			}
		}
	}

	function getActionClasses(baseClasses: string, state: ActionState) {
		if (state === 'pending') return `${baseClasses} opacity-70 cursor-wait`;
		if (state === 'success') return `${baseClasses} !bg-green-100 !text-green-700 !border-green-300`;
		if (state === 'error') return `${baseClasses} !bg-red-100 !text-red-700 !border-red-300`;
		return baseClasses;
	}

	function setTemporaryFeedbackMessage(message: string, delayMs: number) {
		feedbackMessage = message;
		if (feedbackResetTimeout) clearTimeout(feedbackResetTimeout);
		feedbackResetTimeout = setTimeout(() => {
			feedbackMessage = null;
		}, delayMs);
	}

	async function handleWater() {
		await runCareAction('water', CareEventType.WATERED);
	}

	async function handleFertilize() {
		await runCareAction('fertilize', CareEventType.FERTILIZED);
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
				{#if plant.watering_interval}
					<div class="flex items-center gap-1">
						<Droplet class="w-3 h-3 text-sky-500" />
						<span>Water every {plant.watering_interval} day{plant.watering_interval === 1 ? '' : 's'}</span>
					</div>
				{/if}
				{#if plant.fertilizing_interval}
					<div class="flex items-center gap-1">
						<Leaf class="w-3 h-3 text-amber-500" />
						<span>Fertilize every {plant.fertilizing_interval} day{plant.fertilizing_interval === 1 ? '' : 's'}</span>
					</div>
				{/if}
			</div>
		</section>
	</a>

	<footer class="p-4 pt-0 flex gap-2">
		<button 
			class={getActionClasses('btn btn-sm variant-soft-primary flex-1', waterState)}
			onclick={handleWater}
			disabled={waterState === 'pending'}
			aria-busy={waterState === 'pending'}
		>
			{#if waterState === 'pending'}
				<Loader2 class="w-4 h-4 animate-spin" />
				<span>Saving...</span>
			{:else if waterState === 'success'}
				<Check class="w-4 h-4" />
				<span>Saved</span>
			{:else if waterState === 'error'}
				<AlertCircle class="w-4 h-4" />
				<span>Retry</span>
			{:else}
				<Droplet class="w-4 h-4" />
				<span>Water</span>
			{/if}
		</button>
		<button 
			class={getActionClasses('btn btn-sm variant-soft-secondary flex-1', fertilizeState)}
			onclick={handleFertilize}
			disabled={fertilizeState === 'pending'}
			aria-busy={fertilizeState === 'pending'}
		>
			{#if fertilizeState === 'pending'}
				<Loader2 class="w-4 h-4 animate-spin" />
				<span>Saving...</span>
			{:else if fertilizeState === 'success'}
				<Check class="w-4 h-4" />
				<span>Saved</span>
			{:else if fertilizeState === 'error'}
				<AlertCircle class="w-4 h-4" />
				<span>Retry</span>
			{:else}
				<Leaf class="w-4 h-4" />
				<span>Fertilize</span>
			{/if}
		</button>
	</footer>
	{#if feedbackMessage}
		<p class="px-4 pb-4 text-xs text-red-600">{feedbackMessage}</p>
	{/if}
</div>
