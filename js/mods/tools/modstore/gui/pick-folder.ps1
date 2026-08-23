# Pick folder - write UTF-8 path to file (avoid GBK stdout garbling on Chinese Windows)
param(
    [string]$Title = "Select folder",
    [Parameter(Mandatory = $true)]
    [string]$OutFile
)
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = $Title
$dlg.ShowNewFolderButton = $true
$result = $dlg.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($OutFile, $dlg.SelectedPath, $utf8)
}
