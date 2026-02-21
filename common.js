import { Settings, SiteSettings } from './utils.js';

export const api =
  typeof chrome !== 'undefined' ? chrome : typeof browser !== 'undefined' ? browser : {};

export const DEFAULT_SCHEME = 'delumine-smart';
const DEFAULT_FILTER = DEFAULT_SCHEME.split('-').slice(1).join('-');
const storeCache = {};
let settings = new Settings(DEFAULT_FILTER);

let migrationTask;
async function migrateFromLocalStorage() {
  const { migrationComplete } = await api.storage.local.get(['migrationComplete']);
  if (migrationComplete >= 2) {
    return;
  }
  if (migrationTask) {
    await migrationTask;
    return;
  }
  migrationTask = (async () => {
    try {
      await Promise.race([
        chrome.offscreen.createDocument({
          url: 'migrate.html',
          reasons: ['LOCAL_STORAGE'],
          justification: 'migrating local storage to cloud sync storage',
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Offscreen creation timed out')), 4000),
        ),
      ]);
    } catch {
      // Already created or timed out. That's fine, just send the message.
    }
    const [remoteResult, migrationResult] = await Promise.allSettled([
      Promise.race([
        api.storage.sync.get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sync get timed out')), 2000)),
      ]),
      Promise.race([
        chrome.runtime.sendMessage({ target: 'offscreen', action: 'migrate' }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Migration message timed out')), 1000),
        ),
      ]),
    ]);
    const remoteSettings = remoteResult.status === 'fulfilled' ? remoteResult.value : null;
    const localStorage =
      migrationResult.status === 'fulfilled' ? migrationResult.value?.localStorage : null;
    if (remoteSettings) {
      try {
        Object.assign(storeCache, remoteSettings);
        settings = Settings.import(storeCache?.sites, DEFAULT_FILTER);
      } catch (err) {
        console.log(`Error loading remote settings: ${JSON.stringify(err)}`);
      }
    }
    if (localStorage) {
      const { sites, ...otherSettings } = migrateV1toV2(localStorage);
      // Allow local settings to override remote settings.
      Object.assign(storeCache, otherSettings);
      // Merge local site settings with any existing ones.
      settings.import(sites);
      storeCache.sites = settings.export();
      // Publish the merged site settings.
      await storeSet('sites', storeCache.sites);
      try {
        api.storage.local.set({ migrationComplete: 2 });
      } catch (error) {
        console.warn(error);
      }
    }
  })();
  await migrationTask;
  migrationTask = null;
}

function parseSiteMods(sitemods) {
  // Perplexingly, I seem to have implemented settingsV1 sitemodifiers in two
  // different ways: either a whitespace-delimited string or an object with
  // key: true pairs.
  try {
    return sitemods.split(' ');
  } catch {
    /* Not a string. */
  }
  try {
    return Object.keys(sitemods);
  } catch {
    /* Not an object. */
  }
  return [];
}

const toBool = (str) => str !== 'false' && Boolean(str);

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export function migrateV1toV2(v1) {
  const v2 = { version: 2, enabled: toBool(v1?.enabled ?? true) };
  const defaultFilter = (v1?.scheme ?? DEFAULT_SCHEME).split('-').slice(1).join('-') || 'normal';
  const schemeToFilter = (scheme) => {
    const filter = (scheme ?? `filter-${defaultFilter}`).split('-').slice(1).join('-') || 'normal';
    return filter === 'no-invert' ? 'normal' : filter;
  };
  const defaultMods = [];
  if (toBool(v1?.low_contrast)) {
    defaultMods.push('low_contrast');
  }
  if (toBool(v1?.kill_background)) {
    defaultMods.push('kill_background');
  }
  if (toBool(v1?.force_text)) {
    defaultMods.push('force_text');
  }
  defaultMods.push('dynamic');
  const settings = new Settings(defaultFilter, defaultMods);

  const siteModifiers = safeJsonParse(v1?.sitemodifiers ?? '{}', {});
  const siteSchemes = safeJsonParse(v1?.siteschemes ?? '{}', {});
  const domains = new Set([...Object.keys(siteModifiers), ...Object.keys(siteSchemes)]);
  for (const domain of domains) {
    const siteSettings = new SiteSettings(
      schemeToFilter(siteSchemes[domain]),
      parseSiteMods(siteModifiers[domain])
        .map(
          (mod) =>
            ({
              'low-contrast': 'low_contrast',
              low_contrast: 'low_contrast',
              kill_background: 'kill_background',
              force_text: 'force_text',
            })[mod],
        )
        .filter(Boolean),
    );
    settings.save(domain, siteSettings);
  }
  v2.sites = settings.export();
  console.log(`Settings V2: ${JSON.stringify(v2)}`);
  return v2;
}

export async function syncStore() {
  await migrateFromLocalStorage();
  return await refreshStore();
}

function splitSites(sites) {
  if (!sites || sites.length === 0) return [[]];
  const chunks = [];
  const chunkSize = 100;
  for (let i = 0; i < sites.length; i += chunkSize) {
    chunks.push(sites.slice(i, i + chunkSize));
  }
  return chunks;
}

function mergeSites(storeItems) {
  let allSites = storeItems.sites || [];
  let i = 1;
  while (storeItems[`sites_${i}`]) {
    allSites = allSites.concat(storeItems[`sites_${i}`]);
    i++;
  }
  return allSites;
}

export async function refreshStore() {
  let items = {};
  try {
    items = await Promise.race([
      api.storage.sync.get(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Sync get timed out')), 2000)),
    ]);
  } catch (e) {
    console.warn('Failed to refresh store from sync (using defaults/backup):', e);
    try {
      const local = await api.storage.local.get('backup_sites');
      if (local.backup_sites) {
        console.log('Loaded sites from local backup.');
        items.sites = local.backup_sites;
      }
    } catch (localErr) {
      console.warn('Failed to load local backup:', localErr);
    }
  }

  Object.assign(storeCache, items);
  storeCache.sites = mergeSites(items);
  settings = Settings.import(storeCache?.sites, DEFAULT_FILTER);

  try {
    const localSites = await Promise.race([
      api.storage.local.get('sites'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Local get timed out')), 1000)),
    ]);
    settings.import(localSites['sites'] ?? []);
  } catch (e) {
    console.warn('Failed to load local sites:', e);
  }

  return settings;
}

export async function storeSet(key, value) {
  storeCache[key] = value;

  if (key === 'sites') {
    const chunks = splitSites(value);
    const updates = {};
    updates.sites = chunks[0] || [];
    for (let i = 1; i < chunks.length; i++) {
      updates[`sites_${i}`] = chunks[i];
      storeCache[`sites_${i}`] = chunks[i];
    }

    // Cleanup old keys
    try {
      const allKeys = Object.keys(await api.storage.sync.get());
      const keysToRemove = allKeys.filter((k) => {
        if (!k.startsWith('sites_')) return false;
        const index = parseInt(k.split('_')[1]);
        return !isNaN(index) && index >= chunks.length;
      });

      if (keysToRemove.length > 0) {
        keysToRemove.forEach((k) => delete storeCache[k]);
        await api.storage.sync.remove(keysToRemove);
      }
    } catch (e) {
      console.warn('Failed to cleanup old site keys', e);
    }

    return api.storage.sync.set(updates);
  }

  return api.storage.sync.set({ [key]: value });
}

export function $(id) {
  return document.getElementById(id);
}

export function getEnabled() {
  return storeCache?.enabled ?? true;
}

export function setEnabled(enabled) {
  return storeSet('enabled', toBool(enabled));
}

export function getSiteSettings(site) {
  const siteSettings = settings.load(site);
  if (!siteSettings) {
    throw new Error(`Could not load settings for ${site}`);
  }
  return siteSettings;
}

export function setSiteSettings(site, siteSettings) {
  settings.save(site, siteSettings);
  storeCache.sites = settings.export();
  try {
    api.storage.local.set({
      sites: settings.exportLocal(),
      backup_sites: storeCache.sites,
    });
  } catch (error) {
    console.warn(error);
  }
  return storeSet('sites', storeCache.sites);
}

export function delSiteSettings(site) {
  settings.remove(site);
  storeCache.sites = settings.export();
  try {
    api.storage.local.set({
      sites: settings.exportLocal(),
      backup_sites: storeCache.sites,
    });
  } catch (error) {
    console.warn(error);
  }
  return storeSet('sites', storeCache.sites);
}

export async function resetSiteSchemes() {
  await api.storage.sync.remove(Object.keys(await api.storage.sync.get()));
  for (const key of Object.keys(storeCache)) {
    delete storeCache[key];
  }
  settings = new Settings(DEFAULT_FILTER);
}

export function siteFromUrl(url) {
  return new URL(url).hostname;
}

export function getGlobalSettings() {
  return storeCache['settings'] ?? {};
}

export function setGlobalSetting(key, value) {
  const globalSettings = getGlobalSettings();
  globalSettings[key] = value;
  return storeSet('settings', globalSettings);
}

export function getMatchingSite(site) {
  return settings.match(site);
}

export function setSiteScheme(site, scheme) {
  const siteSettings = settings.load(site);
  return setSiteSettings(site, new SiteSettings(scheme, siteSettings.mods));
}

export function setDefaultModifiers(modifiers) {
  const defaultSettings = settings.site_default();
  return setSiteSettings('', new SiteSettings(defaultSettings.filter, modifiers));
}

export function addSiteModifier(site, modifier) {
  const siteSettings = settings.load(site);
  const mods = new Set(siteSettings.mods);
  mods.add(modifier);
  const newSettings = new SiteSettings(siteSettings.filter, mods);
  return setSiteSettings(site, newSettings);
}

export function delSiteModifier(site, modifier) {
  const siteSettings = settings.load(site);
  const mods = new Set(siteSettings.mods);
  mods.delete(modifier);
  const newSettings = new SiteSettings(siteSettings.filter, mods);
  return setSiteSettings(site, newSettings);
}

export function changedFromDefault(site) {
  return !settings.site_default().equals(settings.load(site));
}

export function isFileUrl(url) {
  try {
    return new URL(url).origin === 'file://';
  } catch {
    return false;
  }
}

export function isDisallowedUrl(url) {
  if (url.indexOf('about') == 0) {
    return true;
  } else if (url.indexOf('chrome') == 0) {
    // Special case the "newtab" page, which this extension affects.
    if (siteFromUrl(url) == 'newtab') return false;
    else return true;
  }
  return false;
}
