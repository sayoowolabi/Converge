import { useEffect, type ReactNode } from "react";
import type { Role } from "../domain/types";
import { useStore } from "../state/store";
import { Icon } from "./Icon";
import { ROLE_LABEL } from "./TopBar";

/** Toasts announced politely to screen readers. */
export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <Icon name="check" size={18} />
          <span>{t.text}</span>
          <button type="button" className="toast-close" aria-label="Dismiss message" onClick={() => dismissToast(t.id)}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Shown instead of a page that belongs to another role view. In the real system
 * the API returns 403 to users without the role (FR 3); the demo account holds
 * every role, so it only needs to switch view (FR 4).
 */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const store = useStore();
  if (store.role === role) return <>{children}</>;
  return (
    <section className="page narrow">
      <p className="eyebrow">{ROLE_LABEL[role]} view</p>
      <h1 className="page-title">This page is part of the {ROLE_LABEL[role]} view</h1>
      <p className="lede">
        You&rsquo;re viewing Converge as {ROLE_LABEL[store.role]}. Your account also holds the {ROLE_LABEL[role]} role,
        so you can switch without signing in again.
      </p>
      <button type="button" className="btn btn-ink" onClick={() => store.setRole(role)}>
        Switch to {ROLE_LABEL[role]} view
      </button>
    </section>
  );
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Converge` : "Converge";
  }, [title]);
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
