import type { LayoutDirection } from '../diagram/diagramTypes';
import type { ApplyLayoutOperation } from './operationTypes';

export function createApplyLayoutOperation(
  direction?: LayoutDirection,
): ApplyLayoutOperation {
  const timestamp = new Date().toISOString();
  return {
    id: `apply-layout-${timestamp}`,
    type: 'apply_layout',
    direction,
    timestamp,
    description: direction ? `切换为 ${direction} 布局` : '自动排版',
  };
}
