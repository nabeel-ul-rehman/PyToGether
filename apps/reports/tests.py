from django.test import SimpleTestCase

from .payment_providers import ProviderNotConfigured, UnconfiguredRaastProvider


class RaastProviderBoundaryTests(SimpleTestCase):
    def test_provider_does_not_claim_payment_initiated_without_bank_adapter(self):
        with self.assertRaises(ProviderNotConfigured):
            UnconfiguredRaastProvider().initiate_payment(
                payment=object(), idempotency_key="internal-test-id"
            )

    def test_provider_does_not_claim_payment_verified_without_bank_adapter(self):
        with self.assertRaises(ProviderNotConfigured):
            UnconfiguredRaastProvider().verify_payment(provider_reference="ref")
