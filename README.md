# UGC Planner 📸

A phone-friendly planner for Instagram UGC deals. It tracks every Reel, Story, Post and Carousel per brand, with draft deadlines, go-live dates, status and payments.

- **Hosting:** GitHub Pages (free)
- **Database:** a Google Sheet she owns, through a small Apps Script

Until a sheet is connected, the app runs in **Demo mode** with sample data, so you can try it straight away.

---

## What's inside

| Tab | What it shows |
|---|---|
| ⚡ **This week** | Overdue items, items due today, and the next 7 days. Each card has a one-tap **Move to next stage** button. |
| 🗓️ **Calendar** | A month view, colour-coded by content type. Solid means go-live, dashed means draft due, and days with 3+ items get an orange ring. |
| 📋 **All** | A searchable table of every deliverable, filterable by status. |
| 💸 **Payments** | Totals received, invoiced and not yet invoiced, plus **"Posted but not paid"** so she knows who to chase. |

**One row = one deliverable.** If a brand wants 1 Reel + 3 Stories, add the Reel and then tap **Save + add another**. The brand name and contact carry over.

The stages are Briefed → Shooting → Draft sent → Approved → Live. While an item is in *Briefed* or *Shooting*, the app tracks its **draft due** date. After that it tracks the **go-live** date.

---

## Setup (about 15 minutes)

### 1. Create the Google Sheet (her Google account)

1. Go to [sheets.new](https://sheets.new) and name it **UGC Planner**.
2. Open **Extensions → Apps Script**.
3. Delete what's there, paste in everything from [`apps-script/Code.gs`](apps-script/Code.gs), and press **Save** 💾.
4. In the function dropdown at the top, pick **`setup`** and click **Run**.
   - Google asks for permission: **Review permissions → choose account → Advanced → Go to UGC Planner (unsafe) → Allow**. It says "unsafe" only because it's your own unverified script.
   - This creates a **Deliverables** tab with the column headers.

### 2. Set the passcode 🔐

The web app URL is public, so the passcode stops strangers from reading or editing her data.

1. In Apps Script, click **⚙️ Project Settings → Script Properties → Edit**.
2. Change the value of `PASSCODE` from `change-me` to something only she knows. Click **Save**.

### 3. Deploy the backend

1. Click **Deploy → New deployment**.
2. Click the ⚙️ next to "Select type" and choose **Web app**.
3. Set **Execute as:** *Me*, and **Who has access:** *Anyone*.
4. Click **Deploy** and **copy the Web app URL**. It ends in `/exec`.

> If you change `Code.gs` later, use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. This keeps the same URL.

### 4. Put the app on GitHub Pages

1. Create a new **public** repo on GitHub, e.g. `ugc-planner`.
2. Push this folder to it:
   ```bash
   cd ugc-planner
   git init
   git add .
   git commit -m "UGC Planner"
   git branch -M main
   git remote add origin https://github.com/<your-username>/ugc-planner.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Go to the **Actions** tab and wait for the green ✓. It takes about a minute. If the first run failed because Pages wasn't enabled yet, click **Re-run jobs**.
5. The app is live at **`https://<your-username>.github.io/ugc-planner/`**.

Every push to `main` redeploys automatically.

### 5. Connect it (on her phone)

1. Open the app link and tap ⚙︎ **Settings**.
2. Paste the **Web app URL** and the **passcode**, then tap **Connect**.
3. On iPhone, add it to the home screen with **Share → Add to Home Screen**. On Android, use **⋮ → Add to Home screen**. It then opens like an app.

The URL and passcode are saved on that device only, so connect once per device.

---

## Using the sheet directly

She can open the Google Sheet any time to bulk-edit, sort, or add rows. Rows typed directly into the sheet get an `id` automatically the next time the app loads.

- Keep dates as `YYYY-MM-DD`, e.g. `2026-10-20`.
- `type` must be one of: `Reel`, `Story`, `Post`, `Carousel`.
- `status` must be one of: `Briefed`, `Shooting`, `Draft sent`, `Approved`, `Live`.
- `payment` must be one of: `Unpaid`, `Invoiced`, `Paid`.
- `collab` is `Yes` or `No`.

Don't rename or reorder the header row.

---

## Run locally

```bash
npm install
npm run dev
```

## Project structure

```
ugc-planner/
├─ apps-script/Code.gs        ← paste into the Google Sheet's Apps Script
├─ .github/workflows/deploy.yml  ← auto-deploys to GitHub Pages
├─ src/
│  ├─ App.jsx      ← all screens (week, calendar, all, payments, form, settings)
│  ├─ api.js       ← talks to Apps Script (or demo storage)
│  ├─ utils.js     ← dates, statuses, money formatting
│  └─ styles.css
└─ index.html
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "Wrong passcode" | The passcode in the app must exactly match the `PASSCODE` script property. |
| "did not return data" | Use the **`/exec`** URL from *Deploy*, not the editor URL, and check that access is set to **Anyone**. |
| Changes to Code.gs not working | Deploy a **New version** (step 3 note). Saving alone doesn't update the live web app. |
| Saving feels slow | That's normal. Apps Script takes 1–3 seconds. The app updates the screen instantly and syncs in the background. |
