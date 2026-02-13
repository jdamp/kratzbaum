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

export interface PlantCreate {
	name: string;
	species?: string;
	pot_id?: UUID;
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
	primary_photo_url: string | null;
	plant_id: UUID | null;
	plant_name: string | null;
	created_at: string;
}

export interface PotCreate {
	name: string;
	diameter_cm: number;
	height_cm: number;
}

export interface PotDetail extends Pot {
	photos: PotPhoto[];
}

export interface PotPhoto {
	id: UUID;
	url: string;
	is_primary: boolean;
	uploaded_at: string;
}

export interface ReminderListItem {
	id: UUID;
	plant_id: UUID;
	plant_name: string;
	reminder_type: ReminderType;
	is_enabled: boolean;
	next_due: string;
	created_at: string;
}

export type Reminder = ReminderListItem;

export interface ReminderSettings {
	default_watering_interval: number | null;
	default_fertilizing_interval: number | null;
	preferred_reminder_time: string;
}

export interface ReminderSettingsUpdate {
	default_watering_interval?: number | null;
	default_fertilizing_interval?: number | null;
	preferred_reminder_time?: string;
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
