# MAIRFM Codex Instructions

## Mission
Improve MAIRFM/Josh-FM into a stable autonomous AI radio station that can run for at least 60 minutes without manual intervention, unwanted silence, playback lockups, or an incorrect DJ voice.

## Working rules
- Work only on the `codex/mairfm-audit` branch unless explicitly told otherwise.
- Do not deploy production changes automatically.
- Do not modify secrets, API keys, or deployment credentials.
- Never place secrets in frontend code or commit them.
- Prefer small, reversible changes with clear commit messages.
- Before changing behavior, trace the relevant execution path and identify the root cause.
- Preserve existing working Spotify playback and authentication behavior unless a change is necessary and tested.
- If a change affects DJ/TTS/playback, add or update diagnostics so the failure can be traced later.

## Priority order
1. Playback reliability and continuous radio operation
2. DJ generation flow and timing
3. TTS / voice selection / fallback behavior
4. Diagnostics and observability
5. Mobile/PWA reliability
6. UX polish
7. New features only after the core is stable

## Phase 1: Audit only
For the first task, DO NOT change application behavior.

Inspect the entire repository and produce a technical audit covering:
- architecture and data flow
- Spotify auth/playback/queue flow
- DJ generation and prompt flow
- TTS generation and selected voices
- fallback paths
- scheduling/timing of DJ breaks
- error handling and retry behavior
- API routes and environment variables
- state management and browser persistence
- mobile/PWA/background limitations
- diagnostics currently available
- dead code, duplication, race conditions, fragile assumptions, and likely bugs
- build/deployment risks
- security issues, especially client/server secret boundaries

Classify findings as:
- P0 critical: can break radio, leak secrets, or block core functionality
- P1 high: major reliability or DJ/TTS issue
- P2 medium: degraded behavior or maintainability problem
- P3 low: polish or cleanup

For every finding include:
- affected files/functions
- what is wrong
- why it matters
- concrete proposed fix
- risk of the fix
- how to test it

End with a recommended repair sequence split into small tasks.

## Acceptance target
The eventual stable baseline should be able to:
- play continuously for 60+ minutes
- recover from DJ API failure without stopping music
- recover from TTS failure without stopping music
- avoid long unintended silence
- avoid duplicate/overlapping DJ playback
- consistently use the intended Dutch DJ voice where configured
- expose enough diagnostics to identify the last DJ/TTS/playback failure
