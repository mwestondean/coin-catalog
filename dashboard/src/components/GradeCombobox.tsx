import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, X } from "lucide-react"

// Priority-ordered grades: MS first (most common for this collection), AU next,
// then mid-range, then low. Matches user's actual usage, not alphabetical.
const GRADE_PRIORITY: string[] = [
  "MS-70", "MS-69", "MS-68", "MS-67", "MS-66", "MS-65",
  "MS-64", "MS-63", "MS-62", "MS-61", "MS-60",
  "AU-58", "AU-55", "AU-53", "AU-50",
  "EF-45", "EF-40",
  "VF-35", "VF-30", "VF-25", "VF-20",
  "F-15", "F-12",
  "VG-10", "VG-8",
  "G-6", "G-4",
  "AG-3", "FR-2", "PO-1",
]

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

/**
 * Searchable grade picker. Type any portion ("64", "MS6", "AU55") to filter.
 * Top match auto-highlights; Enter / Tab / click commits. Arrow keys navigate.
 * Empty input shows MS grades first so the common case needs zero typing.
 */
export default function GradeCombobox({
  value,
  onChange,
  placeholder = "Pick a grade",
  autoFocus,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // When user types, query drives the filter. When not typing, input shows value.
  const displayValue = open ? query : value

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[-\s]/g, "")
    if (!q) return GRADE_PRIORITY
    return GRADE_PRIORITY.filter((g) =>
      g.toLowerCase().replace(/[-\s]/g, "").includes(q),
    )
  }, [query])

  useEffect(() => {
    if (activeIndex >= matches.length) setActiveIndex(0)
  }, [matches, activeIndex])

  function commit(grade: string) {
    onChange(grade)
    setOpen(false)
    setQuery("")
    inputRef.current?.blur()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (open && matches[activeIndex]) {
        e.preventDefault()
        commit(matches[activeIndex])
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      setQuery("")
      inputRef.current?.blur()
    }
  }

  function handleBlur(e: React.FocusEvent) {
    // Only close if focus leaves the whole combobox
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      // If query is a perfect match, commit it; otherwise revert
      if (query && matches[0] && matches[0].toLowerCase() === query.toLowerCase().replace(/\s/g, "")) {
        commit(matches[0])
      }
      setOpen(false)
      setQuery("")
    }
  }

  return (
    <div className={`relative ${className}`} onBlur={handleBlur}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onFocus={() => {
            setOpen(true)
            setQuery("")
            setActiveIndex(0)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={handleKey}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-16 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
          {value && !open && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange("")
              }}
              className="pointer-events-auto rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="Clear"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {open && matches.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {matches.map((g, i) => (
            <div
              key={g}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(g)
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer rounded px-2 py-1.5 font-mono text-sm ${
                i === activeIndex ? "bg-accent text-accent-foreground" : ""
              } ${g === value ? "font-bold" : ""}`}
            >
              {g}
            </div>
          ))}
        </div>
      )}
      {open && matches.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-3 text-sm text-muted-foreground shadow-md">
          No match
        </div>
      )}
    </div>
  )
}
