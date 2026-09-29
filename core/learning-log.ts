import { exists, read, runtime, safePath, statePath, type Runtime } from './storage.js';

/**
 * The learner's session wrap-ups live in a learner-authored knowledge note (issue #20). This reads the most recent
 * dated entry so the next session can open with it. It is read-only, adds no canonical field, and returns the
 * learner's own words: a claim, never a verified fact (CF-47).
 */
export const learningLogPath = 'knowledge/learning-log.md';

export function latestLearningEntry(root: string, rt: Runtime = runtime): { path: string; date: string; first_line: string } | null {
  const file = statePath(learningLogPath);
  if (!exists(safePath(root, file, rt), rt)) return null;
  const lines = read(root, file, rt).toString('utf8').split(/\r?\n/);
  let latest: { date: string; index: number } | null = null;
  lines.forEach((line, index) => {
    const date = /^##\s+(\d{4}-\d{2}-\d{2})\b/.exec(line)?.[1];
    // The latest date wins; on a tie, the entry written further down the file.
    if (date && (!latest || date >= latest.date)) latest = { date, index };
  });
  if (!latest) return null;
  const { date, index } = latest as { date: string; index: number };
  const body = lines.slice(index + 1).find(line => line.trim() && !/^#{1,6}\s/.test(line))?.trim() ?? '';
  return { path: file, date, first_line: body.length > 200 ? `${body.slice(0, 199)}…` : body };
}
