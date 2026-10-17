# ADR-003: Ingestion Safeguards and SSRF Prevention

## Context
StashMind supports ingesting text from user uploads, PDFs, article URLs, and YouTube links. Server-side URL fetching presents severe security risks (Server-Side Request Forgery - SSRF), including loopback port scanning, internal microservice probing, and cloud instance metadata theft (e.g. AWS `169.254.169.254`, GCP `metadata.google.internal`).

## Decision
1. In `SecurityService.validateSafeUrl`, strictly validate incoming URLs before any network request:
   - Enforce `http:` and `https:` protocols only.
   - Block `127.0.0.1`, `localhost`, `0.0.0.0`, `169.254.169.254`, RFC 1918 private IP ranges (`10.*`, `172.16-31.*`, `192.168.*`), and IPv6 loopback/link-local.
   - Restrict permissible ports to `80`, `443`, `8080`, and `8443`.
2. Apply strict content size and page constraints: 100,000 character maximum for pasted text, 15MB / 40 pages maximum for PDFs.
3. Compute cryptographic SHA-256 content hashes of normalized inputs before any model call to reuse cached transformation outputs.

## Consequences
- Prevents cloud metadata exfiltration and internal network scanning.
- Eliminates duplicate AI model costs via content hash lookup.
