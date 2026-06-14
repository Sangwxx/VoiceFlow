import type { Diagram } from '../diagram/diagramTypes';
import { applyCleanAutoLayout } from './cleanAutoLayout';

export interface LayoutEngine {
  layout(diagram: Diagram): Diagram;
}

export const defaultLayoutEngine: LayoutEngine = {
  layout: applyCleanAutoLayout,
};
