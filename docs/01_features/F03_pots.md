# F03: Pot Inventory

## Overview
Users can maintain an inventory of their plant pots, tracking sizes and photos, and optionally assigning pots to specific plants.

## User Stories

### US-01: View Pot Inventory
**As a** user  
**I want to** see a list of all my pots  
**So that** I can manage my pot collection

**Acceptance Criteria:**
- Display pots in a grid or list view
- Show pot name, size, and thumbnail photo
- Indicate if pot is assigned to a plant (show plant name)
- Filter by: available, in-use, size range

### US-02: Add New Pot
**As a** user  
**I want to** add a new pot to my inventory  
**So that** I can track it and assign it to plants

**Acceptance Criteria:**
- Input fields for: Name, Diameter (cm), Height (cm)
- Upload one or more photos
- Optionally assign to an existing plant

### US-03: View Pot Details
**As a** user  
**I want to** view detailed information about a pot  
**So that** I can see its specifications and status

**Acceptance Criteria:**
- Display pot name, dimensions
- Show photo gallery
- Show assigned plant (if any) with link to plant details
- History of plants that have used this pot (optional)

### US-04: Update Pot Information
**As a** user  
**I want to** update my pot's information  
**So that** I can keep records accurate

**Acceptance Criteria:**
- Edit name and dimensions
- Add/remove photos
- Change plant assignment

### US-05: Assign Pot to Plant
**As a** user  
**I want to** assign a pot to a plant  
**So that** I can track which pot each plant is in

**Acceptance Criteria:**
- Select from available (unassigned) pots
- If pot already assigned, show warning and option to reassign
- Update both pot and plant records

### US-06: Delete Pot
**As a** user  
**I want to** remove a pot from my inventory  
**So that** I can keep my collection current

**Acceptance Criteria:**
- Confirmation dialog before deletion
- If assigned to plant, require unassignment first or provide option

---

## Data Model

### Pot Entity
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| name | String | Yes | User-defined name |
| diameter_cm | Float | Yes | Diameter in centimeters |
| height_cm | Float | Yes | Height in centimeters |
| created_at | DateTime | Yes | When pot was added |

### PotPhoto Entity
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| pot_id | UUID | Yes | Foreign key to Pot |
| file_path | String | Yes | Path to stored image |
| is_primary | Boolean | Yes | Is this the thumbnail? |
| uploaded_at | DateTime | Yes | Upload timestamp |

> [!NOTE]
> The Plant entity has a `pot_id` foreign key to establish the one-to-one relationship.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pots` | List all pots |
| POST | `/api/pots` | Create new pot |
| GET | `/api/pots/{id}` | Get pot details |
| PUT | `/api/pots/{id}` | Update pot |
| DELETE | `/api/pots/{id}` | Delete pot |
| POST | `/api/pots/{id}/photos` | Upload photo |
| DELETE | `/api/pots/{id}/photos/{photo_id}` | Delete photo |
| GET | `/api/pots/available` | List unassigned pots |

---

## Additional Considerations

- **Material tracking** - Should we track pot material (ceramic, plastic, terracotta)? -> No
- **Drainage** - Track if pot has drainage holes? -> No
- **Color** - Track pot color for aesthetic matching? -> No
