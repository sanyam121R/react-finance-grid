import type { SortDirection } from "../types";

export const SortIcon = ({ dir }: { dir: SortDirection | null }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path
      d="M6 1.5 9 5H3L6 1.5Z"
      fill={dir === "asc" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1"
    />
    <path
      d="M6 10.5 3 7h6l-3 3.5Z"
      fill={dir === "desc" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1"
    />
  </svg>
);

export const PinIcon = ({ pinned }: { pinned: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      d="M9.5 1.5 14.5 6.5 12 7l-2.5 4.5L8 10 4 14l-2-2 4-4-1.5-1.5L9 4l.5-2.5Z"
      fill={pinned ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path
      d="M4 2.5 8 6l-4 3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);