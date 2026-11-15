import { forwardRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Explains why an action is blocked and names the rule (DECISIONS D-020).
 * Pair it with a button that has aria-disabled="true" and aria-describedby={id}.
 */
export const BlockedNotice = forwardRef<
  HTMLDivElement,
  { id: string; code: string; title: string; children: ReactNode; tone?: "blocked" | "info" }
>(function BlockedNotice({ id, code, title, children, tone = "blocked" }, ref) {
  return (
    <div ref={ref} id={id} className={`blocked-notice ${tone}`} tabIndex={-1}>
      <span className="blocked-icon">
        <Icon name={tone === "blocked" ? "lock" : "info"} size={18} />
      </span>
      <div>
        <p className="blocked-title">
          {/^([A-Z]{2}\d|FR \d+)$/.test(code) ?<span className="rule-code">{code}</span> : null}
          {title}
        </p>
        <div className="blocked-body">{children}</div>
      </div>
    </div>
  );
});
