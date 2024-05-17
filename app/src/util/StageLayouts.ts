export interface StagePoint {
  x: number
  y: number
}

export class StageLayout {
  name: string
  layout: StagePoint[]
  columnCount: number
  constructor(name: string, layout: StagePoint[]) {
    this.name = name
    this.layout = layout
    this.columnCount = layout.length
  }

  getXDifference(leftIndex: number, rightIndex: number) {
    if (leftIndex == rightIndex) return 0
    let dx = this.layout[rightIndex].x - this.layout[leftIndex].x
    const dy = this.layout[rightIndex].y - this.layout[leftIndex].y

    const distance = Math.sqrt(dx * dx + dy * dy)
    dx /= distance

    const negative = dx <= 0

    dx = Math.pow(dx, 4)

    if (negative) dx = -dx

    return dx
  }

  getYDifference(leftIndex: number, rightIndex: number) {
    if (leftIndex == rightIndex) return 0
    const dx = this.layout[rightIndex].x - this.layout[leftIndex].x
    let dy = this.layout[rightIndex].y - this.layout[leftIndex].y

    const distance = Math.sqrt(dx * dx + dy * dy)
    dy /= distance

    const negative = dy <= 0

    dy = Math.pow(dy, 4)

    if (negative) dy = -dy

    return dy
  }

  averagePoint(leftIndex: number, rightIndex: number) {
    if (leftIndex == -1 && rightIndex == -1) return { x: 0, y: 0 }
    if (leftIndex == -1) return this.layout[rightIndex]
    if (rightIndex == -1) return this.layout[leftIndex]
    return {
      x: (this.layout[leftIndex].x + this.layout[rightIndex].x) / 2,
      y: (this.layout[leftIndex].y + this.layout[rightIndex].y) / 2,
    }
  }

  getDistanceSq(leftIndex: number, rightIndex: number) {
    const p1 = this.layout[leftIndex]
    const p2 = this.layout[rightIndex]
    return (p1.y - p2.y) * (p1.y - p2.y) + (p1.x - p2.x) * (p1.x - p2.x)
  }

  bracketCheck(column1: number, column2: number) {
    return this.getDistanceSq(column1, column2) <= 2
  }

  getPlayerAngle(leftIndex: number, rightIndex: number) {
    const left = this.layout[leftIndex]
    const right = this.layout[rightIndex]
    const x1 = right.x - left.x
    const y1 = right.y - left.y
    const x2 = 1
    const y2 = 0
    const dot = x1 * x2 + y1 * y2
    const det = x1 * y2 - y1 * x2
    return Math.atan2(det, dot)
  }
}

export const LAYOUT: { [id: string]: StageLayout } = {
  "dance-single": new StageLayout("dance-single", [
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: 1, y: 0 },
  ]),
  "dance-double": new StageLayout("dance-double", [
    { x: -1, y: 0 },
    { x: -0.7, y: -1 },
    { x: -0.7, y: 1 },
    { x: -0.2, y: 0 },

    { x: 0.2, y: 0 },
    { x: 0.7, y: -1 },
    { x: 0.7, y: 1 },
    { x: 1, y: 0 },
  ]),
}
