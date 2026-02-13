# API Contracts

## Base URL
```
https://your-domain.com/api/v1
```

## Authentication

All endpoints except `/auth/login` and `/auth/register` require authentication via Bearer token.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## Auth Endpoints

### POST /auth/register
Create a new user account.

**Request:**
```json
{
  "username": "plantlover",
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "plantlover",
  "email": "user@example.com",
  "created_at": "2024-01-15T10:30:00Z"
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

## Plant Endpoints

### GET /plants
List all plants for the authenticated user.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| sort | string | Field to sort by: `name`, `species`, `created_at` |
| order | string | Sort order: `asc`, `desc` |
| species | string | Filter by species |
| needs_water | boolean | Filter plants due for watering |

**Response (200):**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Monstera",
      "species": "Monstera deliciosa",
      "primary_photo_url": "/uploads/plants/abc123.jpg",
      "pot": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Large Terracotta"
      },
      "last_watered": "2024-01-14T10:00:00Z",
      "last_fertilized": "2024-01-01T10:00:00Z",
      "created_at": "2024-01-01T10:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "per_page": 20
}
```

### POST /plants
Create a new plant.

**Request (multipart/form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Plant name |
| species | string | No | Species name |
| pot_id | uuid | No | Assign to pot |
| photos | file[] | No | One or more photos |

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Monstera",
  "species": "Monstera deliciosa",
  "pot_id": null,
  "photos": [],
  "created_at": "2024-01-15T10:30:00Z"
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
  "pot": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Large Terracotta",
    "diameter_cm": 25.0,
    "height_cm": 20.0
  },
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
  "reminders": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "type": "WATERING",
      "next_due": "2024-01-17T10:00:00Z",
      "is_enabled": true
    }
  ],
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

**Response (201):**
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "plant_id": "550e8400-e29b-41d4-a716-446655440000",
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
| from_date | datetime | Start date |
| to_date | datetime | End date |

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
Identify a plant from photo.

**Request (multipart/form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | file | Yes | Plant photo |
| organ | string | Yes | Plant part: leaf, flower, fruit, bark |
| plant_id | uuid | No | Associate with existing plant |

**Response (200):**
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440005",
  "results": [
    {
      "score": 0.85,
      "scientific_name": "Monstera deliciosa",
      "common_names": ["Swiss Cheese Plant", "Monster Fruit"],
      "family": "Araceae"
    },
    {
      "score": 0.10,
      "scientific_name": "Philodendron bipinnatifidum",
      "common_names": ["Tree Philodendron"],
      "family": "Araceae"
    }
  ],
  "requested_at": "2024-01-15T10:30:00Z"
}
```

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
