import { routeCommand } from '../commands/router/commandRouter';
import type { RouteResult } from '../commands/router/routeTypes';
import { normalizeText } from '../utils/text';

export type VoiceTaskSource = 'interim' | 'final';
export type VoiceTaskReadiness = 'immediate' | 'after_recording';
export type VoiceTaskStatus =
  | 'queued'
  | 'waiting_recording_end'
  | 'executing'
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

const BOUNDARY_PATTERN =
  /(?:[。！？；，,;!?]+|然后|接着|随后|并且|最后|再(?=[看放缩改切撤重暂继取确导保加删连画生创整突弱隐显]))/g;
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
  const complete: string[] = [];
  let cursor = 0;
  for (const match of text.matchAll(BOUNDARY_PATTERN)) {
    const index = match.index ?? 0;
    const part = text.slice(cursor, index).trim();
    if (part) complete.push(part);
    cursor = index + match[0].length;
  }
  return { complete, remainder: text.slice(cursor).trim() };
}

export function isImmediateTask(route: RouteResult): boolean {
  return (
    route.route === 'fast' &&
    Boolean(route.fastCommand && IMMEDIATE_FAST_COMMANDS.has(route.fastCommand)) &&
    route.confidence >= 0.9
  );
}
