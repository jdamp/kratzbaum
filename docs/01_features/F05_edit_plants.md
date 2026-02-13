# F05: Edit Plants

## Overview
Users can update an existing plant's details from the plant detail page, including name, species, pot assignment, and photos.

## User Stories

### US-01: Edit Core Plant Fields
**As a** user  
**I want to** edit an existing plant's name/species/pot  
**So that** my plant data stays accurate over time

**Acceptance Criteria:**
- Open edit modal from `/plants/{id}`
- Update name and species fields
- Reassign or clear pot assignment
- Save persists changes through `PUT /api/plants/{id}`

### US-02: Manage Plant Photos During Edit
**As a** user  
**I want to** add or remove photos while editing  
**So that** the plant gallery stays current

**Acceptance Criteria:**
- Upload new photos from edit modal
- Delete existing photos from edit modal
- Newly uploaded photos are available immediately for identification

### US-03: Identify Species While Editing
**As a** user  
**I want to** run identification while editing an existing plant  
**So that** I can apply a suggested species directly

**Acceptance Criteria:**
- Species field includes an "Identify" action
- Identify runs against a selected plant photo
- User can select a suggestion to populate species input
- Missing API key errors show settings guidance
