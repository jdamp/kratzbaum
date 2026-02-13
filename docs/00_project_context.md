# Kratzbaum - Project Context

## Vision
Kratzbaum is a self-hosted plant management system that helps users track their houseplants, manage watering and fertilizing schedules, and identify plant species using AI. The application is designed to be accessible from desktop browsers and work natively on iPhones as a Progressive Web App (PWA).

## Core Goals
1. **Plant Tracking** - Maintain a comprehensive inventory of plants with photos, species, and care history
2. **Smart Reminders** - Set up customizable reminders for watering and fertilizing schedules
3. **Pot Inventory** - Track available pots and their assignments to plants
4. **Species Recognition** - Identify plants from photos via `POST /api/identify` (PlantNet-backed)

---

## Technology Stack

### Backend
| Component | Technology | Notes |
|-----------|------------|-------|
| Language | Python 3.11+ | Modern async support |
| Framework | FastAPI | High-performance async API |
| ORM | SQLModel | SQLAlchemy + Pydantic integration |
| Database | PostgreSQL | Production database |
| Authentication | Basic Auth + JWT | Extensible to OAuth later |
| File Storage | Local filesystem | For plant and pot photos |
| Scheduler | APScheduler | In-process scheduler with DB persistence |
| Package & Project Management | uv | To manage dependencies and project structure |

### Frontend
| Component | Technology | Notes |
|-----------|------------|-------|
| Framework | SvelteKit | Fast, simple, built-in SSR |
| Component Library | Skeleton UI | Svelte-native, Tailwind-based |
| Styling | Tailwind CSS | Utility-first CSS |
| State Management | Svelte stores | Built-in reactivity |
| PWA | SvelteKit service worker | Built-in $service-worker module |
| Icons | Lucide Svelte | Consistent icon set |

### Infrastructure
| Component | Technology | Notes |
|-----------|------------|-------|
| Containerization | Docker | Multi-stage builds |
| Deployment | Docker Compose | Single-node deployment |

---

## Design System

### Typography
- **Headers**: Roboto (Google Fonts)
- **Body**: Open Sans (Google Fonts)

### Color Palette
Nature-inspired palette:
- Primary: Forest Green (`#2D5A27`)
- Secondary: Leaf Green (`#4CAF50`)
- Accent: Earth Brown (`#795548`)
- Background: Off-white (`#F5F5F5`)
- Surface: White (`#FFFFFF`)
- Error: Coral Red (`#F44336`)

---

## Constraints & Non-Functional Requirements

### Performance
- API response time < 200ms for typical requests
- Image upload and processing < 3 seconds

### Security
- HTTPS required for all connections
- Password hashing with bcrypt
- Rate limiting on authentication endpoints
- PlantNet API key configurable in-app and stored in backend settings

### Scalability
- Single-user initially (multi-user support can be added later)
- Support for 100+ plants
- Photo storage up to 10MB per image

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Multi-user support | Single-user to start |
| Notification delivery | Push notifications (PWA) |
| Photo storage | Local filesystem |
| PlantNet API tier | Free tier (500 req/day) |
| Background tasks | APScheduler (no Celery/Redis) |
| Room/location tracking | Not required |
| Pot material/drainage | Not tracked |
| Offline support | Not required |
| Authentication | Basic auth, extensible to OAuth |
