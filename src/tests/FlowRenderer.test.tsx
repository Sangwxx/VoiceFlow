import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FlowRenderer } from '../components/canvas/FlowRenderer';
import { READ_ONLY_FLOW_PROPS } from '../components/canvas/readOnlyFlowConfig';
import { applyDagreLayout } from '../core/layout/dagreLayout';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('FlowRenderer', () => {
  it('renders the login flow nodes and decision branches', async () => {
    const diagram = applyDagreLayout(loginFlowDiagram);

    const { container } = render(<FlowRenderer diagram={diagram} />);

    expect(await screen.findByText('打开 App')).toBeInTheDocument();
    expect(screen.getByText('是否已登录？')).toBeInTheDocument();
    expect(screen.getByText('登录成功？')).toBeInTheDocument();
    expect(screen.getAllByText('判断')).toHaveLength(2);
    expect(container.querySelectorAll('.react-flow__node').length).toBeGreaterThanOrEqual(
      6,
    );
  });

  it('keeps every user editing and viewport input disabled', () => {
    expect(READ_ONLY_FLOW_PROPS).toMatchObject({
      nodesDraggable: false,
      nodesConnectable: false,
      nodesFocusable: false,
      edgesFocusable: false,
      edgesReconnectable: false,
      elementsSelectable: false,
      panOnDrag: false,
      panOnScroll: false,
      zoomOnScroll: false,
      zoomOnPinch: false,
      zoomOnDoubleClick: false,
      connectOnClick: false,
      deleteKeyCode: null,
      selectionKeyCode: null,
      multiSelectionKeyCode: null,
      panActivationKeyCode: null,
      zoomActivationKeyCode: null,
      disableKeyboardA11y: true,
    });
  });
});
