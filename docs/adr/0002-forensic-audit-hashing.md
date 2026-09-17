# 2. Forensic Audit Hash Chaining

## Status
Accepted

## Context
Enterprise regulatory compliance (SOX, SOC 2) requires tamper-evident ledger immutability. If an entry is modified or deleted directly in the database, the system must detect state tampering.

## Decision
Every posted transaction entry generates a deterministic SHA-256 hash incorporating the previous entry's hash, forming an immutable cryptographic hash chain (`previousHash` -> `currentHash`).

## Consequences
- Immediate forensic detection of missing or modified historical records.
- Enables cryptographic ledger verification.
