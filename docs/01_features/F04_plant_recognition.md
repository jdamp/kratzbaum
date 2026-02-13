# F04: Plant Recognition

## Overview
Users can identify plant species by uploading a photo, which is analyzed using the PlantNet API to provide species suggestions.

> [!WARNING]
> Status: Partially implemented.
> - Implemented: `POST /api/identify`
> - Not planned: identification history persistence endpoints

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

## PlantNet API Integration

### API Details
- **Documentation**: https://my.plantnet.org/
- **Endpoint**: `https://my-api.plantnet.org/v2/identify/{project}`
- **Authentication**: API key in query parameter

### Request Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| images | File[] | PlantNet supports one or more plant photos |
| organs | String[] | PlantNet supports one or more organ hints (leaf, flower, fruit, bark) |
| lang | String | Language for common names (e.g., "en") |

Current backend adapter behavior (`POST /api/identify`):
- Sends exactly one uploaded image (`image`) to PlantNet.
- Sends exactly one organ value (`organ`, default `leaf`).
- Transforms PlantNet payload to simplified fields used by the frontend.

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

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/identify` | Identify plant from photo (implemented) |

### Implemented Endpoint Contract
`POST /api/identify` accepts `multipart/form-data` with:
- `image` (required, image file)
- `organ` (optional, one of `leaf|flower|fruit|bark`, defaults to `leaf`)

Returns:
- `results`: top 0-5 transformed species suggestions
- `remaining_identifications`: upstream PlantNet quota hint when available
- `error`: populated string when PlantNet call fails; in this case status code is still `200`

Validation errors:
- Invalid `organ` -> `400`
- Missing/invalid image mime type -> `400`
- Empty image file -> `400`

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
- Current behavior: return `200` with `error` set and `results: []` so UI can surface a user-facing error message.
- No persistence/retry queue is planned for identification attempts.
