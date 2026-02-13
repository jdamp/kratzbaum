import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { Plant } from '$lib/api/types';
import PlantCard from './PlantCard.svelte';

vi.mock('$lib/api/plants', () => ({
	plantService: {
		recordCareEvent: vi.fn()
	}
}));

function createPlant(overrides: Partial<Plant> = {}): Plant {
	const now = new Date().toISOString();
	return {
		id: 'plant-1',
		name: 'Monstera',
		species: 'Monstera deliciosa',
		primary_photo_url: 'plant.jpg',
		pot: null,
		last_watered: '2026-02-10T12:00:00Z',
		last_fertilized: null,
		last_repotted: null,
		created_at: now,
		updated_at: now,
		...overrides
	};
}

describe('PlantCard', () => {
	it('renders plant info, link target, and photo URL normalization', () => {
		const plant = createPlant();

		render(PlantCard, { props: { plant } });

		expect(screen.getByRole('heading', { name: plant.name })).toBeInTheDocument();
		expect(screen.getByText(plant.species as string)).toBeInTheDocument();

		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', `/plants/${plant.id}`);

		const image = screen.getByAltText(plant.name);
		expect(image).toHaveAttribute('src', '/uploads/plant.jpg');

		const expectedDate = new Date(plant.last_watered as string).toLocaleDateString();
		expect(screen.getByText(`Watered: ${expectedDate}`)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Water/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Fertilize/i })).toBeInTheDocument();
	});

	it('renders fallbacks when optional fields are missing', () => {
		const plant = createPlant({
			species: null,
			primary_photo_url: null,
			last_watered: null
		});

		render(PlantCard, { props: { plant } });

		expect(screen.getByText('Unknown species')).toBeInTheDocument();
		expect(screen.queryByAltText(plant.name)).not.toBeInTheDocument();
		expect(screen.queryByText(/Watered:/)).not.toBeInTheDocument();
	});
});
