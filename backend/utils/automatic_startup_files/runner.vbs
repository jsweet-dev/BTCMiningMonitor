set object = createobject("wscript.shell") 
object.run "c:\users\Jonathan\PsExec.exe -i 1 powershell.exe -WindowStyle hidden -File C:\Users\Jonathan\start_wsl.ps1", 0
