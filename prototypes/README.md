# MAIRFM — Car Mode + Sleep Mode layout prototypes

Status: **dormant / not deployed**  
Branch: `codex/mairfm-car-sleep-layouts`  
Created: 2026-08-29

These files preserve the selected MAIRFM UI direction without changing the current production UI. Nothing in this folder is referenced by `index.html` yet.

## 1. Car Mode — Wave Mode

Target: **iPhone 16 Pro Max in landscape**.

Files:
- `mair-car-mode-wave.css`
- `mair-car-mode-wave.js`

Design direction:
- no map, route, Waze or CarPlay dependency;
- black / deep-purple MAIRFM visual language;
- animated purple wave behind the player;
- current title + artist in the center;
- very large previous / play-pause / next controls;
- volume and mix in the lower area;
- left rail for Live / Favorites / Recent / Mixer;
- right panel for Now Playing / Next / After;
- safe-area padding for landscape iPhone cutouts / home indicator.

Playback safety:
- this prototype does **not** become a second Spotify playback owner;
- transport buttons forward to the existing MAIRFM `#prev`, `#play`, `#next` controls where available;
- if those controls are unavailable, the prototype emits `mair:car-action` instead of inventing playback behavior.

Integration hooks:

```js
MAIRCarModePrototype.open();
MAIRCarModePrototype.close();
MAIRCarModePrototype.setQueue([
  { title: 'Next song', artist: 'Artist' },
  { title: 'Song after that', artist: 'Artist' }
]);
MAIRCarModePrototype.setDJBreak('01:20');
MAIRCarModePrototype.setMix('Chill');
```

Unwired quick actions emit:

```js
window.addEventListener('mair:car-action', (event) => {
  console.log(event.detail.action);
});
```

## 2. Sleep Mode — Landscape Bedside

Target: phone lying **horizontally next to the bed**.

Files:
- `mair-sleep-landscape.css`
- `mair-sleep-landscape.js`

This is intentionally an adapter for the existing `mair-sleep.js`. The existing timer remains the source of truth and keeps responsibility for:
- 15 / 30 / 45 / 60 minute timers;
- stop after current track;
- cancelling the timer;
- stopping MAIR through the existing playback controller.

Landscape design direction:
- current clock on the left;
- remaining sleep time is the visual focus in the center;
- subtle purple moon / ambient glow;
- current track in a quiet card on the right;
- timer preset buttons remain reachable;
- timer cancel remains reachable;
- setup-heavy Sleep controls are hidden in landscape to keep the bedside view calm;
- portrait remains the better configuration view.

The adapter automatically adds `.mair-sleep-landscape-v2` only when the screen is landscape and at least 700px wide.

## Tomorrow: safe integration order

1. Test the branch locally before touching `main`.
2. Load the prototype CSS after the existing MAIRFM styles.
3. Load `mair-car-mode-wave.js` after the normal player / playback scripts.
4. Load `mair-sleep-landscape.js` after `mair-sleep.js`.
5. Add a Car Mode entry button that calls `MAIRCarModePrototype.open()`.
6. Feed the real MAIR queue, DJ-break countdown and current mix into the Car Mode hooks.
7. Test on an actual iPhone 16 Pro Max in landscape, both Safari and installed PWA if both are used.
8. Verify play/pause/next/previous, Spotify state, DJ break transitions, safe areas, rotation and screen dimming.
9. Only after those checks: merge the chosen files into the normal app and deploy.

Potential includes for later (do **not** add to production blindly):

```html
<link rel="stylesheet" href="prototypes/mair-car-mode-wave.css">
<link rel="stylesheet" href="prototypes/mair-sleep-landscape.css">
<script src="prototypes/mair-car-mode-wave.js" defer></script>
<script src="prototypes/mair-sleep-landscape.js" defer></script>
```

## Explicit non-goals for this version

- no embedded navigation;
- no Waze route inside MAIRFM;
- no CarPlay integration;
- no replacement of the existing MAIRFM playback controller;
- no replacement of the existing Sleep timer logic;
- no automatic deployment.
