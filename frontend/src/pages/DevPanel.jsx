import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

/* ── Helpers ─────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  const map = {
    ok: 'bg-emerald-900/60 text-emerald-300',
    error: 'bg-red-900/60 text-red-300',
    pending: 'bg-yellow-900/60 text-yellow-300',
    completed: 'bg-emerald-900/60 text-emerald-300',
    failed: 'bg-red-900/60 text-red-300',
    processing: 'bg-blue-900/60 text-blue-300',
    queued: 'bg-zinc-700 text-zinc-300',
    canceled: 'bg-zinc-700 text-zinc-400',
    zaakceptowany: 'bg-emerald-900/60 text-emerald-300',
    w_produkcji: 'bg-blue-900/60 text-blue-300',
    roboczy: 'bg-zinc-700 text-zinc-300',
  };
  const cls = map[status] ?? 'bg-zinc-800 text-zinc-400';
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-mono ${cls}`}>{status}</span>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
      <span className={`text-xs text-right truncate max-w-[180px] ${mono ? 'font-mono text-amber-300' : 'text-zinc-300'}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

/* ── System Info cards ────────────────────────────────────────── */

function HealthCard({ health, config }) {
  if (!health) return null;
  const isOk = health.has_groq_key;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">Backend</h3>
        <span className={`h-2 w-2 rounded-full ${isOk ? 'bg-emerald-400' : 'bg-red-400'}`} />
      </div>
      <InfoRow label="Port" value={health.port} mono />
      <InfoRow label="Node" value={health.node_version} mono />
      <InfoRow label="Uptime" value={`${health.uptime_sec}s`} />
      <InfoRow label="VIDEO_ENGINE" value={health.video_engine} mono />
      <InfoRow label="GROQ key" value={health.has_groq_key ? '✓ ustawiony' : '✗ BRAK'} />
      <InfoRow label="RunComfy key" value={health.has_runcomfy_key ? '✓ ustawiony' : '✗ BRAK'} />
    </div>
  );
}

function ConfigCard({ config }) {
  if (!config) return null;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">Konfiguracja</h3>
      <InfoRow label="WAN_LENGTH" value={config.wan_length} mono />
      <InfoRow label="I2V_PROFILE" value={config.i2v_profile} mono />
      <InfoRow label="GROQ_MODEL" value={config.groq_model} mono />
      <InfoRow label="RunComfy endpoint" value={config.runcomfy_endpoint_set ? '✓ ustawiony' : '✗ BRAK'} />
      <InfoRow label="NODE_ENV" value={config.node_env} mono />
    </div>
  );
}

function JobsCard({ jobs }) {
  if (!jobs?.length) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Ostatnie joby</h3>
        <p className="text-xs text-zinc-500">Brak jobów.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">Ostatnie joby ({jobs.length})</h3>
      <div className="space-y-1.5">
        {jobs.slice(0, 8).map((j) => (
          <div key={j.id} className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-zinc-500 truncate">{j.id.slice(0, 8)}…</span>
            <StatusBadge status={j.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlansCard({ plans }) {
  if (!plans?.length) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Plany odcinków</h3>
        <p className="text-xs text-zinc-500">Brak planów.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">Plany odcinków ({plans.length})</h3>
      <div className="space-y-1.5">
        {plans.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-300 truncate">{p.code} — {p.title}</span>
            <StatusBadge status={p.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Chat message renderer ────────────────────────────────────── */

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-amber-500/20 text-amber-100 border border-amber-500/30'
            : 'bg-zinc-800 text-zinc-200 border border-zinc-700/50'
        }`}
      >
        {msg.content}
        {msg.tool_calls?.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">
              Narzędzia ({msg.tool_calls.length})
            </summary>
            <div className="mt-1 space-y-1">
              {msg.tool_calls.map((tc, i) => (
                <div key={i} className="rounded bg-zinc-900 px-2 py-1 text-xs font-mono text-zinc-400">
                  {tc.tool || tc.name}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

const QUICK_PROMPTS = [
  'Jaki jest stan backendu?',
  'Pokaż ostatnie 5 jobów.',
  'Jakie plany odcinków istnieją?',
  'Sprawdź konfigurację silnika wideo.',
  'Czy są joby w stanie failed?',
];

/* ── Main DevPanel ────────────────────────────────────────────── */

export default function DevPanel() {
  const [state, setState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await api.devAgent.getState();
      setState(data);
      setMessages(data.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(text) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    setError('');

    // Optimistic user message
    const tempUser = { id: `tmp-${Date.now()}`, role: 'user', content: msg };
    setMessages((prev) => [...prev, tempUser]);

    try {
      const result = await api.devAgent.sendMessage(msg);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUser.id),
        result.user_message,
        result.assistant_message,
      ]);
      // Refresh system stats
      const fresh = await api.devAgent.getState();
      setState(fresh);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    if (!window.confirm('Wyczyścić historię czatu z Programistą?')) return;
    setClearing(true);
    try {
      await api.devAgent.clearHistory();
      setMessages([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearing(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const sys = state?.system;

  return (
    <div className="dev-panel-layout">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Dev Mode</p>
          <h1 className="text-xl font-bold text-amber-400">Programista</h1>
        </div>
        <button
          onClick={refresh}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition"
        >
          Odśwież
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && !state ? (
        <p className="text-zinc-400">Ładowanie stanu systemu…</p>
      ) : (
        <div className="dev-grid">
          {/* LEFT: System info */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">System</h2>
            <HealthCard health={sys?.health} config={sys?.config} />
            <ConfigCard config={sys?.config} />
            <JobsCard jobs={sys?.recent_jobs} />
            <PlansCard plans={sys?.episode_plans} />
          </div>

          {/* RIGHT: Chat */}
          <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden" style={{ minHeight: '480px' }}>
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <span className="text-sm font-semibold text-zinc-300">Czat z Programistą</span>
              <button
                onClick={handleClear}
                disabled={clearing || messages.length === 0}
                className="text-xs text-zinc-600 hover:text-red-400 disabled:opacity-40 transition"
              >
                Wyczyść historię
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-zinc-500 mb-4">
                    Witaj! Zapytaj mnie o stan systemu, joby, produkcję lub konfigurację.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {QUICK_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => handleSend(p)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-amber-600 hover:text-amber-300 transition"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-xl bg-zinc-800 px-4 py-3 text-sm text-zinc-400 border border-zinc-700/50">
                    <span className="animate-pulse">Programista analizuje…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-zinc-800 p-3">
              {messages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.slice(0, 3).map((p) => (
                    <button
                      key={p}
                      onClick={() => handleSend(p)}
                      className="rounded border border-zinc-700/50 px-2 py-1 text-[10px] text-zinc-500 hover:border-amber-600/50 hover:text-amber-400 transition"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Zapytaj Programistę…"
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-600 focus:outline-none"
                  disabled={sending}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || sending}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40 transition self-end"
                >
                  Wyślij
                </button>
              </div>
              <p className="mt-1 text-[10px] text-zinc-600">Enter = wyślij · Shift+Enter = nowa linia</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
