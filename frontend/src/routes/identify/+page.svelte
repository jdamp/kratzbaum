<script lang="ts">
	import { Search, Camera, Leaf, Upload } from 'lucide-svelte';
	import { apiClient } from '$lib/api/client';

	interface IdentificationResult {
		score: number;
		scientific_name: string;
		common_names: string[];
		family: string;
	}

	let photo: File | null = $state(null);
	let photoPreview = $state<string | null>(null);
	let organ = $state<'leaf' | 'flower' | 'fruit' | 'bark'>('leaf');
	let results = $state<IdentificationResult[]>([]);
	let isIdentifying = $state(false);
	let error = $state<string | null>(null);

	function handlePhotoChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			photo = input.files[0];
			const reader = new FileReader();
			reader.onload = (e) => {
				photoPreview = e.target?.result as string;
			};
			reader.readAsDataURL(input.files[0]);
			results = [];
		}
	}

	async function handleIdentify() {
		if (!photo) {
			error = 'Please select a photo first';
			return;
		}

		isIdentifying = true;
		error = null;

		try {
			const formData = new FormData();
			formData.append('image', photo);
			formData.append('organ', organ);

			const response = await apiClient.post<{ results: IdentificationResult[] }>('/identify', formData);
			results = response.results || [];
		} catch (err: any) {
			error = err.message || 'Identification failed';
		} finally {
			isIdentifying = false;
		}
	}

	function selectSpecies(species: string) {
		// Could navigate to add plant page with species pre-filled
		alert(`Selected: ${species}`);
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">Identify Plant</h1>

	<div class="card p-6 bg-surface-50">
		<!-- Photo Upload -->
		<div class="flex flex-col items-center mb-6">
			<label class="cursor-pointer group">
				<input 
					type="file" 
					accept="image/*" 
					capture="environment"
					class="hidden" 
					onchange={handlePhotoChange}
				/>
				{#if photoPreview}
					<img 
						src={photoPreview} 
						alt="Preview" 
						class="w-64 h-64 object-cover rounded-lg border-4 border-primary-500"
					/>
				{:else}
					<div class="w-64 h-64 rounded-lg bg-surface-200 flex flex-col items-center justify-center border-4 border-dashed border-surface-300 group-hover:border-primary-500 transition-colors">
						<Camera class="w-12 h-12 text-surface-400 group-hover:text-primary-500 mb-2" />
						<p class="text-surface-500">Take or upload photo</p>
					</div>
				{/if}
			</label>
		</div>

		<!-- Organ Selection -->
		<div class="mb-6">
			<p class="font-medium mb-2">What part of the plant is in the photo?</p>
			<div class="grid grid-cols-4 gap-2">
				{#each ['leaf', 'flower', 'fruit', 'bark'] as type}
					<button 
						class="btn {organ === type ? 'variant-filled-primary' : 'variant-soft'}"
						onclick={() => organ = type as any}
					>
						{type.charAt(0).toUpperCase() + type.slice(1)}
					</button>
				{/each}
			</div>
		</div>

		{#if error}
			<div class="alert variant-filled-error mb-4">
				<p>{error}</p>
			</div>
		{/if}

		<button 
			class="btn variant-filled-primary w-full"
			onclick={handleIdentify}
			disabled={!photo || isIdentifying}
		>
			<Search class="w-4 h-4" />
			<span>{isIdentifying ? 'Identifying...' : 'Identify Plant'}</span>
		</button>
	</div>

	<!-- Results -->
	{#if results.length > 0}
		<div class="card p-6 bg-surface-50">
			<h2 class="text-lg font-bold mb-4">Results</h2>
			<div class="space-y-3">
				{#each results as result}
					<button 
						class="w-full text-left p-4 bg-white rounded-lg border border-surface-200 hover:border-primary-500 transition-colors"
						onclick={() => selectSpecies(result.scientific_name)}
					>
						<div class="flex items-center gap-4">
							<div class="p-2 bg-primary-50 rounded-full">
								<Leaf class="w-6 h-6 text-primary-600" />
							</div>
							<div class="flex-1">
								<p class="font-bold">{result.scientific_name}</p>
								<p class="text-sm text-surface-500">
									{result.common_names.slice(0, 2).join(', ')}
								</p>
								<p class="text-xs text-surface-400">Family: {result.family}</p>
							</div>
							<div class="text-right">
								<span class="text-lg font-bold text-primary-600">
									{Math.round(result.score * 100)}%
								</span>
								<p class="text-xs text-surface-500">confidence</p>
							</div>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
