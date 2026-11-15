/**
 * Entity types for the Converge prototype.
 *
 * Field names follow docs/erd.md (camelCased). State names follow the
 * booking / event / ticket state tables (requirements.md §5.1), which win
 * over the older ERD enums. In the real system these live in
 * packages/shared and are inferred from the Drizzle schema (ADR 003, ADR 005).
 *
 * Money is integer cents in EUR. Times are ISO-8601 UTC strings, shown in
 * Europe/Dublin (NFR 32).
 */

export type Role = "attendee" | "organiser" | "venue_operator";

export type BookingStatus =
  | "Pending"
  | "Approved"
  | "Confirmed"
  | "Rejected"
  | "Cancelled"
  | "Expired"
  | "Completed";

export type EventStatus = "Draft" | "Published" | "Sold Out" | "Completed" | "Cancelled";

export type TicketStatus = "Reserved" | "Paid" | "Checked In" | "Released" | "Refunded" | "No Show";

export type OrderStatus = "Reserved" | "Paid" | "Released";

export type Category =
  | "Trad & folk"
  | "Food & drink"
  | "Live music"
  | "Arts & culture"
  | "Community"
  | "Comedy";

export const CATEGORIES: Category[] = [
  "Trad & folk",
  "Food & drink",
  "Live music",
  "Arts & culture",
  "Community",
  "Comedy",
];

export interface User {
  id: string;
  name: string;
  initials: string;
  roles: Role[];
  /** Organisation shown as the organiser name on events (FR 7). */
  organisation?: string;
  /** Average rating from past events (FR 40, FR 65). */
  rating?: { average: number; count: number };
  interests?: Category[];
}

export interface TransitStop {
  id: string;
  name: string;
  mode: "Luas" | "DART" | "Dublin Bus";
  line?: string;
}

export interface Image {
  url: string;
  alt: string;
}

export interface VenuePackage {
  id: string;
  name: string;
  model: "flat_fee" | "per_person" | "minimum_spend";
  priceCents: number;
  depositCents: number;
  minGuests: number;
  maxGuests: number;
  inclusions: string[];
}

export interface TimeRange {
  startsAt: string;
  endsAt: string;
}

export interface Venue {
  id: string;
  name: string;
  description: string;
  address: string;
  area: string;
  eircodeRoutingKey: string;
  lat: number;
  lon: number;
  /** Position on the illustrated map, in % of its width/height (DECISIONS D-007). */
  map: { x: number; y: number };
  /** Derived by trigger in the real system (KNN within 2 km). */
  nearestStopId: string;
  nearestStopM: number;
  capacityStanding: number;
  capacitySeated: number;
  facilities: string[];
  photos: Image[];
  packages: VenuePackage[];
  availability: TimeRange[];
  /** False for the real export venues: they host seeded events but aren't bookable listings (D-027). */
  listed: boolean;
  /** venue_members: users who can manage bookings for this venue. */
  memberIds: string[];
}

export interface BookingHistoryEntry {
  status: BookingStatus;
  at: string;
  by: string;
  note?: string;
}

export interface Booking {
  id: string;
  venueId: string;
  packageId?: string;
  organiserId: string;
  startsAt: string;
  endsAt: string;
  expectedGuests: number;
  message: string;
  status: BookingStatus;
  declineReason?: string;
  quotedPriceCents: number;
  depositCents: number;
  history: BookingHistoryEntry[];
}

export interface ConvergeEvent {
  id: string;
  bookingId: string;
  venueId: string;
  organiserId: string;
  category: Category;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  coverImage: Image;
  /** "Welcoming if you're coming on your own" (export filter drawer, FR 60). */
  welcomingSolo: boolean;
  publishedAt?: string;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  description: string;
  priceCents: number;
  quantityTotal: number;
  /** Includes tickets currently Reserved (held). CHECK sold <= total in the real DB. */
  quantitySold: number;
  maxPerOrder: number;
}

export interface OrderLine {
  ticketTypeId: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  id: string;
  userId: string;
  eventId: string;
  lines: OrderLine[];
  subtotalCents: number;
  discountCents: number;
  feeCents: number;
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
  /** Real wall-clock epoch ms when the 10-minute hold ends (FR 46, FR 49). */
  holdExpiresAtMs: number;
  paymentRef?: string;
}

export interface Ticket {
  id: string;
  orderId: string;
  eventId: string;
  ticketTypeId: string;
  holderId: string;
  /** Random, unguessable (FR 50). Only meaningful once Paid. */
  qrToken: string;
  status: TicketStatus;
  checkedInAt?: string;
}

export interface Post {
  id: string;
  eventId: string;
  authorId: string;
  parentId?: string;
  body: string;
  createdAt: string;
}

export interface AttendeeStatus {
  eventId: string;
  userId: string;
  attendingAlone: boolean;
  openToMessages: boolean;
}

export type InteractionKind = "view" | "save" | "unsave" | "purchase" | "venue_view" | "enquiry";

export interface Interaction {
  userId: string;
  kind: InteractionKind;
  eventId?: string;
  venueId?: string;
  at: string;
}

export interface Notification {
  id: string;
  userId: string;
  text: string;
  link?: string;
  /** Which role view the notification belongs to (the demo user holds all three). */
  forRole: Role;
  at: string;
  read: boolean;
}

export interface Db {
  users: User[];
  stops: TransitStop[];
  venues: Venue[];
  bookings: Booking[];
  events: ConvergeEvent[];
  ticketTypes: TicketType[];
  orders: Order[];
  tickets: Ticket[];
  posts: Post[];
  attendeeStatus: AttendeeStatus[];
  savedEventIds: string[];
  interactions: Interaction[];
  notifications: Notification[];
}
