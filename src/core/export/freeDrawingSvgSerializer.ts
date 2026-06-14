import type {
  FreeDrawingObject,
  FreeDrawingScene,
} from '../freeDrawing/freeDrawingTypes';

export function serializeFreeDrawingSvg(scene: FreeDrawingScene): string {
  const objects = scene.objects.map(serializeObject).join('\n  ');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" role="img" aria-label="${escapeXml(scene.title)}">`,
    '  <rect width="100%" height="100%" fill="#fffdf8"/>',
    objects ? `  ${objects}` : '',
    '</svg>',
  ]
    .filter(Boolean)
    .join('\n');
}

export function freeDrawingSvgDataUrl(scene: FreeDrawingScene): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializeFreeDrawingSvg(scene))}`;
}

function serializeObject(object: FreeDrawingObject): string {
  const common = [
    `aria-label="${escapeXml(object.label)}"`,
    attribute('fill', object.fill),
    attribute('stroke', object.stroke),
    numericAttribute('stroke-width', object.strokeWidth),
  ]
    .filter(Boolean)
    .join(' ');

  switch (object.type) {
    case 'circle':
      return `<circle ${common} cx="${object.cx}" cy="${object.cy}" r="${object.radius}"/>`;
    case 'ellipse':
      return `<ellipse ${common} cx="${object.cx}" cy="${object.cy}" rx="${object.rx}" ry="${object.ry}"${object.rotate ? ` transform="rotate(${object.rotate} ${object.cx} ${object.cy})"` : ''}/>`;
    case 'rect':
      return `<rect ${common} x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}"${object.radius !== undefined ? ` rx="${object.radius}"` : ''}/>`;
    case 'line':
      return `<line ${common} x1="${object.x1}" y1="${object.y1}" x2="${object.x2}" y2="${object.y2}"${object.lineCap ? ` stroke-linecap="${object.lineCap}"` : ''}/>`;
    case 'path':
      return `<path ${common} d="${escapeXml(object.d)}" stroke-linecap="round"/>`;
  }
}

function attribute(name: string, value: string | undefined): string {
  return value === undefined ? '' : `${name}="${escapeXml(value)}"`;
}

function numericAttribute(name: string, value: number | undefined): string {
  return value === undefined ? '' : `${name}="${value}"`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
