# F02: Reminders

## Overview
Users can set up customizable reminders for plant care activities, ensuring they never forget to water or fertilize their plants.

## User Stories

### US-01: Create Watering Reminder
**As a** user  
**I want to** set a recurring watering reminder for a plant  
**So that** I remember to water it regularly

**Acceptance Criteria:**
- Select frequency: daily, every X days, weekly, specific days
- Set preferred time for reminder
- Enable/disable reminder without deleting
- Override for different seasons (summer vs winter frequency)

### US-02: Create Fertilizing Reminder
**As a** user  
**I want to** set a fertilizing reminder for a plant  
**So that** I remember to feed it appropriately

**Acceptance Criteria:**
- Select frequency: weekly, monthly, every X weeks
- Set preferred time for reminder
- Enable dormant season pause (winter months)

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

### Reminder Entity
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| plant_id | UUID | Yes | Foreign key to Plant |
| reminder_type | Enum | Yes | WATERING, FERTILIZING |
| frequency_type | Enum | Yes | DAILY, DAYS_INTERVAL, WEEKLY, SPECIFIC_DAYS |
| frequency_value | Integer | Conditional | Days interval or null |
| specific_days | Array[Int] | Conditional | Day of week (0=Mon, 6=Sun) |
| preferred_time | Time | Yes | When to send reminder |
| is_enabled | Boolean | Yes | Is reminder active? |
| dormant_start | Integer | No | Month (1-12) when to pause |
| dormant_end | Integer | No | Month (1-12) when to resume |
| next_due | DateTime | Yes | Next scheduled reminder |
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

