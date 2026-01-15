import {
  $,
  syncStore,
  getGlobalSettings,
  setGlobalSetting,
  delSiteSettings,
  resetSiteSchemes,
  migrateV1toV2,
  storeSet,
  setEnabled,
} from './common.js';

function initSettings() {
  const globalSettings = getGlobalSettings();
  if (globalSettings['detect_animation']) {
    $('detect_animation').value = globalSettings['detect_animation'];
  }
}

export async function onImport() {
  const status = $('import_status');
  status.textContent = "Importing...";
  status.style.color = "#8BF";
  try {
    const jsonStr = $('import_data').value;
    if (!jsonStr.trim()) {
      status.textContent = "Error: No data provided.";
      status.style.color = "#d54848";
      return;
    }
    const data = JSON.parse(jsonStr);

    let v2Data;
    if (data.sites && Array.isArray(data.sites)) {
       v2Data = data;
    } else if (data.sitemodifiers || data.siteschemes || data.enabled !== undefined || data.localStorage) {
       v2Data = migrateV1toV2(data.localStorage || data);
    } else {
       v2Data = migrateV1toV2(data);
    }

    if (v2Data.enabled !== undefined) {
      await setEnabled(v2Data.enabled);
    }
    if (v2Data.sites) {
      await storeSet('sites', v2Data.sites);
    }
    if (v2Data.settings) {
       await storeSet('settings', v2Data.settings);
    }

    await syncStore();

    status.textContent = "Import successful! Refreshing...";
    status.style.color = "#0f0";
    setTimeout(async () => {
        status.textContent = "";
        const store = await syncStore();
        initSettings();
        loadSettingsDisplay(store.export());
    }, 1000);

  } catch (e) {
    status.textContent = "Error: " + e.message;
    status.style.color = "#d54848";
    console.error(e);
  }
}

export async function onForget() {
  await resetSiteSchemes();
  loadSettingsDisplay((await syncStore()).export());
}

// Open all links in new tabs.
function onLinkClick() {
  const links = document.getElementsByTagName("a");
  for (let i = 0; i < links.length; i++) {
    (function () {
      const ln = links[i];
      const location = ln.href;
      ln.onclick = function () {
          chrome.tabs.create({active: true, url: location});
      };
    })();
  }
}

function onDetectAnim(evt) {
  setGlobalSetting('detect_animation', evt.target.value);
}

function loadSettingsDisplay(store) {
  function makeTag(tag, ...contents) {
    const element = document.createElement(tag);
    for (const child of contents) {
      try {
        element.appendChild(
          typeof child === "string" ? document.createTextNode(child)
            : child
        );
      } catch {
        console.log(`Bad contents of ${tag}: ${JSON.stringify(contents)}`);
        console.log(`Bad child type: ${JSON.stringify(child)}`);
      }
    }
    return element;
  }
  function makeSiteDiv([url, filter, ...mods]) {
    const deleteIcon = makeTag("img");
    deleteIcon.src = chrome.runtime.getURL("delete.svg");
    const deleteBtn = url ? makeTag("button", deleteIcon) : makeTag("span", "");
    const row = makeTag('div',
      deleteBtn,
      makeTag('span', url || "DEFAULT"),
      makeTag('span', filter),
      makeTag('span', mods.join(', ')),
    );
    if (url) {
      deleteBtn.className = "delete-button";
      deleteBtn.onclick = () => {
        row.parentElement.removeChild(row);
        delSiteSettings(url);
      }
    }
    return row;
  }
  const settingsDiv = $('settings');
  settingsDiv.innerHTML = "";
  const heading = makeTag("div",
    makeTag("span", ""),
    makeTag("span", "Website"),
    makeTag("span", "Filter"),
    makeTag("span", "Options"),
  );
  heading.id = "settings-heading";
  settingsDiv.appendChild(heading);
  for (const site of store) {
    settingsDiv.appendChild(makeSiteDiv(site));
  }
}

export async function init() {
  const store = await syncStore();
  initSettings();
  $('forget').addEventListener('click', onForget, false);
  $('import_btn').addEventListener('click', onImport, false);
  $('detect_animation').addEventListener('change', onDetectAnim, false);
  loadSettingsDisplay(store.export());
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', init, false);
  document.addEventListener('DOMContentLoaded', onLinkClick);
}
