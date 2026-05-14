'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  ensurePushInitialized,
} from '@/lib/pushManager';
import {
  getOneSignalSnapshot,
  getDiagnosticLog,
  isOneSignalAvailable,
  type PushDiagnostic,
} from '@/lib/oneSignalManager';
import { Bell, ChevronLeft } from '@/components/icons';

interface ServerStatus {
  oneSignalConfigured: boolean;
  oneSignalPlayerId: string | null;
  recentNotifications24h: number;
  lastNotificationAt: string | null;
  lastNotificationType: string | null;
}

interface ClientSnapshot {
  available: boolean;
  permission: string;
  subscriptionId: string | null;
  optedIn: boolean | null;
}

interface Preferences {
  pushEnabled: boolean;
  networking: boolean;
  opportunities: boolean;
  universities: boolean;
  social: boolean;
  postLikes: boolean;
  chat: boolean;
  achievements: boolean;
  system: boolean;
  emailDigest: boolean;
  emailAlerts: boolean;
}

const PREF_LABELS: Array<{ key: keyof Preferences; label: string; description: string }> = [
  { key: 'networking', label: 'Networking', description: 'Richieste di amicizia, accettazioni, profili visitati' },
  { key: 'opportunities', label: 'Opportunità', description: 'Nuove opportunità, scadenze importanti' },
  { key: 'universities', label: 'Università', description: 'Corsi consigliati e scadenze' },
  { key: 'social', label: 'Social', description: 'Commenti sui tuoi post, risposte' },
  { key: 'postLikes', label: 'Mi piace sui post', description: 'Quando qualcuno mette mi piace ai tuoi post' },
  { key: 'chat', label: 'Chat', description: 'Nuovi messaggi' },
  { key: 'achievements', label: 'Achievement', description: 'Badge sbloccati' },
  { key: 'system', label: 'Sistema', description: 'Annunci e aggiornamenti importanti' },
];

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean | null }) {
  const color = ok === true ? 'text-green-600' : ok === false ? 'text-red-600' : 'text-gray-500';
  const dot = ok === true ? 'bg-green-500' : ok === false ? 'bg-red-500' : 'bg-gray-300';
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-[#2c3149]">{label}</span>
      <span className={`text-xs font-mono ${color} flex items-center gap-2 max-w-[60%] text-right break-all`}>
        <span className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
        {value}
      </span>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-[#615fe2]' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function NotificationsSettingsPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ClientSnapshot | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [swInfo, setSwInfo] = useState<{ scope: string; state: string; path: string } | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [savingPref, setSavingPref] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [logEntries, setLogEntries] = useState<PushDiagnostic[]>([]);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const refresh = useCallback(async () => {
    // Client snapshot
    try {
      const snap = await getOneSignalSnapshot();
      setSnapshot(snap);
    } catch {
      setSnapshot(null);
    }
    // Server status
    try {
      const { data } = await api.get<ServerStatus>('/notifications/push/status');
      setServerStatus(data);
    } catch {
      setServerStatus(null);
    }
    // SW info
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        const osReg = regs.find((r) => r.active?.scriptURL?.includes('OneSignalSDKWorker'))
          || regs.find((r) => r.active?.scriptURL?.includes('OneSignal'))
          || regs[0];
        if (osReg) {
          setSwInfo({
            scope: osReg.scope,
            state: osReg.active?.state || osReg.installing?.state || 'unknown',
            path: osReg.active?.scriptURL || '?',
          });
        } else {
          setSwInfo(null);
        }
      } catch {
        setSwInfo(null);
      }
    }
    setLogEntries(getDiagnosticLog());
  }, []);

  useEffect(() => {
    // Detect iOS & standalone
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent;
      setIsIOS(/iPad|iPhone|iPod/.test(ua));
      const nav = window.navigator as Navigator & { standalone?: boolean };
      setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true);
    }
    // Ensure OneSignal SDK is initialised so the snapshot is meaningful
    ensurePushInitialized().finally(() => {
      refresh();
    });
    // Load preferences
    api.get<Preferences>('/notifications/preferences')
      .then(({ data }) => setPrefs(data))
      .catch(() => setPrefs(null));
  }, [refresh]);

  const handleEnable = async () => {
    setBusy(true);
    setTestResult(null);
    try {
      const ok = await subscribeToPush();
      if (!ok) {
        setTestResult(
          typeof Notification !== 'undefined' && Notification.permission === 'denied'
            ? 'Permesso negato. Riabilita dalle impostazioni del browser.'
            : 'Impossibile completare la subscription. Controlla il log diagnostico.'
        );
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    setTestResult(null);
    try {
      await unsubscribeFromPush();
      await refresh();
      setTestResult('Subscription resettata. Premi "Attiva notifiche" per ri-registrare il device.');
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setTestResult(null);
    const result = await sendTestPush();
    if (result.success) {
      setTestResult('Test inviato. La notifica dovrebbe arrivare entro pochi secondi.');
    } else {
      setTestResult(`Errore: ${result.error || 'unknown'}`);
    }
    setBusy(false);
  };

  const togglePref = async (key: keyof Preferences, value: boolean) => {
    if (!prefs) return;
    setSavingPref(key);
    const optimistic = { ...prefs, [key]: value };
    setPrefs(optimistic);
    try {
      const { data } = await api.put<Preferences>('/notifications/preferences', { [key]: value });
      setPrefs(data);
    } catch {
      setPrefs(prefs); // rollback
    } finally {
      setSavingPref(null);
    }
  };

  const supported = typeof window !== 'undefined' && isPushSupported();
  const oneSignalAvail = isOneSignalAvailable();
  const permission = snapshot?.permission || 'unknown';
  const playerIdMatches = Boolean(
    snapshot?.subscriptionId && serverStatus?.oneSignalPlayerId &&
    snapshot.subscriptionId === serverStatus.oneSignalPlayerId
  );

  return (
    <div className="min-h-screen bg-[#fbf8ff] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[rgba(172,176,206,0.3)] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[#615fe2]" aria-label="Indietro">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[#2c3149] font-bold text-lg">Notifiche</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* iOS PWA hint */}
        {isIOS && !isStandalone && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
            <p className="font-semibold mb-1">Per ricevere notifiche su iPhone</p>
            <p>
              Su iOS le notifiche push funzionano solo se aggiungi COhA alla schermata Home:
              tocca <strong>Condividi</strong> in Safari → <strong>Aggiungi a schermata Home</strong>.
              Richiede iOS 16.4 o superiore.
            </p>
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[rgba(172,176,206,0.3)]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(97,95,226,0.1)] flex items-center justify-center shrink-0">
              <Bell size={20} className="text-[#615fe2]" />
            </div>
            <div>
              <h2 className="text-[#2c3149] font-semibold">Push notifications</h2>
              <p className="text-xs text-[#747995] mt-0.5">
                {permission === 'granted' && playerIdMatches
                  ? 'Dispositivo registrato e attivo.'
                  : permission === 'granted'
                  ? 'Permesso concesso ma device non sincronizzato.'
                  : permission === 'denied'
                  ? 'Permesso negato dal browser.'
                  : 'Non ancora attivate su questo dispositivo.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleEnable}
              disabled={busy || !supported || !oneSignalAvail}
              className="flex-1 min-w-[7.5rem] py-2 px-3 rounded-xl text-sm font-semibold text-white bg-[#615fe2] hover:bg-[#4f4dc0] disabled:opacity-50 transition-colors"
            >
              {permission === 'granted' ? 'Ri-sincronizza' : 'Attiva notifiche'}
            </button>
            <button
              onClick={handleTest}
              disabled={busy || !serverStatus?.oneSignalPlayerId}
              className="flex-1 min-w-[7.5rem] py-2 px-3 rounded-xl text-sm font-semibold text-[#615fe2] bg-[rgba(97,95,226,0.1)] hover:bg-[rgba(97,95,226,0.2)] disabled:opacity-50 transition-colors"
            >
              Invia test push
            </button>
            <button
              onClick={handleReset}
              disabled={busy}
              className="py-2 px-3 rounded-xl text-sm font-medium text-[#747995] hover:text-[#595e78] disabled:opacity-50 transition-colors"
            >
              Reset
            </button>
          </div>
          {testResult && (
            <p className="mt-3 text-xs text-[#2c3149] bg-gray-50 rounded-lg p-2">{testResult}</p>
          )}
        </div>

        {/* Diagnostic status */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[rgba(172,176,206,0.3)]">
          <h3 className="text-[#2c3149] font-semibold mb-2">Stato dispositivo</h3>
          <StatusRow
            label="Supporto browser"
            value={supported ? 'OK' : 'Non supportato'}
            ok={supported}
          />
          <StatusRow
            label="OneSignal configurato"
            value={oneSignalAvail ? 'sì' : 'no'}
            ok={oneSignalAvail}
          />
          <StatusRow
            label="Permission"
            value={permission}
            ok={permission === 'granted' ? true : permission === 'denied' ? false : null}
          />
          <StatusRow
            label="Service Worker"
            value={swInfo ? `${swInfo.state} (${new URL(swInfo.path).pathname})` : 'non registrato'}
            ok={swInfo?.state === 'activated'}
          />
          <StatusRow
            label="SW scope"
            value={swInfo?.scope || '—'}
            ok={swInfo?.scope?.endsWith('/') || null}
          />
          <StatusRow
            label="OneSignal subscription ID"
            value={snapshot?.subscriptionId || '—'}
            ok={Boolean(snapshot?.subscriptionId)}
          />
          <StatusRow
            label="OptedIn (locale)"
            value={String(snapshot?.optedIn ?? '—')}
            ok={snapshot?.optedIn === true ? true : snapshot?.optedIn === false ? false : null}
          />
          <StatusRow
            label="PlayerId salvato sul server"
            value={serverStatus?.oneSignalPlayerId || '—'}
            ok={Boolean(serverStatus?.oneSignalPlayerId)}
          />
          <StatusRow
            label="ID locale = server"
            value={playerIdMatches ? 'sì' : snapshot?.subscriptionId ? 'no — re-sync necessario' : '—'}
            ok={snapshot?.subscriptionId ? playerIdMatches : null}
          />
          <StatusRow
            label="Notifiche ultime 24h"
            value={String(serverStatus?.recentNotifications24h ?? '—')}
            ok={null}
          />
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[rgba(172,176,206,0.3)]">
          <h3 className="text-[#2c3149] font-semibold mb-3">Preferenze notifiche</h3>
          {!prefs ? (
            <p className="text-sm text-[#747995]">Caricamento…</p>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-[#2c3149]">Push notifications</p>
                  <p className="text-xs text-[#747995]">Disattiva per silenziare tutte le push</p>
                </div>
                <Toggle
                  checked={prefs.pushEnabled}
                  onChange={(v) => togglePref('pushEnabled', v)}
                  disabled={savingPref === 'pushEnabled'}
                />
              </div>
              {PREF_LABELS.map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex-1 pr-3">
                    <p className="text-sm font-medium text-[#2c3149]">{label}</p>
                    <p className="text-xs text-[#747995]">{description}</p>
                  </div>
                  <Toggle
                    checked={prefs[key]}
                    onChange={(v) => togglePref(key, v)}
                    disabled={savingPref === key || !prefs.pushEnabled}
                  />
                </div>
              ))}
              <div className="pt-2">
                <p className="text-xs font-semibold text-[#747995] uppercase tracking-wide mb-2">Email</p>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex-1 pr-3">
                    <p className="text-sm font-medium text-[#2c3149]">Riepilogo email</p>
                    <p className="text-xs text-[#747995]">Digest periodico via email</p>
                  </div>
                  <Toggle
                    checked={prefs.emailDigest}
                    onChange={(v) => togglePref('emailDigest', v)}
                    disabled={savingPref === 'emailDigest'}
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="flex-1 pr-3">
                    <p className="text-sm font-medium text-[#2c3149]">Avvisi via email</p>
                    <p className="text-xs text-[#747995]">Email per eventi importanti</p>
                  </div>
                  <Toggle
                    checked={prefs.emailAlerts}
                    onChange={(v) => togglePref('emailAlerts', v)}
                    disabled={savingPref === 'emailAlerts'}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Diagnostic log */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[rgba(172,176,206,0.3)]">
          <button
            onClick={() => {
              setShowLog((s) => !s);
              if (!showLog) setLogEntries(getDiagnosticLog());
            }}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-[#2c3149] font-semibold">Log diagnostico</h3>
            <span className="text-xs text-[#747995]">{showLog ? 'nascondi' : 'mostra'}</span>
          </button>
          {showLog && (
            <div className="mt-3 max-h-64 overflow-y-auto bg-gray-50 rounded-lg p-2 font-mono text-[0.625rem] leading-relaxed text-[#2c3149]">
              {logEntries.length === 0 ? (
                <p className="text-[#747995]">Nessun evento.</p>
              ) : (
                logEntries.slice().reverse().map((e, i) => (
                  <div key={i} className={e.level === 'error' ? 'text-red-700' : e.level === 'warn' ? 'text-amber-700' : ''}>
                    [{e.ts.slice(11, 19)}] {e.level.toUpperCase()} {e.step} {e.detail ? JSON.stringify(e.detail) : ''}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
