import { routeCommand } from '../commands/router/commandRouter';
import type { RouteResult } from '../commands/router/routeTypes';
import { normalizeText } from '../utils/text';

export type VoiceTaskSource = 'interim' | 'final';
export type VoiceTaskReadiness = 'immediate' | 'after_recording';
export type VoiceTaskStatus =
  | 'queued'
  | 'waiting_recording_end'
  | 'executing'
  | 'verifying'
  | 'needs_clarification'
  | 'awaiting_confirmation'
  | 'no_change'
  | 'completed'
  | 'failed';

export type VoiceTask = {
  id: string;
  sequence: number;
  text: string;
  source: VoiceTaskSource;
  readiness: VoiceTaskReadiness;
  status: VoiceTaskStatus;
  route: RouteResult;
};

const STRONG_BOUNDARY_PATTERN =
  /(?:[。！？；;!?]+|然后|接着|随后|最后|再(?=[看放缩改切撤重暂继取确导保加删连画生创整突弱隐显]))/g;
const WEAK_BOUNDARY_PATTERN = /[，,]+/g;
const IMMEDIATE_FAST_COMMANDS = new Set([
  'fit_view',
  'zoom_in',
  'zoom_out',
  'layout_top_down',
  'layout_left_to_right',
  'apply_layout',
  'pause',
  'resume',
]);

export class VoiceTaskSegmenter {
  private sequence = 0;
  private provisionalTexts: string[] = [];

  ingestInterim(text: string): VoiceTask[] {
    const { complete } = splitByBoundaries(text);
    return complete
      .filter((part) => {
        const key = normalizeText(part);
        if (!key || this.provisionalTexts.includes(key)) return false;
        this.provisionalTexts.push(key);
        return true;
      })
      .map((part) => this.createTask(part, 'interim'));
  }

  ingestFinal(text: string): VoiceTask[] {
    const { complete, remainder } = splitByBoundaries(text);
    const parts = [...complete, ...(remainder ? [remainder] : [])];
    return parts
      .filter((part) => {
        const key = normalizeText(part);
        const provisionalIndex = this.provisionalTexts.indexOf(key);
        if (provisionalIndex >= 0) {
          this.provisionalTexts.splice(provisionalIndex, 1);
          return false;
        }
        return Boolean(key);
      })
      .map((part) => this.createTask(part, 'final'));
  }

  reset(): void {
    this.provisionalTexts = [];
  }

  private createTask(text: string, source: VoiceTaskSource): VoiceTask {
    const route = routeCommand(text);
    const readiness = isImmediateTask(route) ? 'immediate' : 'after_recording';
    this.sequence += 1;
    return {
      id: `voice-task-${Date.now()}-${this.sequence}`,
      sequence: this.sequence,
      text: text.trim(),
      source,
      readiness,
      status: readiness === 'immediate' ? 'queued' : 'waiting_recording_end',
      route,
    };
  }
}

export function splitByBoundaries(text: string): {
  complete: string[];
  remainder: string;
} {
  const weakMerged = mergeDependentCommaClauses(text);
  const complete: string[] = [];
  let cursor = 0;
  for (const match of weakMerged.matchAll(STRONG_BOUNDARY_PATTERN)) {
    const index = match.index ?? 0;
    const part = weakMerged.slice(cursor, index).trim();
    if (part) complete.push(part);
    cursor = index + match[0].length;
  }
  return { complete, remainder: weakMerged.slice(cursor).trim() };
}

function mergeDependentCommaClauses(text: string): string {
  const parts = text
    .split(WEAK_BOUNDARY_PATTERN)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return text;
  const merged: string[] = [parts[0]];
  for (const part of parts.slice(1)) {
    if (isIndependentTask(part)) merged.push(part);
    else merged[merged.length - 1] = `${merged[merged.length - 1]}，${part}`;
  }
  return merged.join('然后');
}

function isIndependentTask(text: string): boolean {
  const route = routeCommand(text);
  if (route.route === 'unknown') return false;
  if (
    /^(?:放|放在|放到|位于|在|改成|改为|设为|作为|做)(?:左|右|上|下|中|红|蓝|绿|黄|灰)/.test(
      text,
    )
  ) {
    return false;
  }
  return route.confidence >= 0.65;
}

export function isImmediateTask(route: RouteResult): boolean {
  return (
    route.route === 'fast' &&
    Boolean(route.fastCommand && IMMEDIATE_FAST_COMMANDS.has(route.fastCommand)) &&
    route.confidence >= 0.9
  );
}
