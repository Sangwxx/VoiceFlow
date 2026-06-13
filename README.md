# VoiceFlow

VoiceFlow is a pure-voice structured drawing tool. After the browser microphone permission is granted, users can create, edit, arrange, beautify, version and export flowcharts or architecture diagrams without mouse, keyboard or touch editing.

```text
Voice -> Router -> Fast / Simple / Workflow / Agent -> Operation / Proposal
      -> Diagram Store -> Dagre -> Read-only React Flow -> Export
```

## Run

```bash
npm install
npm run dev
```

Use desktop Chrome or Edge and open the URL printed by Vite.

## Main Voice Commands

- Create: `画一个用户登录流程图`
- Edit: `在登录页后面加一个验证码校验节点`
- Style: `把失败分支改成红色虚线`
- View: `聚焦登录页`, `看全图`, `隐藏异常分支`, `显示异常分支`
- History: `撤销`, `重做`
- Version: `保存当前版本叫初始流程`, `恢复版本初始流程`, `对比版本初始流程`
- Report: `整理成适合汇报的版本`
- Scenes: `加载登录演示场景`, `加载电商订单演示场景`, `加载系统架构演示场景`
- Export: `导出 JSON`, `导出 SVG`, `导出 PNG`
- Control: `暂停`, `继续`, `确认`, `取消`

Named versions persist in browser `localStorage`. Full Diagram replacements always enter a preview and require voice confirmation.

## AI Configuration

Without configuration, VoiceFlow uses a deterministic Mock AI Provider. An OpenAI-compatible provider can be configured with:

```bash
VITE_AI_BASE_URL=https://your-provider.example/v1
VITE_AI_API_KEY=your-demo-key
VITE_AI_MODEL=your-model
```

`VITE_` values are exposed to the browser and are suitable only for local demonstrations. Production usage requires a backend proxy.

## Verification

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Copy `.env.example` to `.env.local`, fill all three values, and restart `npm run dev`.
With a real provider enabled, unknown or incomplete speech transcripts are first corrected using
the current Diagram and recent-command context, then routed again. Natural drawing requests that
still do not match a deterministic rule are sent to the contextual Agent. The Agent may propose a
validated batch of Operations against the current Diagram; the batch is previewed and requires
voice confirmation before it is committed as one undoable history entry. Mock mode only performs a
small set of deterministic corrections, demo-topic generation and contextual modification demos.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DEMO_SCRIPT.md](DEMO_SCRIPT.md) and [DESIGN_AUDIT.md](DESIGN_AUDIT.md). Demo video recording is intentionally excluded.
