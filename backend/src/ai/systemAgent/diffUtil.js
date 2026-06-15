/**
 * Prosty diff liniowy do podglądu (przycięcie wspólnego prefiksu/sufiksu).
 * Nie jest pełnym LCS — wystarcza do czytelnego pokazania zmiany właścicielowi.
 */
export function buildSimpleDiff(before, after, filePath = '') {
  const a = before === null || before === undefined ? [] : String(before).split('\n');
  const b = String(after ?? '').split('\n');

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }

  const lines = [];
  if (filePath) lines.push(`--- ${filePath}`);
  if (start > 0) lines.push(`@@ wspólny kontekst do linii ${start} @@`);
  for (let i = start; i <= endA; i++) lines.push(`- ${a[i]}`);
  for (let i = start; i <= endB; i++) lines.push(`+ ${b[i]}`);
  if (endA < start && endB < start) lines.push('(brak zmian)');
  return lines.join('\n');
}

export function buildChangeSetDiff(changes) {
  return changes
    .map((c) => buildSimpleDiff(c.before, c.after, c.path))
    .join('\n\n');
}
