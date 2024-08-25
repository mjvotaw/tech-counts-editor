import { App } from "../../App"
import { Window, WindowOptions } from "./Window"

export abstract class ResizableWindow extends Window {
  private resizeHandle: HTMLDivElement
  private mouseDown: boolean = false

  constructor(options: WindowOptions) {
    console.log("RESIZABLE WINDOW")
    super(options)

    this.resizeHandle = document.createElement("div")
    this.resizeHandle.classList.add("window-resize-handle")

    this.windowElement.appendChild(this.resizeHandle)
    const handleResize = (event: MouseEvent) => {
      this.handleResize(event)
    }

    this.resizeHandle.addEventListener("mousedown", () => {
      window.addEventListener("mousemove", handleResize)
    })

    window.addEventListener("mouseup", () => {
      window.removeEventListener("mousemove", handleResize)
    })
  }

  onClose(): void {
    this.resizeHandle.remove()
  }

  handleMouseDown() {
    this.mouseDown = true
    window.addEventListener("mouseup", this.handleMouseUp.bind(this))
    window.addEventListener("mousemove", this.handleResize.bind(this))
  }

  handleMouseUp() {
    console.log("handleMouseUp!")
    this.mouseDown = false
    window.removeEventListener("mouseup", this.handleMouseUp.bind(this))
    window.removeEventListener("mousemove", this.handleResize.bind(this))
  }

  handleResize(event: MouseEvent) {
    const width =
      parseInt(this.viewElement.style.width.slice(0, -2)) + event.movementX
    const height =
      parseInt(this.viewElement.style.height.slice(0, -2)) + event.movementY

    this.windowElement.style.width = width + "px"

    this.viewElement.style.width = width + "px"
    this.viewElement.style.height = height + "px"

    this.clampPosition()
  }
}
