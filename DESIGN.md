# Design

Tammeni's visual world: **the school day reaching home.** A sibling of the owner's products NAQAH, Amanah and Seet: two grounds, one warm metal, calm status colours, big Arabic headlines, real product moments as proof.

Scope: every Tammeni screen (`/welcome`, `/tammeni`, `/assistant`, `/assistant/confirmation`, `/demo-control`, `/login`). Never restyle `/` (the Madrasati copy in `src/components/madrasati/`), and never move tokens onto `body` or `:root`: they live in `.tammeni-experience` (`src/components/brand/tammeni.css`).

## Palette

| Role | Token | Value | Use |
|---|---|---|---|
| Board (deep field) | `board` | `#123A34` | Header, welcome hero, page bands, footer, primary button on paper |
| Board raised / line | `board-raised`, `board-line` | `#1B4A42`, `#2F6458` | Tracks on the board; focus ring on paper |
| Chalk | `chalk`, `chalk-soft` | `#F4EEE1`, `#C7D2C9` | Text on the board; primary button on the board |
| Paper | `ground`, `surface`, `panel` | `#F7F2E8`, `#FCF9F2`, `#EFE8DA` | Page, sheets, quiet panels. Never pure white |
| Ink | `ink`, `ink-soft`, `faint` | `#16261F`, `#45524B`, `#5C6761` | Text on paper |
| Bell brass (the accent) | `bell`, `bell-light`, `bell-soft`, `bell-ink` | `#C9973F`, `#E2BE76`, `#F4E7CB`, `#7A561A` | One lit thing per screen: the logo on the board, the active nav mark, the note's bell, the last timeline stop |
| Margin red | `margin` | `#C2553F` | Decoration only: the 1px exercise-book margin on `.note`. Never text or status |
| Status | `ok/warn/danger/info` + `-bg` | muted pairs | Always with a word |

## Type

- Headings: **Alexandria** 600 (`--font-display`, applied to h1–h3), tracking 0, `text-wrap: balance`. Page titles 36→48px on bands, welcome hero 44→72px.
- Body: **IBM Plex Sans Arabic**, 16–17px, line-height 1.7–1.85. Latin digits, `<bdi>` around numbers and Latin text.

## Components

- Buttons: pills, 48px (44 small). One primary per screen. On paper the primary is board with chalk text; on the board it is chalk with board text (`.on-board .btn-primary`). The second action is a `.text-link` (underlined verb + arrow pointing the reading direction), not a second filled button.
- Surfaces separate by tone, not shadows: `.sheet` (surface, 1px line, radius 20), `.tone` (panel), `.lit` (bell-soft). Only floating things cast a shadow.
- **Signature: `.note`**, the note home. A surface slip with a 1px margin-red rule near its start edge and a brass bell in the margin. It carries the one piece of news that matters on a screen (the dashboard's next exam, the message example). Use at most once per screen.
- **Board band**: page title on `.on-board`, the working sheet overlaps its lower edge (`-mt-12`), as on Amanah's form pages.
- `.perforation`: a dotted rule, one seam per screen (the footer).
- Fields 48px, radius 12, 1.5px control border, board-line focus.
- Icons: the existing one-stroke set in `src/components/dashboard/icons.tsx`. No icon-in-circle feature grids.

## Motion

One ease everywhere: `cubic-bezier(0.22, 1, 0.36, 1)`. Micro 150ms, arrive 260ms, rise 520ms. One authored moment per screen (the welcome greeting). Reduced motion: still and complete.

## Voice

Short Saudi Arabic. Headlines can be questions (وش صار مع عيالك اليوم؟). No eyebrows above headings, no ALL CAPS, no numbered sections, no emoji, no exclamation marks. Examples always say they are examples with fictional data.
