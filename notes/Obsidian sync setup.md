# Obsidian sync setup

How the coding journal gets from the project into the **SecondBrain**
Obsidian vault, and how to control it.

## How it works

A small program (`tools/obsidian-sync.ps1` in the project) runs on the
owner's Windows computer once an hour. Each run it downloads the latest
project files from GitHub and copies **GUIDE.md plus everything in
`notes/`** into:

```
C:\Users\inmyi\iCloudDrive\iCloud~md~obsidian\SecondBrain\Naan Kabob Apps
```

Because the vault lives in iCloud Drive, iCloud then carries the fresh
copies to every other device with the same vault. No Obsidian plugins, no
accounts, no passwords — the project is public, so the download needs no
login.

The sync is **one-way** (project → vault). Edits made to these files inside
Obsidian are overwritten within the hour. The rest of the vault is never
touched.

## One-time setup (about a minute)

1. Press the **Start** button, type `powershell`, and open
   **Windows PowerShell**.
2. Paste this whole line and press Enter:

```powershell
Invoke-WebRequest -UseBasicParsing https://raw.githubusercontent.com/sudipbha/naan-kabob-apps/main/tools/obsidian-sync.ps1 -OutFile "$env:USERPROFILE\naan-kabob-obsidian-sync.ps1"; powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\naan-kabob-obsidian-sync.ps1" -Install
```

That downloads the sync program to your user folder, fills the vault folder
immediately, and schedules the hourly refresh. You should see
"Automatic sync is ON" at the end, and a **Naan Kabob Apps** folder in
Obsidian a moment later.

## Turning it off

Open PowerShell the same way and run:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\naan-kabob-obsidian-sync.ps1" -Uninstall
```

The notes already in the vault stay; they just stop refreshing.

## If the vault ever moves

Run the setup line again with the new location added, for example:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\naan-kabob-obsidian-sync.ps1" -Install -VaultFolder "D:\New Vault\Naan Kabob Apps"
```

## Small print

- The refresh happens only while the computer is on and you're logged in —
  it catches up on the next hourly run after you're back.
- New notes added to the project appear automatically. A note *renamed or
  deleted* in the project leaves its old copy behind in the vault (the sync
  never deletes anything in your vault); stale leftovers are safe to delete
  by hand.
- The schedule lives in Windows **Task Scheduler** under the name
  "Naan Kabob - Obsidian sync", if you ever want to see or change it there.
