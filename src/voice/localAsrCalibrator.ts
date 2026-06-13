import type { Diagram } from '../core/diagram/diagramTypes';
import { pinyin } from 'pinyin-pro';
import { normalizeText } from '../utils/text';
import {
  ASR_ERROR_MAPPINGS,
  BUILTIN_ASR_LEXICON,
  PINYIN_CONFUSION_GROUPS,
  type LexiconEntry,
} from './asrLexicon';

export type LocalCalibrationResult = {
  originalText: string;
  correctedText: string;
  confidence: number;
  reason: string;
  changed: boolean;
};

type Candidate = {
  start: number;
  end: number;
  source: string;
  replacement: string;
  score: number;
  reason: string;
};

const PHONETIC_KEYS = new Map<string, string>(
  PINYIN_CONFUSION_GROUPS.flatMap((group, groupIndex) =>
    [...group].map((character) => [character, String(groupIndex)] as const),
  ),
);

export function calibrateAsrTranscript(
  text: string,
  context: { diagram: Diagram; recentCommands?: string[] },
): LocalCalibrationResult {
  const original = text.trim();
  let corrected = original;
  const reasons: string[] = [];
  for (const [pattern, replacement] of ASR_ERROR_MAPPINGS) {
    const next = corrected.replace(pattern, replacement);
    if (next !== corrected) reasons.push('高精度错词映射');
    corrected = next;
  }

  const entries = buildDynamicLexicon(context);
  corrected = applyBestCandidates(corrected, entries, reasons);

  const changed = corrected !== original;
  return {
    originalText: text,
    correctedText: corrected,
    confidence: changed ? confidenceFromReasons(reasons) : 1,
    reason: changed ? [...new Set(reasons)].join(' + ') : '无需校准',
    changed,
  };
}

export function buildDynamicLexicon(context: {
  diagram: Diagram;
  recentCommands?: string[];
}): LexiconEntry[] {
  const dynamic: LexiconEntry[] = [
    { term: context.diagram.title, weight: 1.15, category: 'diagram_context' },
    ...context.diagram.nodes.map((node) => ({
      term: node.label,
      weight: 1.2,
      category: 'node_context',
    })),
    ...context.diagram.edges
      .filter((edge) => edge.label)
      .map((edge) => ({
        term: edge.label as string,
        weight: 1.1,
        category: 'edge_context',
      })),
    ...(context.recentCommands ?? []).flatMap(extractCommandTerms),
  ];
  const byTerm = new Map<string, LexiconEntry>();
  for (const item of [...BUILTIN_ASR_LEXICON, ...dynamic]) {
    const normalized = normalizeText(item.term);
    if (normalized.length < 2) continue;
    const existing = byTerm.get(normalized);
    if (!existing || existing.weight < item.weight) byTerm.set(normalized, item);
  }
  return [...byTerm.values()];
}

function extractCommandTerms(command: string): LexiconEntry[] {
  const terms = command
    .split(/[，。！？、；：,.!?;:\s]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && term.length <= 16);
  return terms.map((term) => ({ term, weight: 1.05, category: 'recent_command' }));
}

function applyBestCandidates(
  text: string,
  entries: LexiconEntry[],
  reasons: string[],
): string {
  const protectedSpans = findProtectedSpans(text, entries);
  const candidates = entries
    .flatMap((entry) => findCandidates(text, entry))
    .sort((left, right) => right.score - left.score);
  const accepted: Candidate[] = [];
  for (const candidate of candidates) {
    if (candidate.score < thresholdFor(candidate.replacement)) continue;
    if (protectedSpans.some((span) => overlaps(candidate, span))) continue;
    const competitor = candidates.find(
      (other) =>
        other !== candidate &&
        overlaps(candidate, other) &&
        other.replacement !== candidate.replacement,
    );
    if (competitor && candidate.score - competitor.score < 0.08) continue;
    if (accepted.some((item) => overlaps(candidate, item))) continue;
    accepted.push(candidate);
  }
  let result = text;
  for (const candidate of accepted.sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, candidate.start)}${candidate.replacement}${result.slice(candidate.end)}`;
    reasons.push(candidate.reason);
  }
  return result;
}

function findProtectedSpans(text: string, entries: LexiconEntry[]): Candidate[] {
  const terms = entries.flatMap((entry) => [entry.term, ...(entry.aliases ?? [])]);
  const spans: Candidate[] = [];
  for (const term of [...new Set(terms)].sort(
    (left, right) => right.length - left.length,
  )) {
    let start = text.indexOf(term);
    while (start >= 0) {
      const span = {
        start,
        end: start + term.length,
        source: term,
        replacement: term,
        score: 1,
        reason: '已识别词保护',
      };
      if (!spans.some((item) => overlaps(span, item))) spans.push(span);
      start = text.indexOf(term, start + term.length);
    }
  }
  return spans;
}

function findCandidates(text: string, entry: LexiconEntry): Candidate[] {
  const target = normalizeText(entry.term);
  if (text.includes(entry.term) || target.length < 2) return [];
  const candidates: Candidate[] = [];
  for (
    let length = Math.max(2, target.length - 1);
    length <= target.length + 1;
    length += 1
  ) {
    for (let start = 0; start + length <= text.length; start += 1) {
      const source = text.slice(start, start + length);
      const normalizedSource = normalizeText(source);
      if (normalizedSource.length < 2 || source === entry.term) continue;
      const base = similarity(normalizedSource, target);
      const exactPhonetic = phoneticKey(normalizedSource) === phoneticKey(target);
      const score = Math.min(1, base * entry.weight + (exactPhonetic ? 0.08 : 0));
      if (score >= thresholdFor(entry.term) - 0.08) {
        candidates.push({
          start,
          end: start + length,
          source,
          replacement: entry.term,
          score,
          reason: entry.category.includes('context') ? '当前画布上下文' : '领域候选评分',
        });
      }
    }
  }
  return candidates;
}

function thresholdFor(term: string): number {
  if (term.length <= 2) return 0.94;
  if (term.length === 3) return 0.9;
  return 0.86;
}

function overlaps(left: Candidate, right: Candidate): boolean {
  return left.start < right.end && right.start < left.end;
}

function confidenceFromReasons(reasons: string[]): number {
  if (reasons.includes('高精度错词映射')) return 0.98;
  if (reasons.includes('命令别名归一化')) return 0.96;
  if (reasons.includes('当前画布上下文')) return 0.93;
  return 0.9;
}

export function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  const edit = 1 - editDistance(left, right) / Math.max(left.length, right.length);
  const pinyinLeft = fullPinyinKey(left);
  const pinyinRight = fullPinyinKey(right);
  const pinyinScore =
    1 -
    editDistance(pinyinLeft, pinyinRight) /
      Math.max(pinyinLeft.length, pinyinRight.length);
  const confusionLeft = phoneticKey(left);
  const confusionRight = phoneticKey(right);
  const confusion =
    1 -
    editDistance(confusionLeft, confusionRight) /
      Math.max(confusionLeft.length, confusionRight.length);
  return edit * 0.35 + pinyinScore * 0.55 + confusion * 0.1;
}

function phoneticKey(text: string): string {
  return [...text].map((character) => PHONETIC_KEYS.get(character) ?? character).join('');
}

function fullPinyinKey(text: string): string {
  return pinyin(text, { toneType: 'none', type: 'array' }).join('');
}

export function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}
