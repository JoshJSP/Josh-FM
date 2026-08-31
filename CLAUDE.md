# MAIRFM — Claude Code handoff

## Purpose
This repository is the active MAIRFM/Josh-FM codebase. Treat `main` as the current source of truth unless the user explicitly selects another branch.

MAIRFM is a personal Dutch AI radio experience built on Spotify Premium. It manages continuous playback, requests, queue logic, DJ breaks, TTS, discovery, mobile/PWA behavior, and Car Mode.

## Important handoff note
`AGENTS.md` contains historical Codex-specific instructions. Read it for architecture and reliability priorities, but its instruction to work only on `codex/mairfm-audit` does **not** apply to Claude Code. For Claude work, start from the current `main` branch and create a dedicated `claude/...` branch before making non-trivial changes.

## First action in every new Claude session
Before editing code:
1. Run `git status` and confirm the active branch.
2. Pull/fetch the latest remote state.
3. Read `README.md`, `AGENTS.md`, `MAIR_STABILITY_NOTES.md`, and `PRE_DEPLOY.md` if present.
4. Inspect recent commits (`git log --oneline -20`) so recent fixes are not accidentally reverted.
5. Inspect the relevant execution path before changing behavior.
6. Prefer root-cause fixes over patches layered on top of existing patches.

## Current baseline
- Package: `mair-radio`
- Current package version at handoff: `2.0.0-beta.9`
- Deployment: Vercel / HTTPS web app + PWA
- Spotify auth: OAuth PKCE; never add a Spotify client secret to frontend code.
- Core playback owner: `playback-primary.js`
- Queue serialization: `queue-core.js`
- DJ scheduling/playback: `mair-dj-v2.js`
- DJ writer API: `/api/dj-writer`
- TTS API: `/api/tts`
- Mobile/PWA and background behavior are important and fragile.
- Recent development has included Car Mode and playback/queue reliability; preserve recent fixes unless there is a tested reason to replace them.

## Reliability priorities
In this order:
1. Continuous Spotify playback and recovery
2. Queue correctness / no unwanted duplicate or consecutive request behavior
3. Spotify session/auth persistence
4. DJ timing, generation and transition order
5. TTS/voice reliability with graceful failure
6. Background/mobile/PWA behavior
7. Car Mode correctness and stability
8. Diagnostics and observability
9. UX/layout polish
10. New features

Music must keep playing when AI/TTS features fail. Do not make DJ, discovery, TTS, news, or other optional systems capable of stopping core playback.

## Safety / repository rules
- Never commit secrets, API keys, OAuth tokens, credentials or private environment values.
- Do not modify production credentials or Vercel environment variables unless explicitly asked.
- Do not delete or rewrite recent working behavior without tracing why it exists.
- Avoid broad rewrites when a smaller root-cause fix is possible.
- Keep changes reversible and commits focused.
- Do not force-push or rewrite shared history unless explicitly requested.
- Do not deploy to production unless the user explicitly asks for deployment in that session.
- Do not silently change Spotify redirect/auth behavior.

## Testing
The main release gate is:

```bash
npm run predeploy
```

Useful targeted commands are defined in `package.json`, including playback, queue, DJ, TTS, background, UI, Car Mode-adjacent and regression checks. Prefer targeted tests while iterating, then run the full `npm run predeploy` before considering a change release-ready.

If a test fails, report:
- exact failing command
- likely root cause
- whether failure is introduced by the current change or pre-existing
- what remains unverified

Never claim something is fixed only because static checks pass when the behavior requires a real browser/Spotify/iPhone runtime test.

## Deployment discipline
Before a production deploy:
1. Ensure working tree is clean or intentionally committed.
2. Run targeted tests for changed behavior.
3. Run `npm run predeploy`.
4. Review the diff for accidental secret/config/cache/version changes.
5. Preserve a known-good commit/branch when doing risky playback/auth/mobile changes.
6. Only then deploy if explicitly requested.

## How to work with the user
The user prefers concrete progress over long speculative plans. For a coding task:
- inspect first;
- make the smallest complete change that solves the root issue;
- test it;
- summarize exactly what changed, what passed, and what still needs a real-device/runtime check.

When the user asks for a large autonomous task, break the implementation internally into safe checkpoints and commit useful milestones rather than making one huge unreviewable change.

## iOS/native direction
MAIRFM is currently primarily a web/PWA product. If adding a native iOS wrapper later, preserve the existing web/Vercel version as a working product. Treat native iOS as an additional shell/integration layer rather than replacing the web app by default. Keep platform-specific code isolated where possible.
