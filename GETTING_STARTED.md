# Getting Started

This app logs your weekly time against Jira tickets automatically — you set a rough split of your recurring work once, adjust it week to week, and it handles the actual clicking-into-Jira-and-logging-hours part for you.

It runs entirely on your own computer. Nothing is shared with anyone else — it only talks to Jira, using your own login.

## 1. Unzip the folder

Wherever you downloaded it (Downloads, Desktop, wherever), double-click the zip file to unzip it. You should end up with a folder called something like `time-tracker`.

## 2. Start the app

**On a Mac:** open that folder and double-click **`Start Time Tracker.command`**.

> The first time you do this, macOS may show a warning like *"can't be opened because it is from an unidentified developer."* This is normal for a file that wasn't downloaded from the App Store. To get past it (only needed once): **right-click** the file, choose **Open**, then click **Open** again in the dialog that appears.

**On Windows:** open that folder and double-click **`Start Time Tracker.bat`**.

A black terminal window will open and walk you through setup. Keep it open — closing it stops the app.

## 3. First-time setup

The first time you run it, it'll ask for a couple of things:

- **Your Jira email** — the one you use to log into `integritymarketing.atlassian.net`.
- **A Jira API token** — this is like a password just for this app, separate from your real password. To get one:
  1. Go to **id.atlassian.com/manage-profile/security/api-tokens** (you can copy/paste that into a browser)
  2. Click **Create API token**
  3. Give it any name, e.g. "Time Tracker"
  4. Copy the token it gives you
  5. Paste it into the terminal window when asked (it'll show as `*` characters as you type, like a password field)

If you mistype something, it'll tell you and let you try again.

Once it connects successfully, it'll start the app and open it in your browser automatically at `localhost:3000`.

## 4. Set up your Baseline

The first thing to do inside the app is set up your **Baseline** — the recurring split of your time across your Jira tickets, in percentages that add up to 100. For example: 30% on one ticket, 20% on another, and so on. This is just your starting point — you'll adjust it week to week as your actual work shifts.

Click **Edit baseline**, search for and add your tickets, set each one's percentage, and save.

## 5. Every week

- Open the app (run the same double-click file again if it's not already running — it'll skip straight to starting up since you're already set up).
- Use **← Earlier** to go to the week you want to log (usually last week, once it's actually finished).
- Adjust percentages if your work shifted, or add a **one-off** entry for something outside your normal split (a specific meeting, PTO, etc. — pick the exact day it happened).
- Click **Log this week to Jira**. That's it — it creates the actual worklogs on your tickets. Re-clicking it later (say, after an edit) updates those same entries instead of creating duplicates.

## Troubleshooting

- **"That saved login isn't working anymore"** — your API token expired (they last about a year) or was revoked. Make a new one following step 3 above, then either:
  - If the app is still open in your browser: scroll to the **Settings** section (below the weekly grid), paste the new token into **Jira Connection**, and click **Save connection** — no need to close anything.
  - Otherwise: just double-click the start file again; it'll notice the saved login stopped working and ask for a new one automatically.
- **The app didn't open in your browser** — go to `http://localhost:3000` manually.
- **Something looks wrong or broken** — leave the terminal window open (don't close it) and message **Andy Watson** with a screenshot of what you're seeing.
- **You closed the window and want to reopen the app** — just double-click the start file again.

## Privacy

Your Jira credentials and your logged time are stored only on your own computer (never sent anywhere except to Jira itself, using your own login). Andy doesn't see your data.
