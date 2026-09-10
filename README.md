# NPM Portal — free auth starter (GitHub + Supabase)

A tiny React app where students sign in with their **NPM** (a numeric ID).
On first visit a whitelisted NPM sets a password and an account is created;
afterwards the same NPM + password signs them in. Everything runs on free tiers:

- **Supabase** — database + auth (stores users & hashes passwords for you)
- **GitHub Pages** — static hosting
- **GitHub Actions** — CI/CD (auto-deploy on every push to `main`)

## How the login works

1. User types their NPM. The app calls `npm_login_status(npm)` which answers
   `not_whitelisted` / `unregistered` / `registered`.
2. **unregistered** → "create a password" screen → `auth.signUp`.
   A Supabase *Before-User-Created hook* rejects any NPM not in the whitelist.
3. **registered** → "enter password" screen → `auth.signInWithPassword`.

NPMs aren't emails, so each NPM maps to a synthetic email `\<npm>@npm.app`.
**You never store passwords yourself** — Supabase Auth hashes them in `auth.users`.
Your NPM lives in the `profiles` table, linked to the auth user.

---

## Setup (about 15 minutes)

### 1. Database & auth rules
Open **Supabase → SQL Editor → New query**, paste all of `sql/setup.sql`, Run.
This creates the `npm_whitelist` and `profiles` tables, RLS policies, the
signup hook, and seeds two test NPMs (`1234567890`, `2222222222`).

### 2. Turn OFF email confirmation
The synthetic emails are never real, so confirmation must be off:
**Authentication → Sign In / Providers → Email** → turn **Confirm email** OFF → Save.
Keep **Allow new users to sign up** ON.

### 3. Enable the whitelist hook
**Authentication → Hooks → Before User Created** → enable → choose the Postgres
function `hook_check_npm_whitelist` → Save.

### 4. Run it locally (optional)
```bash
cp .env.example .env      # values are already filled in for your project
npm install
npm run dev
```
Visit the printed URL and sign in with `1234567890`.

### 5. Deploy to GitHub Pages
1. Push this folder to a GitHub repo (`main` branch).
2. **Repo → Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. **Repo → Settings → Secrets and variables → Actions** add two **secrets**:
   - `VITE_SUPABASE_URL` = `https://cdypfbswmzwvfjoqzykh.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your publishable key (`sb_publishable_...`)
   (Optional **variable** `VITE_NPM_EMAIL_DOMAIN` if you change it from `npm.app`.)
4. Push, or run the **Deploy to GitHub Pages** action. Site goes live at
   `https://<you>.github.io/<repo>/`.

---

## Adding NPMs to the whitelist
In the SQL Editor:
```sql
insert into public.npm_whitelist (npm, full_name)
values ('0011223344', 'Jane Doe');
```
Or edit the table directly in **Table Editor → npm_whitelist**.

## Notes on security
- The publishable / anon key is *meant* to be public — it's safe in client code.
- Your **database password** and **service_role key** are NOT used here and must
  never be committed or shared.
- All real protection is enforced server-side: RLS policies + the signup hook.
  Add RLS policies to every new table you create.

## Changing the email domain
If you change `npm.app`, update it in **both** `sql/setup.sql`
(`hook_check_npm_whitelist`) and `VITE_NPM_EMAIL_DOMAIN`. Use a normal
`name.tld` shape so Supabase accepts the email format.

## SQL Lab (MySQL)

The **SQL** menu provides a shared classroom MySQL workbench. Administrators can
create and modify the database; students receive read-only query access. MySQL
credentials are kept in Supabase Edge Function secrets and are never sent to the
browser.

Create two MySQL users for the same classroom database. Give the admin user the
DDL/DML privileges you need, and restrict the student user at the database level:

```sql
CREATE USER 'sql_lab_admin'@'%' IDENTIFIED BY 'use-a-strong-password';
GRANT ALL PRIVILEGES ON classroom.* TO 'sql_lab_admin'@'%';

CREATE USER 'sql_lab_student'@'%' IDENTIFIED BY 'use-another-strong-password';
GRANT SELECT, SHOW VIEW ON classroom.* TO 'sql_lab_student'@'%';
FLUSH PRIVILEGES;
```

Then configure and deploy the function (URL-encode special characters in the
passwords):

```bash
supabase secrets set MYSQL_ADMIN_URL="mysql://sql_lab_admin:password@host:3306/classroom"
supabase secrets set MYSQL_STUDENT_URL="mysql://sql_lab_student:password@host:3306/classroom"
supabase functions deploy mysql-console
```

The MySQL server must accept TLS connections from Supabase's Edge Function
network. Keep `MYSQL_STUDENT_URL` read-only even though the function also blocks
write statements, providing defense in depth.
