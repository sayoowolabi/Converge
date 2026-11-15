import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { DemoNote, Switch } from "../../components/Bits";
import { BlockedNotice } from "../../components/BlockedNotice";
import { EmptyState, useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { DEMO_NOW, formatDayTime, formatLongDate } from "../../domain/format";
import type { Post } from "../../domain/types";
import { holdsTicket, useStore } from "../../state/store";
import { NotFound } from "../NotFound";

const CLOSE_AFTER_MS = 7 * 86400_000;

/** Communities the user can join: events they hold a ticket for, or organise (FR 58). */
export function CommunityIndex() {
  useDocumentTitle("Community");
  const { db, userId } = useStore();
  const events = db.events
    .filter(
      (e) =>
        (holdsTicket(db, userId, e.id) || e.organiserId === userId) &&
        e.status !== "Draft" &&
        new Date(e.endsAt).getTime() + CLOSE_AFTER_MS > DEMO_NOW.getTime(),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <section className="page">
      <p className="eyebrow">Community</p>
      <h1 className="page-title">Your event communities</h1>
      <p className="lede">
        Each event has its own space for ticket holders and the organiser. Say hello beforehand, find people who are
        coming on their own, or simply read along.
      </p>
      {events.length === 0 ? (
        <EmptyState title="No communities yet">
          <p>
            <Icon name="lock" size={16} /> Communities open to you once you have a ticket. They stay open for posts until
            7 days after the event.
          </p>
          <Link className="btn btn-ink" to="/">
            Find something worth going to
          </Link>
        </EmptyState>
      ) : (
        <ul className="row-list">
          {events.map((e) => {
            const venue = db.venues.find((v) => v.id === e.venueId)!;
            const posts = db.posts.filter((p) => p.eventId === e.id).length;
            const alone = db.attendeeStatus.filter((a) => a.eventId === e.id && a.attendingAlone).length;
            return (
              <li key={e.id} className="row-card" data-testid="community-row">
                <div>
                  <p className="event-date">{formatDayTime(e.startsAt)}</p>
                  <h2 className="row-title">
                    <Link to={`/events/${e.id}/community`}>{e.title}</Link>
                  </h2>
                  <p className="muted small">
                    {venue.name} · {posts} post{posts === 1 ? "" : "s"} · {alone} coming on their own
                  </p>
                </div>
                <Icon name="arrow" size={18} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Event community (FR 58–FR 61): posts and replies, plus the "attending alone" status. */
export function Community() {
  const { eventId } = useParams();
  const { db, userId, addPost, deletePost, setAttendeeStatus, toast } = useStore();
  const event = db.events.find((e) => e.id === eventId);
  useDocumentTitle(event ? `${event.title} community` : "Community");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!event || event.status === "Draft") return <NotFound what="community" />;
  const isOrganiser = event.organiserId === userId;
  const allowed = isOrganiser || holdsTicket(db, userId, event.id);

  if (!allowed) {
    return (
      <section className="page narrow">
        <Link className="back-link" to={`/events/${event.id}`}>
          <Icon name="back" size={16} /> {event.title}
        </Link>
        <p className="eyebrow">Event community</p>
        <h1 className="page-title">{event.title}</h1>
        <BlockedNotice id="community-locked" code="FR 58" title="For ticket holders only">
          <p>
            Only people with a ticket and the organiser can see and join this event&rsquo;s community. That keeps the
            conversation between people who are actually going.
          </p>
          <Link className="btn btn-ink" to={`/events/${event.id}`}>
            Get tickets
          </Link>
        </BlockedNotice>
      </section>
    );
  }

  const closesAt = new Date(new Date(event.endsAt).getTime() + CLOSE_AFTER_MS);
  const open = DEMO_NOW < closesAt;
  const me = db.users.find((u) => u.id === userId)!;
  const status = db.attendeeStatus.find((a) => a.eventId === event.id && a.userId === userId);
  const alone = db.attendeeStatus.filter((a) => a.eventId === event.id && a.attendingAlone);
  const posts = db.posts.filter((p) => p.eventId === event.id);
  const topLevel = posts.filter((p) => !p.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const repliesTo = (id: string) =>
    posts.filter((p) => p.parentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const userName = (id: string) => {
    const u = db.users.find((x) => x.id === id)!;
    return u.id === event.organiserId ? (u.organisation ?? u.name) : u.name;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = addPost(event.id, body);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setError(null);
    setBody("");
    toast("Posted to the community.");
  };
  const submitReply = (e: FormEvent, parentId: string) => {
    e.preventDefault();
    const r = addPost(event.id, replyBody, parentId);
    if (!r.ok) return;
    setReplyBody("");
    setReplyTo(null);
    toast("Reply posted.");
  };

  const renderPost = (p: Post, isReply = false) => {
    const author = db.users.find((u) => u.id === p.authorId)!;
    const fromOrganiser = p.authorId === event.organiserId;
    return (
      <article className={`post ${isReply ? "reply" : ""}`} aria-label={`Post by ${userName(p.authorId)}`}>
        <header>
          <span className={`avatar ${fromOrganiser ? "organiser" : ""}`} aria-hidden="true">
            {author.initials}
          </span>
          <span className="post-author">
            {userName(p.authorId)}
            {fromOrganiser ? <span className="badge">Organiser</span> : null}
            {p.authorId === userId ? <span className="badge you">You</span> : null}
          </span>
          <time dateTime={p.createdAt} className="muted small">
            {formatDayTime(p.createdAt)}
          </time>
        </header>
        <p>{p.body}</p>
        <div className="post-actions">
          {!isReply && open ? (
            <button
              type="button"
              className="text-button"
              aria-expanded={replyTo === p.id}
              onClick={() => {
                setReplyTo(replyTo === p.id ? null : p.id);
                setReplyBody("");
              }}
            >
              Reply<span className="sr-only"> to {userName(p.authorId)}</span>
            </button>
          ) : null}
          {p.authorId === userId ? (
            <button type="button" className="text-button" onClick={() => deletePost(p.id)}>
              Delete<span className="sr-only"> your post</span>
            </button>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <section className="page community-page">
      <Link className="back-link" to={`/events/${event.id}`}>
        <Icon name="back" size={16} /> {event.title}
      </Link>
      <p className="eyebrow">Event community</p>
      <h1 className="page-title">{event.title}</h1>
      <p className="muted">
        {formatLongDate(event.startsAt)} ·{" "}
        {open ? `Open for posts until ${formatLongDate(closesAt.toISOString())}` : "Closed to new posts"}
      </p>

      <div className="detail-grid community-grid">
        <div>
          {open ? (
            <form className="form-card post-form" onSubmit={submit}>
              <div className="field">
                <label htmlFor="new-post">Write a post</label>
                <textarea
                  id="new-post"
                  rows={3}
                  value={body}
                  placeholder="Say hello, ask a question, suggest meeting up…"
                  aria-describedby={error ? "post-error" : undefined}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              {error ? (
                <p id="post-error" className="field-error">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="btn btn-ink">
                Post as {me.name}
              </button>
            </form>
          ) : null}

          <section aria-labelledby="posts-heading" className="info-section">
            <h2 id="posts-heading">
              Conversation <span className="count">{posts.length}</span>
            </h2>
            {topLevel.length === 0 ? <p className="muted">No posts yet. Start the conversation.</p> : null}
            <ol className="post-list">
              {topLevel.map((p) => (
                <li key={p.id}>
                  {renderPost(p)}
                  {repliesTo(p.id).length ? (
                    <ol className="reply-list">
                      {repliesTo(p.id).map((r) => (
                        <li key={r.id}>{renderPost(r, true)}</li>
                      ))}
                    </ol>
                  ) : null}
                  {replyTo === p.id ? (
                    <form className="reply-form" onSubmit={(e) => submitReply(e, p.id)}>
                      <label htmlFor={`reply-${p.id}`}>Reply to {userName(p.authorId)}</label>
                      <textarea
                        id={`reply-${p.id}`}
                        rows={2}
                        value={replyBody}
                        autoFocus
                        onChange={(e) => setReplyBody(e.target.value)}
                      />
                      <button type="submit" className="btn btn-ink">
                        Post reply
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ol>
            <DemoNote>
              New posts appear straight away here. In the real app they arrive live for everyone, and refreshing still
              shows them if live updates are unavailable (ADR 009, NFR 18).
            </DemoNote>
          </section>
        </div>

        <aside className="action-panel" aria-labelledby="alone-heading">
          {!isOrganiser ? (
            <section className="solo-panel" aria-labelledby="my-status-heading">
              <h2 id="my-status-heading">Your status</h2>
              <Switch
                id="attending-alone"
                checked={!!status?.attendingAlone}
                onChange={(v) => {
                  setAttendeeStatus(event.id, { attendingAlone: v });
                  toast(v ? "You're marked as coming on your own." : "You're no longer marked as coming on your own.");
                }}
                label="I'm coming on my own"
                hint="Others coming alone can see this and say hello."
              />
              <Switch
                id="open-to-messages"
                checked={!!status?.openToMessages}
                onChange={(v) => setAttendeeStatus(event.id, { openToMessages: v })}
                label="Open to messages"
                hint="Lets other ticket holders message you about this event."
              />
            </section>
          ) : null}
          <h2 id="alone-heading">Coming on their own</h2>
          {alone.length ? (
            <ul className="plain-list alone-list" data-testid="alone-list">
              {alone.map((a) => {
                const u = db.users.find((x) => x.id === a.userId)!;
                const shared = (u.interests ?? []).filter((i) => (me.interests ?? []).includes(i));
                return (
                  <li key={a.userId}>
                    <span className="avatar" aria-hidden="true">
                      {u.initials}
                    </span>
                    <span>
                      <strong>{u.id === userId ? `${u.name} (you)` : u.name}</strong>
                      <small className="muted">
                        {a.openToMessages ? "Open to messages" : "Not taking messages"}
                        {u.id !== userId && shared.length ? ` · You both like ${shared.join(", ")}` : ""}
                      </small>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">Nobody yet. You could be the first.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
