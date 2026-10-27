/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// Robust Client-Side Synchronization & Outbox Engine
// Ensures seamless offline-to-online transitions, automatic background syncing,
// and conflict-free reconciliation between mobile/desktop devices and the cloud server.
// ============================================================================

export interface OutboxItem {
  id: string;
  entity: 'student' | 'batch_scores' | 'results_dispatch' | 'assessment_config' | 'custom_results';
  action: 'upsert' | 'delete' | 'patch';
  entityId: string;
  data: any;
  timestamp: string;
  deviceId: string;
  retries: number;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastReconciledCount: number;
}

const OUTBOX_KEY = 'stanbax_sync_outbox';
const DEVICE_ID_KEY = 'stanbax_sync_device_id';
const LAST_SYNC_KEY = 'stanbax_sync_last_at';

// 1. Stable Device Identifier
export function getSyncDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_ephemeral_' + Math.random().toString(36).substring(2, 8);
  }
}

// 2. Outbox Storage Management
export function getPendingOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePendingOutbox(items: OutboxItem[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
    notifyListeners();
  } catch (e) {
    console.warn('[SyncManager] Failed to write outbox to localStorage:', e);
  }
}

// 3. Queue Pending Changes (Offline-First)
export function queueOfflineChange(
  entity: OutboxItem['entity'],
  entityId: string,
  data: any,
  action: OutboxItem['action'] = 'upsert'
): void {
  const outbox = getPendingOutbox();
  const deviceId = getSyncDeviceId();
  const timestamp = new Date().toISOString();

  // Deduplicate if the same entity has a pending change
  const existingIdx = outbox.findIndex(item => item.entity === entity && item.entityId === entityId);
  
  const newItem: OutboxItem = {
    id: 'out_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    entity,
    action,
    entityId,
    data,
    timestamp,
    deviceId,
    retries: 0,
  };

  if (existingIdx >= 0) {
    // If it's a batch score or student, merge intelligently into the pending entry
    outbox[existingIdx] = {
      ...outbox[existingIdx],
      data: action === 'patch' ? { ...outbox[existingIdx].data, ...data } : data,
      timestamp,
      retries: 0,
    };
  } else {
    outbox.push(newItem);
  }

  savePendingOutbox(outbox);

  // Trigger background sync immediately if online
  if (navigator.onLine) {
    void triggerBackgroundSync();
  }
}

// 4. State Listeners
type SyncListener = (status: SyncStatus) => void;
const listeners = new Set<SyncListener>();

let currentStatus: SyncStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,
  lastReconciledCount: 0,
};

try {
  currentStatus.lastSyncedAt = localStorage.getItem(LAST_SYNC_KEY);
  currentStatus.pendingCount = getPendingOutbox().length;
} catch {}

function notifyListeners(): void {
  currentStatus.pendingCount = getPendingOutbox().length;
  currentStatus.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  for (const listener of listeners) {
    try {
      listener({ ...currentStatus });
    } catch (err) {
      console.warn('[SyncManager] Listener error:', err);
    }
  }
}

export function subscribeToSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  listener({ ...currentStatus });
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncStatus(): SyncStatus {
  return { ...currentStatus, pendingCount: getPendingOutbox().length };
}

// 5. Intelligent Merge Helper for Client-Side Storage
export function mergeStudentArrays(local: any[], remote: any[]): any[] {
  const remoteMap = new Map<string, any>();
  for (const r of remote) {
    if (r?.id) remoteMap.set(r.id, r);
  }

  const mergedList: any[] = [];
  const processedIds = new Set<string>();

  for (const loc of local) {
    if (!loc?.id) continue;
    processedIds.add(loc.id);
    const rem = remoteMap.get(loc.id);

    if (!rem) {
      // Exists locally only (created offline)
      mergedList.push(loc);
      continue;
    }

    // Merge grades subject by subject
    const gradesMap = new Map<string, any>();
    for (const g of rem.grades || []) {
      if (g?.subject) gradesMap.set(g.subject.toLowerCase(), g);
    }
    for (const g of loc.grades || []) {
      if (!g?.subject) continue;
      const key = g.subject.toLowerCase();
      const existing = gradesMap.get(key);
      if (!existing) {
        gradesMap.set(key, g);
      } else {
        // Keep the one with non-zero scores or newer timestamp
        const locHasScores = (g.ca1 || 0) + (g.ca2 || 0) + (g.ca3 || 0) + (g.exam || 0) > 0;
        const remHasScores = (existing.ca1 || 0) + (existing.ca2 || 0) + (existing.ca3 || 0) + (existing.exam || 0) > 0;
        if (locHasScores && !remHasScores) {
          gradesMap.set(key, g);
        } else if (locHasScores && remHasScores) {
          // Both have scores; merge CA and exam attributes non-destructively
          gradesMap.set(key, {
            ...existing,
            ...g,
            ca1: g.ca1 ?? existing.ca1,
            ca2: g.ca2 ?? existing.ca2,
            ca3: g.ca3 ?? existing.ca3,
            exam: g.exam ?? existing.exam,
            total: (g.ca1 ?? existing.ca1 ?? 0) + (g.ca2 ?? existing.ca2 ?? 0) + (g.ca3 ?? existing.ca3 ?? 0) + (g.exam ?? existing.exam ?? 0),
          });
        }
      }
    }

    const mergedGrades = Array.from(gradesMap.values());

    // Resolve which timestamp is fresher
    const locTime = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
    const remTime = rem.updatedAt ? new Date(rem.updatedAt).getTime() : 0;
    const fresher = locTime > remTime ? loc : rem;

    mergedList.push({
      ...rem,
      ...loc,
      ...fresher,
      grades: mergedGrades.length > 0 ? mergedGrades : (rem.grades || loc.grades || []),
      lastCollatedResult: loc.lastCollatedResult || rem.lastCollatedResult,
      savedOnline: true,
    });
  }

  // Add any remote-only students
  for (const rem of remote) {
    if (rem?.id && !processedIds.has(rem.id)) {
      mergedList.push(rem);
    }
  }

  return mergedList;
}

// 6. Central Cloud Reconciliation
let activeSyncPromise: Promise<{
  ok: boolean;
  reconciledCount: number;
  students?: any[];
  assessmentConfig?: any;
  message: string;
}> | null = null;

export async function reconcileWithCloudServer(options?: {
  forceFull?: boolean;
}): Promise<{
  ok: boolean;
  reconciledCount: number;
  students?: any[];
  assessmentConfig?: any;
  message: string;
}> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    currentStatus.isSyncing = true;
    currentStatus.lastError = null;
    notifyListeners();

    try {
      const outbox = getPendingOutbox();
      const deviceId = getSyncDeviceId();

      // Read local state that might have offline edits
      let localStudents: any[] = [];
      try {
        const raw = localStorage.getItem('stanbax_students');
        if (raw) localStudents = JSON.parse(raw);
      } catch {}

      let localAssessmentConfig: any = null;
      try {
        const raw = localStorage.getItem('stanbax_assessment_config');
        if (raw) localAssessmentConfig = JSON.parse(raw);
      } catch {}

      const payload = {
        deviceId,
        timestamp: new Date().toISOString(),
        outbox,
        localStudents: Array.isArray(localStudents) ? localStudents : [],
        localAssessmentConfig,
        forceFull: !!options?.forceFull,
      };

      const res = await fetch('/api/sync/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();

      if (result.success) {
        // Clear processed outbox items
        savePendingOutbox([]);

        const nowIso = new Date().toISOString();
        currentStatus.lastSyncedAt = nowIso;
        currentStatus.lastReconciledCount = result.reconciledCount || 0;
        try {
          localStorage.setItem(LAST_SYNC_KEY, nowIso);
        } catch {}

        // Persist reconciled students and assessmentConfig to local storage
        if (Array.isArray(result.students)) {
          try {
            localStorage.setItem('stanbax_students', JSON.stringify(result.students));
          } catch {}
        }
        if (result.assessmentConfig) {
          try {
            localStorage.setItem('stanbax_assessment_config', JSON.stringify(result.assessmentConfig));
          } catch {}
        }

        currentStatus.isSyncing = false;
        notifyListeners();

        return {
          ok: true,
          reconciledCount: result.reconciledCount || 0,
          students: result.students,
          assessmentConfig: result.assessmentConfig,
          message: result.message || 'Synchronization complete.',
        };
      } else {
        throw new Error(result.error || 'Server reconciliation returned unverified status');
      }
    } catch (err: any) {
      console.warn('[SyncManager] Cloud reconciliation deferred:', err?.message || err);
      currentStatus.isSyncing = false;
      currentStatus.lastError = err?.message || 'Sync temporarily unavailable';
      notifyListeners();

      return {
        ok: false,
        reconciledCount: 0,
        message: err?.message || 'Failed to reconcile with cloud server',
      };
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

// 7. Background Auto-Sync Trigger
export async function triggerBackgroundSync(): Promise<void> {
  if (!navigator.onLine) return;
  const outbox = getPendingOutbox();
  if (outbox.length === 0) return;
  await reconcileWithCloudServer();
}

// 8. Automated Lifecyle Listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    currentStatus.isOnline = true;
    notifyListeners();
    void triggerBackgroundSync();
  });

  window.addEventListener('offline', () => {
    currentStatus.isOnline = false;
    notifyListeners();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      void triggerBackgroundSync();
    }
  });

  // Periodic safety pulse: sync pending changes every 30 seconds
  setInterval(() => {
    if (navigator.onLine && getPendingOutbox().length > 0) {
      void triggerBackgroundSync();
    }
  }, 30000);
}
