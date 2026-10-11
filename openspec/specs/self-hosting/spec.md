# Self Hosting Specification

## Purpose

Run kratzbaum on operator-controlled infrastructure with durable media and either local SQLite or an existing PostgreSQL database.

## Requirements

### Requirement: SQLite and PostgreSQL backends
The deployment SHALL support a configurable local SQLite database and a configurable PostgreSQL connection, with equivalent catalogue, care, identification-attempt, and session behavior. SQLite SHALL be the default. Selecting PostgreSQL SHALL allow connection to an existing server without requiring a bundled database container. Connection failure SHALL NOT silently substitute a different database.

#### Scenario: Start with SQLite
- **WHEN** the operator selects a writable local SQLite file
- **THEN** the application initializes or opens that file and collection operations persist there

#### Scenario: Use existing PostgreSQL
- **WHEN** the operator supplies a valid connection to an existing PostgreSQL server
- **THEN** the application uses that database with equivalent collection and care behavior

#### Scenario: Configured database is unavailable
- **WHEN** the selected database cannot be opened or connected
- **THEN** startup fails with a useful error and no substitute collection is created

### Requirement: Versioned schema and durable data
The system SHALL apply required versioned schema migrations before accepting collection traffic and SHALL retain stored plants, activities, schedules, and photos across application restarts when configured persistence is retained. Failed migration SHALL prevent serving incompatible collection traffic.

#### Scenario: Restart a deployment
- **WHEN** the application restarts using the same database and media volume
- **THEN** its saved plants, photos, history, and schedules remain available

#### Scenario: Migration cannot complete
- **WHEN** a required migration fails
- **THEN** startup reports the failure without accepting collection writes against the incomplete schema

### Requirement: Persistent media integrity
The system SHALL store photos on a configurable persistent filesystem location, keep stored media references consistent with successful writes/deletions, and clean incomplete temporary uploads. Operators SHALL be given backup/restore instructions covering both the selected database and media.

#### Scenario: Interrupted upload
- **WHEN** photo processing or persistence fails before completion
- **THEN** no successfully published photo references a missing output file and incomplete temporary files are cleaned up

### Requirement: Self-hosted application image and configuration
The project SHALL provide an application container serving the frontend and Go API from one origin, with working HEIC decoding and documented configuration for timezone, auth, PlantNet, database, and media. Deployment examples SHALL cover local SQLite and external PostgreSQL and explain configuring HTTPS for PWA operation.

#### Scenario: Run the supplied image
- **WHEN** the operator starts the application image with valid settings and persistent storage
- **THEN** the frontend/API are reachable from one origin and supported image inputs, including HEIC, can be normalized by the backend

#### Scenario: Required decoder is absent
- **WHEN** a deployment lacks its required HEIC decoder
- **THEN** startup reports that configuration failure before accepting uploads
