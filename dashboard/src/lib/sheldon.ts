/**
 * Sheldon scale grades for coin grading.
 * Used in grade pickers and wager scoring.
 */

export const SHELDON_GRADES = [
  "PO-1",
  "FR-2",
  "AG-3",
  "G-4",
  "G-6",
  "VG-8",
  "VG-10",
  "F-12",
  "F-15",
  "VF-20",
  "VF-25",
  "VF-30",
  "VF-35",
  "EF-40",
  "EF-45",
  "AU-50",
  "AU-53",
  "AU-55",
  "AU-58",
  "MS-60",
  "MS-61",
  "MS-62",
  "MS-63",
  "MS-64",
  "MS-65",
  "MS-66",
  "MS-67",
  "MS-68",
  "MS-69",
  "MS-70",
] as const

export type SheldonGrade = (typeof SHELDON_GRADES)[number]

// Short forms used in the database (AU55 instead of AU-55)
export const SHELDON_SHORT = SHELDON_GRADES.map((g) => g.replace("-", ""))

export function toShort(grade: string): string {
  return grade.replace("-", "")
}

export function toLong(grade: string): string {
  // Insert dash before the numeric part: AU55 -> AU-55, MS63 -> MS-63
  return grade.replace(/^([A-Z]+)(\d+)$/, "$1-$2")
}

export const PROBLEM_FLAGS = [
  "none",
  "cleaned",
  "environmental damage",
  "rim ding",
  "scratch",
  "pvc",
] as const
