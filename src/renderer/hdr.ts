/**
 * HDR screens (recent iPhones, Macs, HDR monitors): where the browser supports an extended
 * range WebGL canvas, the drawing buffer is switched to half float with extended tone mapping,
 * so the brightest lights (the sunrise, the candle flames) can glow brighter than paper white.
 * Everywhere else nothing changes. Returns true when HDR output is on.
 */
type HdrGL = WebGL2RenderingContext & {
  drawingBufferStorage?: (format: number, w: number, h: number) => void;
  drawingBufferToneMapping?: (o: { mode: 'extended' | 'standard' }) => void;
};

export function enableHdr(gl: WebGL2RenderingContext, width: number, height: number): boolean {
  try {
    if (typeof matchMedia !== 'function' || !matchMedia('(dynamic-range: high)').matches) return false;
    const g = gl as HdrGL;
    if (typeof g.drawingBufferStorage !== 'function' || typeof g.drawingBufferToneMapping !== 'function') return false;
    g.drawingBufferStorage(g.RGBA16F, Math.max(1, width), Math.max(1, height));
    g.drawingBufferToneMapping({ mode: 'extended' });
    return !g.getError();
  } catch {
    return false;
  }
}
