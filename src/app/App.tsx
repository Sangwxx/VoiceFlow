import { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { CanvasErrorBoundary } from '../components/common/CanvasErrorBoundary';
import { VisualClarificationCard } from '../components/common/VisualClarificationCard';
import { registerCanvasViewportApi } from '../services/canvasViewportService';
import { BrowserSpeechFeedbackService } from '../services/speechFeedbackService';
import { useAgentStore } from '../stores/agentStore';
import { useCommandStore } from '../stores/commandStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVoiceStore, type VoiceStatus } from '../stores/voiceStore';
import { useProposalStore } from '../stores/proposalStore';
import { useVersionStore } from '../stores/versionStore';
import { useExportStore } from '../stores/exportStore';
import { useWorkflowStore } from '../stores/workflowStore';
import { useCanvasViewStore } from '../stores/canvasViewStore';
import { hideExceptionPaths } from '../components/canvas/canvasView';
import { createVoiceController } from '../voice/voiceController';
import type { VoiceController } from '../voice/voiceTypes';
import { WebSpeechProvider } from '../voice/webSpeechProvider';
import styles from './App.module.css';

const FlowRenderer = lazy(() =>
  import('../components/canvas/FlowRenderer').then(({ FlowRenderer }) => ({
    default: FlowRenderer,
  })),
);

const STATUS_LABELS: Record<VoiceStatus, string> = {
  idle: '等待启动',
  listening: '正在聆听',
  recognizing: '正在识别',
  processing: '正在执行',
  paused: '命令已暂停',
  speaking: '正在反馈',
  error: '识别异常',
  unsupported: '浏览器不支持',
};

export function App() {
  const diagram = useDiagramStore((state) => state.diagram);
  const pastCount = useDiagramStore((state) => state.past.length);
  const futureCount = useDiagramStore((state) => state.future.length);
  const history = useDiagramStore((state) => state.history);
  const voiceStatus = useVoiceStore((state) => state.status);
  const interimTranscript = useVoiceStore((state) => state.interimTranscript);
  const finalTranscript = useVoiceStore((state) => state.finalTranscript);
  const correctedTranscript = useVoiceStore((state) => state.correctedTranscript);
  const correctionFeedback = useVoiceStore((state) => state.correctionFeedback);
  const pendingCorrection = useVoiceStore((state) => state.pendingCorrection);
  const voiceError = useVoiceStore((state) => state.error);
  const commandPaused = useVoiceStore((state) => state.commandPaused);
  const lastRoute = useCommandStore((state) => state.lastRouteResult);
  const executionLog = useCommandStore((state) => state.executionLog);
  const lastMessage = useCommandStore((state) => state.lastMessage);
  const pendingClarification = useCommandStore((state) => state.pendingClarification);
  const agent = useAgentStore();
  const proposal = useProposalStore((state) => state.proposal);
  const versions = useVersionStore((state) => state.versions);
  const versionDiff = useVersionStore((state) => state.lastDiff);
  const versionPersistenceError = useVersionStore((state) => state.persistenceError);
  const exportState = useExportStore();
  const workflowClarification = useWorkflowStore(
    (state) => state.pendingVersionClarification,
  );
  const focusClarification = useWorkflowStore((state) => state.pendingFocusClarification);
  const exceptionPathsHidden = useCanvasViewStore((state) => state.exceptionPathsHidden);
  const focusedNodeId = useCanvasViewStore((state) => state.focusedNodeId);
  const selectedNodeId = useDiagramStore((state) => state.selectedNodeId);
  const controller = useMemo(() => createBrowserVoiceController(), []);
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const latestExecution = executionLog[0];
  const averageDuration = executionLog.length
    ? Math.round(
        executionLog.reduce((total, entry) => total + entry.durationMs, 0) /
          executionLog.length,
      )
    : 0;
  const fastPathRate = executionLog.length
    ? Math.round(
        (executionLog.filter((entry) => entry.route === 'fast').length /
          executionLog.length) *
          100,
      )
    : 0;
  const routeAverages = (['fast', 'simple', 'workflow', 'agent'] as const).map(
    (route) => {
      const entries = executionLog.filter((entry) => entry.route === route);
      return {
        route,
        durationMs: entries.length
          ? Math.round(
              entries.reduce((total, entry) => total + entry.durationMs, 0) /
                entries.length,
            )
          : null,
      };
    },
  );

  useEffect(() => {
    return () => controller.stopListening();
  }, [controller]);

  const candidateDiagram = proposal?.diagram ?? diagram;
  const visibleDiagram = exceptionPathsHidden
    ? hideExceptionPaths(candidateDiagram)
    : candidateDiagram;
  const isPreview = Boolean(proposal);
  const decisionCount = visibleDiagram.nodes.filter(
    (node) => node.type === 'decision',
  ).length;
  const branchCount = visibleDiagram.edges.filter((edge) => edge.label).length;

  return (
    <main className={styles.appShell}>
      <header className={styles.topBar}>
        <div>
          <div className={styles.brandRow}>
            <span className={styles.logoMark}>VF</span>
            <span className={styles.productName}>VoiceFlow</span>
            <span className={styles.phaseBadge}>AI 语音绘图</span>
          </div>
          <p className={styles.tagline}>分层低延迟路由 · 上下文消歧 · 安全预览确认</p>
        </div>
        <div className={styles.documentStatus}>
          <div>
            <span>当前图形</span>
            <strong>{diagram.title}</strong>
          </div>
          <div>
            <span>语音状态</span>
            <strong>{STATUS_LABELS[voiceStatus]}</strong>
          </div>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.leftPanel} aria-label="语音控制状态">
          <section className={styles.panelCard}>
            <div className={styles.sectionHeading}>
              <span>语音状态</span>
              <span className={`${styles.statusDot} ${styles[voiceStatus]}`} />
            </div>
            <div
              className={`${styles.voiceOrb} ${styles[voiceStatus]}`}
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
            </div>
            <strong>{STATUS_LABELS[voiceStatus]}</strong>
            <button
              className={`${styles.recordingButton} ${
                recordingEnabled ? styles.recordingButtonActive : ''
              }`}
              type="button"
              aria-pressed={recordingEnabled}
              onClick={() => {
                if (recordingEnabled) {
                  controller.stopListening();
                } else {
                  controller.startListening();
                }
                setRecordingEnabled((enabled) => !enabled);
              }}
            >
              {recordingEnabled ? '停止语音输入' : '开始语音输入'}
            </button>
            <p>
              {voiceError ??
                (commandPaused
                  ? '仅响应继续、取消和确认'
                  : recordingEnabled
                    ? '正在持续监听，完成后请停止语音输入。'
                    : '点击开始后，请允许浏览器访问麦克风。')}
            </p>
          </section>
          <section className={styles.panelCard}>
            <div className={styles.sectionHeading}>
              <span>核心语音示例</span>
              <span className={styles.successLabel}>WORKFLOW</span>
            </div>
            <ul className={styles.commandList}>
              <li>Simple Path 示例</li>
              <li>“整理成适合汇报的版本”</li>
              <li>“保存当前版本叫初始流程”</li>
              <li>“加载电商订单演示场景”</li>
              <li>“导出 PNG”</li>
            </ul>
          </section>
        </aside>

        <section
          className={`${styles.canvasRegion} ${isPreview ? styles.previewRegion : ''}`}
          aria-label="流程图工作区"
        >
          <div className={styles.canvasHeading}>
            <div>
              <span className={styles.eyebrow}>
                VOICE → WORKFLOW → PROPOSAL → CONFIRM
              </span>
              <h1>{visibleDiagram.title}</h1>
            </div>
            <span className={isPreview ? styles.previewBadge : styles.readOnlyBadge}>
              {isPreview ? `${proposal?.source} 预览 · 请说确认或取消` : '纯语音只读画布'}
            </span>
          </div>
          <CanvasErrorBoundary diagramId={visibleDiagram.id}>
            <Suspense
              fallback={
                <div className={styles.canvasLoading} role="status">
                  正在加载画布…
                </div>
              }
            >
              <FlowRenderer ref={registerCanvasViewportApi} diagram={visibleDiagram} />
            </Suspense>
          </CanvasErrorBoundary>
        </section>

        <aside className={styles.rightPanel} aria-label="Agent 状态与历史">
          <section
            className={`${styles.panelCard} ${isPreview ? styles.agentActiveCard : ''}`}
          >
            <div className={styles.sectionHeading}>
              <span>候选预览与状态</span>
              <span
                className={
                  agent.status === 'error' ? styles.errorStatus : styles.successLabel
                }
              >
                {proposal ? proposal.source.toUpperCase() : agent.status.toUpperCase()}
              </span>
            </div>
            <dl className={styles.summaryGrid}>
              <div>
                <dt>Provider</dt>
                <dd>{agent.providerMode}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{agent.model || '--'}</dd>
              </div>
              <div>
                <dt>图表类型</dt>
                <dd>{visibleDiagram.diagramType}</dd>
              </div>
              <div>
                <dt>节点 / 连线</dt>
                <dd>
                  {visibleDiagram.nodes.length} / {visibleDiagram.edges.length}
                </dd>
              </div>
              <div>
                <dt>判断 / 分支</dt>
                <dd>
                  {decisionCount} / {branchCount}
                </dd>
              </div>
              <div>
                <dt>验证状态</dt>
                <dd>{isPreview ? '已通过' : '--'}</dd>
              </div>
              <div>
                <dt>异常分支</dt>
                <dd>{exceptionPathsHidden ? '已隐藏' : '显示中'}</dd>
              </div>
              <div>
                <dt>当前聚焦</dt>
                <dd>{focusedNodeId ?? selectedNodeId ?? '--'}</dd>
              </div>
            </dl>
            <p className={styles.resultMessage}>
              {agent.error ?? proposal?.summary ?? agent.summary ?? lastMessage}
            </p>
          </section>

          <section className={styles.panelCard}>
            <div className={styles.sectionHeading}>
              <span>智能决策指标</span>
              <span className={styles.successLabel}>
                {latestExecution?.route.toUpperCase() ?? 'READY'}
              </span>
            </div>
            <dl className={styles.summaryGrid}>
              <div>
                <dt>本次耗时</dt>
                <dd>{latestExecution ? `${latestExecution.durationMs} ms` : '--'}</dd>
              </div>
              <div>
                <dt>路由置信度</dt>
                <dd>{lastRoute ? `${Math.round(lastRoute.confidence * 100)}%` : '--'}</dd>
              </div>
              <div>
                <dt>平均耗时</dt>
                <dd>{executionLog.length ? `${averageDuration} ms` : '--'}</dd>
              </div>
              <div>
                <dt>快速路径命中</dt>
                <dd>{executionLog.length ? `${fastPathRate}%` : '--'}</dd>
              </div>
            </dl>
            <p className={styles.resultMessage}>
              {lastRoute?.reason ??
                '确定性命令本地执行，复杂意图进入 Agent，低置信度主动澄清'}
            </p>
            <dl className={styles.operationSummary}>
              {routeAverages.map(({ route, durationMs }) => (
                <div key={route}>
                  <dt>{route.toUpperCase()} 平均耗时</dt>
                  <dd>{durationMs === null ? '--' : `${durationMs} ms`}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={styles.panelCard}>
            <div className={styles.sectionHeading}>
              <span>版本与导出</span>
              <span className={styles.mutedLabel}>{versions.length} 个版本</span>
            </div>
            <ol className={styles.historyList}>
              {versions.length === 0 ? (
                <li className={styles.emptyLog}>尚无持久版本</li>
              ) : (
                versions.slice(0, 3).map((version) => (
                  <li key={version.id}>
                    <span>{version.kind}</span>
                    {version.name}
                  </li>
                ))
              )}
            </ol>
            <p className={styles.resultMessage}>
              {versionPersistenceError ??
                exportState.error ??
                exportState.lastResult?.filename ??
                (versionDiff
                  ? `对比：新增 ${versionDiff.addedNodes}，删除 ${versionDiff.removedNodes}，修改 ${versionDiff.changedNodes}`
                  : '等待保存版本或导出')}
            </p>
          </section>

          {(agent.status === 'clarifying' || pendingClarification) && (
            <VisualClarificationCard
              title="视觉化消歧"
              status="等待语音回答"
              originalCommand={
                pendingClarification?.originalCommand ?? agent.originalCommand
              }
              reason={
                agent.status === 'clarifying'
                  ? agent.summary
                  : '当前指令匹配到多个候选目标，为避免误操作，系统暂停执行并请求确认。'
              }
              candidates={pendingClarification?.candidates ?? []}
            />
          )}

          {pendingCorrection && (
            <VisualClarificationCard
              title="语义纠错待确认"
              status={`置信度 ${Math.round(pendingCorrection.confidence * 100)}%`}
              originalCommand={pendingCorrection.originalText}
              reason={pendingCorrection.reason}
              candidates={[
                {
                  id: 'pending-correction',
                  label: pendingCorrection.correctedText,
                  kind: '纠错建议',
                  detail: '建议命令',
                },
              ]}
            />
          )}

          {workflowClarification && (
            <section className={`${styles.panelCard} ${styles.clarificationCard}`}>
              <div className={styles.sectionHeading}>
                <span>请选择版本</span>
                <span>等待回答</span>
              </div>
              <ol className={styles.candidateList}>
                {workflowClarification.candidates.map((version, index) => (
                  <li key={version.id}>
                    第 {index + 1} 个 · {version.name}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {focusClarification && (
            <section className={`${styles.panelCard} ${styles.clarificationCard}`}>
              <div className={styles.sectionHeading}>
                <span>请选择聚焦节点</span>
                <span>等待回答</span>
              </div>
              <ol className={styles.candidateList}>
                {focusClarification.map((node, index) => (
                  <li key={node.id}>
                    第 {index + 1} 个 · {node.label}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className={styles.panelCard}>
            <div className={styles.sectionHeading}>
              <span>历史状态</span>
              <span className={styles.mutedLabel}>
                {lastRoute?.route.toUpperCase() ?? '等待命令'}
              </span>
            </div>
            <p className={styles.resultMessage}>{lastMessage}</p>
            <ol className={styles.historyList}>
              {history.length === 0 ? (
                <li className={styles.emptyLog}>等待图形操作</li>
              ) : (
                history.slice(0, 4).map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.action}</span>
                    {entry.description}
                  </li>
                ))
              )}
            </ol>
            <p className={styles.resultMessage}>
              撤销 {pastCount} · 重做 {futureCount} · 命令 {executionLog.length}
            </p>
            <span className={styles.mutedLabel}>最近命令</span>
          </section>
        </aside>
      </div>

      <footer className={styles.transcriptBar}>
        <span className={styles.transcriptLabel}>实时字幕</span>
        <span className={styles.transcriptLive}>
          {interimTranscript || finalTranscript || '等待语音输入…'}
        </span>
        <span className={styles.finalTranscript}>
          {correctedTranscript
            ? `语义纠错 ${Math.round((correctionFeedback?.confidence ?? 0) * 100)}%：${correctedTranscript}`
            : finalTranscript
              ? `最终：${finalTranscript}`
              : '尚无最终识别文本'}
        </span>
      </footer>
    </main>
  );
}

function createBrowserVoiceController(): VoiceController {
  const provider = new WebSpeechProvider();
  const box: { current?: VoiceController } = {};
  const speechFeedback = new BrowserSpeechFeedbackService({
    beforeSpeak: () => box.current?.pauseForFeedback(),
    afterSpeak: () => box.current?.resumeAfterFeedback(),
  });
  const controller = createVoiceController({ provider, speechFeedback });
  box.current = controller;
  return controller;
}
