/** the preview's device in its own units, and its glass: 16:10, the aspect of the viewport the preview renders at */
export const device = { w: 640, h: 450 };
export const glass = { x: 32, y: 56, w: 576, h: 360 };

/** a rect of the device as CSS percentages of the drawing */
export function percentOf(r: { x: number; y: number; w: number; h: number }) {
  return {
    left: `${(r.x / device.w) * 100}%`,
    top: `${(r.y / device.h) * 100}%`,
    width: `${(r.w / device.w) * 100}%`,
    height: `${(r.h / device.h) * 100}%`,
  };
}
