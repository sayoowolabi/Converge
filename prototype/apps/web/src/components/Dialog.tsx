import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog (DECISIONS D-017).
 * role="dialog" + aria-modal, labelled by its heading. Focus moves inside on open,
 * Tab/Shift+Tab wrap, Escape and backdrop click close, focus returns to the
 * opener on close, the page behind is inert and its scroll is locked.
 */
export function Dialog({
  labelledBy,
  describedBy,
  onClose,
  className,
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current!;
    const root = document.getElementById("root");
    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);

    root?.setAttribute("inert", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (panel.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? panel).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      root?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
