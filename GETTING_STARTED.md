# Getting Started

This app logs your weekly time against Jira tickets automatically — you set a rough split of your recurring work once, adjust it week to week, and it handles the actual clicking-into-Jira-and-logging-hours part for you.

It runs entirely on your own computer. Nothing is shared with anyone else — it only talks to Jira, using your own login. Nothing needs to be installed first: no Node, no Git, no admin rights.

## 1. Download the app

Andy will send you a link to the Releases page (or a zip directly). Download the one for your computer:

- **Mac:** `TimeTracker-mac-arm64.zip`
- **Windows:** `TimeTracker-windows.zip`

Unzip it somewhere you'll remember — your **Desktop** is a good choice. (On Windows, avoid a deeply nested folder like a synced OneDrive Documents folder — some Windows systems have trouble with very long file paths.)

## 2. Start the app

Inside the unzipped `Time Tracker` folder, double-click the start file for your computer.

> **On a Mac**, the first time you do this, macOS will warn you about an app that wasn't downloaded from the App Store. This is normal — you just need to approve it once:
>
> - **If you see "Apple could not verify that '...' is free of malware..."** (current macOS): double-click the file once to trigger the warning, then go to **System Settings → Privacy & Security**, scroll down to the **Security** section, and click **Open Anyway** next to the message about the blocked file. Confirm with your password or Touch ID (and one more "Open Anyway"/"Open" click if it asks again).
> - **If you see "can't be opened because it is from an unidentified developer"** (older macOS): **right-click** `Start Time Tracker.command`, choose **Open**, then click **Open** again in the dialog that appears.
>
> Either way, this is only needed the very first time — after that, double-clicking just starts the app.

> **On Windows**, you may see a blue "Windows protected your PC" screen (SmartScreen). Click **More info**, then **Run anyway**. This is normal for an app that isn't distributed through the Microsoft Store.

A black terminal window will open, check for updates, start the app, and open it in your browser automatically — usually at `http://127.0.0.1:3000` (if that port is busy, it'll pick the next free one and tell you).

Keep the terminal window open while you use the app — closing it stops the app.

## 3. Connect to Jira

The first time you run it, you'll land on a **Connect to Jira** screen. To get your API token:

1. Go to **id.atlassian.com/manage-profile/security/api-tokens** (you can copy/paste that into a browser).
2. Click **Create API token**.
3. Give it any name, e.g. "Time Tracker".
4. Copy the token it gives you.
5. Paste your email and the token into the app and click **Save connection**.

If you mistype something, it'll tell you and let you try again — the connection is checked live against Jira before anything is saved.

## 4. Set up your Baseline

The first thing to do inside the app is set up your **Baseline** — the recurring split of your time across your Jira tickets, in percentages that add up to 100. For example: 30% on one ticket, 20% on another, and so on. This is just your starting point — you'll adjust it week to week as your actual work shifts.

Click **Edit baseline**, search for and add your tickets, set each one's percentage, and save.

## 5. Every week

- Open the app (double-click the same start file again if it's not already running). Every time you do, it briefly checks for app updates and installs any automatically — you don't need to do anything for this.
- Use **← Earlier** to go to the week you want to log (usually last week, once it's actually finished).
- Adjust percentages if your work shifted, or add a **one-off** entry for something outside your normal split (a specific meeting, PTO, etc. — pick the exact day it happened).
- Click **Log this week to Jira**. That's it — it creates the actual worklogs on your tickets. Re-clicking it later (say, after an edit) updates those same entries instead of creating duplicates.

## Where your stuff lives

Your database and Jira login are stored outside the app folder, so updating the app (or even deleting and re-downloading it) never touches your data:

- **Mac:** `~/Library/Application Support/WeeklyTimeTracker`
- **Windows:** `%LOCALAPPDATA%\WeeklyTimeTracker`

## Troubleshooting

- **"That saved login isn't working anymore"** — your API token expired (they last about a year) or was revoked. Make a new one following step 3 above, then scroll to the **Settings** section (below the weekly grid), paste the new token into **Jira Connection**, and click **Save connection** — no need to close anything.
- **"Couldn't check for updates"** — it just carries on with the version you already have; nothing is broken. If you keep seeing this, message **Andy Watson**.
- **The app didn't open in your browser** — the terminal window prints the exact address (`http://127.0.0.1:<port>`) once it's ready; open that manually.
- **Something looks wrong or broken** — leave the terminal window open (don't close it) and message **Andy Watson** with a screenshot of what you're seeing.
- **You closed the window and want to reopen the app** — just double-click the start file again.

## Privacy

Your Jira credentials and your logged time are stored only on your own computer (never sent anywhere except to Jira itself, using your own login). Andy doesn't see your data.
