<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { potService } from '$lib/api/pots';
	import { plantService } from '$lib/api/plants';
	import { syncPotAssignment } from '$lib/services/pot-assignment';
	import type { PlantListItem, PotDetail } from '$lib/api/types';
	import { ArrowLeft, Edit2, Trash2, Box, Leaf } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let pot: PotDetail | null = $state(null);
	let plants: PlantListItem[] = $state([]);
	let isLoading = $state(true);
	let showAssignmentForm = $state(false);
	let selectedPlantId = $state('');
	let isSavingAssignment = $state(false);
	let assignmentError = $state<string | null>(null);

	const potId = page.params.id ?? '';

	async function loadData() {
		if (!potId) {
			return;
		}

		const [potData, plantsData] = await Promise.all([
			potService.getPot(potId),
			plantService.getPlants({ sort: 'name', order: 'asc' })
		]);

		pot = potData;
		plants = plantsData;
		if (!showAssignmentForm) {
			selectedPlantId = potData.plant_id ?? '';
		}
	}

	onMount(async () => {
		if (!potId) {
			isLoading = false;
			return;
		}
		try {
			await loadData();
		} catch (err) {
			console.error('Failed to fetch pot data:', err);
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

	function openAssignmentForm() {
		if (!pot) return;
		selectedPlantId = pot.plant_id ?? '';
		assignmentError = null;
		showAssignmentForm = true;
	}

	function closeAssignmentForm() {
		if (!pot) return;
		selectedPlantId = pot.plant_id ?? '';
		assignmentError = null;
		showAssignmentForm = false;
	}

	function getPlantOptionLabel(plant: PlantListItem): string {
		if (plant.pot_id && plant.pot_id !== pot?.id) {
			return `${plant.name} (currently in another pot)`;
		}
		if (plant.pot_id === pot?.id) {
			return `${plant.name} (currently here)`;
		}
		return plant.name;
	}

	function getReassignmentWarning(): string | null {
		if (!pot || !selectedPlantId) {
			return null;
		}

		const warnings: string[] = [];
		if (pot.plant_id && selectedPlantId !== pot.plant_id) {
			warnings.push(`"${pot.plant_name ?? 'Current plant'}" will be unassigned from this pot.`);
		}

		const selectedPlant = plants.find((plant) => plant.id === selectedPlantId);
		if (selectedPlant && selectedPlant.pot_id && selectedPlant.pot_id !== pot.id) {
			warnings.push(`"${selectedPlant.name}" is currently assigned to another pot and will be reassigned.`);
		}

		if (warnings.length === 0) {
			return null;
		}

		return `${warnings.join('\n')}\n\nContinue?`;
	}

	async function handleSaveAssignment() {
		if (!pot) return;
		assignmentError = null;

		const warning = getReassignmentWarning();
		if (warning && !confirm(warning)) {
			return;
		}

		isSavingAssignment = true;
		try {
			await syncPotAssignment({
				potId: pot.id,
				selectedPlantId: selectedPlantId || null,
				plants
			});
			showAssignmentForm = false;
			await loadData();
		} catch (err: any) {
			assignmentError = err.message || 'Failed to save assignment.';
		} finally {
			isSavingAssignment = false;
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

			<div class="space-y-3">
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

				{#if showAssignmentForm}
					<div class="p-4 bg-white rounded-lg border border-surface-200 space-y-3">
						<label class="label">
							<span class="label-text font-medium">Assigned plant</span>
							<select class="select" bind:value={selectedPlantId} disabled={isSavingAssignment}>
								<option value="">No plant assigned</option>
								{#each plants as plantOption}
									<option value={plantOption.id}>{getPlantOptionLabel(plantOption)}</option>
								{/each}
							</select>
						</label>

						{#if assignmentError}
							<div class="alert variant-filled-error">
								<p>{assignmentError}</p>
							</div>
						{/if}

						<div class="flex gap-2 justify-end">
							<button
								type="button"
								class="btn btn-sm variant-soft"
								onclick={closeAssignmentForm}
								disabled={isSavingAssignment}
							>
								Cancel
							</button>
							<button
								type="button"
								class="btn btn-sm variant-filled-primary"
								onclick={handleSaveAssignment}
								disabled={isSavingAssignment}
							>
								{isSavingAssignment ? 'Saving...' : 'Save Assignment'}
							</button>
						</div>
					</div>
				{:else}
					<div class="flex justify-end">
						<button type="button" class="btn btn-sm variant-soft-primary" onclick={openAssignmentForm}>
							{pot.plant_id ? 'Reassign Plant' : 'Assign Plant'}
						</button>
					</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
	<div class="text-center py-20">
		<p class="text-surface-500">Pot not found.</p>
		<a href="/pots" class="btn variant-soft-primary mt-4">Back to Pots</a>
	</div>
{/if}
