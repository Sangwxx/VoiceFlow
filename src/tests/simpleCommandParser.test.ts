import { describe, expect, it } from 'vitest';

import { parseSimpleCommand } from '../commands/simple/simpleCommandParser';

describe('parseSimpleCommand', () => {
  it.each([
    ['加一个节点叫验证码校验', 'create_node'],
    ['在登录页后面加一个验证码校验节点', 'insert_node_after'],
    ['删除验证码校验节点', 'delete_node'],
    ['把登录页改名为账号登录', 'update_node_text'],
    ['把验证码校验改成蓝色', 'update_node_style'],
    ['连接登录页到验证码校验', 'create_edge'],
    ['删除登录页到验证码校验的连线', 'delete_edge'],
    ['把失败分支改成红色虚线', 'update_edge_style'],
  ])('parses "%s" as %s', (text, intent) => {
    expect(parseSimpleCommand(text)).toMatchObject({ status: 'ready', intent });
  });

  it('extracts node type, edge label and style fields', () => {
    expect(parseSimpleCommand('添加一个判断节点叫是否通过')).toMatchObject({
      status: 'ready',
      draft: { nodeType: 'decision', label: '是否通过' },
    });
    expect(parseSimpleCommand('连接登录页到验证码校验标签为成功')).toMatchObject({
      status: 'ready',
      draft: {
        sourceText: '登录页',
        targetText: '验证码校验',
        label: '成功',
      },
    });
    expect(parseSimpleCommand('把失败分支改成红色虚线')).toMatchObject({
      status: 'ready',
      draft: { edgeText: '失败', colorName: '红色', lineType: 'dashed' },
    });
  });

  it('rejects unsupported wording', () => {
    expect(parseSimpleCommand('把流程做得更好看')).toMatchObject({ status: 'invalid' });
  });
});
