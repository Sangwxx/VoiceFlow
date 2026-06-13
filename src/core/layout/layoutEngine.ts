import type { Diagram } from '../diagram/diagramTypes';
import { applyDagreLayout } from './dagreLayout';

export interface LayoutEngine {
  layout(diagram: Diagram): Diagram;
}

export const defaultLayoutEngine: LayoutEngine = {
  layout: applyDagreLayout,
};
