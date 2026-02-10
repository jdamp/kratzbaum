# F02: Reminders

## Overview
Users can set up customizable reminders for plant care activities, ensuring they never forget to water or fertilize their plants.

## User Stories

### US-01: Global Reminder Intervals
**As a** user  
**I want to** configure global watering and fertilizing intervals  
**So that** I am automatically reminded to care for my plants by default

**Acceptance Criteria:**
- Set global `default_watering_interval` (number of days)
- Set global `default_fertilizing_interval` (number of days)
- Global settings apply to all plants without custom settings
- Reminders are triggered when the time since the last care event exceeds the interval

### US-02: Plant-Specific Overrides
**As a** user  
**I want to** set custom care intervals for a specific plant  
**So that** I can care for plants with special needs (e.g. succulents that need less water)

**Acceptance Criteria:**
- Set `watering_interval` override for a specific plant
- Set `fertilizing_interval` override for a specific plant
- Plant overrides take precedence over global settings
- Option to reset a plant to use "Global Defaults" (clearing the overrides)

### US-03: View Upcoming Reminders
**As a** user  
**I want to** see all upcoming reminders  
**So that** I can plan my plant care activities

**Acceptance Criteria:**
- Calendar or list view of upcoming reminders
- Filter by reminder type (watering, fertilizing)
- Show overdue reminders prominently

### US-04: Mark Reminder Complete
**As a** user  
**I want to** mark a reminder as complete  
**So that** it reschedules to the next occurrence

**Acceptance Criteria:**
- One-tap completion from reminder
- Automatically records care event for the plant
- Reschedule next reminder based on frequency

### US-05: Snooze Reminder
**As a** user  
**I want to** snooze a reminder  
**So that** I can be reminded again later

**Acceptance Criteria:**
- Snooze options: 1 hour, 3 hours, tomorrow
- Show snoozed status on reminder

### US-06: Receive Notifications
**As a** user  
**I want to** receive notifications for my reminders  
**So that** I'm alerted even when not using the app

**Acceptance Criteria:**
- Push notification via PWA (Web Push API)
- Notification shows plant name and care type
- Tap notification opens plant detail view
- Permission prompt on first app visit

---

## Data Model

### Global Settings
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| default_watering_interval | Integer | No | Global days between watering (default: null/off) |
| default_fertilizing_interval | Integer | No | Global days between fertilizing (default: null/off) |

### Plant Entity (Reminders Extension)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| watering_interval | Integer | No | Custom days between watering (overrides global) |
| fertilizing_interval | Integer | No | Custom days between fertilizing (overrides global) |

### Reminder Entity (Internal Tracking)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| plant_id | UUID | Yes | Foreign key to Plant |
| reminder_type | Enum | Yes | WATERING, FERTILIZING |
| next_due | DateTime | Yes | Next scheduled reminder (calculated) |
| preferred_time | Time | Yes | When to send reminder (global or per plant) |
| is_enabled | Boolean | Yes | Is reminder active? |
| created_at | DateTime | Yes | When reminder was created |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reminders` | List all reminders |
| POST | `/api/reminders` | Create new reminder |
| GET | `/api/reminders/{id}` | Get reminder details |
| PUT | `/api/reminders/{id}` | Update reminder |
| DELETE | `/api/reminders/{id}` | Delete reminder |
| POST | `/api/reminders/{id}/complete` | Mark complete |
| POST | `/api/reminders/{id}/snooze` | Snooze reminder |
| GET | `/api/reminders/upcoming` | Get upcoming reminders |
| GET | `/api/reminders/overdue` | Get overdue reminders |
| POST | `/api/push/subscribe` | Register push subscription |
| DELETE | `/api/push/subscribe` | Unsubscribe from push |

---

## Push Notification Implementation

### Backend (pywebpush)
```python
from pywebpush import webpush, WebPushException

def send_push_notification(subscription: PushSubscription, title: str, body: str):
    webpush(
        subscription_info={
            "endpoint": subscription.endpoint,
            "keys": {
                "p256dh": subscription.p256dh_key,
                "auth": subscription.auth_key
            }
        },
        data=json.dumps({"title": title, "body": body}),
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims={"sub": "mailto:admin@kratzbaum.local"}
    )
```

### Frontend (Service Worker)
```javascript
// sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png'
  });
});
```

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Notification type | PWA Push notifications only |
| Email notifications | Not implemented |
| Timezone handling | Use server timezone (single user) |
| Batch notifications | No, send individual notifications |

