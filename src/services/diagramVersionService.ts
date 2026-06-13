import { diagramsHaveMeaningfulDifference } from '../core/operations/operationResultVerifier';
import { useCommandStore } from '../stores/commandStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVersionStore, type DiagramVersion } from '../stores/versionStore';

export function saveCurrentDiagramVersion(
  sourceAction: string,
  automatic = false,
): DiagramVersion | null {
  const diagram = useDiagramStore.getState().diagram;
  const versions = useVersionStore.getState().versions;
  if (
    versions.some(
      (version) => !diagramsHaveMeaningfulDifference(version.diagram, diagram),
    )
  ) {
    return null;
  }
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const version = useVersionStore
    .getState()
    .saveVersion(
      `${automatic ? '自动备份' : '手动保存'}：${diagram.title} ${time}`,
      automatic ? 'auto' : 'manual',
      sourceAction,
      diagram,
    );
  useCommandStore
    .getState()
    .setLastMessage(automatic ? '已自动备份上一张图' : '已保存当前图');
  return version;
}
