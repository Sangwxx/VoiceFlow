import { Component, type ErrorInfo, type ReactNode } from 'react';

import { logModuleError } from '../../utils/logger';
import { ErrorPanel } from './ErrorPanel';

type CanvasErrorBoundaryProps = {
  diagramId: string;
  children: ReactNode;
};

type CanvasErrorBoundaryState = {
  error: Error | null;
};

export class CanvasErrorBoundary extends Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  state: CanvasErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logModuleError('CanvasRenderer', 'render_error', this.props.diagramId, {
      error,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorPanel
          title="画布渲染失败"
          message="当前图形无法安全展示，原始 Diagram 数据未被修改。"
        />
      );
    }

    return this.props.children;
  }
}
