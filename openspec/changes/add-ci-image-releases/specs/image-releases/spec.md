## Purpose

Provide automatically tested, versioned application images that homelab operators can pull from GHCR without a manual release process.

## ADDED Requirements

### Requirement: Automated validation
The project SHALL run automated checks on pull requests targeting main and on pushes to main. Required checks SHALL cover Go tests with SQLite and PostgreSQL integration including backup/restore, frontend unit tests and type checking, browser tests, and production-container startup and HEIC upload smoke tests. Missing required prerequisites SHALL fail the check rather than silently skip required coverage.

#### Scenario: Validate a pull request
- **WHEN** a pull request targets main
- **THEN** the required checks run and report their outcome without publishing an image

#### Scenario: Exercise PostgreSQL coverage
- **WHEN** backend checks run
- **THEN** they use a disposable PostgreSQL database and matching backup/restore tools so PostgreSQL contract and backup tests execute

### Requirement: Test-gated main publication
Each push to main SHALL publish the production application image to `ghcr.io/jdamp/kratzbaum` only after every required check for that revision passes. Pull requests and other branches SHALL NOT publish images. A newer push SHALL NOT cancel an earlier main build merely to save CI work.

#### Scenario: Publish a passing main revision
- **WHEN** all required checks pass for a push to main
- **THEN** that revision's production image is published to GHCR

#### Scenario: A required check fails
- **WHEN** any required check fails
- **THEN** that run publishes no application image and does not update latest

#### Scenario: Several main pushes arrive
- **WHEN** multiple pushes to main occur while checks are running
- **THEN** each passing push remains eligible to publish its own version

### Requirement: Automatic image versions
Published application images SHALL use only the release aliases `latest` and `0.1.<github.run_number>`. Both tags for a newly published run SHALL identify the same production image. Run-number gaps SHALL be allowed, and rerunning a workflow SHALL reuse its version rather than allocate a new one. Version metadata SHALL identify the version and source revision.

#### Scenario: Allocate a version
- **WHEN** workflow run number 42 publishes successfully
- **THEN** the image is available as `0.1.42` and latest identifies that published image

#### Scenario: Rerun an existing workflow
- **WHEN** a workflow is rerun
- **THEN** its version is unchanged and no run-attempt suffix or extra release version is introduced

### Requirement: Document image consumption
The project SHALL document the GHCR image path, pulling latest or a numbered version, run-number semantics, and any one-time package access setup. Documentation SHALL distinguish moving tags from digest-based exact pinning.

#### Scenario: Deploy a published image
- **WHEN** an operator follows the container deployment documentation
- **THEN** they can select a published version or latest and understand registry access and version behavior
