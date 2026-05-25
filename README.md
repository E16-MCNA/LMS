# E16 LMS

## Production Setup

Recommended host: Render web service using `render.yaml`.

Required environment variables:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=change-me-to-a-long-random-secret
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Deploy steps:

```bash
npm ci
npm run db:migrate
npm run db:drift
npm run build
npm start
```

CI runs `npm ci`, `npm run lint`, and `npm run build` on push and pull request.

Post-deploy smoke test:

```bash
DEPLOY_URL=https://your-domain.example npm run smoke:deploy
```

Academic E2E flow against a running server:

```bash
E2E_BASE_URL=http://localhost:3100 npm run test:e2e
```

Enable HTTPS/SSL in the host provider, attach the custom domain, then run the smoke test against the final HTTPS URL.

Rollback procedure is documented in `docs/rollback-checklist.md`.
