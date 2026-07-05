# LedgerFlow AI Intelligence Manifest

This document outlines the division of labor between deterministic algorithms (Tier 1) and neural artificial intelligence (Tier 2).

## 1. Algorithmic Intelligence (Local & Instant)
These features run entirely on your browser using advanced mathematical and logic patterns. They are instant, 100% accurate, and do not require an internet connection or API keys.

*   **Natural Language Filter (FastPath)**: 
    *   Resolves: Dates ("last month"), Amounts ("> $500"), Categories ("Rent"), and Status ("pending").
    *   Fuzzy Logic: Matches project and category names even with partial typing.
*   **Forensic Audit Suite**:
    *   **Benford's Law**: Mathematical distribution analysis of leading digits to detect artificial entry.
    *   **Z-Score Anomalies**: Detects outliers more than 2.5 standard deviations from the mean.
    *   **Duplicate Detection**: Identity signatures based on (Date + Amount + Truncated Description).
*   **Financial Forecasting (Standard)**:
    *   **Holt-Winters Projection**: Linear and seasonal trend analysis based on historical cycles.
    *   **Scenario Architect**: Virtual "Ghost" transactions injected into the ledger for "What If" modeling.
*   **Pivot Explorer**: Real-time multi-dimensional data reconstruction (Excel-grade).

## 2. Neural Intelligence (Generative AI)
Generative AI is invoked only for high-level reasoning, semantic discovery, and narrative synthesis.

*   **Intelligence Assistant (Cortex)**: 
    *   Used for: Summarizing complex audit results into human-readable advice.
    *   Reasoning: "Why is my burn rate increasing?" cross-references unrelated categories to find hidden links.
*   **Magic Entry (Neural Fallback)**:
    *   Used for: Parsing vague human sentences like "I think I paid the tax man about three grand last Tuesday from the business account" into a valid journal entry.
*   **Strategic Directives**:
    *   Generates: Long-term capital allocation strategies based on global dataset trends.
*   **Semantic Search**:
    *   Matches: "Find my food expenses" will match "Starbucks", "Diner", and "Grocery" without explicit tags.

## 3. Data Privacy & Fallback Policy
*   **Tier 1 ALWAYS runs first.** If the algorithm can solve the query, the AI is never called.
*   No financial data is sent to the AI unless it is necessary to solve a "Generative" request.
*   The system remains 100% functional even without an API key (using local algorithms only).
