import type { FastCommandExecutionResult } from '../fast/fastCommandExecutor';
import type { FreeDrawingObject } from '../../core/freeDrawing/freeDrawingTypes';
import type { SpeechFeedbackService } from '../../services/speechFeedbackService';
import { useCommandStore } from '../../stores/commandStore';
import { useFreeDrawingStore } from '../../stores/freeDrawingStore';
import { createId } from '../../utils/id';
import { normalizeText } from '../../utils/text';

const COLORS: Record<string, string> = {
  红色: '#ef4444',
  粉色: '#f472b6',
  蓝色: '#3b82f6',
  绿色: '#22c55e',
  黄色: '#facc15',
  紫色: '#a855f7',
  橙色: '#f97316',
};

export function createFreeDrawingExecutor(speechFeedback: SpeechFeedbackService) {
  return {
    execute(text: string): FastCommandExecutionResult {
      const normalized = normalizeText(text);
      if (/^(?:清空|清除)(?:自由)?画布$/.test(normalized)) {
        useFreeDrawingStore.getState().clear();
        return finish('已清空自由画布');
      }
      const scene = useFreeDrawingStore.getState().scene;
      const origin = nextOrigin(scene.objects.length);
      const color = Object.entries(COLORS).find(([name]) =>
        normalized.includes(name),
      )?.[1];
      if (/(?:花朵|花)$/.test(normalized)) {
        useFreeDrawingStore
          .getState()
          .addObjects(
            createFlower(origin.x, origin.y, color ?? '#f472b6'),
            '自由画布：花朵',
          );
        return finish('已在自由画布绘制一朵花');
      }
      if (/杯子|水杯|咖啡杯/.test(normalized)) {
        useFreeDrawingStore
          .getState()
          .addObjects(
            createCup(origin.x, origin.y, color ?? '#60a5fa'),
            '自由画布：杯子',
          );
        return finish('已在自由画布绘制一个杯子');
      }
      const message = '自由画图模式当前支持绘制花朵、杯子和清空画布';
      useCommandStore.getState().setLastMessage(message);
      return { status: 'ignored', message };
    },
  };

  function finish(message: string): FastCommandExecutionResult {
    useCommandStore.getState().setLastMessage(message);
    void speechFeedback.speak(message);
    return { status: 'success', message };
  }
}

function nextOrigin(objectCount: number): { x: number; y: number } {
  const itemIndex = Math.floor(objectCount / 5);
  return {
    x: 230 + (itemIndex % 3) * 280,
    y: 210 + Math.floor(itemIndex / 3) * 300,
  };
}

function createFlower(x: number, y: number, petalColor: string): FreeDrawingObject[] {
  const id = createId('flower');
  const petals = Array.from({ length: 8 }, (_, index) => {
    const angle = index * 45;
    const radians = (angle * Math.PI) / 180;
    return {
      id: `${id}-petal-${index + 1}`,
      type: 'ellipse' as const,
      label: `花瓣 ${index + 1}`,
      cx: x + Math.cos(radians) * 68,
      cy: y + Math.sin(radians) * 68,
      rx: 34,
      ry: 58,
      rotate: angle + 90,
      fill: petalColor,
      stroke: '#be185d',
      strokeWidth: 3,
    };
  });
  return [
    {
      id: `${id}-stem`,
      type: 'line',
      label: '花茎',
      x1: x,
      y1: y + 65,
      x2: x,
      y2: y + 250,
      stroke: '#15803d',
      strokeWidth: 12,
      lineCap: 'round',
    },
    {
      id: `${id}-leaf`,
      type: 'ellipse',
      label: '叶子',
      cx: x + 45,
      cy: y + 180,
      rx: 52,
      ry: 24,
      rotate: -25,
      fill: '#4ade80',
      stroke: '#15803d',
      strokeWidth: 3,
    },
    ...petals,
    {
      id: `${id}-center`,
      type: 'circle',
      label: '花心',
      cx: x,
      cy: y,
      radius: 50,
      fill: '#facc15',
      stroke: '#ca8a04',
      strokeWidth: 4,
    },
  ];
}

function createCup(x: number, y: number, color: string): FreeDrawingObject[] {
  const id = createId('cup');
  return [
    {
      id: `${id}-body`,
      type: 'path',
      label: '杯身',
      d: `M ${x - 95} ${y - 65} L ${x - 72} ${y + 120} Q ${x} ${y + 155} ${x + 72} ${y + 120} L ${x + 95} ${y - 65} Z`,
      fill: color,
      stroke: '#1e3a8a',
      strokeWidth: 5,
    },
    {
      id: `${id}-rim`,
      type: 'ellipse',
      label: '杯口',
      cx: x,
      cy: y - 65,
      rx: 95,
      ry: 25,
      fill: '#dbeafe',
      stroke: '#1e3a8a',
      strokeWidth: 5,
    },
    {
      id: `${id}-handle`,
      type: 'path',
      label: '杯把',
      d: `M ${x + 80} ${y - 15} C ${x + 175} ${y - 25}, ${x + 175} ${y + 100}, ${x + 70} ${y + 95}`,
      fill: 'none',
      stroke: '#1e3a8a',
      strokeWidth: 18,
    },
    {
      id: `${id}-steam-1`,
      type: 'path',
      label: '热气 1',
      d: `M ${x - 35} ${y - 105} C ${x - 70} ${y - 150}, ${x} ${y - 165}, ${x - 25} ${y - 210}`,
      fill: 'none',
      stroke: '#94a3b8',
      strokeWidth: 7,
    },
    {
      id: `${id}-steam-2`,
      type: 'path',
      label: '热气 2',
      d: `M ${x + 30} ${y - 110} C ${x} ${y - 155}, ${x + 70} ${y - 165}, ${x + 45} ${y - 215}`,
      fill: 'none',
      stroke: '#94a3b8',
      strokeWidth: 7,
    },
  ];
}
