# Getting Started

This app logs your weekly time against Jira tickets automatically — you set a rough split of your recurring work once, adjust it week to week, and it handles the actual clicking-into-Jira-and-logging-hours part for you.

It runs entirely on your own computer. Nothing is shared with anyone else — it only talks to Jira, using your own login.

## 1. Get the launcher

Andy will send you a small zip file (`time-tracker-launcher.zip`). Save it somewhere you'll remember — Desktop is fine — and unzip it. Inside are two files; you only need the one for your computer:

- **Mac:** `Start Time Tracker.command`
- **Windows:** `Start Time Tracker.bat`

You can delete the other one, or just ignore it.

## 2. Start the app

Double-click the file for your computer.

> **On a Mac**, the first time you do this, macOS may show a warning like *"can't be opened because it is from an unidentified developer."* This is normal for a file that wasn't downloaded from the App Store. To get past it (only needed once): **right-click** the file, choose **Open**, then click **Open** again in the dialog that appears.

A black terminal window will open. The very first time, it'll also download the actual app (this needs Git — if you don't have it yet, it'll open the download page for you; on a Mac this might instead pop up an "Install Command Line Tools" prompt, which is the same thing, just follow that). This only happens once — after that, double-clicking just starts the app.

Keep the terminal window open while you use the app — closing it stops the app.

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

- Open the app (double-click the same start file again if it's not already running). Every time you do, it briefly checks for app updates and installs any automatically — you don't need to do anything for this.
- Use **← Earlier** to go to the week you want to log (usually last week, once it's actually finished).
- Adjust percentages if your work shifted, or add a **one-off** entry for something outside your normal split (a specific meeting, PTO, etc. — pick the exact day it happened).
- Click **Log this week to Jira**. That's it — it creates the actual worklogs on your tickets. Re-clicking it later (say, after an edit) updates those same entries instead of creating duplicates.

## Troubleshooting

- **"That saved login isn't working anymore"** — your API token expired (they last about a year) or was revoked. Make a new one following step 3 above, then either:
  - If the app is still open in your browser: scroll to the **Settings** section (below the weekly grid), paste the new token into **Jira Connection**, and click **Save connection** — no need to close anything.
  - Otherwise: just double-click the start file again; it'll notice the saved login stopped working and ask for a new one automatically.
- **"Couldn't check for updates" or "couldn't apply the update automatically"** — it just carries on with the version you already have; nothing is broken. If you keep seeing this, message **Andy Watson**.
- **The app didn't open in your browser** — go to `http://localhost:3000` manually.
- **Something looks wrong or broken** — leave the terminal window open (don't close it) and message **Andy Watson** with a screenshot of what you're seeing.
- **You closed the window and want to reopen the app** — just double-click the start file again.

## Privacy

Your Jira credentials and your logged time are stored only on your own computer (never sent anywhere except to Jira itself, using your own login). Andy doesn't see your data.
