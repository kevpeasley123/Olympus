# Synthetic signing fixture

`test-signing-key.pk8` is a deliberately generated 2048-bit RSA test key, paired
with the public JWKS in `fixture.json`. It signs offline mock-provider identities
for `fixture-user` and `oaiapp_fixture`. It is not an account credential and must
never be trusted by a production provider or used for real authentication.

The private key is included only by the `#[cfg(test)]` module in `connection.rs`.
The synthetic acceptance controller uses public fixture verification and synthetic
access/refresh strings. Production identity keys come from fixed-origin discovery;
production consent and generation remain gated.

Verified SHA-256:
`f7516d9aa0be6aab6de5fba61cf99a0dc58e7c545a15f5cb24b4e9bc5cc6a7a5`.
The public modulus and exponent were checked against the fixture without printing
private-key bytes. Preserve the fixture with its tests; do not repurpose it.
