"""SMS provider abstraction — swap this one file to move from dev to production SMS.

Current: DevSMSProvider (hardcoded OTP, no real SMS sent).
Future:  Add MSG91Provider / TwilioProvider here, flip get_sms_provider().
"""

from __future__ import annotations

import abc
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class SMSProvider(abc.ABC):
    """Abstract base for all SMS/OTP providers."""

    @abc.abstractmethod
    async def send_otp(self, phone: str, otp: str) -> bool:
        """Send an OTP to *phone*. Return True on success."""
        ...

    @abc.abstractmethod
    async def verify_otp(self, phone: str, otp: str) -> bool:
        """Verify that *otp* is valid for *phone*. Return True if valid."""
        ...


class DevSMSProvider(SMSProvider):
    """Development provider — no real SMS, accepts the hardcoded dev OTP."""

    async def send_otp(self, phone: str, otp: str) -> bool:
        logger.info("DEV SMS: OTP for %s is %s (not actually sent)", phone, otp)
        return True

    async def verify_otp(self, phone: str, otp: str) -> bool:
        return otp == settings.OTP_DEV_CODE


# ---------------------------------------------------------------------------
# To add a real provider later:
#
#   class MSG91Provider(SMSProvider):
#       async def send_otp(self, phone, otp):
#           ...  # call MSG91 API
#       async def verify_otp(self, phone, otp):
#           ...  # call MSG91 verify API
#
# Then update get_sms_provider() to return MSG91Provider().
# ---------------------------------------------------------------------------


def get_sms_provider() -> SMSProvider:
    """Factory — returns the active SMS provider based on config."""
    # TODO: check settings for a PROVIDER flag and return the real one
    return DevSMSProvider()
