export interface StagePoint {
  x: number
  y: number
}

export const LAYOUT: Record<string, StagePoint[]> = {
  "dance-single": [
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: 1, y: 0 },
  ],
  "dance-double": [
    { x: -1, y: 0 },
    { x: -0.7, y: -1 },
    { x: -0.7, y: 1 },
    { x: -0.2, y: 0 },

    { x: 0.2, y: 0 },
    { x: 0.7, y: -1 },
    { x: 0.7, y: 1 },
    { x: 1, y: 0 },
  ],
}
