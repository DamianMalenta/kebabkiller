import { useEffect, useRef, useState } from 'react';
import { renderChatWidget } from './ChatWidgets.jsx';

const STEP_LABELS = {
  series_start: '1/4 · Nazwa i klimat serialu',
  series_style: '2/4 · Styl wizualny',
  series_canon_assets: '3/4 · Assety do kanonu',
  series_confirm: '4/4 · Potwierdzenie kanonu',
  series_complete: '✓ Kanon gotowy · Tryb tworzenia odcinków',
  episode_start: '1/5 · Pomysł na odcinek',
  episode_logline: '2/5 · Logline i bohaterowie',
  episode_storyboard: '3/5 · Sceny storyboard',
  episode_assets: '4/5 · Assety scen',
  episode_review: '5/5 · Zatwierdź przed produkcją',
  episode_complete: '✓ Odcinek gotowy · Produkuj video',
  free_mode: 'Tryb reżyserii',
};

export default function ChatCenter({
  messages,
  wizard,
  suggestions = [],
  onSend,
  onConfirm,
  loading,
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function submit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    onSend(text);
  }

  return (
    <div className="director-chat flex h-full min-h-[60vh] flex-col rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Stół Reżyserski</p>
        {wizard && (
          <div className="mt-1">
            <span className="inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
              {STEP_LABELS[wizard.step] || wizard.step}
            </span>
            {wizard.prompt && (
              <p className="mt-1 text-sm text-zinc-400">{wizard.prompt}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {(messages || []).map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'ml-auto bg-amber-500/15 text-amber-50'
                : 'mr-auto bg-zinc-900 text-zinc-200'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            {(msg.widgets || []).map((widget, idx) => (
              <div key={`${msg.id}-w-${idx}`} className="mt-3">
                {renderChatWidget(widget, {
                  onConfirm: () => onConfirm?.(widget.props),
                  onReject: () => {},
                })}
              </div>
            ))}
          </div>
        ))}
        {loading && (
          <p className="text-sm text-zinc-500">AI myśli…</p>
        )}
        <div ref={bottomRef} />
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-zinc-800 px-4 py-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSend(s)}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-amber-600 hover:text-amber-200"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="border-t border-zinc-800 p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pisz fabułę, wydawaj polecenia reżyserii…"
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            Wyślij
          </button>
        </div>
      </form>
    </div>
  );
}
