// Single source of truth for the active MAIR service-worker cache version.
//
// sw.js owns the value. Elke release-check importeert hem hier vandaan in plaats
// van hem letterlijk te herhalen, zodat een PWA-cachebump nooit meer in tien
// scripts tegelijk hoeft te worden nagelopen (audit C-1).
//
// Naast het uitlezen bewaakt deze module de invariant die de gate eerder liet
// glippen: sw.js en api/version.js moeten dezelfde cacheversie melden. Een
// halve bump faalt hierdoor direct, met een leesbare melding.
import fs from 'node:fs';

const SW_URL = new URL('../sw.js', import.meta.url);
const VERSION_API_URL = new URL('../api/version.js', import.meta.url);
const VERSION_JS_URL = new URL('../version.js', import.meta.url);
const DECLARATION = /^const CACHE='([^']+)';/m;
const CACHE_NAME = /^mair-v\d+-[a-z0-9-]+$/;
const ASSET_DECLARATION = /window\.JFM_ASSET_VERSION='(\d+)';/;

/** Leest de cacheversie uit de sw.js-broncode en valideert de vorm. */
export function readReleaseCache(swSource = fs.readFileSync(SW_URL, 'utf8')) {
  const found = DECLARATION.exec(swSource);
  if (!found) {
    throw new Error("sw.js bevat geen leesbare \"const CACHE='…';\" declaratie op een eigen regel; de release-cacheversie kan niet worden bepaald.");
  }
  const cache = found[1];
  if (!CACHE_NAME.test(cache)) {
    throw new Error(`Onverwachte service-worker cachenaam '${cache}'. Verwacht patroon: mair-v<nummer>-<beschrijving>.`);
  }
  return cache;
}

/** Controleert of de serverroute dezelfde cacheversie meldt als de service worker. */
export function assertReleaseCacheConsistency(cache = RELEASE_CACHE, versionApiSource = fs.readFileSync(VERSION_API_URL, 'utf8')) {
  if (!versionApiSource.includes(`cache:'${cache}'`)) {
    const reported = /cache:'([^']+)'/.exec(versionApiSource)?.[1] || 'geen';
    throw new Error(`api/version.js meldt cache '${reported}' maar sw.js gebruikt '${cache}'. Werk beide bij in dezelfde commit.`);
  }
  return true;
}

/**
 * Leest de centrale assetversie uit version.js. Zelfde valkuil als de cacheversie had:
 * de waarde stond letterlijk in version.js en werd letterlijk herhaald in vijf
 * releasechecks, dus een assetbump brak de poort op plekken die niets met de bump te
 * maken hadden (audit, nieuwe bevinding van 3 september 2026).
 */
export function readAssetVersion(versionSource = fs.readFileSync(VERSION_JS_URL, 'utf8')) {
  const found = ASSET_DECLARATION.exec(versionSource);
  if (!found) {
    throw new Error("version.js bevat geen leesbare \"window.JFM_ASSET_VERSION='…';\" declaratie; de assetversie kan niet worden bepaald.");
  }
  return found[1];
}

export const RELEASE_CACHE = readReleaseCache();
export const RELEASE_CACHE_DECLARATION = `const CACHE='${RELEASE_CACHE}'`;

assertReleaseCacheConsistency();

export const RELEASE_ASSET_VERSION = readAssetVersion();

export default RELEASE_CACHE;
