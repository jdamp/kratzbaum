<script lang="ts">
	import { auth, isAuthenticated } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let username = $state('');
	let password = $state('');
	let isLoading = $derived($auth.isLoading);
	let error = $derived($auth.error);

	onMount(() => {
		if ($isAuthenticated) {
			goto('/');
		}
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();
		const success = await auth.login(username, password);
		if (success) {
			goto('/');
		}
	}
</script>

<div class="flex-1 flex items-center justify-center p-4">
	<div class="card p-8 w-full max-w-md bg-surface-50 shadow-xl border border-surface-200">
		<header class="mb-8 text-center">
			<h1 class="h1 text-primary-600 mb-2">Kratzbaum</h1>
			<p class="text-surface-600">Plant Management System</p>
		</header>

		<form onsubmit={handleSubmit} class="space-y-6">
			<label class="label">
				<span class="label-text">Username</span>
				<input
					class="input"
					type="text"
					placeholder="Enter username..."
					bind:value={username}
					required
				/>
			</label>

			<label class="label">
				<span class="label-text">Password</span>
				<input
					class="input"
					type="password"
					placeholder="Enter password..."
					bind:value={password}
					required
				/>
			</label>

			{#if error}
				<div class="alert variant-filled-error">
					<div class="alert-message">
						<p>{error}</p>
					</div>
				</div>
			{/if}

			<button 
				type="submit" 
				class="btn variant-filled-primary w-full" 
				disabled={isLoading}
			>
				{isLoading ? 'Logging in...' : 'Login'}
			</button>
		</form>
	</div>
</div>
