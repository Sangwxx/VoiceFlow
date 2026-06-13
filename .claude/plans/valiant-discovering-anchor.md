# 语音输入层改动：点击切换 + 3秒静音自动关闭

## Context

当前语音输入需要用户手动点击"停止语音输入"才能关闭麦克风。用户希望：
1. 保留点击切换录音的交互（开始/停止）
2. 增加静音检测：停止说话 3 秒后自动关闭麦克风

## 改动方案（4 个文件）

### 1. `src/voice/voiceTypes.ts` — 增加静音回调类型

`VoiceProviderCallbacks` 接口增加 `onSilence?: () => void`，供 provider 在检测到静音时回调。

### 2. `src/voice/webSpeechProvider.ts` — 实现 3 秒静音计时器

在 `WebSpeechProvider` 类中增加：
- `silenceTimer: number | null` 字段
- `resetSilenceTimer()`：每次 `handleResult` 中 `foundText === true` 时调用，重置 3 秒倒计时
- `clearSilenceTimer()`：清理计时器
- 计时器到期 → `intentionallyStopped = true`（防止自动重启）→ 停止识别 → 调用 `callbacks.onSilence?.()`

关键逻辑：只有 `onresult` 事件中存在**有效文本内容**（`text.trim() !== ''`）时才重置计时器。空的/无声的 `onresult` 不重置，让计时器正常走完触发自动关闭。

**注意**：`mockVoiceProvider.ts` 不需要改动（测试用，无真实音频）。

### 3. `src/voice/voiceController.ts` — 处理静音回调

在 `createVoiceController()` 的 provider 回调中传入 `onSilence`：

```typescript
onSilence: () => {
  shouldListen = false;  // 不再处理残留识别结果
  useVoiceStore.getState().setStatus('idle');
  useVoiceStore.getState().setError(null);  // 清除可能的错误提示
}
```

`shouldListen = false` 确保 `handleResult` 中 `if (!shouldListen) return;` 生效，停止处理后续残留结果。

### 4. `src/app/App.tsx` — 同步按钮状态

增加一个 `useEffect` 监听 `voiceStore.status`：

```typescript
useEffect(() => {
  if (voiceStatus === 'idle' || voiceStatus === 'unsupported') {
    setRecordingEnabled(false);
  }
}, [voiceStatus]);
```

当自动关闭导致状态变为 `idle` 时，按钮自动恢复为"开始语音输入"。

### 边界情况处理

| 场景 | 处理方式 |
|---|---|
| 用户说话途中停顿 < 3 秒 | `onresult` 持续收到文本，计时器不断重置，不会触发自动关闭 |
| 用户说完一句话，3 秒内说下一句 | 同上，计时器在每次 `onresult` 时重置 |
| 用户手动点击"停止" | `controller.stopListening()` → status = idle → useEffect 同步按钮状态（不会冲突，setState 幂等）|
| 自动关闭后用户再次点击"开始" | controller.startListening() → 重新开始录音 |
| 静默 3 秒内浏览器 `onend` 触发 | `intentionallyStopped=false` 时会自动重启；但 3 秒静音计时器到期后 `intentionallyStopped=true`，不再重启 |

## 测试验证

1. 点击"开始语音输入" → 按钮变为"停止语音输入"，状态显示"正在聆听"
2. 说话 → 字幕栏显示识别文字
3. 停止说话 → 3 秒后自动关闭 → 状态变为"空闲"，按钮变为"开始语音输入"
4. 再次点击"开始语音输入" → 恢复正常录音
5. 说话中停顿 < 3 秒 → 不会误关闭
6. 手动点击"停止语音输入" → 立即关闭，功能正常
