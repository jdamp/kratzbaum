## Purpose

Provide a consistently German, accessible household plant-care experience across the application, including offline and error states.

## ADDED Requirements

### Requirement: German-only application presentation
The application SHALL present app-authored user-facing text in German across login, navigation, collection, plant detail, rooms, care, identification, settings, loading, empty, offline, unavailable, confirmation, success, and error states. Accessible names, image alternatives, form help, placeholders, alerts, live status messages, and app-owned update prompts SHALL also be German. The document SHALL declare German as its language and its title, description, and installable manifest name and description SHALL be German. The app SHALL use German regardless of the browser language and SHALL NOT offer a language switcher or language preference.

#### Scenario: English-language browser opens the app
- **WHEN** a user with an English-language browser opens the login page or any collection view
- **THEN** app-authored interface text and accessible control names are German
- **AND** no language selector is presented

#### Scenario: App is launched offline
- **WHEN** a user launches a previously cached app shell without connectivity
- **THEN** app-authored navigation, offline explanations, and available saved views remain in German

#### Scenario: Installable metadata
- **WHEN** a compatible browser reads the app document and installable manifest
- **THEN** the document language identifies German and app-authored title and description text is German

### Requirement: German and actionable error feedback
The application SHALL display German, actionable messages for frontend, backend, upload, identification, connection, and direct authentication failures while preserving the applicable failure distinctions. Unknown or unsafe technical errors SHALL receive a safe German fallback. HTTP statuses, existing structured error codes, and response field shapes SHALL remain compatible.

#### Scenario: Validation and provider errors
- **WHEN** a room or image validation fails, or PlantNet reports a timeout or quota failure
- **THEN** the user receives an appropriate German error without losing recoverable input
- **AND** distinct failure categories remain distinguishable

#### Scenario: Unknown server failure
- **WHEN** a request fails with an unrecognized or unsafe technical error
- **THEN** the app shows a safe German error rather than exposing the raw technical message

#### Scenario: Direct sign-in failure
- **WHEN** the application's sign-in or callback endpoint reports an error directly to the browser
- **THEN** the app-owned error is presented in German without exposing credentials or tokens

### Requirement: German locale conventions
App-rendered dates, times, numbers, counts, and pluralized messages SHALL use German conventions independently of the browser's preferred language. The calendar SHALL display German weekday labels with Monday as the first day of the week, with dates and events aligned under the correct weekday. German display formatting SHALL preserve the configured deployment timezone, saved instants and dates, and existing due-date and care calculations.

#### Scenario: German calendar in an English browser
- **WHEN** a user with an English-language browser opens the calendar
- **THEN** month and weekday names are German and the first calendar column is Monday
- **AND** each date, completed event, and due item remains on its correct calendar day

#### Scenario: Singular and plural intervals
- **WHEN** the app displays a one-day interval and a multi-day interval
- **THEN** both use grammatically correct German singular or plural text

#### Scenario: Timezone and daylight saving
- **WHEN** a saved activity or care interval crosses a calendar-day or daylight-saving boundary in the configured deployment timezone
- **THEN** German formatting does not change its stored instant or calculated care date

### Requirement: Preserve user and external content
The app SHALL preserve existing user-provided plant and room names, notes, and other collection text as stored, and SHALL retain scientific names and proper names. It SHALL request German common names from PlantNet as specified by plant identification, without requiring a common name when the provider has none. Identity-provider pages and browser-native controls outside the app's control are not required to be translated by the app.

#### Scenario: Existing household data
- **WHEN** an existing collection contains user-written names or notes in any language and the user views the collection or edits a different record
- **THEN** the existing content is not translated or overwritten

#### Scenario: German common name is absent
- **WHEN** PlantNet returns a candidate without a German common name
- **THEN** the scientific name remains visible and usable for identification
