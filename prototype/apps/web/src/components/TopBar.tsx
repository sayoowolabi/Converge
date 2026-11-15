import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import type { Role } from "../domain/types";
import { useStore } from "../state/store";
import { Icon } from "./Icon";

export const ROLE_LABEL: Record<Role, string> = {
  attendee: "Attendee",
  organiser: "Organiser",
  venue_operator: "Venue operator",
};

export const ROLE_HOME: Record<Role, string> = {
  attendee: "/",
  organiser: "/organiser",
  venue_operator: "/venue",
};

const ROLE_HINT: Record<Role, string> = {
  attendee: "Find events and buy tickets",
  organiser: "Book venues and run events",
  venue_operator: "Manage listings and requests",
};

/** Tabs per role view (FR 4, DECISIONS D-009). NavLink sets aria-current="page". */
const TABS: Record<Role, { to: string; label: string; end?: boolean }[]> = {
  attendee: [
    { to: "/", label: "What’s on", end: true },
    { to: "/tickets", label: "My tickets" },
    { to: "/community", label: "Community" },
  ],
  organiser: [
    { to: "/organiser", label: "Dashboard", end: true },
    { to: "/organiser/venues", label: "Find a venue" },
    { to: "/organiser/events", label: "My events" },
    { to: "/organiser/analytics", label: "Analytics" },
  ],
  venue_operator: [
    { to: "/venue", label: "Requests", end: true },
    { to: "/venue/listings", label: "My venues" },
    { to: "/venue/analytics", label: "Analytics" },
  ],
};

/** Open/close state for a popover: closes on Escape (returning focus) and on outside clicks. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);
  return { open, setOpen, anchorRef, buttonRef };
}

function useSwitchRole() {
  const { setRole, toast } = useStore();
  const navigate = useNavigate();
  return (role: Role) => {
    setRole(role);
    navigate(ROLE_HOME[role]);
    toast(`Now viewing Converge as ${ROLE_LABEL[role]}.`);
  };
}

export function RoleSwitcher({ name, onSwitched }: { name: string; onSwitched?: () => void }) {
  const { role } = useStore();
  const switchRole = useSwitchRole();
  return (
    <fieldset className="role-options">
      <legend>View as</legend>
      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
        <label key={r} className="role-option">
          <input
            type="radio"
            name={name}
            value={r}
            checked={role === r}
            onChange={() => {
              switchRole(r);
              onSwitched?.();
            }}
          />
          <span>
            {ROLE_LABEL[r]}
            <small>{ROLE_HINT[r]}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function DemoMeta() {
  const { db, resetDemo } = useStore();
  return (
    <div className="menu-meta">
      <span title="FR 42: views, saves and purchases are recorded for recommendations">
        {db.interactions.length} interactions logged
      </span>
      <button type="button" className="text-button" onClick={resetDemo}>
        Reset demo
      </button>
    </div>
  );
}

function Popover({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="popover" id={id}>
      {children}
    </div>
  );
}

export function TopBar() {
  const { db, role, userId, markNotificationsRead } = useStore();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const profile = usePopover();
  const bell = usePopover();
  const navId = "primary-nav";
  const profileId = useId();
  const bellId = useId();
  const user = db.users.find((u) => u.id === userId)!;
  const notifications = db.notifications.filter((n) => n.userId === userId);
  const unread = notifications.filter((n) => !n.read).length;

  // Close menus after navigating.
  useEffect(() => {
    setMobileOpen(false);
    profile.setOpen(false);
    bell.setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <header className="topbar">
      <Link className="brand" to={ROLE_HOME[role]} aria-label="Converge home">
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span aria-hidden="true">converge</span>
      </Link>

      <nav id={navId} className={mobileOpen ? "nav-open" : ""} aria-label={`${ROLE_LABEL[role]} navigation`}>
        <ul>
          {TABS[role].map((tab) => (
            <li key={tab.to}>
              <NavLink to={tab.to} end={tab.end}>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mobile-only mobile-nav-extra">
          <NavLink className="host-link" to="/host">
            For venues &amp; organisers
          </NavLink>
          <RoleSwitcher name="role-mobile" onSwitched={() => setMobileOpen(false)} />
          <DemoMeta />
        </div>
      </nav>

      <div className="header-actions">
        <NavLink className="host-link" to="/host">
          For venues &amp; organisers
        </NavLink>

        <div className="popover-anchor" ref={bell.anchorRef}>
          <button
            ref={bell.buttonRef}
            type="button"
            className="icon-button notification"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            aria-expanded={bell.open}
            aria-controls={bellId}
            onClick={() => {
              bell.setOpen(!bell.open);
              profile.setOpen(false);
              if (!bell.open) markNotificationsRead();
            }}
          >
            <Icon name="bell" size={20} />
            {unread ? <b aria-hidden="true">{unread}</b> : null}
          </button>
          {bell.open ? (
            <Popover id={bellId}>
              <h2>Notifications</h2>
              {notifications.length === 0 ? (
                <p>Nothing yet.</p>
              ) : (
                <ul className="notif-list">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      {n.link ? <Link to={n.link}>{n.text}</Link> : n.text}
                      <small>For your {ROLE_LABEL[n.forRole]} view</small>
                    </li>
                  ))}
                </ul>
              )}
            </Popover>
          ) : null}
        </div>

        <div className="popover-anchor profile-anchor" ref={profile.anchorRef}>
          <button
            ref={profile.buttonRef}
            type="button"
            className="profile"
            aria-expanded={profile.open}
            aria-controls={profileId}
            onClick={() => {
              profile.setOpen(!profile.open);
              bell.setOpen(false);
            }}
          >
            <span className="avatar" aria-hidden="true">
              {user.initials}
            </span>
            <span className="role-label">{ROLE_LABEL[role]}</span>
            <span className="sr-only"> view: account and role menu for {user.name}</span>
            <Icon name="chevron" size={15} />
          </button>
          {profile.open ? (
            <Popover id={profileId}>
              <h2>{user.name}</h2>
              <p>One account, three roles (FR 4). Switch view without signing in again.</p>
              <RoleSwitcher name="role-desktop" onSwitched={() => profile.setOpen(false)} />
              <DemoMeta />
            </Popover>
          ) : null}
        </div>

        <button
          type="button"
          className="mobile-menu-button"
          aria-expanded={mobileOpen}
          aria-controls={navId}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Icon name={mobileOpen ? "close" : "menu"} />
        </button>
      </div>
    </header>
  );
}
