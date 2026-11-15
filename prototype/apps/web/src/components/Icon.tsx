import type { ReactNode } from "react";

/** Line icons from the Figma export, plus a few new ones. Always decorative (aria-hidden). */
export type IconName =
  | "arrow"
  | "back"
  | "bell"
  | "calendar"
  | "check"
  | "chevron"
  | "close"
  | "heart"
  | "info"
  | "location"
  | "lock"
  | "menu"
  | "minus"
  | "plus"
  | "search"
  | "sliders"
  | "star"
  | "ticket"
  | "train"
  | "users";

const paths: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  location: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  calendar: <path d="M5 3v3M19 3v3M4 8h16M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Z" />,
  users: (
    <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-2a4 4 0 0 0-3-3.87M16 2.13a4 4 0 0 1 0 7.75" />
  ),
  sliders: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="11" cy="18" r="2" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
  ),
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M14 21h-4" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  back: <path d="M19 12H5M10 7l-5 5 5 5" />,
  ticket: (
    <>
      <path d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4V7Z" />
      <path d="M12 7v10" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M5 12h14M12 5v14" />,
  check: <path d="m5 12 5 5 9-10" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="1" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  star: <path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4l-5.6 2.9 1.1-6.2L3 9.7l6.2-.9L12 3Z" />,
  train: (
    <>
      <rect x="5" y="3" width="14" height="13" rx="3" />
      <path d="M5 10h14M9 20l-2 2M15 20l2 2M8.5 13.5h.01M15.5 13.5h.01" />
    </>
  ),
};

export function Icon({ name, size = 20, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
