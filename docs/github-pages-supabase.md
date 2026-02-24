# GitHub Pages + Supabase setup (no local `.env` required)

If you deploy only through GitHub Pages, keep Supabase values in GitHub Secrets and inject them at build time.

## Required environment secrets

Create these in **Settings → Environments → dev**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional:

- `VITE_SUPABASE_AUTH_REDIRECT_URL` (use your GitHub Pages URL, for example `https://<user>.github.io/<repo>/`)

## Why this is required

The web app reads Vite env vars at build time and will fail fast if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing.【apps/web/src/services/supabaseClient.ts】

## GitHub configuration

1. Go to **Settings → Environments → dev**.
2. Add the required secrets above.
3. Enable GitHub Pages source as **GitHub Actions**.
4. Use `.github/workflows/deploy-web-pages.yml` to build and deploy.

The workflow uses environment **dev** for the build job (to read your Supabase test secrets) and deploys to GitHub Pages in a separate `github-pages` environment.

## Security note

`VITE_SUPABASE_ANON_KEY` is intended for browser clients. Do **not** put Supabase `service_role` keys in frontend env vars.
