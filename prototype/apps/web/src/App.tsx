import { useEffect, useRef, type ReactElement } from "react";
import { Route, Routes, useLocation } from "react-router";
import { RoleGate, Toasts } from "./components/Feedback";
import { TopBar } from "./components/TopBar";
import { Checkout } from "./screens/attendee/Checkout";
import { Community, CommunityIndex } from "./screens/attendee/Community";
import { EventPage } from "./screens/attendee/EventPage";
import { MyTickets } from "./screens/attendee/MyTickets";
import { WhatsOn } from "./screens/attendee/WhatsOn";
import { OrganiserAnalytics, VenueAnalytics } from "./screens/analytics/Analytics";
import { HostLanding } from "./screens/HostLanding";
import { NotFound } from "./screens/NotFound";
import { BookingDetail } from "./screens/organiser/BookingDetail";
import { EventEditor } from "./screens/organiser/EventEditor";
import { MyEvents, OrganiserHome } from "./screens/organiser/OrganiserHome";
import { VenuePage } from "./screens/organiser/VenuePage";
import { VenueSearch } from "./screens/organiser/VenueSearch";
import { BookingReview, VenueHome, VenueListings } from "./screens/venue/VenueScreens";

/**
 * After each client-side navigation, move focus to the new page's <h1> so
 * screen-reader and keyboard users start at the top of the new content (D-031).
 */
function useRouteFocus() {
  const { pathname } = useLocation();
  // Track the previous path rather than a "first render" flag, so StrictMode's
  // double-run of effects in development doesn't steal focus on initial load.
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    window.scrollTo(0, 0);
    const h1 = document.querySelector<HTMLElement>("main h1");
    if (h1) {
      h1.setAttribute("tabindex", "-1");
      h1.focus({ preventScroll: true });
    }
  }, [pathname]);
}

const organiser = (el: ReactElement) => <RoleGate role="organiser">{el}</RoleGate>;
const operator = (el: ReactElement) => <RoleGate role="venue_operator">{el}</RoleGate>;

export default function App() {
  useRouteFocus();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <TopBar />
      <main id="main" tabIndex={-1}>
        <Routes>
          {/* Journey 1: attendee discovers and buys */}
          <Route path="/" element={<WhatsOn />} />
          <Route path="/events/:eventId" element={<EventPage />} />
          <Route path="/checkout/:orderId" element={<Checkout />} />
          <Route path="/tickets" element={<MyTickets />} />
          {/* Journey 3: community (ticket holders and organiser only, FR 58) */}
          <Route path="/community" element={<CommunityIndex />} />
          <Route path="/events/:eventId/community" element={<Community />} />
          {/* Journey 2: organiser and venue operator */}
          <Route path="/host" element={<HostLanding />} />
          <Route path="/organiser" element={organiser(<OrganiserHome />)} />
          <Route path="/organiser/venues" element={organiser(<VenueSearch />)} />
          <Route path="/organiser/bookings/:bookingId" element={organiser(<BookingDetail />)} />
          <Route path="/organiser/events" element={organiser(<MyEvents />)} />
          <Route path="/organiser/events/:eventId" element={organiser(<EventEditor />)} />
          {/* Analytics dashboards (FR 67–FR 71) */}
          <Route path="/organiser/analytics" element={organiser(<OrganiserAnalytics />)} />
          <Route path="/venue/analytics" element={operator(<VenueAnalytics />)} />
          <Route path="/venues/:venueId" element={<VenuePage />} />
          <Route path="/venue" element={operator(<VenueHome />)} />
          <Route path="/venue/listings" element={operator(<VenueListings />)} />
          <Route path="/venue/bookings/:bookingId" element={operator(<BookingReview />)} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Toasts />
    </div>
  );
}
