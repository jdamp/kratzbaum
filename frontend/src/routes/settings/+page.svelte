<script lang="ts">
	import { onMount } from 'svelte';
	import { settingsService } from '$lib/api/settings';
	import type { PlantNetSettings } from '$lib/api/types';
	import { KeyRound, Save } from 'lucide-svelte';

	let apiKey = $state('');
	let status = $state<PlantNetSettings | null>(null);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let successMessage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	async function loadSettings() {
		isLoading = true;
		errorMessage = null;
		try {
			status = await settingsService.getPlantNetSettings();
		} catch (err: any) {
			errorMessage = err.message || 'Failed to load settings';
		} finally {
			isLoading = false;
		}
	}

	onMount(loadSettings);

	async function saveApiKey() {
		successMessage = null;
		errorMessage = null;

		if (!apiKey.trim()) {
			errorMessage = 'Please enter a PlantNet API key';
			return;
		}

		isSaving = true;
		try {
			status = await settingsService.updatePlantNetSettings({ api_key: apiKey.trim() });
			apiKey = '';
			successMessage = 'PlantNet API key saved';
		} catch (err: any) {
			errorMessage = err.message || 'Failed to save PlantNet API key';
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">Settings</h1>

	<div class="card p-6 bg-surface-50 space-y-4">
		<div class="flex items-center gap-3">
			<div class="p-2 rounded-full bg-primary-100">
				<KeyRound class="w-5 h-5 text-primary-700" />
			</div>
			<div>
				<h2 class="text-lg font-semibold">PlantNet API Key</h2>
				<p class="text-sm text-surface-500">Used for plant identification requests.</p>
			</div>
		</div>

		{#if isLoading}
			<p class="text-surface-500">Loading settings...</p>
		{:else if status}
			<div class="rounded-lg border border-surface-200 bg-white p-3 text-sm">
				<p>
					Status:
					<span class={status.is_configured ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
						{status.is_configured ? 'Configured' : 'Not configured'}
					</span>
				</p>
				{#if status.masked_api_key}
					<p class="text-surface-500 mt-1">Current key: <code>{status.masked_api_key}</code></p>
				{/if}
			</div>
		{/if}

		<label class="label">
			<span class="label-text font-medium">API Key</span>
			<input
				type="password"
				class="input"
				placeholder="Enter PlantNet API key"
				bind:value={apiKey}
				autocomplete="off"
			/>
		</label>

		<button
			class="btn variant-filled-primary"
			onclick={saveApiKey}
			disabled={isSaving}
		>
			<Save class="w-4 h-4" />
			<span>{isSaving ? 'Saving...' : 'Save API Key'}</span>
		</button>

		{#if successMessage}
			<div class="alert variant-soft-success">
				<p>{successMessage}</p>
			</div>
		{/if}

		{#if errorMessage}
			<div class="alert variant-filled-error">
				<p>{errorMessage}</p>
			</div>
		{/if}
	</div>
</div>
