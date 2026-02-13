import { plantService } from '$lib/api/plants';
import type { PlantListItem, UUID } from '$lib/api/types';

interface SyncPotAssignmentParams {
	potId: UUID;
	selectedPlantId: UUID | null;
	plants: PlantListItem[];
}

/**
 * Keep the pot/plant relationship consistent from the frontend.
 * Assignment is source-of-truth on Plant.pot_id.
 */
export async function syncPotAssignment({
	potId,
	selectedPlantId,
	plants
}: SyncPotAssignmentParams): Promise<void> {
	const currentOwners = plants.filter((plant) => plant.pot_id === potId && plant.id !== selectedPlantId);

	for (const owner of currentOwners) {
		await plantService.updatePlant(owner.id, { pot_id: null });
	}

	if (!selectedPlantId) {
		return;
	}

	const selectedPlant = plants.find((plant) => plant.id === selectedPlantId);
	if (!selectedPlant) {
		throw new Error('Selected plant no longer exists.');
	}

	if (selectedPlant.pot_id === potId) {
		return;
	}

	await plantService.updatePlant(selectedPlantId, { pot_id: potId });
}
