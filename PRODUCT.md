# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Parent (primary):** a Saudi parent, usually on a phone, who wants school news about each child (attendance, exams, grades) without opening the school platform every day. Reads Arabic, right to left. In the public demo every visitor signs in as the same fictional parent, linked to two children (ريم and نواف).
- **Demo operator:** a team member who uses the demo studio (`/demo-control`) to add school events and send updates during a demo. Password-protected on the live site.
- LinkedIn visitors see the same parent experience; it is not redesigned for them separately.

## Product Purpose

طمّني (Tammeni) lets a parent choose, per child and per topic, what school news reaches them, when, and how: a phone call from an AI voice agent (لولوة) or a text message. Success: the parent knows what matters about each child without checking the platform.

## Positioning

The update reaches the parent by an ordinary call or text, on the parent's own schedule, and the call is a conversation: the parent can ask about the child's attendance or grades and hear answers from the child's record.

## Operating Context

- `/welcome` is the entry; one button starts the demo with no account.
- `/tammeni` is the parent dashboard; `/assistant` holds the alert settings (step-by-step questions for a first-time parent, a summary once saved, and «ابدأ من جديد» to start over); `/assistant/confirmation` confirms a save.
- `/demo-control` is the operator studio: record an event, see Tammeni's decision, preview, send (mock unless real sending is switched on).
- `/` and `/login` are a deliberate copy of the official Madrasati platform, the "before" that Tammeni sits beside. They must keep looking like the real Madrasati site; do not restyle them.

## Capabilities and Constraints

- Topics: attendance, exam reminders, grades. Timings: right away, end of day, weekly/custom, days before an exam, monthly grade summary. Methods: call or text.
- In the public demo nothing is sent automatically; sends happen only from the demo studio. Unanswered-call retry is saved but not active.
- Fictional data only; not affiliated with Madrasati or the Ministry of Education. The demo banner says so on every page.
- Data lives in Supabase with row-level security; the backend (FastAPI) places calls (OpenAI voice) and texts (Twilio).

## Brand Commitments

- Name: طمّني (Tammeni).
- The character art of لولوة and تركي (`public/characters/`) stays.
- Voice: short, natural Saudi Arabic ("وش يوصلك", "تبي"), plain and calm.
- Sibling of the owner's other products NAQAH, Amanah and Seet: it should read as made by the same hand.

## Evidence on Hand

- Fictional school dataset (`supabase/data/madrasati-dataset.json`), live demo at https://tammeni-demo.vercel.app/welcome, project report and presentation in `docs/`.
- No real users, testimonials or metrics exist; never invent them.

## Product Principles

1. Lead with the child's news, not with the product.
2. A first-time parent finishes setup by answering simple questions, one at a time.
3. Say only what actually happens: no implied automatic sending, no invented certainty.
4. Short Arabic text; one clear next action per screen.

## Accessibility & Inclusion

Arabic RTL first, readable on a phone outdoors, keyboard-usable, WCAG AA contrast, respects reduced motion.
