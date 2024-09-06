import {
  Row,
  Foot,
  FEET_LABEL_TO_FOOT,
  FEET,
  OTHER_PART_OF_FOOT,
  TECH_COUNTS,
  TechCountsCategory,
} from "./ParityDataTypes"

export function calculateTechCounts(
  rows: Row[],
  columnCount: number,
  timeThresholds: number[]
) {
  const techCounts: number[] = []
  for (let t = 0; t < 6; t++) {
    techCounts.push(0)
  }

  const techCountsPerRow = calculateTechCountsPerRow(
    rows,
    columnCount,
    timeThresholds
  )

  for (let r = 0; r < techCountsPerRow.length; r++) {
    const techCountRow = techCountsPerRow[r]
    const currentRow = rows[r]
    const techs_string = techCountRow.map(t => TECH_COUNTS[t]).join(",")
    for (const note of currentRow.notes) {
      if (note != undefined) {
        note.tech = techs_string
      }
    }

    for (const t of techCountRow) {
      techCounts[t] += 1
    }
  }

  return techCounts
}

export function calculateTechCountsPerRow(
  rows: Row[],
  columnCount: number,
  timeThresholds: number[]
) {
  const techCountsPerRow: TechCountsCategory[][] = []

  for (let r = 0; r < rows.length; r++) {
    const techCountsForRow = calculateTechCountsForRow(
      rows,
      r,
      columnCount,
      timeThresholds
    )
    techCountsPerRow.push(techCountsForRow)
  }

  return techCountsPerRow
}

export function calculateTechCountsForRow(
  rows: Row[],
  rowIndex: number,
  columnCount: number,
  timeThresholds: number[]
) {
  const currentRow = rows[rowIndex]
  const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : undefined

  const currentFootPlacement: number[] = getFootPlacement(
    currentRow,
    columnCount
  )
  const currentColumns: Foot[] = getColumns(currentRow, columnCount)
  const noteCount: number = getNoteCount(currentRow, columnCount)

  const previousFootPlacement: number[] = previousRow
    ? getFootPlacement(previousRow, columnCount)
    : emptyFootPlacement(columnCount)
  const previousColumns: Foot[] = previousRow
    ? getColumns(previousRow, columnCount)
    : emptyColumns(columnCount)
  const previousNoteCount = previousRow
    ? getNoteCount(previousRow, columnCount)
    : 0

  for (let i = 0; i <= FEET.length; i++) {
    previousFootPlacement.push(-1)
    currentFootPlacement.push(-1)
  }

  const techs: TechCountsCategory[] = []

  /*
  Jacks are same arrow same foot
  Doublestep is same foot on successive arrows
  Brackets are jumps with one foot

  Footswitch is different foot on the up or down arrow
  Sideswitch is footswitch on left or right arrow
  Crossovers are left foot on right arrow or vice versa
  */

  // check for jacks and doublesteps
  if (rowIndex > 0 && noteCount == 1 && previousNoteCount == 1) {
    for (const foot of FEET) {
      if (
        currentFootPlacement[foot] == -1 ||
        previousFootPlacement[foot] == -1
      ) {
        continue
      }

      if (previousFootPlacement[foot] == currentFootPlacement[foot]) {
        if (
          timeThresholds[TechCountsCategory.Jacks] == undefined ||
          currentRow.second - rows[rowIndex - 1].second <
            timeThresholds[TechCountsCategory.Jacks]
        ) {
          techs.push(TechCountsCategory.Jacks)
        }
      } else {
        if (
          timeThresholds[TechCountsCategory.Doublesteps] == undefined ||
          currentRow.second - rows[rowIndex - 1].second <
            timeThresholds[TechCountsCategory.Doublesteps]
        ) {
          techs.push(TechCountsCategory.Doublesteps)
        }
      }
    }
  }

  // check for brackets
  if (
    noteCount >= 2 &&
    (rowIndex == 0 ||
      timeThresholds[TechCountsCategory.Brackets] == undefined ||
      currentRow.second - rows[rowIndex - 1].second <
        timeThresholds[TechCountsCategory.Brackets])
  ) {
    if (
      currentFootPlacement[Foot.LEFT_HEEL] != -1 &&
      currentFootPlacement[Foot.LEFT_TOE] != -1
    ) {
      techs.push(TechCountsCategory.Brackets)
    }

    if (
      currentFootPlacement[Foot.RIGHT_HEEL] != -1 &&
      currentFootPlacement[Foot.RIGHT_TOE] != -1
    ) {
      techs.push(TechCountsCategory.Brackets)
    }
  }

  for (let c = 0; c < columnCount; c++) {
    if (currentColumns[c] == Foot.NONE) {
      continue
    }

    // this same column was stepped on in the previous row, but not by the same foot ==> footswitch or sideswitch
    if (
      previousColumns[c] != Foot.NONE &&
      previousColumns[c] != currentColumns[c] &&
      OTHER_PART_OF_FOOT[previousColumns[c]] != currentColumns[c] &&
      (rowIndex == 0 ||
        timeThresholds[TechCountsCategory.Footswitches] == undefined ||
        currentRow.second - rows[rowIndex - 1].second <
          timeThresholds[TechCountsCategory.Footswitches])
    ) {
      // this is assuming only 4-panel single
      if (c == 0 || c == 3) {
        techs.push(TechCountsCategory.Sideswitches)
      } else {
        techs.push(TechCountsCategory.Footswitches)
      }
    }
    // if the right foot is pressing the left arrow, or the left foot is pressing the right ==> crossover
    else if (
      c == 0 &&
      previousColumns[c] == Foot.NONE &&
      (currentColumns[c] == Foot.RIGHT_HEEL ||
        currentColumns[c] == Foot.RIGHT_TOE)
    ) {
      1
      techs.push(TechCountsCategory.Crossovers)
    } else if (
      c == 3 &&
      previousColumns[c] == Foot.NONE &&
      (currentColumns[c] == Foot.LEFT_HEEL ||
        currentColumns[c] == Foot.LEFT_TOE)
    ) {
      techs.push(TechCountsCategory.Crossovers)
    }
  }
  return techs
}

function emptyFootPlacement(columnCount: number) {
  const footPlacement: number[] = []
  for (let i = 0; i <= FEET.length; i++) {
    footPlacement.push(-1)
  }
  return footPlacement
}
function getFootPlacement(row: Row, columnCount: number) {
  const footPlacement: number[] = emptyFootPlacement(columnCount)

  for (let c = 0; c < columnCount; c++) {
    const currentNote = row.notes[c]
    if (currentNote != undefined) {
      const currFoot = currentNote.parity
        ? FEET_LABEL_TO_FOOT[currentNote.parity]
        : Foot.NONE

      if (
        currentNote.type != "Tap" &&
        currentNote.type != "Hold" &&
        currentNote.type != "Roll"
      ) {
        continue
      }

      footPlacement[currFoot] = c
    }
  }
  return footPlacement
}

function emptyColumns(columnCount: number) {
  const columns: Foot[] = []
  for (let i = 0; i < columnCount; i++) {
    columns.push(Foot.NONE)
  }
  return columns
}

function getColumns(row: Row, columnCount: number) {
  const columns: Foot[] = emptyColumns(columnCount)

  for (let c = 0; c < columnCount; c++) {
    const currentNote = row.notes[c]
    if (currentNote != undefined) {
      const currFoot = currentNote.parity
        ? FEET_LABEL_TO_FOOT[currentNote.parity]
        : Foot.NONE

      if (
        currentNote.type != "Tap" &&
        currentNote.type != "Hold" &&
        currentNote.type != "Roll"
      ) {
        continue
      }
      columns[c] = currFoot
    }
  }

  return columns
}

function getNoteCount(row: Row, columnCount: number) {
  let noteCount: number = 0

  for (let c = 0; c < columnCount; c++) {
    const currentNote = row.notes[c]
    if (currentNote != undefined) {
      if (
        currentNote.type != "Tap" &&
        currentNote.type != "Hold" &&
        currentNote.type != "Roll"
      ) {
        continue
      }
      noteCount += 1
    }
  }
  return noteCount
}
