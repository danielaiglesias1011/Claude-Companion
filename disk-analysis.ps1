Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  DISK SPACE ANALYSIS - $env:COMPUTERNAME" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Drive overview
Write-Host "`n--- C: DRIVE OVERVIEW ---" -ForegroundColor Yellow
$vol = Get-Volume -DriveLetter C
$totalGB = [math]::Round($vol.Size / 1GB, 1)
$freeGB = [math]::Round($vol.SizeRemaining / 1GB, 1)
$usedGB = [math]::Round(($vol.Size - $vol.SizeRemaining) / 1GB, 1)
$pctFree = [math]::Round(($vol.SizeRemaining / $vol.Size) * 100, 1)
Write-Host "Total: ${totalGB} GB | Used: ${usedGB} GB | Free: ${freeGB} GB ($pctFree% free)"

# 2. Top 15 largest folders in C:\Users
Write-Host "`n--- TOP 15 LARGEST FOLDERS IN C:\Users ---" -ForegroundColor Yellow
Get-ChildItem "C:\Users" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $userPath = $_.FullName
    $folders = @("Desktop","Documents","Downloads","Videos","Music","Pictures",
                 "AppData\Local","AppData\Roaming","AppData\Local\Temp",
                 "AppData\Local\Microsoft\Teams","AppData\Local\Google\Chrome\User Data",
                 "AppData\Local\Microsoft\Edge\User Data",
                 "AppData\Local\Microsoft\Outlook",
                 ".vscode","OneDrive")
    foreach ($f in $folders) {
        $full = Join-Path $userPath $f
        if (Test-Path $full) {
            $size = (Get-ChildItem $full -Recurse -Force -ErrorAction SilentlyContinue |
                     Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
            if ($size -gt 100MB) {
                [PSCustomObject]@{
                    Path = $full.Replace("C:\Users\","~\")
                    SizeGB = [math]::Round($size / 1GB, 2)
                }
            }
        }
    }
} | Sort-Object SizeGB -Descending | Select-Object -First 15 | Format-Table -AutoSize

# 3. Windows cleanup candidates
Write-Host "--- WINDOWS CLEANUP CANDIDATES ---" -ForegroundColor Yellow
$cleanupPaths = @(
    @("Windows\Temp",           "C:\Windows\Temp"),
    @("Windows\SoftwareDist",   "C:\Windows\SoftwareDistribution\Download"),
    @("Windows\Installer ($)",  "C:\Windows\Installer"),
    @("Windows\WinSxS",         "C:\Windows\WinSxS"),
    @("ProgramData\Packages",   "C:\ProgramData\Package Cache"),
    @("Recycle Bin",            "C:\`$Recycle.Bin")
)
foreach ($item in $cleanupPaths) {
    $path = $item[1]
    if (Test-Path $path) {
        $size = (Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue |
                 Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
        $sizeGB = [math]::Round($size / 1GB, 2)
        if ($sizeGB -ge 0.1) {
            Write-Host ("  {0,-30} {1,8} GB" -f $item[0], $sizeGB)
        }
    }
}

# 4. Top 20 largest individual files on C:
Write-Host "`n--- TOP 20 LARGEST FILES ON C: ---" -ForegroundColor Yellow
Get-ChildItem C:\ -Recurse -File -Force -ErrorAction SilentlyContinue |
    Sort-Object Length -Descending |
    Select-Object -First 20 |
    ForEach-Object {
        $sizeGB = [math]::Round($_.Length / 1GB, 2)
        $sizeMB = [math]::Round($_.Length / 1MB, 0)
        Write-Host ("  {0,6} MB  {1}" -f $sizeMB, $_.FullName)
    }

# 5. Reclaim estimate
Write-Host "`n--- QUICK RECLAIM ESTIMATES ---" -ForegroundColor Yellow
$tempSize = 0
Get-ChildItem "C:\Windows\Temp" -Recurse -Force -ErrorAction SilentlyContinue |
    ForEach-Object { $tempSize += $_.Length }
Get-ChildItem "C:\Users\*\AppData\Local\Temp" -Recurse -Force -ErrorAction SilentlyContinue |
    ForEach-Object { $tempSize += $_.Length }
$dlSize = (Get-ChildItem "C:\Windows\SoftwareDistribution\Download" -Recurse -Force -ErrorAction SilentlyContinue |
           Measure-Object Length -Sum -ErrorAction SilentlyContinue).Sum
$rbSize = (Get-ChildItem "C:\`$Recycle.Bin" -Recurse -Force -ErrorAction SilentlyContinue |
           Measure-Object Length -Sum -ErrorAction SilentlyContinue).Sum

$totalReclaim = $tempSize + $dlSize + $rbSize
Write-Host ("  Temp files:        {0,6:N2} GB" -f ($tempSize / 1GB))
Write-Host ("  WU Downloads:      {0,6:N2} GB" -f ($dlSize / 1GB))
Write-Host ("  Recycle Bin:       {0,6:N2} GB" -f ($rbSize / 1GB))
Write-Host ("  --------------------------------")
Write-Host ("  Est. Reclaimable:  {0,6:N2} GB" -f ($totalReclaim / 1GB)) -ForegroundColor Green

Write-Host "`n=====================================================" -ForegroundColor Cyan
Write-Host "  SCAN COMPLETE" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
