<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { isAuthenticated, auth } from '$lib/stores/auth';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import { Leaf, Droplet, Flower2, Search, Settings, LogOut, Home, Box } from 'lucide-svelte';

	let { children } = $props();

	// Guard protected routes
	$effect(() => {
		const isLoginPage = page.url.pathname === '/login';
		const isAuth = $isAuthenticated;
		
		untrack(() => {
			if (!isAuth && !isLoginPage) {
				goto('/login');
			}
		});
	});

	const navItems = [
		{ label: 'Plants', icon: Home, href: '/' },
		{ label: 'Pots', icon: Box, href: '/pots' },
		{ label: 'Reminders', icon: Droplet, href: '/reminders' },
		{ label: 'Identify', icon: Search, href: '/identify' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Kratzbaum</title>
</svelte:head>

<div class="h-full flex flex-col bg-surface-100 font-body">
	{#if $isAuthenticated && page.url.pathname !== '/login'}
			<!-- Header -->
		<header class="shadow-md sticky top-0 z-10" style="background-color: #2d5a27; color: white;">
			<div class="flex justify-between items-center p-4">
				<div class="flex items-center gap-2">
					<Leaf class="w-6 h-6" />
					<h1 class="text-xl font-bold font-header">Kratzbaum</h1>
				</div>
				<!-- Desktop Navigation -->
				<nav class="hidden sm:flex items-center gap-4">
					{#each navItems as item}
						<a 
							href={item.href} 
							class="flex items-center gap-2 px-3 py-2 rounded-md transition-colors"
							style="background-color: {page.url.pathname === item.href || (item.href === '/' && page.url.pathname.startsWith('/plants')) ? 'rgba(255,255,255,0.2)' : 'transparent'}; color: white;"
						>
							<item.icon class="w-5 h-5" />
							<span>{item.label}</span>
						</a>
					{/each}
				</nav>
				<button class="btn btn-sm variant-soft" onclick={() => auth.logout()}>
					<LogOut class="w-4 h-4" />
					<span class="hidden sm:inline">Logout</span>
				</button>
			</div>
		</header>

		<!-- Main Content -->
		<main class="flex-1 overflow-y-auto pb-20 sm:pb-0 sm:pt-4">
			<div class="container mx-auto max-w-5xl px-4">
				{@render children()}
			</div>
		</main>

		<!-- Bottom Navigation (Mobile) -->
		<nav class="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 flex justify-around p-2 z-10">
			{#each navItems as item}
				<a 
					href={item.href} 
					class="flex flex-col items-center p-2 {page.url.pathname === item.href ? 'text-primary-600' : 'text-surface-500'}"
				>
					<item.icon class="w-6 h-6" />
					<span class="text-xs mt-1">{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Sidebar (Desktop - optional, simplified as top nav for now) -->
	{:else}
		{@render children()}
	{/if}
</div>
