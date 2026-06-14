import type { FastCommandMatch, FastCommandName } from './fastCommandTypes';

type FastCommandDefinition = {
  command: FastCommandName;
  phrases: string[];
  exactOnly?: boolean;
};

export const highPriorityCommands: FastCommandDefinition[] = [
  { command: 'cancel', phrases: ['取消', '取消当前操作', '算了'] },
  { command: 'pause', phrases: ['暂停', '停一下', '先别动', '停止执行'] },
  { command: 'resume', phrases: ['继续', '继续执行', '恢复执行'] },
];

export const fastCommandDictionary: FastCommandDefinition[] = [
  { command: 'undo', phrases: ['撤销', '回到上一步', '退一步', '刚才的不算'] },
  { command: 'redo', phrases: ['重做', '恢复回来', '再做一次'] },
  { command: 'fit_view', phrases: ['看全图', '适应屏幕', '显示完整画布', '居中'] },
  { command: 'zoom_in', phrases: ['放大', '放大画布', '再大一点'] },
  { command: 'zoom_out', phrases: ['缩小', '缩小画布', '再小一点'] },
  { command: 'layout_left_to_right', phrases: ['横向布局', '从左到右', '改成横向布局'] },
  { command: 'layout_top_down', phrases: ['纵向布局', '从上到下', '改成纵向布局'] },
  { command: 'apply_layout', phrases: ['自动排版', '重新排版', '整理布局'] },
  { command: 'list_versions', phrases: ['列出版本', '有哪些版本', '查看版本'] },
  {
    command: 'save_version',
    phrases: ['保存', '保存当前版本'],
    exactOnly: true,
  },
  {
    command: 'export_json',
    phrases: ['导出json', '保存为json', '导出为json', '导出json文件'],
  },
  {
    command: 'export_svg',
    phrases: ['导出svg', '导出矢量图', '导出为svg', '保存为svg'],
  },
  {
    command: 'export_png',
    phrases: [
      '导出png',
      '导出图片',
      '导出为图片',
      '保存为图片',
      '导出这个图表',
      '导出当前图表',
      '导出这个图',
      '导出当前图',
      '导出图表',
    ],
  },
];

function matchDefinitions(
  normalizedText: string,
  definitions: FastCommandDefinition[],
): FastCommandMatch | null {
  for (const definition of definitions) {
    if (definition.phrases.includes(normalizedText)) {
      return { command: definition.command, confidence: 1 };
    }
    if (
      !definition.exactOnly &&
      definition.phrases.some((candidate) => normalizedText.includes(candidate))
    ) {
      return { command: definition.command, confidence: 0.92 };
    }
  }
  return null;
}

export function matchHighPriorityCommand(text: string) {
  return matchDefinitions(text, highPriorityCommands);
}

export function matchFastCommand(text: string) {
  if (isDiagramGenerationDescription(text)) return null;
  return matchStructuredExport(text) ?? matchDefinitions(text, fastCommandDictionary);
}

function matchStructuredExport(normalizedText: string): FastCommandMatch | null {
  if (!/(?:导出|保存|输出)/.test(normalizedText)) return null;
  if (/(?:svg|矢量图)/.test(normalizedText)) {
    return { command: 'export_svg', confidence: 0.98 };
  }
  if (/json/.test(normalizedText)) {
    return { command: 'export_json', confidence: 0.98 };
  }
  if (/(?:png|图片|图像)/.test(normalizedText)) {
    return { command: 'export_png', confidence: 0.98 };
  }
  return null;
}

function isDiagramGenerationDescription(normalizedText: string): boolean {
  return /(?:生成|画|绘制|创建).*(?:流程图|架构图|组织结构图|用例图|思维导图|结构图)/.test(
    normalizedText,
  );
}
