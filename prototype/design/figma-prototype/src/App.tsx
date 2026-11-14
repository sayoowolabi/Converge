import { useMemo, useState } from "react";

type IconName =
  | "arrow"
  | "bell"
  | "calendar"
  | "chevron"
  | "close"
  | "heart"
  | "location"
  | "menu"
  | "minus"
  | "plus"
  | "search"
  | "sliders"
  | "ticket"
  | "users";

function Icon({
  name,
  size = 20,
  filled = false,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
}) {
  const paths: Record<IconName, React.ReactNode> = {
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
    calendar: (
      <>
        <path d="M5 3v3M19 3v3M4 8h16M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Z" />
      </>
    ),
    users: (
      <>
        <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-2a4 4 0 0 0-3-3.87M16 2.13a4 4 0 0 1 0 7.75" />
      </>
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
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M14 21h-4" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    ticket: (
      <>
        <path d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4V7Z" />
        <path d="M12 7v10" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    minus: <path d="M5 12h14" />,
    plus: (
      <>
        <path d="M5 12h14M12 5v14" />
      </>
    ),
  };
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
    >
      {paths[name]}
    </svg>
  );
}

const events = [
  {
    id: 1,
    category: "TRAD & FOLK",
    title: "The Corner House Sessions",
    date: "SAT, 24 AUG",
    time: "7:30 PM",
    place: "The Cobblestone",
    area: "Smithfield, Dublin 7",
    price: 22,
    image:
      "https://images.unsplash.com/photo-1779455664988-79df81782a53?auto=format&fit=crop&w=1000&q=85",
    attendees: 148,
    color: "#f2c84b",
    description:
      "A warm evening of live folk, new voices and familiar tunes in one of Dublin’s best-loved music rooms.",
  },
  {
    id: 2,
    category: "FOOD & DRINK",
    title: "The Big Table: Summer Supper",
    date: "SUN, 25 AUG",
    time: "5:00 PM",
    place: "The Fumbally",
    area: "The Liberties, Dublin 8",
    price: 32,
    image:
      "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1000&q=85",
    attendees: 92,
    color: "#e8633a",
    description:
      "A long-table supper from local growers, made for sharing. Come with friends or join a table on your own.",
  },
  {
    id: 3,
    category: "LIVE MUSIC",
    title: "After Dark: New Irish Voices",
    date: "FRI, 30 AUG",
    time: "8:00 PM",
    place: "The National Stadium",
    area: "South Circular Road, Dublin 8",
    price: 24,
    image:
      "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1000&q=85",
    attendees: 267,
    color: "#95bfa8",
    description:
      "An independent showcase bringing together the next wave of Irish artists on one stage.",
  },
  {
    id: 4,
    category: "COMMUNITY",
    title: "Dún Laoghaire Harbour Weekender",
    date: "SAT, 31 AUG",
    time: "12:00 PM",
    place: "East Pier",
    area: "Dún Laoghaire, Co. Dublin",
    price: 16,
    image:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1000&q=85",
    attendees: 513,
    color: "#62d9ff",
    description:
      "A day by the sea with local music, makers, food and family-friendly workshops. Rain plan included.",
  },
];

function EventCard({
  event,
  selected,
  saved,
  onSelect,
  onSave,
}: {
  event: (typeof events)[number];
  selected: boolean;
  saved: boolean;
  onSelect: () => void;
  onSave: () => void;
}) {
  return (
    <article className={`event-card ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="event-image-wrap">
        <img src={event.image} alt={`${event.title} event`} className="event-image" />
        <span className="category-pill">{event.category}</span>
        <button
          className={`save-button ${saved ? "saved" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          aria-label={saved ? "Remove from saved events" : "Save event"}
        >
          <Icon name="heart" size={18} filled={saved} />
        </button>
        <div className="people-pill">
          <span className="avatar-stack">AM</span> Aoife + {event.attendees - 1} going
        </div>
      </div>
      <div className="event-content">
        <div>
          <p className="event-date">
            {event.date} · {event.time}
          </p>
          <h3>{event.title}</h3>
          <p className="event-place">
            {event.place} <span>·</span> {event.area}
          </p>
        </div>
        <div className="event-price">
          <small>FROM</small>€{event.price}
        </div>
      </div>
    </article>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("What’s on");
  const [selectedId, setSelectedId] = useState(1);
  const [saved, setSaved] = useState<number[]>([2]);
  const [activeFilter, setActiveFilter] = useState("All events");
  const [showFilters, setShowFilters] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);
  const [mobileMenu, setMobileMenu] = useState(false);
  const selected = useMemo(
    () => events.find((event) => event.id === selectedId) ?? events[0],
    [selectedId],
  );

  const toggleSaved = (id: number) => {
    setSaved((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Gather home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          gather
        </a>
        <nav className={mobileMenu ? "nav-open" : ""}>
          {["What’s on", "My tickets", "Community"].map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => {
                setActiveTab(tab);
                setMobileMenu(false);
              }}
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button className="host-link">For venues & organisers</button>
          <button className="icon-button notification" aria-label="Notifications">
            <Icon name="bell" size={19} />
            <b />
          </button>
          <button className="profile">
            <span>AK</span>
            <Icon name="chevron" size={15} />
          </button>
          <button
            className="mobile-menu-button"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Open menu"
          >
            <Icon name={mobileMenu ? "close" : "menu"} />
          </button>
        </div>
      </header>

      <main>
        <section className="intro">
          <div>
            <p className="eyebrow">DUBLIN, TOGETHER</p>
            <h1>
              Find something
              <br />
              <em>worth going to.</em>
            </h1>
          </div>
          <p className="intro-copy">
            Good nights out, neighbourhood favourites and a few unexpected finds. See who’s going,
            make a plan and feel part of it.
          </p>
        </section>

        <section className="search-panel">
          <button className="search-field">
            <span className="search-icon">
              <Icon name="search" />
            </span>
            <span>
              <small>WHAT</small>
              <strong>Search events, artists or venues</strong>
            </span>
          </button>
          <button className="search-field">
            <span>
              <Icon name="location" />
            </span>
            <span>
              <small>WHERE</small>
              <strong>Dublin & nearby</strong>
            </span>
          </button>
          <button className="search-field date-field">
            <span>
              <Icon name="calendar" />
            </span>
            <span>
              <small>WHEN</small>
              <strong>Any date</strong>
            </span>
          </button>
          <button className="search-submit">
            <Icon name="arrow" />
            <span>See what’s on</span>
          </button>
        </section>

        <div className="content-head">
          <div>
            <p className="eyebrow">PICKS NEAR YOU</p>
            <h2>What’s on around Dublin</h2>
          </div>
          <div className="distance">
            <span>48 local events</span>
            <i />
            within 10 km
          </div>
        </div>

        <div className="filters">
          {["All events", "This weekend", "Trad & folk", "Food & drink", "Arts & culture"].map(
            (filter) => (
              <button
                key={filter}
                className={activeFilter === filter ? "active" : ""}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ),
          )}
          <button
            className={`filter-button ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Icon name="sliders" size={17} /> Filters {showFilters && <b>2</b>}
          </button>
        </div>

        {showFilters && (
          <div className="filter-drawer">
            <div>
              <label>Price range</label>
              <div className="price-range">
                <span>€0</span>
                <div>
                  <i />
                  <i />
                </div>
                <span>€80+</span>
              </div>
            </div>
            <div>
              <label>Group vibe</label>
              <button className="toggle active">
                <i />
              </button>
              <span>Welcoming if you’re coming on your own</span>
            </div>
            <button className="apply-filter" onClick={() => setShowFilters(false)}>
              Show 48 events
            </button>
          </div>
        )}

        <div className="explore-grid">
          <div className="event-list">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                selected={selectedId === event.id}
                saved={saved.includes(event.id)}
                onSelect={() => setSelectedId(event.id)}
                onSave={() => toggleSaved(event.id)}
              />
            ))}
          </div>

          <aside className="map-panel">
            <div className="map-top">
              <span>
                <Icon name="location" size={16} /> Explore the map
              </span>
              <button>
                <Icon name="minus" size={16} />
              </button>
              <button>
                <Icon name="plus" size={16} />
              </button>
            </div>
            <div className="map-art">
              <span className="river" />
              <span className="road r1" />
              <span className="road r2" />
              <span className="road r3" />
              <span className="road r4" />
              <span className="road r5" />
              <span className="park p1" />
              <span className="park p2" />
              <span className="map-label l1">DRUMCONDRA</span>
              <span className="map-label l2">SMITHFIELD</span>
              <span className="map-label l3">RINGSEND</span>
              <span className="map-label l4">PHIBSBOROUGH</span>
              {events.map((event, index) => (
                <button
                  key={event.id}
                  className={`map-pin pin-${index + 1} ${selectedId === event.id ? "active" : ""}`}
                  onClick={() => setSelectedId(event.id)}
                >
                  €{event.price}
                </button>
              ))}
              <div className="map-detail">
                <img src={selected.image} alt="" />
                <div>
                  <small>{selected.date}</small>
                  <strong>{selected.title}</strong>
                  <span>{selected.place}</span>
                </div>
                <button onClick={() => setShowTickets(true)}>
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </div>
            <button className="locate-button">
              <span>⌖</span> Search this area
            </button>
          </aside>
        </div>

        <section className="solo-banner">
          <div className="solo-avatars">
            <span>J</span>
            <span>N</span>
            <span>R</span>
          </div>
          <div>
            <p className="eyebrow">COMING ON YOUR OWN?</p>
            <h2>You’ll be in good company.</h2>
            <p>
              Say hello in the event chat beforehand, or simply turn up. No pressure either way.
            </p>
          </div>
          <button>
            Find a welcoming event <Icon name="arrow" size={18} />
          </button>
        </section>
      </main>

      {showTickets && (
        <div className="modal-backdrop" onMouseDown={() => setShowTickets(false)}>
          <div className="ticket-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowTickets(false)}>
              <Icon name="close" />
            </button>
            <img src={selected.image} alt="" />
            <div className="modal-body">
              <p className="eyebrow">
                {selected.category} · {selected.date}
              </p>
              <h2>{selected.title}</h2>
              <p className="modal-place">
                <Icon name="location" size={17} /> {selected.place}, {selected.area}
              </p>
              <p className="modal-description">{selected.description}</p>
              <div className="ticket-option">
                <div>
                  <strong>General admission</strong>
                  <span>Access to the full event</span>
                </div>
                <b>€{selected.price}</b>
                <div className="counter">
                  <button onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}>
                    <Icon name="minus" size={15} />
                  </button>
                  <span>{ticketCount}</span>
                  <button onClick={() => setTicketCount(Math.min(6, ticketCount + 1))}>
                    <Icon name="plus" size={15} />
                  </button>
                </div>
              </div>
              <div className="modal-total">
                <span>Total</span>
                <strong>€{selected.price * ticketCount}</strong>
              </div>
              <button className="checkout-button">
                <Icon name="ticket" /> Continue to checkout
              </button>
              <p className="secure-note">
                Price includes booking fees · Secure checkout · Instant digital tickets
              </p>
            </div>
          </div>
        </div>
      )}

      <button className="floating-ticket" onClick={() => setShowTickets(true)}>
        <Icon name="ticket" />
        <span>Get tickets</span>
      </button>
    </div>
  );
}

export default App;
