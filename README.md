# Akinal İnşaat Project

## Local development

The frontend (Vite, port 8080) and the PHP API (`public_html/api/`) run as two separate
local servers; the Vite dev server proxies `/api/*` requests to the PHP one (see
`vite.config.ts`).

1. Start the PHP backend (from the repo root):
   ```bash
   php -S localhost:8000 -t public_html
   ```
   Requires `public_html/api/config.php` to exist locally (copy `config.example.php` and
   fill in DB credentials) for endpoints that touch the database.

2. Start the frontend, in a separate terminal:
   ```bash
   npm run dev
   ```
   Opens on `http://localhost:8080`. `/api/*` requests are proxied to `http://localhost:8000`
   by default; override with `VITE_API_PROXY_TARGET` if your local PHP server runs elsewhere
   (e.g. XAMPP/Apache on a different port).
