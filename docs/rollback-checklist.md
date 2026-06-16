# Rollback Checklist

1. Identify the last known good Git commit and deployment ID.
2. Pause new deploys.
3. Confirm Supabase backups and current migration version with `npm run db:drift`.
4. Roll the web service back to the last known good deployment.
5. If a database rollback is required, restore Supabase into a temporary project first and validate with `npm run db:drift`.
6. Repoint production only after smoke tests pass.
7. Run `DEPLOY_URL=https://your-domain npm run smoke:deploy`.
8. Record incident timeline, failed commit, restored commit, and database restore point.
