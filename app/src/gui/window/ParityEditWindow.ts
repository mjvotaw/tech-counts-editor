import { App } from "../../App"
import { NumberSpinner } from "../element/NumberSpinner"
import { WaterfallManager } from "../element/WaterfallManager"
import { Window } from "./Window"
import { basename, dirname } from "../../util/Path"
import { EventHandler } from "../../util/EventHandler"
import { FileHandler } from "../../util/file-handler/FileHandler"
import { WebFileHandler } from "../../util/file-handler/WebFileHandler"

export class ParityEditWindow extends Window {
  app: App

  private innerContainer: HTMLDivElement
  private parityDisplayLabels: HTMLDivElement[] = []
  private parityOverrideSelects: HTMLSelectElement[] = []

  constructor(app: App) {
    super({
      title: "Edit Parity Data",
      width: 370,
      height: 400,
      disableClose: false,
      win_id: "parity_stuff",
      blocking: false,
    })

    this.app = app
    window.Parity?.setEnabled(true)
    this.innerContainer = document.createElement("div")

    this.initView()
    this.setupEventHandlers()
  }

  onClose() {
    window.Parity?.setEnabled(false)
    this.windowElement.dispatchEvent(new Event("closingWindow"))
  }

  // View building

  initView(): void {
    this.viewElement.replaceChildren()
    this.viewElement.classList.add("parity-data")
    this.innerContainer.classList.add("padding")

    this.addParityDisplay()
    this.addFooterButtons()

    this.viewElement.appendChild(this.innerContainer)
    this.resetParity()
    this.updateParityDisplay()
  }

  addParityDisplay() {
    const numCols = this.app.chartManager?.loadedChart?.gameType.numCols || 0

    const container = document.createElement("div")

    const displayContainer = document.createElement("div")
    displayContainer.classList.add("parity-display")

    const overridesContainer = document.createElement("div")
    overridesContainer.classList.add("parity-display")

    for (let i = 0; i < numCols; i++) {
      // Create space for displaying current parity selections

      const displayPanel = document.createElement("div")
      displayPanel.classList.add("parity-display-panel")
      displayPanel.innerText = "None"

      displayContainer.appendChild(displayPanel)
      this.parityDisplayLabels.push(displayPanel)

      // Create selects
      const panel = document.createElement("div")
      panel.classList.add("parity-display-panel")

      const selector = this.createParitySelector()
      panel.appendChild(selector)

      overridesContainer.appendChild(panel)
      this.parityOverrideSelects.push(selector)
    }

    const displayLabel = document.createElement("div")
    displayLabel.innerText = "Current Parity:"
    container.appendChild(displayLabel)
    container.appendChild(displayContainer)

    const overrideLabel = document.createElement("div")
    overrideLabel.innerText = "Overrides:"

    container.appendChild(overrideLabel)
    container.appendChild(overridesContainer)

    this.innerContainer.appendChild(container)
  }

  createParitySelector(): HTMLSelectElement {
    const selector = document.createElement("select")
    selector.size = 5
    const optionLabels = [
      "None",
      "Left Heel",
      "Left Toe",
      "Right Heel",
      "Right Toe",
    ]

    for (let i = 0; i < optionLabels.length; i++) {
      const option = document.createElement("option")
      option.value = `${i}`
      option.innerText = optionLabels[i]
      selector.appendChild(option)
    }
    return selector
  }

  addFooterButtons() {
    const footer = document.createElement("div")
    footer.classList.add("footer")

    const resetButton = document.createElement("button")
    resetButton.innerText = "Reset Overrides"
    resetButton.onclick = () => {
      window.Parity?.resetRowOverrides()
      this.resetParity()
    }
    footer.appendChild(resetButton)

    const saveButton = document.createElement("button")
    saveButton.innerText = "Save Parity Data"
    saveButton.onclick = () => {
      this.saveParity()
    }

    footer.appendChild(saveButton)
    this.innerContainer.appendChild(footer)
  }

  // Event handling

  setupEventHandlers() {
    const reloadParity = () => {
      this.resetParity()
    }

    EventHandler.on("smLoaded", reloadParity)
    EventHandler.on("chartLoaded", reloadParity)
    EventHandler.on("chartModified", reloadParity)

    const updateDisplay = () => {
      this.updateParityDisplay()
    }
    EventHandler.on("snapToTickChanged", updateDisplay)

    this.windowElement.addEventListener("closingWindow", function () {
      EventHandler.off("smLoaded", reloadParity)
      EventHandler.off("chartLoaded", reloadParity)
      EventHandler.off("chartModified", reloadParity)
      EventHandler.off("snapToTickChanged", updateDisplay)
    })
  }

  updateParityDisplay() {
    console.log("updateParityDisplay")
    if (this.app.chartManager == undefined) {
      return
    }
    const beat = this.app.chartManager?.getBeat()
    const parity = window.Parity?.getParityForBeat(beat)

    if (parity == undefined) {
      console.log(`no parity info for beat ${beat}`)
      // no notes on this beat, disable everything
      for (const l of this.parityDisplayLabels) {
        l.innerText = "None"
      }
    } else {
      const optionLabels = [
        "None",
        "Left Heel",
        "Left Toe",
        "Right Heel",
        "Right Toe",
      ]
      for (let i = 0; i < parity.length; i++) {
        this.parityDisplayLabels[i].innerText = optionLabels[parity[i]]
      }
    }
  }

  resetParity() {
    window.Parity?.resetRowOverrides()
    window.Parity?.analyze()
  }

  async saveParity() {
    if (window.Parity == undefined) {
      return
    }
    const parityJson = window.Parity.serializeParityResults(true)
    const smPath = this.app.chartManager.smPath
    const difficulty =
      this.app.chartManager.loadedChart?.difficulty || "No Difficulty"

    const dir = dirname(smPath)
    const baseName = basename(smPath)
    const fileName = baseName.includes(".")
      ? baseName.split(".").slice(0, -1).join(".")
      : baseName

    const jsonFilename = `${fileName}-${difficulty}-parity.json`
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
