import { BitmapText, Container, Rectangle, Sprite, Texture } from "pixi.js"
import { Widget } from "./Widget"
import { WidgetManager } from "./WidgetManager"
import { EventHandler } from "../../util/EventHandler"
import stageArrowUrl from "../../../assets/stage/StageArrow.png"
import { HoldNotedataEntry } from "../../chart/sm/NoteTypes"
import { Options } from "../../util/Options"

export class StageWidget extends Widget {
  stage: Sprite = new Sprite(Texture.WHITE)
  arrows: Container[] = []
  arrowFlashes: Container[] = []

  private lastBeatCrossed: number = -1
  private lastNoteDataIndex: number = 0
  private stageLightsBeatsLeft: number[] = []

  private LIGHTS_FALLOFF_BEATS: number = 0.125
  private LIGHTS_LOOKAHEAD_BEATS: number = 0.01

  private lastUpdateTime: number = 0

  constructor(manager: WidgetManager) {
    super(manager)
    this.visible = false

    this.buildDanceStage()
    this.stage.tint = 0x525252
    this.stage.width = 300
    this.stage.height = 300
    this.stage.x = 0
    this.stage.y = 0

    this.addChild(this.stage)
    this.buildDanceStage()
    this.setupEventHandlers()
  }

  update() {
    let isVisible = false
    if (
      this.manager.chartManager.chartView &&
      Options.experimental.showDanceStage
    ) {
      isVisible = true
    }
    this.visible = isVisible

    this.x = (this.manager.app.renderer.screen.width / 2) * -1 + 100
    this.y = (this.manager.app.renderer.screen.height / 2) * -1 + 100
    if (!isVisible) {
      return
    }

    const currentTime = new Date().getTime()
    if (this.lastUpdateTime == 0) {
      this.lastUpdateTime = currentTime
      return
    }
    const timeDelta = (currentTime - this.lastUpdateTime) / 1000
    const beatDelta = this.manager.chartManager.getBeat() - this.lastBeatCrossed
    if (this.manager.chartManager.chartAudio.isPlaying()) {
      this.updateStageLights()

      for (let i = 0; i < this.arrowFlashes.length; i++) {
        if (this.stageLightsBeatsLeft[i] > 0) {
          this.arrowFlashes[i].alpha = 1
        } else {
          this.arrowFlashes[i].alpha = Math.max(
            0,
            this.arrowFlashes[i].alpha - beatDelta * 3
          )
        }
      }
    }
    this.lastUpdateTime = currentTime
  }

  private setupEventHandlers() {
    EventHandler.on("chartLoaded", () => {})

    EventHandler.on("playbackStop", () => {
      this.stageLightsBeatsLeft = [0, 0, 0, 0]
    })
    EventHandler.on("playbackStart", () => {})
  }

  private updateStageLights() {
    // TODO: make this work for other layouts

    if (
      !this.manager.chartManager.chartAudio.isPlaying() ||
      this.manager.chartManager.loadedChart == undefined
    ) {
      return
    }

    const currentBeat = this.manager.chartManager.getBeat()
    const notes = this.manager.chartManager.loadedChart.getNotedata()
    let beatDelta = currentBeat - this.lastBeatCrossed
    if (notes.length == 0) {
      return
    }

    // If the user scrolled backwards, reset lastNoteDataIndex to the note just before the current beat
    if (currentBeat < this.lastBeatCrossed) {
      this.lastNoteDataIndex = Math.max(
        0,
        notes.findIndex(n => n.beat >= currentBeat) - 1
      )
      beatDelta = 0
    }

    // Update the amount of time left to display previous note flashes
    for (let i = 0; i < this.stageLightsBeatsLeft.length; i++) {
      this.stageLightsBeatsLeft[i] = Math.max(
        0,
        this.stageLightsBeatsLeft[i] - beatDelta
      )
    }

    // And if the current beat isn't past the last note, update any flashes that need to play
    if (currentBeat <= notes.at(-1)!.beat) {
      for (let index = this.lastNoteDataIndex; index < notes.length; index++) {
        const note = notes[index]

        if (note.beat > currentBeat + this.LIGHTS_LOOKAHEAD_BEATS) {
          this.lastNoteDataIndex = index
          break
        }
        if (note.fake) {
          continue
        }

        if (note.type == "Tap") {
          this.stageLightsBeatsLeft[notes[index].col] =
            this.LIGHTS_FALLOFF_BEATS
        } else if (note.type == "Hold" || note.type == "Roll") {
          this.stageLightsBeatsLeft[notes[index].col] = (
            note as HoldNotedataEntry
          ).hold
        }
      }
    }
    this.lastBeatCrossed = currentBeat
  }

  private buildDanceStage() {
    // TODO: change stages when layout changes

    for (const arrow of this.arrows) {
      arrow.removeFromParent()
    }

    this.arrows = []

    const leftArrow = this.makeArrow(0, 100, 0, 0.5)
    const downArrow = this.makeArrow(100, 200, 1.5, 0.5)
    const upArrow = this.makeArrow(100, 0, 0.5, 0.5)
    const rightArrow = this.makeArrow(200, 100, 1, 0.5)
    this.addChild(leftArrow)
    this.addChild(downArrow)
    this.addChild(upArrow)
    this.addChild(rightArrow)

    const leftArrowFlash = this.makeArrow(0, 100, 0, 0)
    const downArrowFlash = this.makeArrow(100, 200, 1.5, 0)
    const upArrowFlash = this.makeArrow(100, 0, 0.5, 0)
    const rightArrowFlash = this.makeArrow(200, 100, 1, 0)
    this.addChild(leftArrowFlash)
    this.addChild(downArrowFlash)
    this.addChild(upArrowFlash)
    this.addChild(rightArrowFlash)

    this.arrowFlashes = [
      leftArrowFlash,
      downArrowFlash,
      upArrowFlash,
      rightArrowFlash,
    ]
    this.stageLightsBeatsLeft = [0, 0, 0, 0]
  }

  private makeArrow(
    x: number,
    y: number,
    rotation: number,
    alpha: number
  ): Container {
    const arrowSprite = Sprite.from(stageArrowUrl, { width: 256, height: 256 })
    arrowSprite.width = 100
    arrowSprite.height = 100
    arrowSprite.anchor.set(0.5)
    arrowSprite.rotation = rotation * Math.PI

    const arrowContainer = new Container()
    arrowContainer.x = x + 50
    arrowContainer.y = y + 50
    arrowContainer.addChild(arrowSprite)
    arrowContainer.alpha = alpha
    return arrowContainer
  }
}
