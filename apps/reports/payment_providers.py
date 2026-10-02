"""Provider boundary for future bank/PSP payment integrations.

SBP publishes Raast participation and merchant-use-case guidance, but not a
generic merchant API contract. A provider adapter must be implemented from
the selected institution's documentation before live requests are enabled.
"""


class PaymentProviderError(Exception):
    """Base exception for payment provider failures."""


class ProviderNotConfigured(PaymentProviderError):
    """Raised when an institution-specific provider has not been configured."""


class RaastProvider:
    """Interface implemented by a participating bank/PSP adapter."""

    def initiate_payment(self, *, payment, idempotency_key):
        raise NotImplementedError

    def verify_payment(self, *, provider_reference):
        raise NotImplementedError


class UnconfiguredRaastProvider(RaastProvider):
    """Fail-closed default; never invents a successful payment response."""

    def initiate_payment(self, *, payment, idempotency_key):
        raise ProviderNotConfigured(
            "Raast online payments require an integration agreement and API "
            "specification from a participating bank or PSP."
        )

    def verify_payment(self, *, provider_reference):
        raise ProviderNotConfigured(
            "Raast status verification is unavailable until a provider is configured."
        )
