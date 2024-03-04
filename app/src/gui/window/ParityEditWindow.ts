import { App } from "../../App"
import { NumberSpinner } from "../element/NumberSpinner"
import { WaterfallManager } from "../element/WaterfallManager"
import { Window } from "./Window"
import { basename, dirname, extname } from "../../util/Path"
import { FileHandler } from "../../util/file-handler/FileHandler"
import { WebFileHandler } from "../../util/file-handler/WebFileHandler"

export class ParityEditWindow extends Window {
  app: App

  private currentWeights: { [key: string]: number }
  private numberFields: { [key: string]: NumberSpinner } = {}

  constructor(app: App) {
    super({
      title: "Edit Parity Stuff",
      width: 370,
      height: 400,
      disableClose: false,
      win_id: "parity_stuff",
      blocking: false,
    })

    this.app = app
    window.Parity?.setEnabled(true)
    this.currentWeights = window.Parity!.getWeights()

    this.initView()
  }

  onClose() {
    window.Parity?.setEnabled(false)
  }

  initView(): void {
    this.viewElement.replaceChildren()
    this.viewElement.classList.add("timing-data")
    const padding = document.createElement("div")
    padding.classList.add("padding")

    // const item = Dropdown.create(
    //   ["All charts", "This chart"],
    //   this.chartTiming ? "This chart" : "All charts"
    // )
    // item.onChange(value => {
    //   this.chartTiming = value == "This chart"
    // })

    //   padding.appendChild(item.view)

    const weightKeys = Object.keys(this.currentWeights)
    weightKeys.forEach(title => {
      const label = document.createElement("div")
      label.classList.add("label")
      label.innerText = title

      const item = NumberSpinner.create(this.currentWeights[title], 10, 0)
      item.onChange = value => {
        this.currentWeights[title] = value || this.currentWeights[title]
        this.updateParity()
      }
      padding.appendChild(label)
      padding.appendChild(item.view)
      this.numberFields[title] = item
    })

    const resetButton = document.createElement("button")
    resetButton.innerText = "Reset to Defaults"
    resetButton.onclick = () => {
      this.currentWeights = window.Parity!.getDefaultWeights()
      this.updateFields()
      this.updateParity()
    }
    padding.appendChild(resetButton)

    const saveButton = document.createElement("button")
    saveButton.innerText = "Save"
    saveButton.onclick = () => {
      this.saveParity()
    }

    padding.appendChild(saveButton)

    this.viewElement.appendChild(padding)
    this.updateParity()
  }
  updateFields() {
    for (const filename in this.numberFields) {
      this.numberFields[filename].setValue(this.currentWeights[filename])
    }
  }

  updateParity() {
    window.Parity?.updateWeights(this.currentWeights)
    window.Parity?.analyze()
  }

  async saveParity() {
    if (window.Parity == undefined) {
      return
    }
    const parityJson = window.Parity.serializeParityData()
    const smPath = this.app.chartManager.smPath
    const dir = dirname(smPath)
    const baseName = basename(smPath)
    const fileName = baseName.includes(".")
      ? baseName.split(".").slice(0, -1).join(".")
      : baseName

    const jsonFilename = fileName + "-parity.json"
    const jsonPath = dir + "/" + jsonFilename

    console.log(`saving parity data to  ${jsonPath}`)

    let error: string | null = null
    if (await FileHandler.getFileHandle(jsonPath, { create: true })) {
      await FileHandler.writeFile(jsonPath, parityJson).catch(err => {
        const message = err.message
        error = message
      })

      const blob = new Blob([parityJson], { type: "application/json" })
      ;(FileHandler.getStandardHandler() as WebFileHandler).saveBlob(
        blob,
        jsonFilename
      )
    }

    if (error == null) {
      WaterfallManager.create("Saved Parity Data")
    } else {
      WaterfallManager.createFormatted("Failed to save file: " + error, "error")
    }
  }
}
