## MODIFIED Requirements

### Requirement: Scientific name Wikipedia reference
When a plant has a nonblank scientific name, plant detail SHALL resolve a matching Wikipedia article, prefer the German article when found, and fall back to a matching English article only when the German lookup succeeds without finding a matching German article. Resolution SHALL account for normalized scientific names, redirects, and a verified equivalent article under a different title when available. A confirmed reference SHALL display the scientific name as a keyboard-accessible link opening in a new tab, identify Wikipedia and new-tab behavior accessibly in German, and identify an English fallback as English. Destinations SHALL use HTTPS on the appropriate German or English Wikipedia host with the title safely URL-encoded. Plants without a scientific name SHALL retain the existing species fallback without a Wikipedia link or lookup. No additional reference form input SHALL be required.

If neither article can be matched, the scientific name SHALL remain readable without a link. An offline, timed-out, or failed lookup SHALL be treated as unavailable rather than as proof that a German article does not exist; the plant detail SHALL remain usable, show accessible German feedback, and permit another lookup when connectivity returns or the user retries. A late lookup result SHALL NOT attach a reference belonging to a previously viewed plant or scientific name. External lookup responses SHALL NOT be added to the existing offline caches.

#### Scenario: Open a species reference
- **WHEN** a matching German Wikipedia article is found for a plant's scientific name
- **THEN** the scientific name links to that German article in a new tab
- **AND** the link is keyboard accessible and describes its Wikipedia destination and new-tab behavior in German

#### Scenario: German title differs from the scientific name
- **WHEN** a verified German article is available through a redirect or an equivalent article's language link under a different title
- **THEN** the reference points to that German article rather than assuming the scientific name is its displayed title

#### Scenario: Fall back to an English article
- **WHEN** the German lookup succeeds without finding a matching German article and a matching English article is found
- **THEN** the scientific name links to the English article in a new tab
- **AND** the accessible reference identifies that the article is in English

#### Scenario: No matching article
- **WHEN** both German and English lookup complete without finding a matching article
- **THEN** the scientific name is displayed without a Wikipedia link

#### Scenario: Scientific name is absent
- **WHEN** a plant has no nonblank scientific name
- **THEN** the existing species fallback is shown without a Wikipedia link or lookup

#### Scenario: Encode a scientific name
- **WHEN** a scientific name or matched article title includes repeated whitespace, Unicode, or URL-reserved characters
- **THEN** the resolved link stays on the intended German or English Wikipedia host and does not allow the input to inject a query or fragment

#### Scenario: Lookup cannot be completed
- **WHEN** the German article lookup times out, fails, or is unavailable offline
- **THEN** the scientific name and plant details remain readable and no unverified English fallback is presented as a confirmed match
- **AND** German feedback communicates that the reference could not be checked and a later retry is possible

#### Scenario: Plant changes during lookup
- **WHEN** a user opens a different plant or changes its scientific name before a reference lookup completes
- **THEN** a late result for the previous name does not appear on the current plant
