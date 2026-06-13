const PUNCTUATION_PATTERN = /[\s，。！？、；：,.!?;:'"“”‘’（）()【】[\]{}<>《》]/g;

export function normalizeText(text: string): string {
  return text.trim().toLocaleLowerCase('zh-CN').replace(PUNCTUATION_PATTERN, '');
}
