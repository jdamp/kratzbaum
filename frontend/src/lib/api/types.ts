export type UUID = string;

export enum CareEventType {
	WATERED = 'WATERED',
	FERTILIZED = 'FERTILIZED',
	REPOTTED = 'REPOTTED'
}

export enum ReminderType {
	WATERING = 'WATERING',
	FERTILIZING = 'FERTILIZING'
}

export enum FrequencyType {
	DAILY = 'DAILY',
	INTERVAL = 'INTERVAL',
	WEEKLY = 'WEEKLY',
	SPECIFIC_DAYS = 'SPECIFIC_DAYS'
}

export interface Plant {
	id: UUID;
	name: string;
	species: string | null;
	primary_photo_url: string | null;
	pot: {
		id: UUID;
		name: string;
	} | null;
	last_watered: string | null;
	last_fertilized: string | null;
	last_repotted: string | null;
	created_at: string;
	updated_at: string;
}

export interface PlantDetail extends Plant {
	photos: PlantPhoto[];
	reminders: Reminder[];
}

export interface PlantPhoto {
	id: UUID;
	url: string;
	is_primary: boolean;
	uploaded_at: string;
}

export interface CareEvent {
	id: UUID;
	plant_id: UUID;
	event_type: CareEventType;
	event_date: string;
	notes: string | null;
	created_at: string;
}

export interface Pot {
	id: UUID;
	name: string;
	diameter_cm: number;
	height_cm: number;
	is_assigned?: boolean;
	assigned_plant_name?: string | null;
	created_at: string;
	updated_at: string;
}

export interface PotDetail extends Pot {
	photos: PotPhoto[];
	plant: {
		id: UUID;
		name: string;
	} | null;
}

export interface PotPhoto {
	id: UUID;
	url: string;
	is_primary: boolean;
	uploaded_at: string;
}

export interface Reminder {
	id: UUID;
	plant_id: UUID;
	reminder_type: ReminderType;
	frequency_type: FrequencyType;
	frequency_value: number | null;
	specific_days: number[] | null;
	preferred_time: string;
	is_enabled: boolean;
	dormant_start: number | null;
	dormant_end: number | null;
	next_due: string;
	created_at: string;
	updated_at: string;
}

export interface AuthResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
}

export interface ApiError {
	detail: {
		code: string;
		message: string;
		errors?: Array<{
			field: string;
			message: string;
		}>;
	};
}
