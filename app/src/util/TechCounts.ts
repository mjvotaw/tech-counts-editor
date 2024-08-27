import {
  Row,
  Foot,
  FEET_LABEL_TO_FOOT,
  FEET,
  OTHER_PART_OF_FOOT,
  TECH_COUNTS,
  TechCountsCategory,
} from "./ParityDataTypes"

const JACK_CUTOFF = 0.176

export function calculateTechCounts(rows: Row[], columnCount: number) {
  const previousFootPlacement: number[] = []
  const currentFootPlacement: number[] = []
  const techCounts: number[] = []
  let previousNoteCount = 0
  for (let t = 0; t < 6; t++) {
    techCounts.push(0)
  }

  for (let i = 0; i <= FEET.length; i++) {
    previousFootPlacement.push(-1)
    currentFootPlacement.push(-1)
  }

  const previousColumns: Foot[] = []
  const currentColumns: Foot[] = []

  for (let i = 0; i < columnCount; i++) {
    previousColumns.push(Foot.NONE)
    currentColumns.push(Foot.NONE)
  }

  for (let r = 0; r < rows.length; r++) {
    const currentRow = rows[r]
    let noteCount: number = 0
    const techs: string[] = []

    // copy the foot placement for the current row into currentColumns,
    // and count up how many notes there are in this row

    for (let c = 0; c < columnCount; c++) {
      const currentNote = currentRow.notes[c]
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

        currentFootPlacement[currFoot] = c
        currentColumns[c] = currFoot
        noteCount += 1
      }
    }

    /*
    Jacks are same arrow same foot
    Doublestep is same foot on successive arrows
    Brackets are jumps with one foot

    Footswitch is different foot on the up or down arrow
    Sideswitch is footswitch on left or right arrow
    Crossovers are left foot on right arrow or vice versa
    */

    // check for jacks and doublesteps
    if (r > 0 && noteCount == 1 && previousNoteCount == 1) {
      for (const foot of FEET) {
        if (
          currentFootPlacement[foot] == -1 ||
          previousFootPlacement[foot] == -1
        ) {
          continue
        }

        if (previousFootPlacement[foot] == currentFootPlacement[foot]) {
          if (currentRow.second - rows[r - 1].second < JACK_CUTOFF) {
            techs.push(TECH_COUNTS[TechCountsCategory.Jacks])
            techCounts[TechCountsCategory.Jacks] += 1
          }
        } else {
          techs.push(TECH_COUNTS[TechCountsCategory.Doublesteps])
          techCounts[TechCountsCategory.Doublesteps] += 1
        }
      }
    }

    // check for brackets
    if (noteCount >= 2) {
      if (
        currentFootPlacement[Foot.LEFT_HEEL] != -1 &&
        currentFootPlacement[Foot.LEFT_TOE] != -1
      ) {
        techs.push(TECH_COUNTS[TechCountsCategory.Brackets])
        techCounts[TechCountsCategory.Brackets] += 1
      }

      if (
        currentFootPlacement[Foot.RIGHT_HEEL] != -1 &&
        currentFootPlacement[Foot.RIGHT_TOE] != -1
      ) {
        techs.push(TECH_COUNTS[TechCountsCategory.Brackets])
        techCounts[TechCountsCategory.Brackets] += 1
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
        OTHER_PART_OF_FOOT[previousColumns[c]] != currentColumns[c]
      ) {
        // this is assuming only 4-panel single
        if (c == 0 || c == 3) {
          techs.push(TECH_COUNTS[TechCountsCategory.Sideswitches])
          techCounts[TechCountsCategory.Sideswitches] += 1
        } else {
          techs.push(TECH_COUNTS[TechCountsCategory.Footswitches])
          techCounts[TechCountsCategory.Footswitches] += 1
        }
      }
      // if the right foot is pressing the left arrow, or the left foot is pressing the right ==> crossover
      else if (
        c == 0 &&
        previousColumns[c] == Foot.NONE &&
        (currentColumns[c] == Foot.RIGHT_HEEL ||
          currentColumns[c] == Foot.RIGHT_TOE)
      ) {
        techs.push(TECH_COUNTS[TechCountsCategory.Crossovers])
        techCounts[TechCountsCategory.Crossovers] += 1
      } else if (
        c == 3 &&
        previousColumns[c] == Foot.NONE &&
        (currentColumns[c] == Foot.LEFT_HEEL ||
          currentColumns[c] == Foot.LEFT_TOE)
      ) {
        techs.push(TECH_COUNTS[TechCountsCategory.Crossovers])
        techCounts[TechCountsCategory.Crossovers] += 1
      }
    }

    const techs_string = techs.join(",")
    for (const note of currentRow.notes) {
      if (note != undefined) {
        note.tech = techs_string
      }
    }

    // Move the values from currentFootPlacement to previousFootPlacement,
    // and reset currentFootPlacement
    for (let f = 0; f <= FEET.length; f++) {
      previousFootPlacement[f] = currentFootPlacement[f]
      currentFootPlacement[f] = -1
    }
    for (let c = 0; c < columnCount; c++) {
      previousColumns[c] = currentColumns[c]
      currentColumns[c] = Foot.NONE
    }
    previousNoteCount = noteCount
  }

  console.log("TECH COUNTS:")
  for (let t = 0; t < TECH_COUNTS.length; t++) {
    console.log(`${TECH_COUNTS[t]}: ${techCounts[t]}`)
  }

  return techCounts
}
