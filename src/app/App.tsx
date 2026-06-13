import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { CanvasErrorBoundary } from '../components/common/CanvasErrorBoundary';
import { ToolManual } from '../components/common/ToolManual';
import { hideExceptionPaths } from '../components/canvas/canvasView';
import { registerCanvasViewportApi } from '../services/canvasViewportService';
import { BrowserSpeechFeedbackService } from '../services/speechFeedbackService';
import { useCanvasViewStore } from '../stores/canvasViewStore';
import { useCommandStore } from '../stores/commandStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVersionStore } from '../stores/versionStore';
import { useVoiceStore, type VoiceStatus } from '../stores/voiceStore';
import { createVoiceController } from '../voice/voiceController';
import type { VoiceTask } from '../voice/voiceTaskSegmenter';
import type { VoiceController } from '../voice/voiceTypes';
import { WebSpeechProvider } from '../voice/webSpeechProvider';
import styles from './App.module.css';

const FlowRenderer = lazy(() =>
  import('../components/canvas/FlowRenderer').then(({ FlowRenderer }) => ({
    default: FlowRenderer,
  })),
);

const STATUS_LABELS: Record<VoiceStatus, string> = {
  idle: '等待语音',
  listening: '正在聆听',
  recognizing: '正在识别',
  processing: '正在执行',
  paused: '命令暂停',
  speaking: '系统反馈',
  error: '识别异常',
  unsupported: '浏览器不支持',
};

const TASK_STATUS_LABELS: Record<VoiceTask['status'], string> = {
  verifying: '正在本地确认',
  needs_clarification: '等待回答',
  awaiting_confirmation: '等待确认',
  no_change: '未产生变化',
  queued: '等待执行',
  waiting_recording_end: '等待录音结束',
  executing: '正在执行',
  completed: '已完成',
  failed: '执行失败',
};

export function App() {
  const [manualOpen, setManualOpen] = useState(false);
  const [textCommand, setTextCommand] = useState('');
  const [textCommandPending, setTextCommandPending] = useState(false);
  const diagram = useDiagramStore((state) => state.diagram);
  const voiceStatus = useVoiceStore((state) => state.status);
  const interimTranscript = useVoiceStore((state) => state.interimTranscript);
  const finalTranscript = useVoiceStore((state) => state.finalTranscript);
  const correctedTranscript = useVoiceStore((state) => state.correctedTranscript);
  const correctionFeedback = useVoiceStore((state) => state.correctionFeedback);
  const voiceError = useVoiceStore((state) => state.error);
  const commandPaused = useVoiceStore((state) => state.commandPaused);
  const voiceTasks = useVoiceStore((state) => state.taskQueue);
  const lastMessage = useCommandStore((state) => state.lastMessage);
  const versions = useVersionStore((state) => state.versions);
  const exceptionPathsHidden = useCanvasViewStore((state) => state.exceptionPathsHidden);
  const controller = useMemo(() => createBrowserVoiceController(), []);
  const taskListRef = useRef<HTMLOListElement>(null);
  const recordingEnabled = voiceStatus !== 'idle' && voiceStatus !== 'unsupported';
  const currentTask =
    voiceTasks.find((task) =>
      ['executing', 'verifying', 'needs_clarification', 'awaiting_confirmation'].includes(
        task.status,
      ),
    ) ??
    voiceTasks.find((task) =>
      ['queued', 'waiting_recording_end'].includes(task.status),
    ) ??
    voiceTasks.at(-1);

  useEffect(() => () => controller.stopListening(), [controller]);
  useEffect(() => {
    const active = taskListRef.current?.querySelector('[data-current="true"]');
    active?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentTask?.id, currentTask?.status]);

  const visibleDiagram = exceptionPathsHidden ? hideExceptionPaths(diagram) : diagram;

  async function submitTextCommand(): Promise<void> {
    const command = textCommand.trim();
    if (!command || textCommandPending) return;
    setTextCommandPending(true);
    useVoiceStore.getState().setFinalTranscript(command);
    try {
      await controller.handleFinalTranscript(command);
      setTextCommand('');
    } finally {
      setTextCommandPending(false);
    }
  }

  return (
    <main className={styles.appShell}>
      <aside className={styles.workbench} aria-label="语音工作区">
        <header className={styles.workbenchHeader}>
          <div>
            <span className={styles.eyebrow}>VOICEFLOW</span>
            <h1>语音工作区</h1>
          </div>
          <span className={`${styles.statusPill} ${styles[voiceStatus]}`}>
            {STATUS_LABELS[voiceStatus]}
          </span>
        </header>

        <section className={styles.microphoneSection} aria-label="麦克风与字幕">
          <button
            className={`${styles.microphoneButton} ${
              recordingEnabled ? styles.microphoneActive : ''
            }`}
            type="button"
            aria-label={recordingEnabled ? '停止语音输入' : '开始语音输入'}
            aria-pressed={recordingEnabled}
            onClick={() =>
              recordingEnabled ? controller.stopListening() : controller.startListening()
            }
          >
            <span className={styles.microphoneIcon} aria-hidden="true" />
            <span>{recordingEnabled ? '停止聆听' : '开始聆听'}</span>
          </button>
          <div className={styles.transcriptBox}>
            <span>实时文字</span>
            <strong>{interimTranscript || finalTranscript || '等待你说话…'}</strong>
            <small>
              {correctedTranscript
                ? `本地校准 ${Math.round((correctionFeedback?.confidence ?? 0) * 100)}%：${correctedTranscript}`
                : (voiceError ?? (commandPaused ? '当前仅响应继续和取消' : lastMessage))}
            </small>
          </div>
        </section>

        <form
          className={styles.textCommandSection}
          aria-label="文字指令测试"
          onSubmit={(event) => {
            event.preventDefault();
            void submitTextCommand();
          }}
        >
          <div className={styles.sectionHeading}>
            <div>
              <span>文字指令测试</span>
              <small>无法使用语音时，走同一条指令执行链路</small>
            </div>
          </div>
          <div className={styles.textCommandControls}>
            <input
              aria-label="输入测试指令"
              placeholder="例如：画一个学生选课用例图"
              value={textCommand}
              onChange={(event) => setTextCommand(event.target.value)}
            />
            <button disabled={!textCommand.trim() || textCommandPending} type="submit">
              {textCommandPending ? '执行中' : '执行指令'}
            </button>
          </div>
        </form>

        <section className={styles.taskSection} aria-label="任务列表">
          <div className={styles.sectionHeading}>
            <div>
              <span>任务列表</span>
              <small>严格按照说出顺序执行</small>
            </div>
            <strong>{voiceTasks.length}</strong>
          </div>
          <ol className={styles.taskScroller} ref={taskListRef}>
            {voiceTasks.length ? (
              voiceTasks.map((task) => {
                const isCurrent = task.id === currentTask?.id;
                return (
                  <li
                    className={`${styles.taskItem} ${
                      isCurrent ? styles.currentTask : ''
                    } ${styles[task.status]}`}
                    data-current={isCurrent}
                    key={task.id}
                  >
                    <span className={styles.taskSequence}>{task.sequence}</span>
                    <div>
                      <strong>{task.text}</strong>
                      <span>{TASK_STATUS_LABELS[task.status]}</span>
                    </div>
                    <span className={styles.confidence}>
                      {Math.round(task.route.confidence * 100)}%
                    </span>
                  </li>
                );
              })
            ) : (
              <li className={styles.emptyState}>说出一个或多个连续任务</li>
            )}
          </ol>
        </section>

        <section className={styles.versionSection} aria-label="版本管理">
          <div className={styles.sectionHeading}>
            <div>
              <span>版本管理</span>
              <small>仅收录明确语音保存的版本</small>
            </div>
            <strong>{versions.length}</strong>
          </div>
          <p className={styles.versionHint}>
            说“保存当前版本叫初始流程”，需要时说“恢复初始流程”。
          </p>
          <ol className={styles.versionList}>
            {versions.length ? (
              versions.slice(0, 5).map((version) => (
                <li key={version.id}>
                  <strong>{version.name}</strong>
                  <span>{new Date(version.createdAt).toLocaleString('zh-CN')}</span>
                </li>
              ))
            ) : (
              <li className={styles.emptyState}>请说“保存当前版本叫…”进行收录</li>
            )}
          </ol>
        </section>
      </aside>

      <section className={styles.canvasArea} aria-label="画布区">
        <header className={styles.canvasHeader}>
          <div>
            <span className={styles.eyebrow}>CANVAS</span>
            <h2>{visibleDiagram.title}</h2>
          </div>
          <span className={styles.readOnlyBadge}>只读画布</span>
          <button
            className={styles.manualButton}
            type="button"
            onClick={() => setManualOpen(true)}
            aria-label="打开工具手册"
          >
            工具手册
          </button>
        </header>
        <CanvasErrorBoundary diagramId={visibleDiagram.id}>
          <Suspense fallback={<div className={styles.canvasLoading}>正在加载画布…</div>}>
            <FlowRenderer ref={registerCanvasViewportApi} diagram={visibleDiagram} />
          </Suspense>
        </CanvasErrorBoundary>
      </section>
      {manualOpen ? <ToolManual onClose={() => setManualOpen(false)} /> : null}
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
