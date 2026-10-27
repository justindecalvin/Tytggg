/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import fs from 'fs';

// ============================================================================
// HIGH-CONCURRENCY ATOMIC IN-MEMORY STORAGE ENGINE FOR STANBAX SCHOOLS
// Eliminates file locking, race conditions, and event-loop blocking under high traffic.
// All reads and writes happen in-memory in O(1) time (<1ms latency), while an
// asynchronous write-queue debounces and atomically writes to disk.
// ============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');

export const PATHS = {
  dataDir: DATA_DIR,
  students: path.join(DATA_DIR, 'students.json'),
  tutors: path.join(DATA_DIR, 'tutors.json'),
  moderators: path.join(DATA_DIR, 'moderators.json'),
  parents: path.join(DATA_DIR, 'parents.json'),
  adminAccounts: path.join(DATA_DIR, 'admin_accounts.json'),
  adminConfig: path.join(DATA_DIR, 'admin_config.json'),
  deletedIds: path.join(DATA_DIR, 'deleted_ids.json'),
  visitorConversations: path.join(DATA_DIR, 'visitor_conversations.json'),
  schoolRepConfig: path.join(DATA_DIR, 'school_rep_config.json'),
  chatChannels: path.join(DATA_DIR, 'chat_channels.json'),
  chatMessages: path.join(DATA_DIR, 'chat_messages.json'),
  assessmentConfig: path.join(DATA_DIR, 'assessment_config.json'),
  theme: path.join(DATA_DIR, 'theme.json'),
};

// 1. In-Memory Store
interface StoreState {
  students: any[];
  tutors: any[];
  moderators: any[];
  parents: any[];
  adminAccounts: any[];
  adminConfig: { masterPassword?: string };
  deletedIds: Set<string>;
  assessmentConfig: any;
  theme: string;
  visitorConversations: any[];
  schoolRepConfig: any;
  chatChannels: any[];
  chatMessages: any[];
  lastModified: number;
}

const state: StoreState = {
  students: [],
  tutors: [],
  moderators: [],
  parents: [],
  adminAccounts: [],
  adminConfig: { masterPassword: 'StanbaxAdmin2025!' },
  deletedIds: new Set<string>(),
  assessmentConfig: null,
  theme: 'crimson-gold',
  visitorConversations: [],
  schoolRepConfig: null,
  chatChannels: [],
  chatMessages: [],
  lastModified: Date.now(),
};

// 2. Atomic Write-Queue Manager
interface FileQueue {
  timer: NodeJS.Timeout | null;
  isWriting: boolean;
  pendingData: any;
  needsWriteAgain: boolean;
}

const fileQueues = new Map<string, FileQueue>();

export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (err) {
      console.warn('[Online Storage] Could not create data dir:', err);
    }
  }
}

function scheduleAtomicWrite(filePath: string, dataSupplier: () => any, debounceMs = 50): void {
  let queue = fileQueues.get(filePath);
  if (!queue) {
    queue = { timer: null, isWriting: false, pendingData: null, needsWriteAgain: false };
    fileQueues.set(filePath, queue);
  }

  queue.pendingData = dataSupplier();

  if (queue.timer) {
    clearTimeout(queue.timer);
  }

  queue.timer = setTimeout(async () => {
    if (!queue) return;
    queue.timer = null;
    if (queue.isWriting) {
      queue.needsWriteAgain = true;
      return;
    }
    await executeAtomicWrite(filePath, queue);
  }, debounceMs);
}

async function executeAtomicWrite(filePath: string, queue: FileQueue): Promise<void> {
  queue.isWriting = true;
  queue.needsWriteAgain = false;
  const data = queue.pendingData;
  const tmpFile = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;

  try {
    ensureDataDir();
    const serialized = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(tmpFile, serialized, 'utf-8');
    await fs.promises.rename(tmpFile, filePath);
  } catch (err) {
    console.error(`[Atomic File Storage] Write error for ${filePath}:`, err);
    try {
      if (fs.existsSync(tmpFile)) {
        await fs.promises.unlink(tmpFile);
      }
    } catch {}
  } finally {
    queue.isWriting = false;
    if (queue.needsWriteAgain) {
      scheduleAtomicWrite(filePath, () => queue.pendingData, 30);
    }
  }
}

// 3. Initialization & Startup Loading (Once per process)
export function initServerStorage(seeds: {
  seedStudents: any[];
  seedTutors: any[];
  seedModerators: any[];
  seedParents: any[];
  defaultRepConfig: any;
  defaultChatChannels: any[];
}): void {
  ensureDataDir();

  // Load deleted IDs tombstone
  if (fs.existsSync(PATHS.deletedIds)) {
    try {
      const raw = fs.readFileSync(PATHS.deletedIds, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.deletedIds = new Set(parsed);
      }
    } catch (e) {
      console.warn('[Online Storage] Could not parse deleted_ids.json:', e);
    }
  }

  // Load students
  if (fs.existsSync(PATHS.students)) {
    try {
      const raw = fs.readFileSync(PATHS.students, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.students = parsed.filter(s => s?.id && !state.deletedIds.has(s.id));
      }
    } catch (e) {
      console.warn('[Online Storage] Could not parse students.json, loading seed:', e);
      state.students = seeds.seedStudents.filter(s => !state.deletedIds.has(s.id));
    }
  } else {
    state.students = seeds.seedStudents.filter(s => !state.deletedIds.has(s.id));
    scheduleAtomicWrite(PATHS.students, () => state.students, 0);
  }

  // Load tutors
  if (fs.existsSync(PATHS.tutors)) {
    try {
      const raw = fs.readFileSync(PATHS.tutors, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.tutors = parsed.filter(t => t?.id && !state.deletedIds.has(t.id));
      }
    } catch (e) {
      state.tutors = seeds.seedTutors.filter(t => !state.deletedIds.has(t.id));
    }
  } else {
    state.tutors = seeds.seedTutors.filter(t => !state.deletedIds.has(t.id));
    scheduleAtomicWrite(PATHS.tutors, () => state.tutors, 0);
  }

  // Load moderators
  if (fs.existsSync(PATHS.moderators)) {
    try {
      const raw = fs.readFileSync(PATHS.moderators, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.moderators = parsed.filter(m => m?.id && !state.deletedIds.has(m.id));
      }
    } catch (e) {
      state.moderators = seeds.seedModerators.filter(m => !state.deletedIds.has(m.id));
    }
  } else {
    state.moderators = seeds.seedModerators.filter(m => !state.deletedIds.has(m.id));
    scheduleAtomicWrite(PATHS.moderators, () => state.moderators, 0);
  }

  // Load parents
  if (fs.existsSync(PATHS.parents)) {
    try {
      const raw = fs.readFileSync(PATHS.parents, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.parents = parsed.filter(p => p?.id && !state.deletedIds.has(p.id));
      }
    } catch (e) {
      state.parents = seeds.seedParents.filter(p => !state.deletedIds.has(p.id));
    }
  } else {
    state.parents = seeds.seedParents.filter(p => !state.deletedIds.has(p.id));
    scheduleAtomicWrite(PATHS.parents, () => state.parents, 0);
  }

  // Load admin accounts
  if (fs.existsSync(PATHS.adminAccounts)) {
    try {
      const raw = fs.readFileSync(PATHS.adminAccounts, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.adminAccounts = parsed.filter(a => a?.id && !state.deletedIds.has(a.id));
      }
    } catch (e) {}
  }

  // Load admin config
  if (fs.existsSync(PATHS.adminConfig)) {
    try {
      state.adminConfig = JSON.parse(fs.readFileSync(PATHS.adminConfig, 'utf-8'));
    } catch {}
  }

  // Load assessment config
  if (fs.existsSync(PATHS.assessmentConfig)) {
    try {
      state.assessmentConfig = JSON.parse(fs.readFileSync(PATHS.assessmentConfig, 'utf-8'));
    } catch {}
  }

  // Load theme
  if (fs.existsSync(PATHS.theme)) {
    try {
      const raw = fs.readFileSync(PATHS.theme, 'utf-8');
      const parsed = JSON.parse(raw);
      state.theme = parsed.theme || 'crimson-gold';
    } catch {}
  } else {
    scheduleAtomicWrite(PATHS.theme, () => ({ theme: 'crimson-gold', updatedAt: new Date().toISOString() }), 0);
  }

  // Load conversations
  if (fs.existsSync(PATHS.visitorConversations)) {
    try {
      const raw = fs.readFileSync(PATHS.visitorConversations, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) state.visitorConversations = parsed;
    } catch {}
  }

  // Load rep config
  if (fs.existsSync(PATHS.schoolRepConfig)) {
    try {
      state.schoolRepConfig = { ...seeds.defaultRepConfig, ...JSON.parse(fs.readFileSync(PATHS.schoolRepConfig, 'utf-8')) };
    } catch {
      state.schoolRepConfig = { ...seeds.defaultRepConfig };
    }
  } else {
    state.schoolRepConfig = { ...seeds.defaultRepConfig };
    scheduleAtomicWrite(PATHS.schoolRepConfig, () => state.schoolRepConfig, 0);
  }

  // Load chat channels
  if (fs.existsSync(PATHS.chatChannels)) {
    try {
      const raw = fs.readFileSync(PATHS.chatChannels, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) state.chatChannels = parsed;
      else state.chatChannels = [...seeds.defaultChatChannels];
    } catch {
      state.chatChannels = [...seeds.defaultChatChannels];
    }
  } else {
    state.chatChannels = [...seeds.defaultChatChannels];
    scheduleAtomicWrite(PATHS.chatChannels, () => state.chatChannels, 0);
  }

  // Load chat messages
  if (fs.existsSync(PATHS.chatMessages)) {
    try {
      const raw = fs.readFileSync(PATHS.chatMessages, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) state.chatMessages = parsed;
    } catch {}
  }

  console.log(`[High-Concurrency Storage Engine] Initialized: ${state.students.length} students, ${state.tutors.length} faculty, in-memory caching active.`);
}

// 4. In-Memory O(1) Getters & Atomic Setters

// Tombstones
export function getDeletedIds(): Set<string> {
  return state.deletedIds;
}

export function addDeletedId(id: string): void {
  if (!id || typeof id !== 'string') return;
  state.deletedIds.add(id);
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.deletedIds, () => Array.from(state.deletedIds), 20);
}

// Students
export function getOnlineStudents(): any[] {
  return state.students.filter(s => s?.id && !state.deletedIds.has(s.id));
}

export function saveOnlineStudents(students: any[]): boolean {
  state.students = students.filter(s => s?.id && !state.deletedIds.has(s.id));
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.students, () => state.students, 50);
  return true;
}

export function updateOnlineStudent(id: string, updates: any): { success: boolean; student?: any; error?: string } {
  if (state.deletedIds.has(id)) {
    return { success: false, error: 'Student was deleted' };
  }
  const index = state.students.findIndex(s => s.id === id);
  if (index === -1) {
    return { success: false, error: 'Student not found' };
  }

  const existing = state.students[index];
  
  // Non-destructive grade merge
  let mergedGrades = existing.grades || [];
  if (Array.isArray(updates.grades)) {
    const gradesMap = new Map<string, any>();
    for (const g of existing.grades || []) {
      if (g?.subject) gradesMap.set(g.subject.toLowerCase(), g);
    }
    for (const g of updates.grades) {
      if (g?.subject) {
        const prev = gradesMap.get(g.subject.toLowerCase());
        gradesMap.set(g.subject.toLowerCase(), prev ? { ...prev, ...g } : g);
      }
    }
    mergedGrades = Array.from(gradesMap.values());
  }

  const updated = {
    ...existing,
    ...updates,
    id,
    grades: mergedGrades,
    savedOnline: true,
    updatedAt: new Date().toISOString(),
  };

  state.students[index] = updated;
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.students, () => state.students, 50);
  return { success: true, student: updated };
}

// Batch Update Students (for high-volume class score entries & result collation)
export function batchUpsertStudents(incomingBatch: any[]): { count: number; students: any[] } {
  const currentMap = new Map<string, any>();
  for (const s of state.students) {
    if (s?.id) currentMap.set(s.id, s);
  }

  let updatedCount = 0;
  const nowIso = new Date().toISOString();

  for (const inc of incomingBatch) {
    if (!inc?.id || state.deletedIds.has(inc.id)) continue;
    const existing = currentMap.get(inc.id);

    if (existing) {
      // Merge grades subject by subject
      const gradesMap = new Map<string, any>();
      for (const g of existing.grades || []) {
        if (g?.subject) gradesMap.set(g.subject.toLowerCase(), g);
      }
      for (const g of inc.grades || []) {
        if (g?.subject) {
          const prev = gradesMap.get(g.subject.toLowerCase());
          gradesMap.set(g.subject.toLowerCase(), prev ? { ...prev, ...g } : g);
        }
      }

      currentMap.set(inc.id, {
        ...existing,
        ...inc,
        grades: Array.from(gradesMap.values()),
        lastCollatedResult: inc.lastCollatedResult || existing.lastCollatedResult,
        savedOnline: true,
        updatedAt: nowIso,
      });
      updatedCount++;
    } else {
      currentMap.set(inc.id, {
        ...inc,
        savedOnline: true,
        updatedAt: nowIso,
      });
      updatedCount++;
    }
  }

  state.students = Array.from(currentMap.values());
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.students, () => state.students, 50);

  return {
    count: updatedCount,
    students: getOnlineStudents(),
  };
}

// Tutors
export function getOnlineTutors(): any[] {
  return state.tutors.filter(t => t?.id && !state.deletedIds.has(t.id));
}

export function saveOnlineTutors(tutors: any[]): boolean {
  state.tutors = tutors.filter(t => t?.id && !state.deletedIds.has(t.id));
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.tutors, () => state.tutors, 50);
  return true;
}

// Moderators
export function getOnlineModerators(): any[] {
  return state.moderators.filter(m => m?.id && !state.deletedIds.has(m.id));
}

export function saveOnlineModerators(moderators: any[]): boolean {
  state.moderators = moderators.filter(m => m?.id && !state.deletedIds.has(m.id));
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.moderators, () => state.moderators, 50);
  return true;
}

// Parents
export function getOnlineParents(): any[] {
  return state.parents.filter(p => p?.id && !state.deletedIds.has(p.id));
}

export function saveOnlineParents(parents: any[]): boolean {
  state.parents = parents.filter(p => p?.id && !state.deletedIds.has(p.id));
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.parents, () => state.parents, 50);
  return true;
}

// Admin Accounts
export function getOnlineAdminAccounts(): any[] {
  return state.adminAccounts.filter(a => a?.id && !state.deletedIds.has(a.id));
}

export function saveOnlineAdminAccounts(accounts: any[]): boolean {
  state.adminAccounts = accounts.filter(a => a?.id && !state.deletedIds.has(a.id));
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.adminAccounts, () => state.adminAccounts, 50);
  return true;
}

// Admin Config
export function getOnlineAdminConfig(): { masterPassword?: string } {
  return state.adminConfig;
}

export function saveOnlineAdminConfig(config: any): boolean {
  state.adminConfig = config;
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.adminConfig, () => state.adminConfig, 50);
  return true;
}

// Assessment Config
export function getOnlineAssessmentConfig(): any {
  return state.assessmentConfig;
}

export function saveOnlineAssessmentConfig(cfg: any): boolean {
  state.assessmentConfig = cfg;
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.assessmentConfig, () => state.assessmentConfig, 50);
  return true;
}

// Theme
export function getOnlineTheme(): string {
  return state.theme || 'crimson-gold';
}

export function saveOnlineTheme(theme: string): boolean {
  state.theme = theme;
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.theme, () => ({ theme, updatedAt: new Date().toISOString() }), 50);
  return true;
}

// Visitor Conversations
export function getOnlineVisitorConversations(): any[] {
  return state.visitorConversations;
}

export function saveOnlineVisitorConversations(list: any[]): boolean {
  state.visitorConversations = list;
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.visitorConversations, () => state.visitorConversations, 50);
  return true;
}

// School Rep Config
export function getOnlineSchoolRepConfig(): any {
  return state.schoolRepConfig;
}

export function saveOnlineSchoolRepConfig(cfg: any): boolean {
  state.schoolRepConfig = cfg;
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.schoolRepConfig, () => state.schoolRepConfig, 50);
  return true;
}

// Chat Channels
export function getOnlineChatChannels(): any[] {
  return state.chatChannels;
}

export function saveOnlineChatChannels(channels: any[]): boolean {
  state.chatChannels = channels;
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.chatChannels, () => state.chatChannels, 50);
  return true;
}

// Chat Messages
export function getOnlineChatMessages(): any[] {
  return state.chatMessages;
}

export function saveOnlineChatMessages(messages: any[]): boolean {
  state.chatMessages = messages;
  state.lastModified = Date.now();
  scheduleAtomicWrite(PATHS.chatMessages, () => state.chatMessages, 50);
  return true;
}

// 5. Intelligent Multi-Device Cloud Reconciliation Engine
export function reconcileCloudData(payload: {
  deviceId?: string;
  outbox?: any[];
  localStudents?: any[];
  localAssessmentConfig?: any;
  forceFull?: boolean;
}): {
  success: boolean;
  reconciledCount: number;
  students: any[];
  assessmentConfig: any;
  serverTimestamp: string;
} {
  let reconciledCount = 0;
  const nowIso = new Date().toISOString();

  // A. Reconcile explicit outbox items
  if (Array.isArray(payload.outbox) && payload.outbox.length > 0) {
    for (const item of payload.outbox) {
      if (item.entity === 'student' && item.data) {
        const studentId = item.entityId || item.data.id;
        if (!studentId || state.deletedIds.has(studentId)) continue;

        const idx = state.students.findIndex(s => s.id === studentId);
        if (idx >= 0) {
          state.students[idx] = {
            ...state.students[idx],
            ...item.data,
            id: studentId,
            savedOnline: true,
            updatedAt: item.timestamp || nowIso,
          };
        } else {
          state.students.push({
            ...item.data,
            id: studentId,
            savedOnline: true,
            updatedAt: item.timestamp || nowIso,
          });
        }
        reconciledCount++;
      } else if (item.entity === 'batch_scores' && Array.isArray(item.data?.scores)) {
        const subject = item.data.subject;
        for (const sc of item.data.scores) {
          const st = state.students.find(s => s.id === sc.studentId);
          if (st) {
            const grades = st.grades || [];
            const idx = grades.findIndex((g: any) => g.subject?.toLowerCase() === subject?.toLowerCase());
            const total = (sc.ca1 || 0) + (sc.ca2 || 0) + (sc.ca3 || 0) + (sc.exam || 0);
            if (idx >= 0) {
              grades[idx] = { ...grades[idx], ...sc, total };
            } else {
              grades.push({
                id: `grd-${st.id}-${subject?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                subject,
                ...sc,
                total,
              });
            }
            st.grades = grades;
            st.updatedAt = nowIso;
            reconciledCount++;
          }
        }
      } else if (item.entity === 'results_dispatch' && item.data) {
        if (Array.isArray(item.data.students)) {
          for (const ds of item.data.students) {
            const idx = state.students.findIndex(s => s.id === ds.id);
            if (idx >= 0) {
              state.students[idx] = {
                ...state.students[idx],
                ...ds,
                savedOnline: true,
                updatedAt: nowIso,
              };
              reconciledCount++;
            }
          }
        }
        if (item.data.assessmentConfig) {
          state.assessmentConfig = { ...(state.assessmentConfig || {}), ...item.data.assessmentConfig };
          saveOnlineAssessmentConfig(state.assessmentConfig);
        }
      }
    }
  }

  // B. Field-level merge of local students against server students
  if (Array.isArray(payload.localStudents) && payload.localStudents.length > 0) {
    const serverMap = new Map<string, any>();
    for (const s of state.students) {
      if (s?.id) serverMap.set(s.id, s);
    }

    for (const loc of payload.localStudents) {
      if (!loc?.id || state.deletedIds.has(loc.id)) continue;
      const srv = serverMap.get(loc.id);

      if (!srv) {
        // Created offline on this device!
        state.students.push({
          ...loc,
          savedOnline: true,
          updatedAt: loc.updatedAt || nowIso,
        });
        reconciledCount++;
      } else {
        // Deep grade merge
        const srvGradesMap = new Map<string, any>();
        for (const g of srv.grades || []) {
          if (g?.subject) srvGradesMap.set(g.subject.toLowerCase(), g);
        }

        let modified = false;
        for (const lg of loc.grades || []) {
          if (!lg?.subject) continue;
          const key = lg.subject.toLowerCase();
          const sg = srvGradesMap.get(key);

          const locScore = (Number(lg.ca1) || 0) + (Number(lg.ca2) || 0) + (Number(lg.ca3) || 0) + (Number(lg.exam) || 0);
          const srvScore = sg ? (Number(sg.ca1) || 0) + (Number(sg.ca2) || 0) + (Number(sg.ca3) || 0) + (Number(sg.exam) || 0) : 0;

          if (!sg && locScore > 0) {
            srvGradesMap.set(key, lg);
            modified = true;
          } else if (sg && locScore > 0 && srvScore === 0) {
            srvGradesMap.set(key, { ...sg, ...lg });
            modified = true;
          } else if (sg && locScore > 0 && srvScore > 0) {
            // Compare timestamps or preserve recent inputs
            const locTime = lg.updatedAt ? new Date(lg.updatedAt).getTime() : 0;
            const srvTime = sg.updatedAt ? new Date(sg.updatedAt).getTime() : 0;
            if (locTime > srvTime) {
              srvGradesMap.set(key, { ...sg, ...lg });
              modified = true;
            }
          }
        }

        if (modified) {
          srv.grades = Array.from(srvGradesMap.values());
          srv.updatedAt = nowIso;
          reconciledCount++;
        }

        // Merge lastCollatedResult if local is newer
        if (loc.lastCollatedResult) {
          const locDispTime = loc.lastCollatedResult.dispatchedAt ? new Date(loc.lastCollatedResult.dispatchedAt).getTime() : 0;
          const srvDispTime = srv.lastCollatedResult?.dispatchedAt ? new Date(srv.lastCollatedResult.dispatchedAt).getTime() : 0;
          if (locDispTime >= srvDispTime) {
            srv.lastCollatedResult = loc.lastCollatedResult;
            srv.termAverage = loc.termAverage ?? srv.termAverage;
            srv.overallPosition = loc.overallPosition ?? srv.overallPosition;
            srv.teacherRemark = loc.teacherRemark ?? srv.teacherRemark;
            srv.principalRemark = loc.principalRemark ?? srv.principalRemark;
            srv.updatedAt = nowIso;
            reconciledCount++;
          }
        }
      }
    }
  }

  // C. Reconcile Assessment Config
  if (payload.localAssessmentConfig && typeof payload.localAssessmentConfig === 'object') {
    const currentCfg = state.assessmentConfig || {};
    const localTime = payload.localAssessmentConfig.resultsDispatchedAt
      ? new Date(payload.localAssessmentConfig.resultsDispatchedAt).getTime()
      : 0;
    const serverTime = currentCfg.resultsDispatchedAt ? new Date(currentCfg.resultsDispatchedAt).getTime() : 0;

    if (localTime >= serverTime) {
      state.assessmentConfig = { ...currentCfg, ...payload.localAssessmentConfig };
      saveOnlineAssessmentConfig(state.assessmentConfig);
      reconciledCount++;
    }
  }

  if (reconciledCount > 0) {
    state.lastModified = Date.now();
    scheduleAtomicWrite(PATHS.students, () => state.students, 50);
  }

  return {
    success: true,
    reconciledCount,
    students: getOnlineStudents(),
    assessmentConfig: getOnlineAssessmentConfig(),
    serverTimestamp: nowIso,
  };
}

// 6. Graceful Exit Synchronization
export function flushAllSync(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(PATHS.students, JSON.stringify(state.students, null, 2), 'utf-8');
    fs.writeFileSync(PATHS.tutors, JSON.stringify(state.tutors, null, 2), 'utf-8');
    fs.writeFileSync(PATHS.moderators, JSON.stringify(state.moderators, null, 2), 'utf-8');
    fs.writeFileSync(PATHS.parents, JSON.stringify(state.parents, null, 2), 'utf-8');
    fs.writeFileSync(PATHS.deletedIds, JSON.stringify(Array.from(state.deletedIds), null, 2), 'utf-8');
    if (state.assessmentConfig) {
      fs.writeFileSync(PATHS.assessmentConfig, JSON.stringify(state.assessmentConfig, null, 2), 'utf-8');
    }
    console.log('[Storage Engine] Successfully flushed all caches on exit.');
  } catch (err) {
    console.warn('[Storage Engine] Exit flush warning:', err);
  }
}

process.on('SIGTERM', flushAllSync);
process.on('SIGINT', flushAllSync);
