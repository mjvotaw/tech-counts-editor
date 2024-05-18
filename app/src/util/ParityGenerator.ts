// Generates foot parity given notedata
// Original algorithm by Jewel, polished by tillvit

import { App } from "../App"
import { EventHandler } from "./EventHandler"
import { LAYOUT } from "./StageLayouts"

import {
  Foot,
  State,
  StepParityGraph,
  SerializableState,
  StepParityNode,
  Row,
} from "./ParityDataTypes"
import { ParityGenInternal, FEET, FEET_LABEL } from "./ParityGenInternals"

export class ParityGenerator {
  private readonly app
  private layout
  private parityGenInternal: ParityGenInternal
  private isEnabled: boolean = false

  private beatOverrides: { [key: string]: Foot[] } = {}
  private lastGraph?: StepParityGraph
  private lastStates?: State[]
  private lastParities: Foot[][] = []

  private DEFAULT_WEIGHTS: { [key: string]: number } = {
    DOUBLESTEP: 850,
    BRACKETJACK: 20,
    JACK: 30,
    JUMP: 30,
    BRACKETTAP: 400,
    HOLDSWITCH: 55,
    MINE: 10000,
    FOOTSWITCH: 5000,
    MISSED_FOOTSWITCH: 500,
    FACING: 2,
    DISTANCE: 6,
    SPIN: 1000,
    SIDESWITCH: 130,
    BADBRACKET: 40,
  }

  private WEIGHTS: { [key: string]: number } = {
    DOUBLESTEP: 850,
    BRACKETJACK: 20,
    JACK: 30,
    JUMP: 30,
    BRACKETTAP: 400,
    HOLDSWITCH: 55,
    MINE: 10000,
    FOOTSWITCH: 5000,
    MISSED_FOOTSWITCH: 500,
    FACING: 2,
    DISTANCE: 6,
    SPIN: 1000,
    SIDESWITCH: 130,
    BADBRACKET: 40,
  }

  constructor(app: App, type: string) {
    this.app = app
    this.layout = LAYOUT[type]
    this.parityGenInternal = new ParityGenInternal(type)
  }

  help() {
    console.log(`Currently only compatible with dance-single.
Available commands: 
analyze(): analyze the current chart
  
clear(): clear parity highlights`)
  }

  private isAnalyzing: boolean = false
  analyze() {
    if (this.isAnalyzing) {
      return
    }
    const notedata = this.app.chartManager.loadedChart?.getNotedata()
    if (!notedata) return
    this.isAnalyzing = true
    const { graph, selectedStates, parities } = this.parityGenInternal.analyze(
      notedata,
      this.beatOverrides,
      this.WEIGHTS
    )
    this.lastGraph = graph
    this.lastStates = selectedStates
    this.lastParities = parities

    this.isAnalyzing = false
    EventHandler.emit("parityUpdated")
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
  }

  getIsEnabled(): boolean {
    return this.isEnabled
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

  //
  // Retrieving various data by beat/row
  //

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
  loadParityData(jsonString: string): boolean {
    const notedata = this.app.chartManager.loadedChart?.getNotedata()
    if (!notedata) return false
    const rows = this.parityGenInternal.createRows(notedata)
    const parities = this.deserializeParityData(jsonString)
    if (parities == undefined) {
      return false
    }
    const paritiesWithoutOverrides = this.parityGenInternal.generateParities(
      false,
      notedata
    )

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
      return this.lastGraph.serialized(indent)
    }
    return ""
  }

  clear() {
    const notedata = this.app.chartManager.loadedChart?.getNotedata()
    if (!notedata) return
    notedata.forEach(note => (note.parity = undefined))
  }

  //
  // Getting/setting weights
  //

  getWeights(): { [key: string]: number } {
    const weightsCopy: { [key: string]: number } = JSON.parse(
      JSON.stringify(this.WEIGHTS)
    )
    return weightsCopy
  }

  getDefaultWeights(): { [key: string]: number } {
    const weightsCopy: { [key: string]: number } = JSON.parse(
      JSON.stringify(this.DEFAULT_WEIGHTS)
    )
    return weightsCopy
  }

  updateWeights(newWeights: { [key: string]: number }) {
    for (const k in this.WEIGHTS) {
      this.WEIGHTS[k] = newWeights[k] || this.WEIGHTS[k]
    }
  }

  resetWeights() {
    this.updateWeights(this.DEFAULT_WEIGHTS)
  }
}
