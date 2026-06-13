import {
  DIAGRAM_TYPES,
  EDGE_TYPES,
  LAYOUT_DIRECTIONS,
  NODE_TYPES,
  THEME_NAMES,
  type Diagram,
} from './diagramTypes';

export type DiagramValidationErrorCode =
  | 'invalid_type'
  | 'required'
  | 'duplicate_id'
  | 'invalid_reference'
  | 'unsupported';

export type DiagramValidationError = {
  code: DiagramValidationErrorCode;
  path: string;
  message: string;
};

export type DiagramValidationResult =
  | { success: true; data: Diagram }
  | { success: false; errors: DiagramValidationError[] };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasAllowedValue<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

export function validateDiagram(input: unknown): DiagramValidationResult {
  const errors: DiagramValidationError[] = [];
  const addError = (code: DiagramValidationErrorCode, path: string, message: string) =>
    errors.push({ code, path, message });

  if (!isRecord(input)) {
    return {
      success: false,
      errors: [
        {
          code: 'invalid_type',
          path: '$',
          message: 'Diagram 必须是对象。',
        },
      ],
    };
  }

  if (!isNonEmptyString(input.id)) addError('required', 'id', '图形 ID 不能为空。');
  if (!isNonEmptyString(input.title)) addError('required', 'title', '图形标题不能为空。');
  if (!hasAllowedValue(DIAGRAM_TYPES, input.diagramType)) {
    addError('invalid_type', 'diagramType', '图形类型不受支持。');
  }

  const nodeIds = new Set<string>();
  if (!Array.isArray(input.nodes)) {
    addError('invalid_type', 'nodes', 'nodes 必须是数组。');
  } else {
    input.nodes.forEach((node, index) => {
      const path = `nodes[${index}]`;
      if (!isRecord(node)) {
        addError('invalid_type', path, '节点必须是对象。');
        return;
      }

      if (!isNonEmptyString(node.id)) {
        addError('required', `${path}.id`, '节点 ID 不能为空。');
      } else if (nodeIds.has(node.id)) {
        addError('duplicate_id', `${path}.id`, `节点 ID "${node.id}" 重复。`);
      } else {
        nodeIds.add(node.id);
      }

      if (!isNonEmptyString(node.label)) {
        addError('required', `${path}.label`, '节点名称不能为空。');
      }
      if (!hasAllowedValue(NODE_TYPES, node.type)) {
        addError('invalid_type', `${path}.type`, '节点类型不受支持。');
      }

      if (node.position !== undefined) {
        if (
          !isRecord(node.position) ||
          !isFiniteNumber(node.position.x) ||
          !isFiniteNumber(node.position.y)
        ) {
          addError(
            'invalid_type',
            `${path}.position`,
            '节点坐标必须包含有限数值 x 和 y。',
          );
        }
      }

      if (node.size !== undefined) {
        if (
          !isRecord(node.size) ||
          !isFiniteNumber(node.size.width) ||
          !isFiniteNumber(node.size.height) ||
          node.size.width <= 0 ||
          node.size.height <= 0
        ) {
          addError(
            'invalid_type',
            `${path}.size`,
            '节点尺寸必须包含大于 0 的 width 和 height。',
          );
        }
      }

      if (node.style !== undefined && !isRecord(node.style)) {
        addError('invalid_type', `${path}.style`, '节点样式必须是对象。');
      }
      if (node.data !== undefined && !isRecord(node.data)) {
        addError('invalid_type', `${path}.data`, '节点 data 必须是对象。');
      }
    });
  }

  const edgeIds = new Set<string>();
  const edgeEndpoints = new Set<string>();
  if (!Array.isArray(input.edges)) {
    addError('invalid_type', 'edges', 'edges 必须是数组。');
  } else {
    input.edges.forEach((edge, index) => {
      const path = `edges[${index}]`;
      if (!isRecord(edge)) {
        addError('invalid_type', path, '连线必须是对象。');
        return;
      }

      if (!isNonEmptyString(edge.id)) {
        addError('required', `${path}.id`, '连线 ID 不能为空。');
      } else if (edgeIds.has(edge.id)) {
        addError('duplicate_id', `${path}.id`, `连线 ID "${edge.id}" 重复。`);
      } else {
        edgeIds.add(edge.id);
      }

      if (!isNonEmptyString(edge.from)) {
        addError('required', `${path}.from`, '连线起点不能为空。');
      } else if (!nodeIds.has(edge.from)) {
        addError('invalid_reference', `${path}.from`, `连线起点 "${edge.from}" 不存在。`);
      }

      if (!isNonEmptyString(edge.to)) {
        addError('required', `${path}.to`, '连线终点不能为空。');
      } else if (!nodeIds.has(edge.to)) {
        addError('invalid_reference', `${path}.to`, `连线终点 "${edge.to}" 不存在。`);
      }

      if (isNonEmptyString(edge.from) && isNonEmptyString(edge.to)) {
        const endpoints = `${edge.from}->${edge.to}`;
        if (edge.from === edge.to) {
          addError('invalid_reference', path, '不允许节点连接到自身。');
        } else if (edgeEndpoints.has(endpoints)) {
          addError('duplicate_id', path, '相同起点和终点的连线重复。');
        } else {
          edgeEndpoints.add(endpoints);
        }
      }

      if (edge.type !== undefined && !hasAllowedValue(EDGE_TYPES, edge.type)) {
        addError('invalid_type', `${path}.type`, '连线类型不受支持。');
      }
      if (edge.style !== undefined && !isRecord(edge.style)) {
        addError('invalid_type', `${path}.style`, '连线样式必须是对象。');
      }
    });
  }

  if (input.groups !== undefined) {
    if (!Array.isArray(input.groups)) {
      addError('invalid_type', 'groups', 'groups 必须是数组。');
    } else {
      const groupIds = new Set<string>();
      input.groups.forEach((group, index) => {
        const path = `groups[${index}]`;
        if (!isRecord(group)) {
          addError('invalid_type', path, '分组必须是对象。');
          return;
        }
        if (!isNonEmptyString(group.id)) {
          addError('required', `${path}.id`, '分组 ID 不能为空。');
        } else if (groupIds.has(group.id)) {
          addError('duplicate_id', `${path}.id`, '分组 ID 重复。');
        } else {
          groupIds.add(group.id);
        }
        if (!isNonEmptyString(group.label)) {
          addError('required', `${path}.label`, '分组名称不能为空。');
        }
        if (!Array.isArray(group.nodeIds)) {
          addError('invalid_type', `${path}.nodeIds`, '分组节点必须是数组。');
        } else {
          group.nodeIds.forEach((nodeId, nodeIndex) => {
            if (!isNonEmptyString(nodeId) || !nodeIds.has(nodeId)) {
              addError(
                'invalid_reference',
                `${path}.nodeIds[${nodeIndex}]`,
                '分组引用了不存在的节点。',
              );
            }
          });
        }
      });
    }
  }

  if (!isRecord(input.layout)) {
    addError('required', 'layout', '布局配置不能为空。');
  } else {
    if (!hasAllowedValue(LAYOUT_DIRECTIONS, input.layout.direction)) {
      addError('invalid_type', 'layout.direction', '布局方向不受支持。');
    }
    for (const key of ['spacingX', 'spacingY'] as const) {
      if (!isFiniteNumber(input.layout[key]) || input.layout[key] <= 0) {
        addError('invalid_type', `layout.${key}`, `${key} 必须是大于 0 的有限数值。`);
      }
    }
    if (typeof input.layout.autoLayout !== 'boolean') {
      addError('invalid_type', 'layout.autoLayout', 'autoLayout 必须是布尔值。');
    }
  }

  if (!isRecord(input.theme)) {
    addError('required', 'theme', '主题配置不能为空。');
  } else if (!hasAllowedValue(THEME_NAMES, input.theme.name)) {
    addError('invalid_type', 'theme.name', '主题名称不受支持。');
  }

  if (!isRecord(input.metadata)) {
    addError('required', 'metadata', '元数据不能为空。');
  } else {
    if (!isNonEmptyString(input.metadata.createdAt)) {
      addError('required', 'metadata.createdAt', '创建时间不能为空。');
    }
    if (!isNonEmptyString(input.metadata.updatedAt)) {
      addError('required', 'metadata.updatedAt', '更新时间不能为空。');
    }
    if (
      !isFiniteNumber(input.metadata.version) ||
      !Number.isInteger(input.metadata.version) ||
      input.metadata.version < 1
    ) {
      addError('invalid_type', 'metadata.version', '版本号必须是大于等于 1 的整数。');
    }
  }

  return errors.length > 0
    ? { success: false, errors }
    : { success: true, data: input as Diagram };
}
