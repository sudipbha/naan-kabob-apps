<#
Naan Kabob -> Obsidian sync

Copies the project's journal (GUIDE.md + everything in notes/) from GitHub
into a folder inside the owner's Obsidian vault. One-way: repo -> vault.
Anything edited inside the vault copy gets overwritten on the next run.

How to use (from a PowerShell window):
  no options    sync once, right now
  -Install      sync now AND refresh automatically every hour from then on
  -Uninstall    turn the automatic hourly refresh off
  -VaultFolder  put the notes somewhere else, e.g.
                -VaultFolder "D:\Vault\Naan Kabob Apps"
#>
param(
  [switch]$Install,
  [switch]$Uninstall,
  [string]$VaultFolder = "$env:USERPROFILE\iCloudDrive\iCloud~md~obsidian\SecondBrain\Naan Kabob Apps"
)

$ErrorActionPreference = 'Stop'
$TaskName = 'Naan Kabob - Obsidian sync'
$RepoZip  = 'https://github.com/sudipbha/naan-kabob-apps/archive/refs/heads/main.zip'

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host 'Automatic sync is off. Your existing notes stay where they are.'
  exit 0
}

# GitHub requires a modern secure connection; older Windows PowerShell
# doesn't pick it by default.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$vaultParent = Split-Path $VaultFolder -Parent
if (-not (Test-Path $vaultParent)) {
  Write-Host "Could not find your Obsidian vault at: $vaultParent"
  Write-Host 'If your vault lives somewhere else, run this again with:'
  Write-Host '  -VaultFolder "C:\path\to\your vault\Naan Kabob Apps"'
  exit 1
}

$tmp = Join-Path $env:TEMP 'naan-kabob-obsidian-sync'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null

Write-Host 'Downloading the latest project notes from GitHub...'
$zip = Join-Path $tmp 'repo.zip'
Invoke-WebRequest -Uri $RepoZip -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath $tmp
$src = Join-Path $tmp 'naan-kabob-apps-main'

New-Item -ItemType Directory -Path $VaultFolder -Force | Out-Null
Copy-Item (Join-Path $src 'GUIDE.md') -Destination $VaultFolder -Force
$copied = 1
$notesDir = Join-Path $src 'notes'
if (Test-Path $notesDir) {
  Get-ChildItem $notesDir -Filter *.md | ForEach-Object {
    Copy-Item $_.FullName -Destination $VaultFolder -Force
    $copied++
  }
}
Remove-Item $tmp -Recurse -Force
Write-Host "Done - $copied notes are up to date in:"
Write-Host "  $VaultFolder"

if ($Install) {
  $action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
    -RepetitionInterval (New-TimeSpan -Hours 1) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Force | Out-Null
  Write-Host 'Automatic sync is ON - your Obsidian copy will refresh every hour.'
  Write-Host 'To turn it off later, run this script again with -Uninstall.'
}
