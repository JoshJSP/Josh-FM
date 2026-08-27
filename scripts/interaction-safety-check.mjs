import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const coordinator=read('mair-spotify-coordinator-v2.js'),uxState=read('mair-ux-state.js'),ux=read('mair-ux-v1.js'),cadence=read('mair-dj-cadence-fix.js'),polish=read('mair-pwa-polish.js'),primary=read('playback-primary.js');
// Recovery/state modules must never become input owners. The earlier click freeze came from this class of hotfix.
for(const [name,src] of [['Spotify coordinator',coordinator],['UX state',uxState],['DJ cadence',cadence]]){
  assert.doesNotMatch(src,/document\.addEventListener\(['"]click|window\.addEventListener\(['"]click|stopImmediatePropagation\(|MutationObserver/ ,`${name} must not own global clicks or broad DOM observation`)
}
assert.doesNotMatch(coordinator,/style\.pointerEvents|pointer-events|position\s*:\s*fixed|z-index/i,'Spotify recovery must not create blocking presentation layers');
assert.doesNotMatch(uxState,/style\.pointerEvents|pointer-events|innerHTML|insertAdjacentHTML/i,'semantic state must not mutate page layout');
// The authoritative UI may own one delegated action listener, but recovery actions must route to existing controllers.
assert.equal((ux.match(/function actions\(\)/g)||[]).length,1,'MAIR UX must retain one action delegation owner');
assert.match(ux,/action==='device'\)window\.JFMPlayback\?\.ensureDevice/,'device CTA must route through playback recovery instead of overlays');
assert.match(ux,/data-mairfm-error-action/,'error CTA must remain a normal button action');
// Primary transport may use capture only for its explicit transport IDs; it must not disable unrelated app controls.
assert.match(primary,/const transportIds=new Set\(\['start','play','next','prev'\]\)/,'transport capture scope must remain explicit');
assert.doesNotMatch(primary,/querySelectorAll\(['"]button['"]\).*disabled|document\.body\.style\.pointerEvents/,'primary playback must not globally disable the interface');
// Top safe-area layer must be non-interactive.
assert.match(polish,/pointer-events\s*:\s*none/i,'safe-area overlays must ignore touch input');
console.log('MAIR interaction safety: PASS — recovery/state layers cannot capture the whole UI');
