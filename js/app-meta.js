'use strict';

// Single browser-side source of truth for release/runtime metadata.
const NERDSYNC_META = Object.freeze({
  version: '0.19.0',
  label: 'Alpha-0.19.0',
  backupSchema: 2,
  localWorkflowSchema: 2,
  buildTrack: 'Plan A / no-D1'
});
const APP_VERSION = NERDSYNC_META.label;
