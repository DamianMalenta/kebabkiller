export default function StepGuide({ step, title, done, children, className = '' }) {
  const showStep = step !== undefined && step !== null && step !== '';
  return (
    <div
      className={`rounded-lg border p-4 text-sm leading-relaxed ${
        done
          ? 'border-emerald-900/50 bg-emerald-950/15'
          : 'border-zinc-800 bg-zinc-950/50'
      } ${className}`}
    >
      <p className="font-medium text-zinc-200">
        {showStep && (
          <>
            <span className="text-amber-400">Krok {step}</span>
            {' — '}
          </>
        )}
        {title}
        {done && <span className="ml-2 text-emerald-400" aria-label="ukończono">✓</span>}
      </p>
      <div className="mt-2 text-zinc-400">{children}</div>
    </div>
  );
}

export function WorkflowOverview({ steps }) {
  return (
    <ol className="space-y-2 text-sm">
      {steps.map(({ step, label, done }) => (
        <li
          key={step}
          className={`flex gap-2 ${done ? 'text-emerald-400/90' : 'text-zinc-500'}`}
        >
          <span className="shrink-0 font-mono text-xs">{done ? '✓' : step}</span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}
