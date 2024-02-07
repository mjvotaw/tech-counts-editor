import { App } from "../../App"
import { NumberSpinner } from "../element/NumberSpinner"
import { Window } from "./Window"

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
}
