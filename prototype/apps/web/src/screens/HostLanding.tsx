import { useNavigate } from "react-router";
import { useDocumentTitle } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { ROLE_HOME, ROLE_LABEL } from "../components/TopBar";
import type { Role } from "../domain/types";
import { useStore } from "../state/store";

/** "For venues & organisers": explains the role views and switches between them (FR 4). */
export function HostLanding() {
  useDocumentTitle("For venues & organisers");
  const { role, setRole, toast } = useStore();
  const navigate = useNavigate();
  const go = (r: Role) => {
    setRole(r);
    toast(`Now viewing Converge as ${ROLE_LABEL[r]}.`);
    navigate(ROLE_HOME[r]);
  };
  const cards: { role: Role; eyebrow: string; title: string; body: string; points: string[] }[] = [
    {
      role: "organiser",
      eyebrow: "Organisers",
      title: "Book a room, then sell it out.",
      body: "Search venues by guests, date and distance, with the nearest stop for every option. Request a booking, confirm it with the deposit, and turn it into a ticketed event.",
      points: ["Venue search with transport access", "Clear deposits and package prices", "Events and tickets from a confirmed booking"],
    },
    {
      role: "venue_operator",
      eyebrow: "Venues",
      title: "Fill your quiet nights.",
      body: "List your space with packages and availability. See every request next to anything it would clash with, and approve or decline in one place.",
      points: ["Requests with clash warnings", "No double bookings", "Deposits confirmed before the date is locked"],
    },
  ];
  return (
    <section className="page">
      <p className="eyebrow">For venues &amp; organisers</p>
      <h1 className="page-title">
        One account. <em className="accent-italic">Every side of the night.</em>
      </h1>
      <p className="lede">
        Your Converge account can hold more than one role. Switch views here or from your profile menu, with no need
        to sign in again. You&rsquo;re viewing as <strong>{ROLE_LABEL[role]}</strong>.
      </p>
      <div className="host-cards">
        {cards.map((c) => (
          <article key={c.role} className="host-card" aria-labelledby={`host-${c.role}`}>
            <p className="eyebrow">{c.eyebrow}</p>
            <h2 id={`host-${c.role}`}>{c.title}</h2>
            <p>{c.body}</p>
            <ul>
              {c.points.map((p) => (
                <li key={p}>
                  <Icon name="check" size={16} /> {p}
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-ink" onClick={() => go(c.role)}>
              {role === c.role ? `Go to ${ROLE_LABEL[c.role]} view` : `Switch to ${ROLE_LABEL[c.role]} view`}
              <Icon name="arrow" size={16} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
