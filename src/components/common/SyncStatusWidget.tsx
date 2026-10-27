/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudCheck, 
  CloudOff, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle,
  Smartphone,
  Laptop
} from '../RealIcons';
import { 
  subscribeToSyncStatus, 
  reconcileWithCloudServer, 
  getSyncDeviceId, 
  type SyncStatus 
} from '../../utils/syncManager';

interface SyncStatusWidgetProps {
  compact?: boolean;
  onReconciled?: (students: any[], assessmentConfig?: any) => void;
  className?: string;
}

export const SyncStatusWidget: React.FC<SyncStatusWidgetProps> = ({
  compact = false,
  onReconciled,
  className = ''
}) => {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
    lastReconciledCount: 0,
  });

  const [isOpen, setIsOpen] = useState(false);
  const [reconcileFeedback, setReconcileFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSyncStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const handleManualReconcile = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReconcileFeedback('Reconciling with cloud database...');
    try {
      const res = await reconcileWithCloudServer({ forceFull: true });
      if (res.ok) {
        setReconcileFeedback(
          res.reconciledCount > 0 
            ? `Reconciled ${res.reconciledCount} records with cloud server!` 
            : 'All records are perfectly synchronized!'
        );
        if (onReconciled && res.students) {
          onReconciled(res.students, res.assessmentConfig);
        }
      } else {
        setReconcileFeedback(`Sync note: ${res.message}`);
      }
    } catch (err: any) {
      setReconcileFeedback(err?.message || 'Sync failed');
    } finally {
      setTimeout(() => setReconcileFeedback(null), 4000);
    }
  };

  const deviceId = getSyncDeviceId();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const formattedLastSync = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Pending initial sync';

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
          status.isSyncing
            ? 'bg-blue-50 border-blue-300 text-blue-700 animate-pulse'
            : !status.isOnline
            ? 'bg-amber-50 border-amber-300 text-amber-800'
            : status.pendingCount > 0
            ? 'bg-amber-50 border-amber-300 text-amber-800'
            : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
        }`}
        title={
          status.isSyncing
            ? 'Synchronizing data with cloud server...'
            : !status.isOnline
            ? 'Offline Mode: Changes saved locally and will auto-sync on reconnect'
            : status.pendingCount > 0
            ? `${status.pendingCount} local offline changes waiting to push to server`
            : 'Cloud Synchronized: All records live on server'
        }
      >
        {status.isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
        ) : !status.isOnline ? (
          <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        ) : status.pendingCount > 0 ? (
          <Cloud className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        ) : (
          <CloudCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        )}

        <span className="text-[11px] font-extrabold whitespace-nowrap">
          {status.isSyncing ? (
            'Syncing...'
          ) : !status.isOnline ? (
            compact ? 'Offline' : `Offline (${status.pendingCount})`
          ) : status.pendingCount > 0 ? (
            compact ? `Sync (${status.pendingCount})` : `${status.pendingCount} to sync`
          ) : (
            compact ? 'Cloud Synced' : 'Cloud Synced'
          )}
        </span>

        {status.pendingCount > 0 && !status.isSyncing && (
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div 
            className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-stone-200 z-50 p-4 text-slate-800 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  status.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {status.isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900">
                    {status.isOnline ? 'Cloud Server Connected' : 'Offline Mode Active'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {status.isOnline ? 'Zero-latency sync enabled' : 'Safe offline local storage'}
                  </div>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                status.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {status.isOnline ? 'Live' : 'Offline'}
              </span>
            </div>

            {/* Device and Sync Details */}
            <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 text-[11px] font-medium">
                  {isMobile ? <Smartphone className="w-3.5 h-3.5" /> : <Laptop className="w-3.5 h-3.5" />}
                  Device Session
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-700">
                  {deviceId.slice(0, 14)}...
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[11px] font-medium">Last Reconciled</span>
                <span className="font-bold text-slate-800 text-[11px]">{formattedLastSync}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[11px] font-medium">Pending Local Changes</span>
                <span className={`font-black text-[11px] ${
                  status.pendingCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {status.pendingCount} records
                </span>
              </div>
            </div>

            {/* Explanatory note */}
            <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
              {status.pendingCount > 0
                ? 'Scores and data changes made on this device are safeguarded locally and will automatically reconcile with the cloud database.'
                : 'All exam results, continuous assessment scores, and scholar updates on this device are in sync with the central cloud database.'}
            </p>

            {reconcileFeedback && (
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{reconcileFeedback}</span>
              </div>
            )}

            {/* Manual Reconcile Button */}
            <button
              type="button"
              disabled={status.isSyncing}
              onClick={handleManualReconcile}
              className="w-full py-2.5 px-3 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${status.isSyncing ? 'animate-spin' : ''}`} />
              <span>{status.isSyncing ? 'Reconciling Data...' : 'Reconcile & Force Sync Now'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
