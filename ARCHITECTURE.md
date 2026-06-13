# VoiceFlow Architecture

## Core Flow

```text
Web Speech API
  -> VoiceController
  -> Command Router
     -> Fast Path
     -> Simple Path
     -> Workflow Path
     -> Agent Path
  -> Operation / Proposal
  -> Diagram Store
  -> Dagre Layout
  -> Read-only React Flow Canvas
  -> Export Service
```

## Design Rules

- Diagram JSON is the only persisted drawing data source.
- React components render state and never directly edit Diagram JSON.
- Fast commands bypass AI.
- Simple commands produce validated Operations.
- Agent output is normalized and validated before becoming a Proposal.
- Full Diagram replacements and contextual Agent Operation batches require a voice-confirmed Proposal.
- View-only behavior such as focus and hidden exception branches never modifies Diagram JSON.
- The React Flow canvas disables mouse, keyboard and touch editing.

## State Ownership

- `diagramStore`: committed Diagram, undo/redo history and programmatic selection.
- `proposalStore`: uncommitted Diagram preview and optional validated Operation batch shared by Agent and Workflow paths.
- `versionStore`: named and automatic snapshots persisted in `localStorage`.
- `voiceStore`: recognition and pause state.
- `commandStore`: route result, execution log and Simple clarification.
- `agentStore`: AI request, provider and clarification state.
- `workflowStore`: version-choice clarification.
- `canvasViewStore`: focus and exception-branch visibility.
- `exportStore`: latest export state.

## Safety Boundaries

- Diagram and Operation runtime validators reject invalid graph structures.
- Contextual Agent requests receive the current Diagram and recent command context, but may only
  return whitelisted Operations. The complete batch is executed against a clone before preview.
- Failed Agent, Workflow, export or clarification actions leave the committed Diagram unchanged.
- Confirmation creates one undoable history entry.
- Real AI failures do not silently fall back to Mock AI.
- Browser-exposed AI keys are suitable only for local demonstrations.
