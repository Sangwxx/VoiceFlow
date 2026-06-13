import type { Diagram } from '../core/diagram/diagramTypes';

export const ecommerceDiagram: Diagram = {
  id: 'ecommerce-order-flow',
  title: '电商订单流程',
  diagramType: 'flowchart',
  nodes: [
    { id: 'start', label: '开始下单', type: 'start' },
    { id: 'cart', label: '确认购物车', type: 'process' },
    { id: 'stock', label: '库存充足？', type: 'decision' },
    { id: 'pay', label: '支付订单', type: 'process' },
    { id: 'paid', label: '支付成功？', type: 'decision' },
    { id: 'ship', label: '仓库发货', type: 'process' },
    { id: 'fail', label: '提示失败', type: 'process' },
    { id: 'end', label: '订单完成', type: 'end' },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'cart' },
    { id: 'e2', from: 'cart', to: 'stock' },
    { id: 'e3', from: 'stock', to: 'pay', label: '是' },
    { id: 'e4', from: 'stock', to: 'fail', label: '否' },
    { id: 'e5', from: 'pay', to: 'paid' },
    { id: 'e6', from: 'paid', to: 'ship', label: '成功' },
    { id: 'e7', from: 'paid', to: 'fail', label: '失败' },
    { id: 'e8', from: 'ship', to: 'end' },
  ],
  groups: [],
  layout: { direction: 'top_down', spacingX: 90, spacingY: 85, autoLayout: true },
  theme: { name: 'business_blue' },
  metadata: {
    createdAt: '2026-06-12T12:00:00.000Z',
    updatedAt: '2026-06-12T12:00:00.000Z',
    version: 1,
  },
};
