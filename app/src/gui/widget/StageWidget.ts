import {
  BitmapText,
  Container,
  Graphics,
  IPointData,
  ObservablePoint,
  Rectangle,
  Sprite,
  Texture,
} from "pixi.js"
import { Widget } from "./Widget"
import { WidgetManager } from "./WidgetManager"
import { EventHandler } from "../../util/EventHandler"
import stageArrowUrl from "../../../assets/stage/StageArrow.png"
import footUrl from "../../../assets/stage/LeftFoot.png"
import { HoldNotedataEntry } from "../../chart/sm/NoteTypes"
import { Options } from "../../util/Options"

export class StageWidget extends Widget {
  stage: Sprite = new Sprite(Texture.WHITE)
  arrowFlashes: Container[] = []

  leftFoot: Container = new Container()
  rightFoot: Container = new Container()

  private lastBeatCrossed: number = -1
  private lastNoteDataIndex: number = 0
  private stageLightsBeatsLeft: number[] = []

  private LIGHTS_FALLOFF_BEATS: number = 0.125
  private LIGHTS_LOOKAHEAD_BEATS: number = 0.01

  private MIN_ROTATION: number = -0.5 * Math.PI
  private MAX_ROTATION: number = 0.5 * Math.PI

  private lastUpdateTime: number = 0

  constructor(manager: WidgetManager) {
    super(manager)
    this.visible = false

    this.stage.tint = 0x525252
    this.stage.width = 300
    this.stage.height = 300
    this.stage.x = 0
    this.stage.y = 0

    this.addChild(this.stage)
    this.buildDanceStage()
    this.buildFeet()
    this.setupEventHandlers()
  }

  update() {
    let isVisible = true
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

    const showFeet = window.Parity?.getIsEnabled() || false

    const currentTime = new Date().getTime()
    if (this.lastUpdateTime == 0) {
      this.lastUpdateTime = currentTime
      return
    }

    const currentBeat = this.manager.chartManager.getBeat()
    const beatDelta = currentBeat - this.lastBeatCrossed
    if (beatDelta != 0) {
      this.updateStage(currentBeat, showFeet)

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

      this.leftFoot.visible = showFeet
      this.rightFoot.visible = showFeet
    }
    this.lastUpdateTime = currentTime
    this.lastBeatCrossed = currentBeat
  }

  private setupEventHandlers() {
    EventHandler.on("chartLoaded", () => {
      this.reset()
    })

    EventHandler.on("playbackStop", () => {
      this.stageLightsBeatsLeft = [0, 0, 0, 0]
    })
    EventHandler.on("playbackStart", () => {
      console.log(
        `playbackStart: current beat: ${this.manager.chartManager.getBeat()}, last beat: ${
          this.lastBeatCrossed
        }, last index: ${this.lastNoteDataIndex}`
      )
    })
  }

  private updateStage(currentBeat: number, showFeet: boolean) {
    // TODO: make this work for other layouts

    if (this.manager.chartManager.loadedChart == undefined) {
      return
    }

    const notes = this.manager.chartManager.loadedChart.getNotedata()
    let beatDelta = currentBeat - this.lastBeatCrossed
    if (notes.length == 0) {
      return
    }

    // If the user scrolled backwards, reset lastNoteDataIndex to the note just before the current beat
    if (currentBeat < this.lastBeatCrossed) {
      console.log(
        `currentBeat ${currentBeat} < last beat: ${this.lastBeatCrossed}, previous index: ${this.lastNoteDataIndex}`
      )
      this.lastNoteDataIndex = Math.max(
        0,
        notes.findIndex(n => n.beat >= currentBeat - 1) - 1
      )
      beatDelta = 0
      console.log(`new index: ${this.lastNoteDataIndex}`)
    }

    // Update the amount of time left to display previous note flashes
    for (let i = 0; i < this.stageLightsBeatsLeft.length; i++) {
      this.stageLightsBeatsLeft[i] = Math.max(
        0,
        this.stageLightsBeatsLeft[i] - beatDelta
      )
    }

    // And if the current beat isn't past the last note, update any flashes that need to play
    let leftHeel = -1
    let leftToe = -1
    let rightHeel = -1
    let rightToe = -1

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

        if (["Tap", "Hold", "Roll"].includes(note.type)) {
          if (note.type == "Hold" || note.type == "Roll") {
            this.stageLightsBeatsLeft[notes[index].col] = (
              note as HoldNotedataEntry
            ).hold
          } else {
            this.stageLightsBeatsLeft[notes[index].col] =
              this.LIGHTS_FALLOFF_BEATS
          }

          if (showFeet && note.parity != undefined) {
            switch (note.parity) {
              case "L":
                leftHeel = note.col
                break
              case "l":
                leftToe = note.col
                break
              case "R":
                rightHeel = note.col
                break
              case "r":
                rightToe = note.col
                break
            }
          }
        }
      }
    }

    if (showFeet) {
      const previousLeftPos = this.leftFoot.position
      const previousRightPos = this.rightFoot.position
      let newLeftPos: IPointData = this.leftFoot.position
      let newRightPos: IPointData = this.rightFoot.position

      if (leftHeel > -1 && leftToe > -1) {
        newLeftPos = this.midpoint(
          this.arrowFlashes[leftHeel].position,
          this.arrowFlashes[leftToe].position
        )
        this.leftFoot.rotation = this.getBracketAngle(
          this.arrowFlashes[leftHeel].position,
          this.arrowFlashes[leftToe].position
        )
      } else if (leftHeel > -1) {
        newLeftPos = this.arrowFlashes[leftHeel].position
      }

      if (rightHeel > -1 && rightToe > -1) {
        newRightPos = this.midpoint(
          this.arrowFlashes[rightHeel].position,
          this.arrowFlashes[rightToe].position
        )
        this.rightFoot.rotation = this.getBracketAngle(
          this.arrowFlashes[rightHeel].position,
          this.arrowFlashes[rightToe].position
        )
      } else if (rightHeel > -1) {
        newRightPos = this.arrowFlashes[rightHeel].position
      }

      if (leftHeel > -1 && leftToe == -1) {
        const angle = Math.max(
          this.MIN_ROTATION,
          Math.min(
            this.MAX_ROTATION,
            this.getFeetAngle(newLeftPos, newRightPos)
          )
        )
        this.leftFoot.rotation = angle
      }

      if (rightHeel > -1 && rightToe == -1) {
        const angle = Math.max(
          this.MIN_ROTATION,
          Math.min(
            this.MAX_ROTATION,
            this.getFeetAngle(newLeftPos, newRightPos)
          )
        )
        this.rightFoot.rotation = angle
      }

      this.leftFoot.position.set(newLeftPos.x, newLeftPos.y)
      this.rightFoot.position.set(newRightPos.x, newRightPos.y)
    }
  }

  private reset() {
    this.lastBeatCrossed = -1
    this.lastNoteDataIndex = 0
    for (let i = 0; i < this.stageLightsBeatsLeft.length; i++) {
      this.stageLightsBeatsLeft[i] = 0
    }
  }

  private buildDanceStage() {
    // TODO: change stages when layout changes

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

  private buildFeet() {
    // I don't think I like graphics programming

    const footHeightScale = 100 / 256
    const leftFootSprite = Sprite.from(footUrl, { width: 111, height: 276 })
    leftFootSprite.scale.set(footHeightScale)

    const rightFootSprite = Sprite.from(footUrl, { width: 111, height: 276 })
    rightFootSprite.scale.set(footHeightScale)
    rightFootSprite.anchor.x = 1
    rightFootSprite.scale.x *= -1

    const leftFootColor = new Graphics()
    leftFootColor.beginFill(0x0390fc)
    leftFootColor.drawRect(0, 0, 43, 107)
    leftFootColor.endFill()

    leftFootColor.mask = leftFootSprite

    const rightFootColor = new Graphics()
    rightFootColor.beginFill(0xfcad03)
    rightFootColor.drawRect(0, 0, 43, 107)
    rightFootColor.endFill()

    rightFootColor.mask = rightFootSprite

    this.leftFoot.addChild(leftFootColor)
    this.leftFoot.addChild(leftFootSprite)

    this.rightFoot.addChild(rightFootColor)
    this.rightFoot.addChild(rightFootSprite)

    this.leftFoot.pivot.set(20, 53)
    this.rightFoot.pivot.set(20, 53)

    this.addChild(this.leftFoot)
    this.addChild(this.rightFoot)

    this.leftFoot.visible = false
    this.rightFoot.visible = false
  }

  // Math stuff

  private midpoint(p1: ObservablePoint, p2: ObservablePoint): IPointData {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  }

  private getBracketAngle(p1: IPointData, p2: IPointData): number {
    if (p1.y == p2.y) {
      return 0
    }
    const top = p1.y < p2.y ? p1 : p2
    const bottom = p1.y > p2.y ? p1 : p2

    const dy = Math.abs(bottom.y - top.y)
    const dx = bottom.x - top.x
    console.log(`dx: ${dx}, dy: ${dy}`)
    return Math.atan2(dy, dx) - Math.PI * 0.5
  }

  private getFeetAngle(left: IPointData, right: IPointData): number {
    const dy = right.y - left.y
    const dx = right.x - left.x

    return Math.atan2(dy, dx)
  }
}
