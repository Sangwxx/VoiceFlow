export function logModuleError(
  moduleName: string,
  errorType: string,
  diagramId: string,
  error: unknown,
) {
  console.error(`[VoiceFlow:${moduleName}]`, {
    errorType,
    diagramId,
    error,
  });
}
