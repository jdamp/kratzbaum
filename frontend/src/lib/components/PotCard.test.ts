import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { Pot } from '$lib/api/types';
import PotCard from './PotCard.svelte';

function createPot(overrides: Partial<Pot> = {}): Pot {
	return {
		id: 'pot-1',
		name: 'Terracotta Pot',
		diameter_cm: 14,
		height_cm: 20,
		primary_photo_url: '/uploads/pot.jpg',
		plant_id: 'plant-1',
		plant_name: 'Monstera',
		created_at: new Date().toISOString(),
		...overrides
	};
}

describe('PotCard', () => {
	it('renders linked pot details with assigned plant', () => {
		const pot = createPot();

		render(PotCard, { props: { pot } });

		expect(screen.getByRole('heading', { name: pot.name })).toBeInTheDocument();
		expect(screen.getByText('14cm × 20cm')).toBeInTheDocument();
		expect(screen.getByText('Monstera')).toBeInTheDocument();

		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', `/pots/${pot.id}`);

		const image = screen.getByAltText(pot.name);
		expect(image).toHaveAttribute('src', pot.primary_photo_url);
	});

	it('shows available state when no plant is assigned', () => {
		const pot = createPot({
			primary_photo_url: null,
			plant_id: null,
			plant_name: null
		});

		render(PotCard, { props: { pot } });

		expect(screen.getByText('Available')).toBeInTheDocument();
		expect(screen.queryByAltText(pot.name)).not.toBeInTheDocument();
	});
});
