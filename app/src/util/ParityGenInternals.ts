// This is most of the internals for ParityGenerator,
// as much of it as I can separate from the rest of the SMEditor code.
// I wanted to do this so that I could port the parity generating stuff
// into something I could more easily run from commandline.

// Generates foot parity given notedata
// Original algorithm by Jewel, polished by tillvit
// Generates foot parity given notedata
// Original algorithm by Jewel, polished by tillvit

import { LAYOUT, StagePoint } from "./StageLayouts"
import {
  HoldNotedataEntry,
  Notedata,
  NotedataEntry,
  isHoldNote,
} from "../chart/sm/NoteTypes"

import {
  Foot,
  FootPlacement,
  State,
  SerializableState,
  Row,
  StepParityNode,
  SerializableNode,
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
  private isEnabled: boolean = false

  private beatOverrides: { [key: string]: Foot[] } = {}
  private lastGraph?: StepParityGraph
  private lastStates?: State[]
  private lastParities: Foot[][] = []

  constructor(type: string) {
    this.layout = LAYOUT[type]
    this.costCalculator = new ParityCostCalculator(type)
  }

  help() {
    console.log(`Currently only compatible with dance-single.
Available commands: 
analyze(): analyze the current chart
  
clear(): clear parity highlights`)
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

  private isAnalyzing: boolean = false
  analyze(notedata: Notedata) {
    if (this.isAnalyzing) {
      return
    }
    this.isAnalyzing = true
    const rows = this.createRows(notedata)

    const graph = this.buildStateGraph(rows, true)
    const states = this.selectStatesForRows(graph, rows.length)
    const parities = states.map(s => s.columns)
    this.setNoteParity(rows, parities)
    this.lastGraph = graph
    this.lastStates = states
    this.lastParities = parities
    this.isAnalyzing = false
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
    const beginningState: State = {
      idx: -1,
      rowIndex: -1,
      second: rows[0].second - 1,
      beat: -1,
      columns: [],
      combinedColumns: [],
      movedFeet: new Set(),
      holdFeet: new Set(),
    }

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

    const endState: State = {
      idx: -1,
      rowIndex: rows.length,
      second: rows[rows.length - 1].second + 1,
      beat: rows[rows.length - 1].beat + 1,
      columns: [],
      combinedColumns: [],
      movedFeet: new Set(),
      holdFeet: new Set(),
    }
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
    const resultState: State = {
      idx: -1,
      rowIndex: rowIndex,
      second: row.second,
      beat: row.beat,
      columns: columns,
      combinedColumns: [],
      movedFeet: new Set(),
      holdFeet: new Set(),
    }

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

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
  }

  getIsEnabled(): boolean {
    return this.isEnabled
  }

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

  getParityForBeat(beat: number): Foot[] | undefined {
    if (this.lastStates == undefined) {
      return undefined
    }
    for (const state of this.lastStates) {
      if (Math.abs(state.beat - beat) < 0.0001) {
        return state.columns
      }
      if (state.beat > beat) {
        break
      }
    }
    return undefined
  }

  getNodeForBeat(beat: number): StepParityNode | undefined {
    if (this.lastGraph == undefined || this.lastStates == undefined) {
      return undefined
    }

    for (const state of this.lastStates) {
      if (Math.abs(state.beat - beat) < 0.0001) {
        return this.lastGraph.addOrGetExistingNode(state)
      }
      if (state.beat > beat) {
        break
      }
    }
    return undefined
  }

  getAllNodesForBeat(beat: number): StepParityNode[] {
    if (this.lastGraph == undefined) {
      return []
    }

    const nodes: StepParityNode[] = []

    for (const node of this.lastGraph.nodes) {
      if (Math.abs(node.state.beat - beat) < 0.0001) {
        nodes.push(node)
      } else if (node.state.beat > beat) {
        break
      }
    }
    return nodes
  }

  getAllNodesForRow(row: number): StepParityNode[] {
    if (this.lastGraph == undefined) {
      return []
    }

    const nodes: StepParityNode[] = []

    for (const node of this.lastGraph.nodes) {
      if (node.state.rowIndex == row) {
        nodes.push(node)
      } else if (node.state.rowIndex > row) {
        break
      }
    }
    return nodes
  }

  // Loads pre-calculated note parity data from json string
  loadParityData(jsonString: string, notedata: Notedata): boolean {
    const rows = this.createRows(notedata)
    const parities = this.deserializeParityData(jsonString)
    if (parities == undefined) {
      return false
    }
    const paritiesWithoutOverrides = this.generateParities(false, notedata)

    // This is mostly a sanity check
    if (
      parities.length != rows.length ||
      parities.length != paritiesWithoutOverrides.length
    ) {
      return false
    }

    // Now that we've loaded the json data, we need to figure out if it represents any
    // notes that were overridden.
    const rowDifferences = this.getParityDifferences(
      paritiesWithoutOverrides,
      parities
    )
    // And then map those differences to beat instead of row

    const beatDifferences: { [key: string]: Foot[] } = {}
    for (const rowIndex in rowDifferences) {
      const beatStr = rows[rowIndex].beat.toFixed(3)
      beatDifferences[beatStr] = rowDifferences[rowIndex]
    }
    this.lastParities = parities
    this.beatOverrides = beatDifferences
    this.setNoteParity(rows, this.lastParities)
    return true
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

  // This just returns the `columns` for each row, indicating the position of
  // each foot for a given row
  serializeParityData(indent: boolean = false): string {
    return JSON.stringify(this.lastParities, null, indent ? 2 : undefined)
  }

  deserializeParityData(jsonString: string): Foot[][] | undefined {
    try {
      const deserialized: Foot[][] = JSON.parse(jsonString)
      return deserialized
    } catch (e) {
      return undefined
    }
  }

  serializeStepGraph(indent: boolean = false): string {
    if (this.lastGraph != undefined) {
      const serializableStepGraph = {
        states: this.statesToSerializedStates(this.lastGraph.states),
        nodes: this.lastGraph.nodes.map(n => n.serialized()),
      }
      return JSON.stringify(serializableStepGraph, null, indent ? 2 : undefined)
    }
    return ""
  }

  statesToSerializedStates(states: State[]): SerializableState[] {
    const serializableStates: Array<SerializableState> = []
    for (const state of states) {
      serializableStates.push(this.stateToSerializedState(state))
    }
    return serializableStates
  }

  stateToSerializedState(state: State): SerializableState {
    const serializableState: SerializableState = {
      idx: state.idx,
      beat: state.beat,
      combinedColumns: state.combinedColumns,
      columns: state.columns,
      movedFeet: [...state.movedFeet],
      holdFeet: [...state.holdFeet],
      second: state.second,
      rowIndex: state.rowIndex,
    }
    return serializableState
  }

  compareCols(a: number[], b: number[]) {
    if (a === b) return true
    if (a == null || b == null) return false
    if (a.length !== b.length) return false

    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  getWeights(): { [key: string]: number } {
    return this.costCalculator.getWeights()
  }

  getDefaultWeights(): { [key: string]: number } {
    return this.costCalculator.getDefaultWeights()
  }

  updateWeights(newWeights: { [key: string]: number }) {
    this.costCalculator.updateWeights(newWeights)
  }

  resetWeights() {
    this.costCalculator.resetWeights()
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

function setsAreEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
  if (set1.size !== set2.size) {
    return false
  }
  for (const item of set1) {
    if (!set2.has(item)) {
      return false
    }
  }
  return true
}

function countOfItem<T>(array: T[], item: T): number {
  return array.filter(a => a == item).length
}
