// This is most of the internals for ParityGenerator,
// as much of it as I can separate from the rest of the SMEditor code.
// I wanted to do this so that I could port the parity generating stuff
// into something I could more easily run from commandline.

// Generates foot parity given notedata
// Original algorithm by Jewel, polished by tillvit
// Generates foot parity given notedata
// Original algorithm by Jewel, polished by tillvit

import { LAYOUT } from "./StageLayouts"
import {
  HoldNotedataEntry,
  Notedata,
  NotedataEntry,
  isHoldNote,
} from "../chart/sm/NoteTypes"

import {
  Foot,
  State,
  SerializableState,
  Row,
  StepParityNode,
  StepParityGraph,
} from "./ParityDataTypes"
import { ParityCostCalculator } from "./ParityCost"

export const FEET = [
  Foot.LEFT_HEEL,
  Foot.LEFT_TOE,
  Foot.RIGHT_HEEL,
  Foot.RIGHT_TOE,
]
export const FEET_LABEL = "LlRr"

export class ParityGenInternal {
  costCalculator: ParityCostCalculator

  private permuteCache: Map<number, Foot[][]> = new Map()
  private readonly layout

  private beatOverrides: { [key: string]: Foot[] } = {}

  constructor(type: string) {
    this.layout = LAYOUT[type]
    this.costCalculator = new ParityCostCalculator(type)
  }

  analyze(
    notedata: Notedata,
    beatOverrides: { [key: string]: Foot[] },
    weights: { [key: string]: number }
  ): { graph: StepParityGraph; selectedStates: State[]; parities: Foot[][] } {
    this.beatOverrides = beatOverrides
    this.costCalculator.setWeights(weights)

    const rows = this.createRows(notedata)

    const graph = this.buildStateGraph(rows, true)
    const selectedStates = this.selectStatesForRows(graph, rows.length)
    const parities = selectedStates.map(s => s.columns)
    this.setNoteParity(rows, parities)
    return { graph, selectedStates, parities }
  }

  calculatePermuteColumnKey(row: Row): number {
    let permuteCacheKey = 0
    for (let i = 0; i < this.layout.columnCount; i++) {
      if (row.notes[i] !== undefined || row.holds[i] !== undefined) {
        permuteCacheKey += Math.pow(2, i)
      }
    }
    return permuteCacheKey
  }

  getPermuteColumns(row: Row): Foot[][] {
    const cacheKey = this.calculatePermuteColumnKey(row)
    let permuteColumns = this.permuteCache.get(cacheKey)
    if (permuteColumns == undefined) {
      permuteColumns = this.permuteColumn(
        row,
        new Array(this.layout.columnCount).fill(Foot.NONE),
        0
      )
      this.permuteCache.set(cacheKey, permuteColumns)
    }
    return this.permuteCache.get(cacheKey)!
  }

  permuteColumn(row: Row, columns: Foot[], column: number): Foot[][] {
    if (column >= columns.length) {
      let leftHeelIndex = -1
      let leftToeIndex = -1
      let rightHeelIndex = -1
      let rightToeIndex = -1
      for (let i = 0; i < columns.length; i++) {
        if (columns[i] == Foot.NONE) continue
        if (columns[i] == Foot.LEFT_HEEL) leftHeelIndex = i
        if (columns[i] == Foot.LEFT_TOE) leftToeIndex = i
        if (columns[i] == Foot.RIGHT_HEEL) rightHeelIndex = i
        if (columns[i] == Foot.RIGHT_TOE) rightToeIndex = i
      }
      if (
        (leftHeelIndex == -1 && leftToeIndex != -1) ||
        (rightHeelIndex == -1 && rightToeIndex != -1)
      ) {
        return []
      }
      if (leftHeelIndex != -1 && leftToeIndex != -1) {
        if (!this.layout.bracketCheck(leftHeelIndex, leftToeIndex)) return []
      }
      if (rightHeelIndex != -1 && rightToeIndex != -1) {
        if (!this.layout.bracketCheck(rightHeelIndex, rightToeIndex)) return []
      }
      return [columns]
    }
    const permutations = []
    if (row.notes[column] || row.holds[column]) {
      for (const foot of FEET) {
        if (columns.includes(foot)) continue
        const newColumns = [...columns]
        newColumns[column] = foot
        permutations.push(...this.permuteColumn(row, newColumns, column + 1))
      }
      return permutations
    }
    return this.permuteColumn(row, columns, column + 1)
  }

  buildOverridenPermuteColumns(row: Row, permuteColumns: Foot[][]): Foot[][] {
    if (this.hasBeatOverride(row.beat)) {
      const updatedPermuteColumns: Foot[][] = []
      const overrides: Foot[] = this.getBeatOverride(row.beat)
      for (const pc of permuteColumns) {
        const updatedPc: Foot[] = [...pc]

        for (let c = 0; c < this.layout.columnCount; c++) {
          const noteOverride = overrides[c]
          if (noteOverride != Foot.NONE) {
            updatedPc[c] = noteOverride
          }
        }

        // Check that this updated permuteColumn doesn't have something wacky like
        // two left heels
        if (
          countOfItem(updatedPc, Foot.LEFT_HEEL) > 1 ||
          countOfItem(updatedPc, Foot.LEFT_TOE) > 1 ||
          countOfItem(updatedPc, Foot.RIGHT_HEEL) > 1 ||
          countOfItem(updatedPc, Foot.RIGHT_TOE) > 1
        ) {
          continue
        }
        if (
          updatedPermuteColumns.filter(u => arraysAreEqual(u, updatedPc))
            .length > 0
        ) {
          continue
        }
        updatedPermuteColumns.push(updatedPc)
      }

      // Sanity check that we have at least one valid permutation
      if (updatedPermuteColumns.length == 0) {
        console.warn(
          `Could not generate any valid permutations with parity overrides for row at beat ${row.beat}, clearing overrides, as there must be something invalid about it.`
        )
        this.removeBeatOverride(row.beat)
        return permuteColumns
      } else {
        return updatedPermuteColumns
      }
    }
    return permuteColumns
  }

  createRows(notedata: Notedata) {
    let activeHolds: (HoldNotedataEntry | undefined)[] = []
    let lastColumnSecond: number | null = null
    let lastColumnBeat: number | null = null
    let notes: NotedataEntry[] = []
    let mines: (number | undefined)[] = []
    let fakeMines: (number | undefined)[] = []
    let nextMines: (number | undefined)[] = []
    let nextFakeMines: (number | undefined)[] = []
    const rows: Row[] = []
    for (const note of notedata) {
      if (note.type == "Mine") {
        if (note.second == lastColumnSecond && rows.length > 0) {
          if (note.fake) {
            nextFakeMines[note.col] = note.second
          } else {
            nextMines[note.col] = note.second
          }
        } else {
          if (note.fake) {
            fakeMines[note.col] = note.second
          } else {
            mines[note.col] = note.second
          }
        }
        continue
      }
      if (note.fake) continue
      if (lastColumnSecond != note.second) {
        if (lastColumnSecond != null && lastColumnBeat != null) {
          rows.push({
            notes,
            holds: activeHolds.map(hold => {
              if (hold === undefined || hold.second >= lastColumnSecond!)
                return undefined
              return hold
            }),
            holdTails: new Set(
              activeHolds
                .filter(hold => {
                  if (hold === undefined) return false
                  if (
                    Math.abs(hold.beat + hold.hold - lastColumnBeat!) > 0.0005
                  ) {
                    return false
                  }
                  return true
                })
                .map(hold => hold!.col)
            ),
            mines: nextMines,
            fakeMines: nextFakeMines,
            second: lastColumnSecond,
            beat: lastColumnBeat,
          })
        }
        lastColumnSecond = note.second
        lastColumnBeat = note.beat
        notes = []
        nextMines = mines
        nextFakeMines = fakeMines
        mines = []
        fakeMines = []
        activeHolds = activeHolds.map(hold => {
          if (hold === undefined || note.beat > hold.beat + hold.hold)
            return undefined
          return hold
        })
      }
      notes[note.col] = note
      if (isHoldNote(note)) {
        activeHolds[note.col] = note
      }
    }
    rows.push({
      notes,
      holds: activeHolds.map(hold => {
        if (hold === undefined || hold.second >= lastColumnSecond!)
          return undefined
        return hold
      }),
      holdTails: new Set(
        activeHolds
          .filter(hold => {
            if (hold === undefined) return false
            if (Math.abs(hold.beat + hold.hold - lastColumnBeat!) > 0.0005) {
              return false
            }
            return true
          })
          .map(hold => hold!.col)
      ),
      mines: nextMines,
      fakeMines: nextFakeMines,
      second: lastColumnSecond!,
      beat: lastColumnBeat!,
    })

    return rows
  }

  generateParities(use_overrides: boolean, notedata: Notedata): Foot[][] {
    const rows = this.createRows(notedata)

    const graph = this.buildStateGraph(rows, use_overrides)
    const states = this.selectStatesForRows(graph, rows.length)
    const parities = states.map(s => s.columns)
    this.setNoteParity(rows, parities)
    return parities
  }

  selectStatesForRows(graph: StepParityGraph, rowCount: number): State[] {
    const nodes_for_rows = graph.computeCheapestPath()
    const states: State[] = []
    for (let i = 0; i < rowCount; i++) {
      const node = graph.nodes[nodes_for_rows[i]]
      states.push(node.state)
    }

    return states
  }

  setNoteParity(rows: Row[], parities: Foot[][]) {
    for (let i = 0; i < rows.length; i++) {
      const parityForRow = parities[i]
      for (let j = 0; j < this.layout.columnCount; j++) {
        if (rows[i].notes[j]) {
          rows[i].notes[j]!.parity = FEET_LABEL[FEET.indexOf(parityForRow[j])]
          rows[i].notes[j]!.parityOverride = this.hasBeatOverride(rows[i].beat)
        }
      }
    }
  }

  // Generates a StepParityGraph from the given array of Rows.
  // The graph inserts two additional nodes: one that represent the beginning of the song, before the first note,
  // and one that represents the end of the song, after the final note.
  buildStateGraph(rows: Row[], use_overrides: boolean): StepParityGraph {
    const graph: StepParityGraph = new StepParityGraph()
    const beginningState: State = new State(-1, rows[0].second - 1, -1, [])

    const startNode: StepParityNode = graph.addOrGetExistingNode(beginningState)
    graph.startNode = startNode.id

    const previousStates: Array<State> = []
    previousStates.push(beginningState)

    for (let i = 0; i < rows.length; i++) {
      const uniqueNodeIdxs = new Set<number>()
      while (previousStates.length > 0) {
        const state = previousStates.shift()!
        const initialNode = graph.addOrGetExistingNode(state)
        let permuteColumns: Foot[][] = this.getPermuteColumns(rows[i])
        if (use_overrides && this.hasBeatOverride(rows[i].beat)) {
          permuteColumns = this.buildOverridenPermuteColumns(
            rows[i],
            permuteColumns
          )
        }

        for (const columns of permuteColumns) {
          const resultState: State = this.initResultState(
            state,
            rows[i],
            i,
            columns
          )
          const cost = this.costCalculator.getActionCost(
            state,
            resultState,
            rows,
            i
          )
          const resultNode = graph.addOrGetExistingNode(resultState)
          graph.addEdge(initialNode, resultNode, cost)

          uniqueNodeIdxs.add(resultNode.id)
        }
      }

      for (const nodeIdx of uniqueNodeIdxs) {
        previousStates.push(graph.nodes[nodeIdx].state)
      }
    }

    // at this point, previousStates holds all of the states for the very last row,
    // which just get connected to the endState

    const endState: State = new State(
      rows.length,
      rows[rows.length - 1].second + 1,
      rows[rows.length - 1].beat + 1,
      []
    )

    const endNode = graph.addOrGetExistingNode(endState)
    graph.endNode = endNode.id
    while (previousStates.length > 0) {
      const state = previousStates.shift()!
      const node = graph.addOrGetExistingNode(state)
      graph.addEdge(node, endNode, { TOTAL: 0 })
    }

    return graph
  }

  // Creates a new State, which is the result of moving from the given
  // initialState to the steps of the given row with the given foot
  // placements in columns.
  initResultState(
    initialState: State,
    row: Row,
    rowIndex: number,
    columns: Foot[]
  ): State {
    const resultState: State = new State(
      rowIndex,
      row.second,
      row.beat,
      columns
    )

    for (let i = 0; i < this.layout.columnCount; i++) {
      resultState.combinedColumns.push(Foot.NONE)
      if (columns[i] == undefined) {
        continue
      }

      if (row.holds[i] == undefined) {
        resultState.movedFeet.add(columns[i])
      } else if (initialState.combinedColumns[i] != columns[i]) {
        resultState.movedFeet.add(columns[i])
      }
      if (row.holds[i] != undefined) {
        resultState.holdFeet.add(columns[i])
      }
    }

    return resultState
  }

  //
  // Methods for checking/setting overrides
  //

  hasBeatOverride(beat: number): boolean {
    const beatStr = beat.toFixed(3)
    if (this.beatOverrides[beatStr] != undefined) {
      for (const f of this.beatOverrides[beatStr]) {
        if (f != Foot.NONE) {
          return true
        }
      }
    }
    return false
  }

  getBeatOverride(beat: number): Foot[] {
    const beatStr = beat.toFixed(3)
    if (this.beatOverrides[beatStr] != undefined) {
      return this.beatOverrides[beatStr]
    }
    const empty: Array<Foot> = []
    for (let i = 0; i < this.layout.columnCount; i++) {
      empty.push(Foot.NONE)
    }
    return empty
  }

  getNoteOverride(beat: number, col: number): Foot {
    const beatStr = beat.toFixed(3)
    if (this.beatOverrides[beatStr] != undefined) {
      return this.beatOverrides[beatStr][col]
    }
    return Foot.NONE
  }

  addNoteOverride(beat: number, col: number, foot: Foot): boolean {
    const beatStr = beat.toFixed(3)
    if (this.beatOverrides[beatStr] == undefined) {
      this.beatOverrides[beatStr] = new Array(this.layout.columnCount).fill(
        Foot.NONE
      )
    }
    // Check that this row doesn't already contain an override for the given foot. If so, return false
    if (
      foot != Foot.NONE &&
      this.beatOverrides[beatStr][col] != foot &&
      this.beatOverrides[beatStr].includes(foot)
    ) {
      return false
    }
    this.beatOverrides[beatStr][col] = foot
    return true
  }

  addRowOverride(beat: number, feet: Foot[]): boolean {
    const beatStr = beat.toFixed(3)
    const footCount: { [key: number]: number } = {}
    let totalCount = 0
    for (const foot of feet) {
      footCount[foot] = (footCount[foot] || 0) + 1
      totalCount += 1
      if (foot != Foot.NONE && footCount[foot] > 1) {
        return false
      }
    }
    if (totalCount == 0) {
      return false
    }

    this.beatOverrides[beatStr] = feet
    return true
  }

  removeNoteOverride(beat: number, col: number): boolean {
    const beatStr = beat.toFixed(3)
    if (this.beatOverrides[beatStr] != undefined) {
      this.beatOverrides[beatStr][col] = Foot.NONE
    }
    return true
  }

  removeBeatOverride(beat: number): boolean {
    const beatStr = beat.toFixed(3)
    delete this.beatOverrides[beatStr]
    return true
  }

  resetBeatOverrides() {
    this.beatOverrides = {}
  }

  // Returns rows that differ between p1 and p2
  // For a given row, the values of p2 that differ from p1 are returned
  // For examples, given p1 = [[0010], [3100]], p2 = [[0010], [2100]]
  // returns {1: [2000]}
  getParityDifferences(p1: Foot[][], p2: Foot[][]): { [key: number]: Foot[] } {
    const rowDifferences: { [key: number]: Foot[] } = {}

    for (let r = 0; r < p1.length; r++) {
      const diffs: Foot[] = []
      let hasDifference: boolean = false
      for (let c = 0; c < p1[r].length; c++) {
        if (p1[r][c] != p2[r][c]) {
          diffs.push(p2[r][c])
          hasDifference = true
        } else {
          diffs.push(Foot.NONE)
        }
      }
      if (hasDifference) {
        rowDifferences[r] = diffs
      }
    }
    return rowDifferences
  }
}

function arraysAreEqual<T>(array1: T[], array2: T[]): boolean {
  if (array1.length !== array2.length) {
    return false
  }

  for (let i = 0; i < array1.length; i++) {
    if (array1[i] !== array2[i]) {
      return false
    }
  }

  return true
}

function countOfItem<T>(array: T[], item: T): number {
  return array.filter(a => a == item).length
}