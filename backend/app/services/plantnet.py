"""PlantNet API client."""

import httpx

from app.core.config import get_settings

settings = get_settings()


async def identify_plant(
    image_data: bytes,
    organ: str = "leaf",
    api_key: str | None = None,
) -> dict:
    """
    Identify a plant using the PlantNet API.

    Args:
        image_data: Raw image bytes
        organ: Plant organ type (leaf, flower, fruit, bark)

    Returns:
        API response with identification results
    """
    key = api_key or settings.plantnet_api_key or None
    if not key:
        return {
            "error": "PlantNet API key not configured",
            "error_code": "MISSING_API_KEY",
            "results": [],
        }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            settings.plantnet_api_url,
            params={
                "api-key": key,
                "include-related-images": "false",
                "no-reject": "false",
                "lang": "en",
            },
            files={
                "images": ("plant.jpg", image_data, "image/jpeg"),
            },
            data={
                "organs": organ,
            },
        )

        if response.status_code != 200:
            return {
                "error": f"PlantNet API error: {response.status_code}",
                "results": [],
            }

        data = response.json()

        # Transform results into a cleaner format
        results = []
        for result in data.get("results", [])[:5]:  # Top 5 results
            species = result.get("species", {})
            results.append(
                {
                    "score": result.get("score", 0),
                    "scientific_name": species.get("scientificNameWithoutAuthor", ""),
                    "common_names": species.get("commonNames", []),
                    "family": species.get("family", {}).get(
                        "scientificNameWithoutAuthor", ""
                    ),
                    "genus": species.get("genus", {}).get(
                        "scientificNameWithoutAuthor", ""
                    ),
                }
            )

        return {
            "results": results,
            "remaining_identifications": data.get("remainingIdentificationRequests", 0),
        }
