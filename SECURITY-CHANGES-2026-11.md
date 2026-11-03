# Security changes — November 2026

All of these are **already live in production** (Supabase project
`hfpmlrrunlttiekfdjdz`). Committing them makes the repo match production,
so a future deploy or re-run doesn't put the old, vulnerable versions back.

## Which repo

| Repo | Changes |
|---|---|
| **Club Management app** (`garlandalefc`) | Everything in this folder |
| **Player Portal** (`garlandale-player-app`) | **None** |

## Files (paths are from the Club Management repo root)

| Path | Action | What it is |
|---|---|---|
| `migrations/2026-11-staff-write-admin-only.sql` | **New** | Only Admin/Chairman can create, change or remove staff; nobody can change their own role |
| `migrations/2026-11-safe-restore.sql` | **New** | Safe restore: pre-restore backup, never deletes parent links/messages/reads, keeps online payments |
| `migrations/2026-11-guardian-link-limit.sql` | **New** | Max 2 Player Portal logins per player, enforced in the database |
| `migrations/2026-11-player-profile-allowlist.sql` | **New** | Parents can only change contact details on their child's record |
| `migrations/2026-11-league-tables-secret.sql` | **New** | Vault secret + checker for the weekly league-tables job; fixed schedule |
| `supabase/functions/send-email/index.ts` | **Replace** | Admin/Chairman/Treasurer only; recipients on file; safe content; rate limit; audit |
| `supabase/functions/invite-player/index.ts` | **Replace** | Coaches: own teams + email on file only; parents notified; audit |
| `supabase/functions/manage-player-guardians/index.ts` | **Replace** | Coaches limited to own teams; removals audited |
| `supabase/functions/fetch-league-tables/index.ts` | **Replace** | Only runs with the Vault secret; leaguerepublic.com only; safe replace |
| `supabase/config.toml` | **New** | Keeps login checking off for fetch-league-tables only (cron can't log in) |
| `schema.sql` | **Replace** | Old `staff_all` policy, old destructive restore, broken backup function and placeholder league job removed / brought in line with production |
| `migrations/2026-08-referees.sql` | **Replace** | Same clean-up (old `staff_all`, broken backup, old restore) |
| `migrations/2026-10-push-notifications.sql` | **Replace** | Old destructive restore removed |
| `README.md` | **Replace** | Out-of-date "no login" security note rewritten |
| `SECURITY-CHANGES-2026-11.md` | **New** | This file |

## How to apply

1. Unzip, then copy the contents of `club-management-app/` over the root
   of your Club Management repo (folders line up: `migrations/`,
   `supabase/functions/...`, `schema.sql`, `README.md`).
2. Review with `git diff`, then commit, e.g.
   `git commit -am "Security fixes Nov 2026 (already live)"` (and
   `git add` the new files first).
3. **Don't re-run the migrations or redeploy the functions** — they're
   already live. Re-running is safe (they're written to run more than once),
   just unnecessary.
4. Pushing to `main` redeploys the admin app on Vercel. That's fine: no
   front-end code changed.

## Things to know

- Until this is committed, don't run `supabase functions deploy` or re-run
  `schema.sql` from the old repo — that would restore the vulnerable versions.
- `schema.sql`'s backup function now matches production, which also backs up
  tables that are only created in production (store, banners, supporters,
  guardian links). The repo still can't rebuild the whole database on its own;
  capture the full live schema with `supabase db pull` when you can.
- Player Portal repo: no changes. But **don't re-run its
  `supabase/migrations/0001_multi_child_guardian_access.sql`** — it would
  redefine `current_player_id()` and let every parent read every notice and
  match row directly. Review the notices/matches read policies first.
- League tables still won't fill: LeagueRepublic returns 403 (bot
  protection). Ask them or the federation for access or a data feed.
