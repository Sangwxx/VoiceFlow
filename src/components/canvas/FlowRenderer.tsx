import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type EdgeTypes,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';

import type { Diagram } from '../../core/diagram/diagramTypes';
import { logModuleError } from '../../utils/logger';
import { registerCanvasElement } from '../../services/canvasElementService';
import {
  DatabaseNode,
  DecisionNode,
  EndNode,
  ExternalNode,
  GroupNode,
  ProcessNode,
  ServiceNode,
  StartNode,
  UserNode,
} from './CanvasNodes';
import {
  diagramToReactFlow,
  type ReactFlowEdge,
  type ReactFlowNode,
} from './canvasTypes';
import styles from './FlowRenderer.module.css';
import { NumberedEdge } from './NumberedEdge';
import { READ_ONLY_FLOW_PROPS } from './readOnlyFlowConfig';

export type CanvasViewportApi = {
  fitView(): Promise<boolean>;
  zoomIn(): Promise<boolean>;
  zoomOut(): Promise<boolean>;
  focusNode(nodeId: string): Promise<boolean>;
};

type FlowRendererProps = {
  diagram: Diagram;
};

const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  process: ProcessNode,
  decision: DecisionNode,
  database: DatabaseNode,
  service: ServiceNode,
  user: UserNode,
  external: ExternalNode,
  group: GroupNode,
};

const edgeTypes: EdgeTypes = {
  numbered: NumberedEdge,
};

export const FlowRenderer = forwardRef<CanvasViewportApi, FlowRendererProps>(
  function FlowRenderer({ diagram }, ref) {
    const [renderDiagram, setRenderDiagram] = useState(diagram);
    const [instance, setInstance] = useState<ReactFlowInstance<
      ReactFlowNode,
      ReactFlowEdge
    > | null>(null);
    const flowElements = useMemo(
      () => diagramToReactFlow(renderDiagram),
      [renderDiagram],
    );

    useEffect(() => {
      let active = true;
      setRenderDiagram(diagram);
      void import('../../core/layout/elkCleanLayout')
        .then(({ applyElkCleanAutoLayout }) => applyElkCleanAutoLayout(diagram))
        .then((result) => {
          if (active) setRenderDiagram(result.diagram);
        })
        .catch((error: unknown) => {
          logModuleError(
            'CleanAutoLayout',
            'elk_layout_failed',
            diagram.id,
            error instanceof Error ? error.message : String(error),
          );
        });
      return () => {
        active = false;
      };
    }, [diagram]);

    useImperativeHandle(
      ref,
      () => ({
        fitView: () =>
          instance?.fitView({ padding: 0.18, duration: 220 }) ?? falsePromise(),
        zoomIn: () => instance?.zoomIn({ duration: 180 }) ?? falsePromise(),
        zoomOut: () => instance?.zoomOut({ duration: 180 }) ?? falsePromise(),
        focusNode: (nodeId) => {
          const node = instance?.getNode(nodeId);
          return node && instance
            ? instance.fitView({ nodes: [node], padding: 0.75, duration: 260 })
            : falsePromise();
        },
      }),
      [instance],
    );

    return (
      <div
        ref={registerCanvasElement}
        className={styles.canvas}
        aria-label={`${diagram.title}画布`}
      >
        <ReactFlow<ReactFlowNode, ReactFlowEdge>
          nodes={flowElements.nodes}
          edges={flowElements.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={(flowInstance) => {
            setInstance(flowInstance);
            void flowInstance.fitView({ padding: 0.18 });
          }}
          onError={(errorType, message) =>
            logModuleError('CanvasRenderer', errorType, diagram.id, message)
          }
          minZoom={0.2}
          maxZoom={2}
          fitView
          {...READ_ONLY_FLOW_PROPS}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#cbd5e1"
          />
        </ReactFlow>
      </div>
    );
  },
);

function falsePromise(): Promise<boolean> {
  return Promise.resolve(false);
}
