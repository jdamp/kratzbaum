# F01: Plant Inventory

## Overview
Users can maintain a comprehensive inventory of their plants, tracking essential information and care history.

## User Stories

### US-01: View Plant List
**As a** user  
**I want to** see a list of all my plants  
**So that** I can quickly browse and manage my plant collection

**Acceptance Criteria:**
- Display plants in a grid or list view
- Show plant name, thumbnail photo, and species
- Support sorting by name, species, or last watered date
- Support filtering by species or care status (needs water, needs fertilizer)
- Support searching plants by name
- Plant-card quick actions (`Water`, `Fertilize`) provide immediate visual feedback on press:
  - show a temporary in-progress state while request is running
  - show a short success state once saved
  - show an error state/message when request fails

### US-02: Add New Plant
**As a** user  
**I want to** add a new plant to my inventory  
**So that** I can track its care over time

**Acceptance Criteria:**
- Input fields for: Name, Species (optional)
- Upload one or more photos
- Optionally assign an existing pot
- Set initial watered/fertilized/repotted dates. These dates are optional

### US-03: View Plant Details
**As a** user  
**I want to** view detailed information about a specific plant  
**So that** I can see its complete care history

**Acceptance Criteria:**
- Display all plant information
- Show photo gallery with ability to add/remove photos
- Display care timeline (watered, fertilized, repotted events)
- Show assigned pot (if any) as a clickable link to pot details
- Quick actions: Water, Fertilize, Repot
- Quick action color mapping is explicit and consistent:
  - `Water` uses water semantic color (blue)
  - `Fertilize` uses fertilizer semantic color (amber)
  - `Repot` uses repot semantic color (green)

### US-04: Update Plant Information
**As a** user  
**I want to** update my plant's information  
**So that** I can keep records accurate

**Acceptance Criteria:**
- Edit name and species
- Add/remove photos
- Change pot assignment for an already existing plant
- Select from existing available pots when assigning
- Allow clearing assignment ("No pot assigned")

### US-05: Record Care Events
**As a** user  
**I want to** record when I water, fertilize, or repot a plant  
**So that** I can track care history

**Acceptance Criteria:**
- Quick action buttons for each care type
- Default to current date/time, but allow backdating
- Optional notes field for care events
- Update "last watered/fertilized/repotted" automatically
- After submitting a care event from a quick action, the originating button shows a visible confirmation state before returning to default.

### US-06: Delete Plant
**As a** user  
**I want to** remove a plant from my inventory  
**So that** I can keep my collection current

**Acceptance Criteria:**
- Confirmation dialog before deletion
- Option to keep or delete associated photos
- Unassign pot relationship

---

## Data Model

### Plant Entity
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| name | String | Yes | User-defined name |
| species | String | No | Scientific or common name |
| created_at | DateTime | Yes | When plant was added |
| pot_id | UUID | No | Foreign key to Pot |

### PlantPhoto Entity
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| plant_id | UUID | Yes | Foreign key to Plant |
| file_path | String | Yes | Path to stored image |
| is_primary | Boolean | Yes | Is this the thumbnail? |
| uploaded_at | DateTime | Yes | Upload timestamp |

### CareEvent Entity
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| plant_id | UUID | Yes | Foreign key to Plant |
| event_type | Enum | Yes | WATERED, FERTILIZED, REPOTTED |
| event_date | DateTime | Yes | When the event occurred |
| notes | String | No | Optional notes |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plants` | List all plants |
| POST | `/api/plants` | Create new plant |
| GET | `/api/plants/{id}` | Get plant details |
| PUT | `/api/plants/{id}` | Update plant |
| DELETE | `/api/plants/{id}` | Delete plant |
| POST | `/api/plants/{id}/photos` | Upload photo |
| DELETE | `/api/plants/{id}/photos/{photo_id}` | Delete photo |
| POST | `/api/plants/{id}/care-events` | Record care event |
| GET | `/api/plants/{id}/care-events` | Get care history |
