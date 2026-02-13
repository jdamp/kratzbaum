# API Contracts

## Base URL
```
https://your-domain.com/api
```

## Authentication

Auth endpoints (`/auth/setup`, `/auth/login`, `/auth/refresh`) do not require `Authorization` headers.
All other endpoints require authentication via Bearer token.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## Auth Endpoints

### POST /auth/setup
Create the single local user (only available before initial setup).

**Request:**
```json
{
  "username": "plantlover",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "message": "User created successfully",
  "username": "plantlover"
}
```

### POST /auth/login
Authenticate and receive JWT token.

**Request:**
```json
{
  "username": "plantlover",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### POST /auth/refresh
Refresh an expired token.

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

---

## Settings Endpoints

### GET /settings/reminders
Get global reminder defaults.

### PUT /settings/reminders
Update global reminder defaults.

### GET /settings/plantnet
Get PlantNet integration settings (planned).

**Response (200):**
```json
{
  "is_configured": true,
  "masked_api_key": "pl***9k",
  "updated_at": "2026-02-13T12:00:00Z"
}
```

Notes:
- `masked_api_key` is optional and should never reveal the full secret.
- This endpoint is intended for frontend configuration UX and does not expose raw keys.

### PUT /settings/plantnet
Create/update PlantNet API key (planned).

**Request (application/json):**
```json
{
  "api_key": "pl-xxxxxxxxxxxxxxxx"
}
```

**Response (200):**
```json
{
  "is_configured": true,
  "masked_api_key": "pl***xx",
  "updated_at": "2026-02-13T12:00:00Z"
}
```

---

## Plant Endpoints

### GET /plants
List all plants for the authenticated user.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| sort | string | Field to sort by: `name`, `species`, `created_at` |
| order | string | Sort order: `asc`, `desc` |
| search | string | Optional case-insensitive name search |

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Monstera",
    "species": "Monstera deliciosa",
    "pot_id": "660e8400-e29b-41d4-a716-446655440001",
    "watering_interval": 7,
    "fertilizing_interval": 30,
    "primary_photo_url": "/uploads/plants/abc123.jpg",
    "created_at": "2024-01-01T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

### POST /plants
Create a new plant.

**Request (application/json):**
```json
{
  "name": "My Monstera",
  "species": "Monstera deliciosa",
  "pot_id": "660e8400-e29b-41d4-a716-446655440001",
  "watering_interval": 7,
  "fertilizing_interval": 30
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Monstera",
  "species": "Monstera deliciosa",
  "pot_id": "660e8400-e29b-41d4-a716-446655440001",
  "watering_interval": 7,
  "fertilizing_interval": 30,
  "primary_photo_url": null,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### GET /plants/{id}
Get plant details.

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Monstera",
  "species": "Monstera deliciosa",
  "pot_id": "660e8400-e29b-41d4-a716-446655440001",
  "watering_interval": 7,
  "fertilizing_interval": 30,
  "primary_photo_url": "/uploads/plants/abc123.jpg",
  "photos": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "url": "/uploads/plants/abc123.jpg",
      "is_primary": true,
      "uploaded_at": "2024-01-15T10:30:00Z"
    }
  ],
  "last_watered": "2024-01-14T10:00:00Z",
  "last_fertilized": "2024-01-01T10:00:00Z",
  "last_repotted": "2023-06-01T10:00:00Z",
  "created_at": "2024-01-01T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### PUT /plants/{id}
Update a plant.

**Request:**
```json
{
  "name": "Monstera Deliciosa",
  "species": "Monstera deliciosa",
  "pot_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

### DELETE /plants/{id}
Delete a plant.

**Response (204):** No content

---

## Care Events Endpoints

### POST /plants/{id}/care-events
Record a care event.

**Request:**
```json
{
  "event_type": "WATERED",
  "event_date": "2024-01-15T10:00:00Z",
  "notes": "Used filtered water"
}
```

**Response (200):**
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "event_type": "WATERED",
  "event_date": "2024-01-15T10:00:00Z",
  "notes": "Used filtered water",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### GET /plants/{id}/care-events
Get care history.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| event_type | string | Filter by type |

---

## Reminder Endpoints

### GET /reminders
List all reminders.

**Response (200):**
```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "plant_id": "550e8400-e29b-41d4-a716-446655440000",
    "plant_name": "My Monstera",
    "reminder_type": "WATERING",
    "next_due": "2024-01-17T09:00:00Z",
    "is_enabled": true,
    "created_at": "2024-01-01T10:30:00Z"
  }
]
```

### GET /reminders/upcoming
List enabled reminders due within the next `days` (default: `7`).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| days | integer | Number of days to include (default `7`) |

**Response (200):**
```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "plant_id": "550e8400-e29b-41d4-a716-446655440000",
    "plant_name": "My Monstera",
    "reminder_type": "WATERING",
    "next_due": "2024-01-17T09:00:00Z",
    "is_enabled": true,
    "created_at": "2024-01-01T10:30:00Z"
  }
]
```

### POST /reminders/{id}/snooze
Snooze reminder.

**Request:**
```json
{
  "snooze_hours": 3
}
```

**Response (200):**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "plant_id": "550e8400-e29b-41d4-a716-446655440000",
  "plant_name": "My Monstera",
  "reminder_type": "WATERING",
  "next_due": "2024-01-15T13:00:00Z",
  "is_enabled": true,
  "created_at": "2024-01-01T10:30:00Z"
}
```

### DELETE /reminders/{id}
Delete a reminder.

**Response (204):** No content

---

## Pot Endpoints

### GET /pots
List all pots.

### POST /pots
Create a pot.

### GET /pots/{id}
Get pot details.

### PUT /pots/{id}
Update a pot.

### DELETE /pots/{id}
Delete a pot.

### GET /pots/available
List unassigned pots.

---

## Plant Identification Endpoints

### POST /identify
Identify a plant from photo (proxied to PlantNet API).

**Auth:** Bearer token required.

**Request (multipart/form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | file | Yes | Plant photo (must be an image MIME type) |
| organ | string | No | Plant part: `leaf`, `flower`, `fruit`, `bark` (default: `leaf`) |

**Response (200):**
```json
{
  "results": [
    {
      "score": 0.85,
      "scientific_name": "Monstera deliciosa",
      "common_names": ["Swiss Cheese Plant", "Monster Fruit"],
      "family": "Araceae",
      "genus": "Monstera"
    },
    {
      "score": 0.10,
      "scientific_name": "Philodendron bipinnatifidum",
      "common_names": ["Tree Philodendron"],
      "family": "Araceae",
      "genus": "Philodendron"
    }
  ],
  "error": null,
  "remaining_identifications": 100
}
```

**Behavior notes:**
- Service-level PlantNet failures (e.g. missing API key or non-200 upstream response) return `200` with `error` populated and an empty `results` list.
- Missing-key failures should also include `error_code: "MISSING_API_KEY"` so frontend can show explicit configuration guidance.
- Invalid organ value returns `400` with `detail` string.
- Empty uploads return `400` with `detail` string.
- Non-image uploads return `400` with `detail` string.
- Frontend usage paths: `/plants/new` and `/plants/{id}` edit modal.

---

## Error Responses

All errors follow this format:

```json
{
  "detail": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "errors": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 422 | Invalid request data |
| NOT_FOUND | 404 | Resource not found |
| UNAUTHORIZED | 401 | Missing or invalid auth |
| FORBIDDEN | 403 | Access denied |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
