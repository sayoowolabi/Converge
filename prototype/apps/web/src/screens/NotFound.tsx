import { Link } from "react-router";
import { useDocumentTitle } from "../components/Feedback";

export function NotFound({ what = "page" }: { what?: string }) {
  useDocumentTitle("Not found");
  return (
    <section className="page narrow">
      <p className="eyebrow">Not found</p>
      <h1 className="page-title">We couldn&rsquo;t find that {what}</h1>
      <p className="lede">It may have been removed, or the link is out of date. Demo data also resets when you reload.</p>
      <Link className="btn btn-ink" to="/">
        Back to What&rsquo;s on
      </Link>
    </section>
  );
}
