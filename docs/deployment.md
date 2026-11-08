# Deploying Tammeni

Two services, both independent of any laptop. Values live only in each host's settings; never in Git.

| Service | Host | Source |
|---|---|---|
| Website (Next.js) | Vercel, project `tammeni-demo` | Repository root; `.vercelignore` excludes the backend |
| Backend (FastAPI, persistent WebSockets) | Railway, service `tammeni-backend` | `Test_AI_Agent_Upload`, staged by `scripts/stage-backend.sh` |

## Database

Apply `supabase/migrations/` in filename order.

## Website

```
vercel deploy --prod
```

Production settings (names only):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `TAMMENI_BACKEND_URL`: the backend's public HTTPS address
- `TAMMENI_DISPATCH_SECRET`: must equal the backend's value
- `TAMMENI_OPERATOR_PASSWORD`: `/demo-control` login, username `operator`
- `TAMMENI_DEMO_PARENT_EMAIL`, `TAMMENI_DEMO_PARENT_PASSWORD`: the fictional parent's sign-in

## Backend

The Dockerfile requires the dataset, so deploy from a staged folder rather than the repository directly:

```
scripts/stage-backend.sh /tmp/tammeni-backend
cd /tmp/tammeni-backend
railway link
railway up --ci --service tammeni-backend
```

Production settings (names only):

- `PUBLIC_URL`: this service's own HTTPS origin, with no path; Twilio signatures are checked against it
- `TAMMENI_DISPATCH_SECRET`: must equal the website's value
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- `MADRASATI_DATASET=/app/backend/data/madrasati-dataset.json`
- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
- `PARENT_PHONE` (calls), `PARENT_PHONE1` (messages), `TAMMENI_ALLOWED_DESTINATIONS`
- `TAMMENI_SITE_URL`: the website's address, used by the scheduler clock
- `TAMMENI_PROVIDER`, `TAMMENI_SCHEDULER_ENABLED`: see below

The image sets `TAMMENI_PUBLIC_DEPLOYMENT=1`, which limits the public API to health, signed call routes and secret-protected routes.

## Sending switches

Everything is off by default. Each row is independent.

| Switch | Host | Off | On | Effect when on |
|---|---|---|---|---|
| `TAMMENI_PROVIDER` | Railway | `mock` | `twilio` | The backend can reach Twilio |
| `TAMMENI_DEMO_REAL_DISPATCH` | Vercel | unset | `1` | Operator sends can go to the provider |
| `TAMMENI_AUTO_DISPATCH` | Vercel | unset | `1` | Due updates are processed (mock on its own) |
| `TAMMENI_SCHEDULER_ENABLED` | Railway | `0` | `1` | The clock calls the website once a minute |
| `TAMMENI_AUTO_DISPATCH_REAL` | Vercel | unset | `1` | Automatic sends can go to the provider |

Vercel settings apply on the next deployment. Before real automatic sending is turned on, update `NO_AUTOMATIC_SENDING` in `src/components/assistant/config.ts`, because parents are told sending is manual.
