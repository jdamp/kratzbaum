# User Flows

## Overview
This document describes the primary user journeys through the Kratzbaum application.

---

## UF-01: Onboarding & First Plant

```mermaid
flowchart TD
    A[Open App] --> B{Logged In?}
    B -->|No| C[Login/Register Screen]
    C --> D[Enter Credentials]
    D --> E{Valid?}
    E -->|No| C
    E -->|Yes| F[Dashboard - Empty State]
    B -->|Yes| G[Dashboard]
    
    F --> H["Add First Plant" CTA]
    H --> I[New Plant Form]
    I --> J[Take/Upload Photo]
    J --> K{Want to Identify?}
    K -->|Yes| L[PlantNet Identification]
    L --> M[Select Species]
    K -->|No| N[Manual Species Entry]
    M --> O[Save Plant]
    N --> O
    O --> P[Plant Added - Dashboard]
```

---

## UF-02: Daily Plant Care

```mermaid
flowchart TD
    A[Open App] --> B[Dashboard]
    B --> C{Notifications Badge?}
    C -->|Yes| D[View Reminders Due]
    D --> E[Select Plant]
    E --> F["Quick Action: Water"]
    F --> G[Confirm Action]
    G --> H[Care Event Recorded]
    H --> I[Reminder Rescheduled]
    I --> J[Next Plant or Dashboard]
    
    C -->|No| K[Browse Plants]
    K --> L[Select Plant]
    L --> M[View Details]
    M --> N{Action Needed?}
    N -->|Water| O["Tap Water Button"]
    N -->|Fertilize| P["Tap Fertilize Button"]
    N -->|Repot| Q["Tap Repot Button"]
    O --> G
    P --> G
    Q --> G
```

---

## UF-03: Adding a New Plant

```mermaid
flowchart TD
    A[Dashboard] --> B["Tap + Button"]
    B --> C[New Plant Screen]
    
    C --> D[Enter Name]
    D --> E{Add Photo?}
    E -->|Camera| F[Take Photo]
    E -->|Gallery| G[Select Photo]
    E -->|Skip| H[No Photo]
    
    F --> I{Identify Species?}
    G --> I
    H --> J[Manual Species]
    
    I -->|Yes| K[Select Organ Type]
    K --> L[Call PlantNet API]
    L --> M{Results Found?}
    M -->|Yes| N[Show Suggestions]
    N --> O[Select Species]
    M -->|No| J
    
    I -->|No| J
    
    O --> P{Assign Pot?}
    J --> P
    
    P -->|Yes| Q[Select from Available]
    P -->|No| R[Skip Pot]
    
    Q --> S[Review & Save]
    R --> S
    S --> T[Plant Created]
    T --> U[Plant Detail View]
```

---

## UF-04: Setting Up Reminders

```mermaid
flowchart TD
    A[Plant Detail View] --> B["Tap Reminders"]
    B --> C{Existing Reminders?}
    C -->|Yes| D[List Reminders]
    C -->|No| E[Empty State]
    
    D --> F["Tap + or Edit"]
    E --> F
    
    F --> G[Reminder Form]
    G --> H[Select Type]
    H --> I[Watering]
    H --> J[Fertilizing]
    
    I --> K[Set Frequency]
    J --> K
    
    K --> L{Frequency Type}
    L -->|Every X Days| M[Enter Days]
    L -->|Weekly| N[Select Days]
    L -->|Monthly| O[Select Day of Month]
    
    M --> P[Set Time]
    N --> P
    O --> P
    
    P --> Q{Dormant Period?}
    Q -->|Yes| R[Set Start/End Months]
    Q -->|No| S[Skip]
    
    R --> T[Save Reminder]
    S --> T
    
    T --> U[Reminder Active]
```

---

## UF-05: Managing Pots

```mermaid
flowchart TD
    A[Bottom Nav: Pots] --> B[Pots List]
    B --> C{Pots Exist?}
    C -->|No| D[Empty State + CTA]
    C -->|Yes| E[Display Grid/List]
    
    D --> F["Add Pot"]
    E --> F
    
    F --> G[Pot Form]
    G --> H[Enter Name]
    H --> I[Enter Dimensions]
    I --> J{Add Photo?}
    J -->|Yes| K[Take/Select Photo]
    J -->|No| L[Skip]
    
    K --> M[Save Pot]
    L --> M
    
    M --> N[Pot Created]
    
    E --> O[Tap Pot]
    O --> P[Pot Detail]
    P --> Q{Assigned to Plant?}
    Q -->|Yes| R[Show Plant Link]
    Q -->|No| S["Available" Status]
    R --> T["Tap Assign/Reassign Plant"]
    S --> T
    T --> U[Assignment Form]
    U --> V[Select Existing Plant or "No plant assigned"]
    V --> W{Selected Plant Already Has Pot?}
    W -->|Yes| X[Show Reassign Warning]
    X --> Y[Confirm Reassignment]
    W -->|No| Z[Save Assignment]
    Y --> Z
    Z --> AA[Pot + Plant Updated]
```

---

## UF-06: Plant Identification

```mermaid
flowchart TD
    A[Any Screen] --> B["Identify Button"]
    B --> C[Capture/Select Photo]
    C --> D[Select Organ Type]
    D --> E["Leaf"]
    D --> F["Flower"]
    D --> G["Fruit"]
    D --> H["Bark"]
    
    E --> I[Submit to API]
    F --> I
    G --> I
    H --> I
    
    I --> J[Loading State]
    J --> K{API Response}
    K -->|Success| L[Show Top Results]
    K -->|Error| M[Show Error + Retry]
    
    L --> N[Each Result Card]
    N --> O[Score/Confidence]
    N --> P[Scientific Name]
    N --> Q[Common Names]
    
    L --> R{Select Species?}
    R -->|Yes| S[Apply to Plant]
    R -->|Cancel| T[Dismiss]
    
    S --> U[Plant Updated]
```

---

## Screen Inventory

| Screen | Description | Key Components |
|--------|-------------|----------------|
| Setup | Initial single-user configuration | Username, password |
| Login | Authentication | Username, password |
| Dashboard | Plant overview | Grid/list view, filter, sort, FAB |
| Plant Detail | Single plant | Photo carousel, care timeline, actions |
| New/Edit Plant | Form | Name, species, photo picker, pot selector |
| Reminders List | All reminders | Grouped by date, quick actions |
| Reminder Form | Create/edit | Type, frequency, time, dormant |
| Pots List | Pot inventory | Grid/list, availability filter |
| Pot Detail | Single pot | Photos, dimensions, plant link, assign/reassign action |
| New/Edit Pot | Form | Name, dimensions, photo picker, existing plant selector |
| Identify | Species ID | Camera, organ selector, results |
| Settings | App settings | Profile, notifications, theme |
