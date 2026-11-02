# Tammeni UI boundaries

- `/` is the protected Madrasati-style entry. Its original navigation, logo, school panels, student selection, and assistant entry links remain in `src/components/madrasati/`.
- `/login` retains the matching original entry screen.
- `/welcome` is Tammeni onboarding. Its default destination is `/tammeni`; explicit supported return links still take precedence.
- `/tammeni` is Tammeni's own parent dashboard. `/assistant` and `/assistant/confirmation` retain their existing URLs and student query parameters.
- `/demo-control` is the separate operator studio, not part of the parent navigation.

The protected homepage was recovered from the source read before the redesign, including the pre-existing removal of an exam-kind badge. It was not reset to the repository's HEAD. The earlier backend, data, integration, and other uncommitted work remains in place.

`src/app/globals.css` retains the original shared rules. The redesign's tokens, typography, controls, and motion are scoped to `.tammeni-experience` in `src/components/brand/tammeni.css`. `TammeniExperience` loads IBM Plex Sans Arabic only inside that boundary; the entry pages retain Tajawal. Do not move scoped tokens or element selectors back onto `body` or `:root`.

## Safe verification

Run `npm test`, `npx tsc --noEmit`, `npx eslint src`, and `npm run build` for local checks. Browser verification must not persist preferences, create/delete school records, dispatch notifications, refresh provider status, or initiate calls. Stub non-read requests in the browser for success/error interaction tests. A simulated browser response is not a successful backend dispatch or persistence test.

Check `/` before and after visiting Tammeni through a client-side link: its font, palette, header, buttons, and navigation must remain unchanged. Check both `/` and the Tammeni routes at desktop, tablet, and mobile widths.
