$WshShell = New-Object -ComObject WScript.Shell

# 1. Update Desktop Shortcut
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$ShortcutPath = Join-Path $DesktopPath "Start Discord Bot.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "$env:SystemRoot\System32\cmd.exe"
$Shortcut.Arguments = '/c "e:\ouroboros-study\discord-bot\start_bot.bat"'
$Shortcut.WorkingDirectory = "e:\ouroboros-study\discord-bot"
$Shortcut.Description = "Start Discord Kaitun Bot"
$Shortcut.IconLocation = "e:\ouroboros-study\discord-bot\assets\bot_icon.ico,0"
$Shortcut.Save()

# 2. Update Taskbar Pinned Shortcut
$TaskbarLnk = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Start Discord Bot.lnk'
if (Test-Path $TaskbarLnk) {
    $TbShortcut = $WshShell.CreateShortcut($TaskbarLnk)
    $TbShortcut.TargetPath = "$env:SystemRoot\System32\cmd.exe"
    $TbShortcut.Arguments = '/c "e:\ouroboros-study\discord-bot\start_bot.bat"'
    $TbShortcut.WorkingDirectory = "e:\ouroboros-study\discord-bot"
    $TbShortcut.Description = "Start Discord Kaitun Bot"
    $TbShortcut.IconLocation = "e:\ouroboros-study\discord-bot\assets\bot_icon.ico,0"
    $TbShortcut.Save()
    Write-Output "SUCCESS: Updated Taskbar pinned icon to bot_icon.ico"
}

Write-Output "SUCCESS: Updated Desktop shortcut to bot_icon.ico"
