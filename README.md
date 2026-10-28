# Madrasati-AI-Assistant
AI-powered parent communication assistant for Madrasati


Educational prototype inspired by Madrasati. Use fictional student records only. This project is not affiliated with the official Madrasati platform.

## Local development

Requires Node.js 20.9 or newer.

1. Run `npm install`.
2. Run `npm run dev`.
3. Open http://localhost:3000.

Checks: `npm run lint` and `npm run build`.

The Arabic RTL foundation is configured. Parent setup UI and Supabase integration are the next steps. No credentials are required for the starter. Never commit secrets or real student records.


## Supabase connection

Copy `.env.example` to `.env.local` if the local file is missing. In the Supabase project, open **Connect** and paste the project URL and **publishable** key into the two variables. Never use a secret or service-role key. Restart the development server after editing this file.

Run `npm run supabase:check` to verify the public API connection without printing configuration values or accessing student records. This checks connectivity, not table permissions.

The dashboard still uses fictional fixtures and preferences still use browser storage. Connection setup does not add authentication, tables, policies, scheduling, or voice calls. Before moving preferences to Supabase, add authentication and parent-specific RLS policies; keep RLS enabled.
