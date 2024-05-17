// Generates foot parity given notedata
// Original algorithm by Jewel, polished by tillvit

import { App } from "../App"
import { EventHandler } from "./EventHandler"

import {
  Foot,
  State,
  SerializableState,
  StepParityNode,
} from "./ParityDataTypes"
import { ParityGenInternal } from "./ParityGenInternals"

export const FEET = [
  Foot.LEFT_HEEL,
  Foot.LEFT_TOE,
  Foot.RIGHT_HEEL,
  Foot.RIGHT_TOE,
]
export const FEET_LABEL = "LlRr"

export class ParityGenerator {
  private readonly app
  private parityGenInternal: ParityGenInternal
  private isEnabled: boolean = false

  constructor(app: App, type: string) {
    this.app = app
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
    this.parityGenInternal.analyze(notedata)
    this.isAnalyzing = false
    EventHandler.emit("parityUpdated")
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
  }

  getIsEnabled(): boolean {
    return this.isEnabled
  }

  hasBeatOverride(beat: number): boolean {
    return this.parityGenInternal.hasBeatOverride(beat)
  }

  getBeatOverride(beat: number): Foot[] {
    return this.parityGenInternal.getBeatOverride(beat)
  }

  getNoteOverride(beat: number, col: number): Foot {
    return this.parityGenInternal.getNoteOverride(beat, col)
  }

  addNoteOverride(beat: number, col: number, foot: Foot): boolean {
    return this.parityGenInternal.addNoteOverride(beat, col, foot)
  }

  addRowOverride(beat: number, feet: Foot[]): boolean {
    return this.parityGenInternal.addRowOverride(beat, feet)
  }

  removeNoteOverride(beat: number, col: number): boolean {
    return this.parityGenInternal.removeNoteOverride(beat, col)
  }

  removeBeatOverride(beat: number): boolean {
    return this.parityGenInternal.removeBeatOverride(beat)
  }

  resetBeatOverrides() {
    this.parityGenInternal.resetBeatOverrides()
  }

  getParityForBeat(beat: number): Foot[] | undefined {
    return this.parityGenInternal.getParityForBeat(beat)
  }

  getNodeForBeat(beat: number): StepParityNode | undefined {
    return this.parityGenInternal.getNodeForBeat(beat)
  }

  getAllNodesForBeat(beat: number): StepParityNode[] {
    return this.parityGenInternal.getAllNodesForBeat(beat)
  }

  getAllNodesForRow(row: number): StepParityNode[] {
    return this.parityGenInternal.getAllNodesForRow(row)
  }

  // Loads pre-calculated note parity data from json string
  loadParityData(jsonString: string): boolean {
    const notedata = this.app.chartManager.loadedChart?.getNotedata()
    if (!notedata) return false
    return this.parityGenInternal.loadParityData(jsonString, notedata)
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
    return this.parityGenInternal.serializeParityData(indent)
  }

  deserializeParityData(jsonString: string): Foot[][] | undefined {
    return this.parityGenInternal.deserializeParityData(jsonString)
  }

  serializeStepGraph(indent: boolean = false): string {
    return this.parityGenInternal.serializeStepGraph(indent)
  }

  statesToSerializedStates(states: State[]): SerializableState[] {
    return this.parityGenInternal.statesToSerializedStates(states)
  }

  stateToSerializedState(state: State): SerializableState {
    return this.parityGenInternal.stateToSerializedState(state)
  }

  clear() {
    const notedata = this.app.chartManager.loadedChart?.getNotedata()
    if (!notedata) return
    notedata.forEach(note => (note.parity = undefined))
  }

  getWeights(): { [key: string]: number } {
    return this.parityGenInternal.costCalculator.getWeights()
  }

  getDefaultWeights(): { [key: string]: number } {
    return this.parityGenInternal.costCalculator.getDefaultWeights()
  }

  updateWeights(newWeights: { [key: string]: number }) {
    this.parityGenInternal.costCalculator.updateWeights(newWeights)
  }

  resetWeights() {
    this.parityGenInternal.costCalculator.resetWeights()
  }
}
