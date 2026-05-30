# PHP API Router Notes

The API is planned as simple same-domain PHP endpoints under `/api`. The React/Vite frontend can call these endpoints with relative URLs such as `/api/projects.php`.

## Foundation Files

- `config.example.php`: placeholder database settings only. Copy to `config.php` on the production server and fill in credentials there.
- `db.php`: loads server-only `config.php` and creates the shared PDO connection.
- `response.php`: JSON response helpers and method enforcement.
- `auth.php`: session helpers and admin guard scaffolding.

## Public Endpoints Planned

- `GET /api/site-settings.php`
- `GET /api/projects.php`
- `GET /api/project-detail.php?slug=`
- `POST /api/contact-request.php`
- `POST /api/cookie-consent.php`

## Admin Endpoints Planned

- `POST /api/admin/login.php`
- `POST /api/admin/logout.php`
- `GET /api/admin/me.php`
- `CRUD /api/admin/projects.php`
- `CRUD /api/admin/customers.php`
- `CRUD /api/admin/finance.php`
- `CRUD /api/admin/media.php`
- `CRUD /api/admin/settings.php`

## Routing Approach

This phase uses direct PHP files instead of a front controller to stay compatible with shared hosting. A later phase can add a thin router if the host supports URL rewriting cleanly.
