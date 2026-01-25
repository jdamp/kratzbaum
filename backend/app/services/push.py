"""Web push notification service."""

import json

from pywebpush import webpush, WebPushException

from app.core.config import get_settings
from app.models import PushSubscription

settings = get_settings()


async def send_push_notification(
    subscription: PushSubscription,
    title: str,
    body: str,
    url: str | None = None,
) -> bool:
    """
    Send a web push notification.
    
    Args:
        subscription: Push subscription from database
        title: Notification title
        body: Notification body
        url: Optional URL to open on click
        
    Returns:
        True if successful, False otherwise
    """
    if not settings.vapid_private_key:
        return False

    try:
        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
        })

        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh_key,
                    "auth": subscription.auth_key,
                },
            },
            data=payload,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_email},
        )
        return True
    except WebPushException as e:
        # If subscription is invalid, it should be removed
        print(f"Push notification failed: {e}")
        return False


async def send_reminder_notification(
    subscription: PushSubscription,
    plant_name: str,
    reminder_type: str,
) -> bool:
    """Send a reminder notification."""
    type_label = "water" if reminder_type == "WATERING" else "fertilize"
    return await send_push_notification(
        subscription=subscription,
        title=f"Time to {type_label} {plant_name}",
        body=f"Your plant {plant_name} needs {type_label}ing!",
        url=f"/plants",
    )
