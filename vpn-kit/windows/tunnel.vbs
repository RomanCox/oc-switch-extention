' Runs tunnel.ps1 with no window at all.
' PowerShell -WindowStyle Hidden still flashes a console on every task start;
' WScript.Shell with flag 0 does not.
' ASCII only on purpose: .vbs is read as ANSI by wscript.

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptDir & "\tunnel.ps1"""

shell.Run cmd, 0, False
