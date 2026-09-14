# Bidipta Roy | Educational Design

A portfolio website for original educational T-shirt designs. Visitors browse the
published designs. The owner signs in at `/admin` to upload, preview, publish, edit,
reorder, unpublish, and delete designs, all from the browser, with no code changes or
redeploys.

Built with Next.js, TypeScript, and Tailwind CSS. Supabase provides the login, the
database, and image storage. Hosted on Vercel.

> This site is a portfolio. It is not connected to Amazon, and having it does not
> guarantee acceptance to Amazon Merch on Demand or any other program.

---

## 1. Run the site on your computer

1. Install **Node.js 20.9 or newer** (the "LTS" download from <https://nodejs.org>).
2. Open a terminal in this folder and install the packages:

   ```bash
   npm install
   ```

3. Create your settings file by copying the example:

   ```bash
   # Windows (PowerShell)
   Copy-Item .env.example .env.local
   # macOS / Linux
   cp .env.example .env.local
   ```

   You will fill it in during step 2.

4. Start the site:

   ```bash
   npm run dev
   ```

   - Portfolio: <http://localhost:3000>
   - Admin: <http://localhost:3000/admin>

Until Supabase is set up, the portfolio shows an empty gallery and the admin page
explains what is missing. After you edit `.env.local`, stop the site (Ctrl + C) and
run `npm run dev` again.

Other useful commands: `npm run build` (production build), `npm run lint`, and
`npm test` (checks the upload and form validation rules).

---

## 2. Set up Supabase (one time, about 10 minutes)

### 2a. Create a project

1. Sign up at <https://supabase.com> and click **New project**.
2. Choose a name, a region near you, and the **Free** plan. Supabase asks for a
   database password: save it in a password manager. This website never needs it.
3. Wait a minute or two for the project to finish setting up.

### 2b. Create the database tables, storage, and access rules

1. In the left sidebar, open **SQL Editor** and start a **New query**.
2. Open `supabase/migrations/20260914120000_portfolio.sql` from this project in any
   text editor, copy **all** of it, and paste it into the query box.
3. Click **Run**. You should see "Success. No rows returned".
4. Check that it worked:
   - **Table Editor** lists `designs` and `admins`.
   - **Storage** lists `design-uploads` (private) and `published-designs` (public).

It is safe to run the file again later; it will not delete anything.

### 2c. Turn off public sign-ups

Open **Authentication → Sign In / Providers**. Some dashboard versions call this
area "General configuration". Turn off **Allow new users to sign up**, then save.

Even if sign-ups were left on, a new account still could not change anything,
because only accounts in the `admins` table can. Turning sign-ups off is tidier.

### 2d. Copy your two public settings into `.env.local`

| Setting in `.env.local` | Where to find it in Supabase |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Click **Connect** at the top of the dashboard, or **Project Settings → Data API → Project URL**. It looks like `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Project Settings → API Keys → Publishable key** (starts with `sb_publishable_`). Older projects may only show a legacy **anon** key, which also works. |

These two values are designed to be public. **Never** use the *secret* key or the
*service_role* key, and never share them. This site doesn't need them.

---

## 3. Create your owner account and sign in

1. In Supabase, open **Authentication → Users → Add user → Create new user**.
2. Enter your email address and a strong password, tick **Auto Confirm User**, and
   click **Create user**.
3. Make that account an owner. Open **SQL Editor → New query**, paste the following
   with your email in place of the example, and click **Run**:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

   To check: run `select * from public.admins;`. It should show one row.

4. Restart `npm run dev`, go to <http://localhost:3000/admin>, and sign in.

**Giving your sister access:** repeat steps 1 to 3 with her email address.

**Forgot your password?** This site has no reset-by-email page. In Supabase, delete
the user under **Authentication → Users**, create it again with a new password, and
run the SQL from step 3 again. Designs don't belong to a user account, so nothing is
lost.

---

## 4. Upload and publish your first design

1. Go to `/admin` and click **Upload your first design**.
2. Drag your artwork into **Design image**, or click the box to choose a file.
   Use PNG (a transparent background works best), JPEG, or WebP, up to 10 MB.
   Wait until it says **Uploaded**.
3. Optionally add a **T-shirt mockup** the same way.
4. Fill in **Title**, **Subject** (for example *Immunology*), **Short description**,
   and **Image description** (one sentence describing the artwork for screen readers).
5. Choose one:
   - **Save draft**: stays private; only you see it in `/admin`.
   - **Preview & publish**: shows exactly how visitors will see it. Then click
     **Publish now**.
6. Click **View it on the portfolio**. The design is live immediately.

Later, from the `/admin` list:

- **Edit** changes the details, replaces images, or unpublishes.
- **Preview & publish** publishes a draft.
- **Unpublish** hides a design and turns it back into a draft.
- The **↑ ↓ arrows** set the order designs appear on the portfolio.
- **Delete** removes a design and its images, after asking you to confirm.

Subject filter buttons appear on the portfolio once there are at least 4 published
designs in at least 2 subjects.

---

## 5. Deploy on Vercel

### 5a. Put the code on GitHub

This folder is already linked to `github.com/BidiptaRoy/Art-Portfolio-`. From a
terminal in this folder:

```bash
git add -A
git commit -m "Portfolio website"
git push -u origin main
```

`.env.local` is ignored by git, so your settings stay on your computer.

### 5b. Create the Vercel project

1. Sign up at <https://vercel.com> using your GitHub account.
2. Click **Add New… → Project** and **Import** the `Art-Portfolio-` repository.
   Vercel detects Next.js automatically.
3. Open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL`: same value as in `.env.local`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: same value as in `.env.local`
4. Click **Deploy** and wait for it to finish.
5. Optional, for nicer link previews: copy your site address (for example
   `https://art-portfolio.vercel.app`). Add it as `NEXT_PUBLIC_SITE_URL` under
   **Settings → Environment Variables**, then redeploy
   (**Deployments → ⋯ next to the latest one → Redeploy**).

Environment variables are built into the site, so **change them only with a
redeploy**. Uploading and publishing designs **never** needs a redeploy.

### 5c. Make sure visitors don't see a Vercel login

Vercel has two kinds of addresses:

- **Production domain**: short, for example `art-portfolio.vercel.app`, shown under
  **Domains** on the project page. **Share this one.**
- **Deployment URLs**: long, with random letters, for example
  `art-portfolio-a1b2c3-bidipta.vercel.app`. By default these ask for a Vercel login.

To check, open your production domain in a private/incognito window. If it asks you
to log in to Vercel, go to **Settings → Deployment Protection**, make sure
**Vercel Authentication** uses **Standard Protection** (not "All Deployments"), and
save.

---

## 6. Limitations and costs

- **Supabase Free plan** includes 500 MB of database space, 1 GB of file storage, and
  5 GB of data transfer per month, which is plenty for a portfolio. If a free project
  has no activity for a week, Supabase can **pause** it, and the site will show an error
  until you click **Restore project** in the dashboard. The Pro plan ($25/month)
  doesn't pause.
- **Vercel Hobby plan** is free and includes 5,000 image resizes per month. Vercel's
  terms limit Hobby to **non-commercial, personal** use. If the site becomes part of
  selling products, review Vercel's fair-use terms; the Pro plan is $20/month per
  member.
- **Unpublishing:** the design disappears from the site immediately. Someone who
  already had the direct link to the image file may still load a cached copy for up
  to about an hour.
- **Web addresses** (`/designs/your-title`) are created from the title and stay fixed
  once a design has been published, so shared links keep working. Renaming the title
  later does not change the address.
- **Wording** (site name, introduction, About section) lives in `src/config/site.ts`.
  Changing it needs a commit and a redeploy. Designs don't.
- **Unfinished uploads:** if you upload an image on a new design but never save it,
  the file stays in the private `design-uploads` bucket. It's harmless; you can delete
  it in **Supabase → Storage** if you like.
- **Other products:** each design has a *Product type* field (under **More options**,
  default "T-shirt"), so mugs or rugs can be added later without changing the
  database. There are no product-specific pages yet.
- **No password-reset email** (see step 3), no shopping cart, and no analytics.

---

## How the site keeps drafts private

- Visitors' requests use the public key, and the database only returns
  **published** designs to them.
- Every uploaded image goes into the **private** `design-uploads` bucket. When you
  publish, the site copies that design's images into the **public**
  `published-designs` bucket; unpublishing or deleting removes the copies.
- Only accounts in the `admins` table can upload or change anything. Every admin
  action checks this on the server, and the database rules check it again.
- Uploads must be real PNG, JPEG, or WebP files of 10 MB or less. Supabase enforces
  the type and size, and the server also checks the file contents before saving.

## Project map

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | Home page: introduction, gallery, About |
| `src/app/designs/[slug]/page.tsx` | Design detail page |
| `src/app/admin/` | Login, design list, editor, and server actions |
| `src/components/` | Shared visual pieces (cards, gallery, detail view) |
| `src/lib/designs/` | Data loading, upload checks, and validation rules |
| `src/config/site.ts` | Site name and wording |
| `supabase/migrations/` | Database, storage, and access rules (run in Supabase) |
| `tests/` | Validation tests (`npm test`) |
