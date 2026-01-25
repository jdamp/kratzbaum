# F04: Plant Recognition

## Overview
Users can identify plant species by uploading a photo, which is analyzed using the PlantNet API to provide species suggestions.

## User Stories

### US-01: Identify Plant from Photo
**As a** user  
**I want to** upload a photo of a plant to identify its species  
**So that** I can correctly label my plant

**Acceptance Criteria:**
- Take or upload a photo from device
- Send to PlantNet API for identification
- Display top 3-5 species suggestions with confidence scores
- Show common name and scientific name for each suggestion
- Allow user to select the correct species to update plant record

### US-02: Identify New Plant During Creation
**As a** user  
**I want to** identify a plant while adding it to my inventory  
**So that** I can add it with the correct species from the start

**Acceptance Criteria:**
- "Identify" button on new plant form
- Photo picker or camera input
- Species suggestions populate the species field

### US-03: Re-identify Existing Plant
**As a** user  
**I want to** re-identify an existing plant  
**So that** I can correct or verify its species

**Acceptance Criteria:**
- "Identify" action on plant detail view
- Use existing photos or take new one
- Show current species vs suggestions
- Update species on user confirmation

### US-04: View Identification History
**As a** user  
**I want to** see past identification attempts  
**So that** I can review what was suggested

**Acceptance Criteria:**
- History of identification requests per plant
- Show photo used, suggestions received, and selection made

---

## PlantNet API Integration

### API Details
- **Documentation**: https://my.plantnet.org/
- **Endpoint**: `https://my-api.plantnet.org/v2/identify/{project}`
- **Authentication**: API key in query parameter

### Request Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| images | File[] | One or more plant photos |
| organs | String[] | Plant part in photo (leaf, flower, fruit, bark) |
| lang | String | Language for common names (e.g., "en") |

### Response Structure
```json
{
  "results": [
    {
      "score": 0.85,
      "species": {
        "scientificNameWithoutAuthor": "Monstera deliciosa",
        "commonNames": ["Swiss Cheese Plant", "Monster Fruit"]
      }
    }
  ]
}
```

---

## Data Model

### PlantIdentification Entity
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| plant_id | UUID | No | FK to Plant (null if standalone) |
| photo_path | String | Yes | Photo used for identification |
| organ | Enum | Yes | LEAF, FLOWER, FRUIT, BARK |
| results | JSON | Yes | API response stored as JSON |
| selected_species | String | No | User-selected species from results |
| requested_at | DateTime | Yes | When identification was requested |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/identify` | Identify plant from photo |
| POST | `/api/plants/{id}/identify` | Identify and update existing plant |
| GET | `/api/plants/{id}/identifications` | Get identification history |

---

## Implementation Notes

> [!CAUTION]
> PlantNet API considerations:

1. **API Key Security** - Store API key in environment variables, never in code
2. **Rate Limiting** - Check API limits (typically 500 requests/day for free tier)
3. **Error Handling** - Handle API timeouts and rate limit errors gracefully
4. **Organ Selection** - Prompt user to specify which part of plant is in photo
5. **Image Optimization** - Resize/compress images before sending to API
6. **Caching** - Consider caching results to avoid repeated API calls

### Fallback Strategy
If PlantNet API is unavailable:
- Queue identification request for retry
- Show user that identification is pending
- Process when API becomes available
