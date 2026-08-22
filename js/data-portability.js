'use strict';

const NERDSYNC_BACKUP_KIND = 'nerdsync-local-backup';


const NERDSYNC_LOCAL_PROFILE_SCHEMA = 2;
function localProfileMigrationKey() { return `nerdsync_local_profile_schema:${currentUser?.id || 'anonymous'}`; }

function migrateNerdSyncLocalProfile() {
  if (!currentUser?.id) return;
  let currentSchema = 0;
  try { currentSchema = Number(localStorage.getItem(localProfileMigrationKey()) || 0); } catch { return; }
  if (currentSchema >= NERDSYNC_LOCAL_PROFILE_SCHEMA) return;
  try {
    const rawPreferences = JSON.parse(localStorage.getItem(preferencesStorageKey()) || '{}') || {};
    const normalizedPreferences = {
      categories:sanitizeBackupObject(rawPreferences.categories),
      categoryNames:sanitizeBackupObject(rawPreferences.categoryNames),
      followedCategories:sanitizeBackupObject(rawPreferences.followedCategories),
      tags:sanitizeBackupObject(rawPreferences.tags),
      languages:sanitizeBackupObject(rawPreferences.languages),
      viewerSamples:Array.isArray(rawPreferences.viewerSamples) ? rawPreferences.viewerSamples.filter(Number.isFinite).slice(-30) : [],
      personalizationEnabled:rawPreferences.personalizationEnabled !== false,
      historicalDiscoveryEnabled:rawPreferences.historicalDiscoveryEnabled !== false,
    };
    localStorage.setItem(preferencesStorageKey(), JSON.stringify({ ...rawPreferences, ...normalizedPreferences }));
    const rawWorkflows = JSON.parse(localStorage.getItem(localWorkflowStorageKey()) || '{}') || {};
    localStorage.setItem(localWorkflowStorageKey(), JSON.stringify({
      ...rawWorkflows,
      version:LOCAL_WORKFLOW_VERSION,
      filterPresets:Array.isArray(rawWorkflows.filterPresets) ? rawWorkflows.filterPresets.slice(0,20) : [],
      matchHistory:Array.isArray(rawWorkflows.matchHistory) ? rawWorkflows.matchHistory.slice(0,20) : [],
      matchShortlist:Array.isArray(rawWorkflows.matchShortlist) ? rawWorkflows.matchShortlist.slice(0,30) : [],
      collections:Array.isArray(rawWorkflows.collections) ? rawWorkflows.collections.slice(0,30) : [],
    }));
    localStorage.setItem(localProfileMigrationKey(), String(NERDSYNC_LOCAL_PROFILE_SCHEMA));
  } catch (error) {
    console.warn('NerdSync local profile migration could not complete', error);
  }
}

function sanitizeBackupObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function collectNerdSyncBackup() {
  if (!currentUser?.id) throw new Error('Sign into Twitch before exporting NerdSync data.');
  let ghostSignal = null;
  try { ghostSignal = typeof secretGameStorageKey === 'function' ? JSON.parse(localStorage.getItem(secretGameStorageKey()) || 'null') : null; } catch { ghostSignal = null; }
  return {
    kind:NERDSYNC_BACKUP_KIND,
    schema:NERDSYNC_META.backupSchema,
    appVersion:NERDSYNC_META.version,
    exportedAt:new Date().toISOString(),
    twitchUserId:String(currentUser.id),
    data:{
      discoveryHistory:sanitizeBackupObject(discoveryHistory),
      preferences:sanitizeBackupObject(preferences),
      accessibility:sanitizeBackupObject(accessibilitySettings),
      workflows:{
        version:LOCAL_WORKFLOW_VERSION,
        filterPresets:Array.isArray(localWorkflowData.filterPresets) ? localWorkflowData.filterPresets : [],
        matchHistory:Array.isArray(localWorkflowData.matchHistory) ? localWorkflowData.matchHistory : [],
        matchShortlist:Array.isArray(localWorkflowData.matchShortlist) ? localWorkflowData.matchShortlist : [],
        collections:Array.isArray(localWorkflowData.collections) ? localWorkflowData.collections : [],
      },
      ghostSignal
    }
  };
}

function migrateNerdSyncBackup(payload) {
  if (!payload || payload.kind !== NERDSYNC_BACKUP_KIND) throw new Error('This is not a NerdSync backup file.');
  const schema = Number(payload.schema || 1);
  if (schema > NERDSYNC_META.backupSchema) throw new Error('This backup was created by a newer NerdSync version. Update NerdSync before importing it.');
  const data = sanitizeBackupObject(payload.data);
  const workflows = sanitizeBackupObject(data.workflows);
  return {
    kind:NERDSYNC_BACKUP_KIND,
    schema:NERDSYNC_META.backupSchema,
    appVersion:String(payload.appVersion || 'unknown'),
    exportedAt:String(payload.exportedAt || ''),
    twitchUserId:String(payload.twitchUserId || ''),
    data:{
      discoveryHistory:sanitizeBackupObject(data.discoveryHistory),
      preferences:sanitizeBackupObject(data.preferences),
      accessibility:sanitizeBackupObject(data.accessibility),
      workflows:{
        version:LOCAL_WORKFLOW_VERSION,
        filterPresets:Array.isArray(workflows.filterPresets) ? workflows.filterPresets.slice(0,20) : [],
        matchHistory:Array.isArray(workflows.matchHistory) ? workflows.matchHistory.slice(0,20) : [],
        matchShortlist:Array.isArray(workflows.matchShortlist) ? workflows.matchShortlist.slice(0,30) : [],
        collections:Array.isArray(workflows.collections) ? workflows.collections.slice(0,30).map(item => ({ ...item, creatorIds:Array.isArray(item.creatorIds) ? [...new Set(item.creatorIds.map(String))].slice(0,500) : [] })) : [],
      },
      ghostSignal:sanitizeBackupObject(data.ghostSignal, null)
    }
  };
}

function exportNerdSyncBackup() {
  try {
    const payload = collectNerdSyncBackup();
    const stamp = new Date().toISOString().slice(0,10);
    downloadTextFile(`nerdsync-backup-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    setStatus('NerdSync local backup downloaded. Keep it somewhere safe if you want to move this setup to another browser or device.');
  } catch (error) {
    setStatus(error.message || 'Could not create NerdSync backup.', true);
  }
}

function applyNerdSyncBackup(payload) {
  const backup = migrateNerdSyncBackup(payload);
  if (!currentUser?.id) throw new Error('Sign into Twitch before importing a NerdSync backup.');
  if (backup.twitchUserId && backup.twitchUserId !== String(currentUser.id)) throw new Error('This backup belongs to a different Twitch account. NerdSync will not mix account-local profiles.');
  const data = backup.data;
  discoveryHistory = data.discoveryHistory;
  preferences = {
    categories:{}, categoryNames:{}, followedCategories:{}, tags:{}, languages:{}, viewerSamples:[], personalizationEnabled:true, historicalDiscoveryEnabled:true,
    ...data.preferences
  };
  accessibilitySettings = { theme:'system', textSize:'normal', largeCards:false, highContrast:false, reduceMotion:false, ...data.accessibility };
  localWorkflowData = data.workflows;
  saveHistory(); savePreferences(); saveAccessibilitySettings(); saveLocalWorkflowData();
  if (data.ghostSignal && typeof secretGameStorageKey === 'function') {
    try { localStorage.setItem(secretGameStorageKey(), JSON.stringify(data.ghostSignal)); } catch {}
  }
  personalizationEnabled = preferences.personalizationEnabled !== false;
  historicalDiscoveryEnabled = preferences.historicalDiscoveryEnabled !== false;
  personalizationModeEl.value = personalizationEnabled ? 'on' : 'off';
  historicalDiscoveryEl.checked = historicalDiscoveryEnabled;
  applyAccessibilitySettings();
  renderLocalWorkflowTools(); renderSavedList(); renderRecommendationProfile(); renderGrid();
  setStatus(`Imported NerdSync backup from ${backup.appVersion}. Your local profile has been restored in this browser.`);
}

async function importNerdSyncBackupFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { setStatus('That backup file is too large. NerdSync backups should be under 5 MB.', true); return; }
  try {
    const payload = JSON.parse(await file.text());
    const migrated = migrateNerdSyncBackup(payload);
    const count = Object.values(migrated.data.discoveryHistory || {}).filter(item => item?.saved).length;
    const proceed = window.confirm(`Import this NerdSync backup? It contains ${count} saved creator${count === 1 ? '' : 's'} and will replace this account's current local NerdSync profile in this browser.`);
    if (!proceed) return;
    applyNerdSyncBackup(migrated);
  } catch (error) {
    setStatus(error.message || 'Could not import that NerdSync backup.', true);
  } finally {
    const input = document.getElementById('nerdsync-backup-import');
    if (input) input.value = '';
  }
}

function installDataPortabilityEvents() {
  document.getElementById('nerdsync-backup-export')?.addEventListener('click', exportNerdSyncBackup);
  document.getElementById('nerdsync-backup-import')?.addEventListener('change', event => importNerdSyncBackupFile(event.target.files?.[0]));
}

installDataPortabilityEvents();
