# GitHub Pages + Supabase setup (no local `.env` required)

If you deploy only through GitHub Pages, keep Supabase values in GitHub Secrets and inject them at build time.

## Required environment secrets

Create these in **Settings → Environments → github-pages**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional:

- `VITE_SUPABASE_AUTH_REDIRECT_URL` (use your GitHub Pages callback URL, for example `https://<user>.github.io/<repo>/auth/callback`)

## Why this is required

The web app reads Vite env vars at build time and will fail fast if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing.【apps/web/src/services/supabaseClient.ts】

## GitHub configuration

1. Go to **Settings → Environments → github-pages**.
2. Add the required secrets above.
3. Enable GitHub Pages source as **GitHub Actions**.
4. Use `.github/workflows/deploy-web-pages.yml` to build and deploy.

The workflow uses environment **github-pages** for both build-time secrets and deployment URL tracking.

## Supabase dashboard URL setup (GitHub Pages only)

In Supabase **Authentication → URL Configuration**:

1. Set **Site URL** to your published GitHub Pages origin:
   - `https://<user>.github.io/<repo>/`
2. Add **Additional Redirect URLs** for any auth callbacks you use, at minimum:
   - `https://<user>.github.io/<repo>/auth/callback`

Then set `VITE_SUPABASE_AUTH_REDIRECT_URL` in the `github-pages` environment to that same callback URL.

## Security note

`VITE_SUPABASE_ANON_KEY` is intended for browser clients. Do **not** put Supabase `service_role` keys in frontend env vars.
