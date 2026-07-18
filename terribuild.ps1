[Reflection.Assembly]::LoadFrom("$((Get-Location).Path)\Newtonsoft.Json.dll")

# Config

try {
    . ".\config.ps1"
}
catch {
    throw "Please put a config.ps1 from the provided config.ps1.sample in the repository root, and run this script from there."
}

$repoRoot = $pwd.Path

# EXE metadata configuration
$version_string = "1.1.0"
$tool_icon = "CoZIcon.ico"
$game_icon = "LauncherIcon.ico"
$publisher = "Committee of Zero"
$product_name = "ANONYMOUS;CODE Improvement Patch"

# Code

function SetInstallerExeMetadata {
    param ([string]$exePath)
    $originalFilename = (Get-Item $exePath).Name
    .\rcedit-x86.exe $exePath `
        --set-icon "$tool_icon" `
        --set-file-version "$version_string" `
        --set-product-version "$version_string" `
        --set-version-string "CompanyName" "$publisher" `
        --set-version-string "FileDescription" "$product_name Installer (v$version_string)" `
        --set-version-string "FileVersion" "$version_string" `
        --set-version-string "InternalName" "Installer.exe" `
        --set-version-string "LegalCopyright" "$publisher" `
        --set-version-string "OriginalFilename" "$originalFilename" `
        --set-version-string "ProductName" "$product_name Installer" `
        --set-version-string "ProductVersion" "$version_string"
}
function SetUninstallerExeMetadata {
    param ([string]$exePath)
    $originalFilename = (Get-Item $exePath).Name
    .\rcedit-x86.exe $exePath `
        --set-icon "$tool_icon" `
        --set-file-version "$version_string" `
        --set-product-version "$version_string" `
        --set-version-string "CompanyName" "$publisher" `
        --set-version-string "FileDescription" "$product_name Uninstaller (v$version_string)" `
        --set-version-string "FileVersion" "$version_string" `
        --set-version-string "InternalName" "nguninstall.exe" `
        --set-version-string "LegalCopyright" "$publisher" `
        --set-version-string "OriginalFilename" "$originalFilename" `
        --set-version-string "ProductName" "$product_name Uninstaller" `
        --set-version-string "ProductVersion" "$version_string"
}

function SetRealbootExeMetadata {
    param ([string]$exePath)
    $originalFilename = (Get-Item $exePath).Name
    .\rcedit-x86.exe $exePath `
        --set-icon "$game_icon" `
        --set-file-version "$version_string" `
        --set-product-version "$version_string" `
        --set-version-string "CompanyName" "$publisher" `
        --set-version-string "FileDescription" "$product_name Launcher (v$version_string)" `
        --set-version-string "FileVersion" "$version_string" `
        --set-version-string "InternalName" "realboot.exe" `
        --set-version-string "LegalCopyright" "$publisher" `
        --set-version-string "OriginalFilename" "$originalFilename" `
        --set-version-string "ProductName" "$product_name Launcher" `
        --set-version-string "ProductVersion" "$version_string"
}

function RunInsert {
    param ([string]$scriptsName, [string]$variant)

    New-Item -ItemType directory -Path "$repoRoot\temp\lines_$scriptsName" | Out-Null
    New-Item -ItemType Junction -Path "$repoRoot\temp\lines_$scriptsName\lang0" -Target "$repoRoot\$scriptsName" | Out-Null

    python "$repoRoot\kawtools\insert.py" "$repoRoot\temp\lines_$scriptsName" "$repoRoot\build-vortex\$variant\c0patch\scenario"
}

function RebuildC0patch {
    param ([string]$variant)

    $tempDir = "$repoRoot\temp\$variant\c0patch"
    New-Item -ItemType directory -Path $tempDir | Out-Null

    cd "$repoRoot\build-vortex\$variant"
    "c0patch" | & "$repoRoot\DoNut\DoNut\bin\Release\net8.0\DoNut.exe"
    Move-Item -Force .\c0patch_info.json .\c0patch_info.psb.m.json
    & "$repoRoot\FreeMote\PsBuild.exe" info-psb c0patch_info.psb.m.json
    Move-Item -Force .\c0patch_info.psb.m $tempDir
    Move-Item -Force .\c0patch_body.bin $tempDir
    cd $repoRoot
}

function RebuildTips {
    param ([string]$scriptsName, [string]$variant)

    & "$repoRoot\FreeMote\PsbDecompile.exe" "$repoRoot\build-vortex\$variant\config\tips.psb.m"

    New-Item -ItemType directory -Path "$repoRoot\temp\tipslines_$scriptsName" | Out-Null
    New-Item -ItemType Junction -Path "$repoRoot\temp\tipslines_$scriptsName\lang1" -Target "$repoRoot\$scriptsName" | Out-Null

    python "$repoRoot\kawtools\insert_tips.py" "$repoRoot\temp\tipslines_$scriptsName" "$repoRoot\build-vortex\$variant\config\tips.psb.m.json"
}

function RebuildTriggerParams {
    param ([string]$scriptsName, [string]$variant)

    & "$repoRoot\FreeMote\PsbDecompile.exe" "$repoRoot\build-vortex\$variant\config\trigger_params.psb.m"
    python "$repoRoot\kawtools\insert_trigger_params.py" "$repoRoot\$scriptsName\trigger_params.txt" "$repoRoot\build-vortex\$variant\config\trigger_params.psb.m.json"
}

function RebuildConfig {
    param ([string]$variant)

    $tempDir = "$repoRoot\temp\$variant\config"
    New-Item -ItemType directory -Path $tempDir | Out-Null

    cd "$repoRoot\build-vortex\$variant"
    foreach ($name in @("init", "movie_config", "trigger_params", "tips")) {
        & "$repoRoot\FreeMote\PsBuild.exe" -nr -o "config\$name.psb.m" "config\$name.psb.m.json"
    }
    New-Item -ItemType directory -Path .\overrides_stash | Out-Null
    Move-Item -Force config\*.json .\overrides_stash
    Remove-Item -Force -ErrorAction SilentlyContinue config\*.pure.psb, config\tips.psb.m.psb

    python "$repoRoot\kawtools\gen_archive_info.py" config config_info.psb.m.json
    & "$repoRoot\FreeMote\PsBuild.exe" info-psb config_info.psb.m.json

    Move-Item -Force .\overrides_stash\*.json config\
    Remove-Item .\overrides_stash

    Move-Item -Force .\config_info.psb.m $tempDir
    Move-Item -Force .\config_body.bin $tempDir
    cd $repoRoot
}

function RebuildScript {
    $tempDir = "$repoRoot\temp\common\script"
    New-Item -ItemType directory -Path $tempDir | Out-Null

    cd "$repoRoot\build-vortex\common"
    python "$repoRoot\kawtools\gen_archive_info.py" script script_info.psb.m.json
    & "$repoRoot\FreeMote\PsBuild.exe" info-psb script_info.psb.m.json
    Move-Item -Force .\script_info.psb.m $tempDir
    Move-Item -Force .\script_body.bin $tempDir
    cd $repoRoot
}

function RebuildFont {
    $tempDir = "$repoRoot\temp\common\font"
    New-Item -ItemType directory -Path $tempDir | Out-Null

    cd "$repoRoot\build-vortex\common"
    python "$repoRoot\kawtools\gen_archive_info.py" font font_info.psb.m.json
    & "$repoRoot\FreeMote\PsBuild.exe" info-psb font_info.psb.m.json
    Move-Item -Force .\font_info.psb.m $tempDir
    Move-Item -Force .\font_body.bin $tempDir
    cd $repoRoot
}

# END CONFIG

function PrintSection {
    param ([string]$desc)
    $line = "------------------------------------------------------------------------"
    $len = (($line.length, $desc.legnth) | Measure -Max).Maximum
    
    Write-Host ""
    Write-Host $line.PadRight($len) -BackgroundColor DarkBlue -ForegroundColor Cyan
    Write-Host ("      >> " + $desc).PadRight($len) -BackgroundColor DarkBlue -ForegroundColor Cyan
    Write-Host $line.PadRight($len) -BackgroundColor DarkBlue -ForegroundColor Cyan
    Write-Host ""
}

Write-Output "                          ＴＥＲＲＩＢＵＩＬＤ"
Write-Output "Rated World's #1 Build Script By Leading Game Industry Officials"
Write-Output ""
Write-Output "------------------------------------------------------------------------"
Write-Output ""

PrintSection "Creating new DIST and temp"
Remove-Item -Force -Recurse -ErrorAction SilentlyContinue .\DIST
New-Item -ItemType directory -Path .\DIST | Out-Null
Remove-Item -Force -Recurse -ErrorAction SilentlyContinue .\temp
New-Item -ItemType directory -Path .\temp | Out-Null
Remove-Item -Force -Recurse -ErrorAction SilentlyContinue .\symbols
New-Item -ItemType directory -Path .\symbols | Out-Null

PrintSection "Pulling latest script changes"
cd ac-scripts-full
& git pull
cd ..
cd ac-scripts-partial
& git pull
cd ..

PrintSection "Building DoNut"
dotnet build .\DoNut\DoNut\DoNut.csproj -c Release

PrintSection "Inserting translated scenario text"
Write-Output "Inserting full scenario text"
RunInsert "ac-scripts-full" "full"
Write-Output "Inserting partial scenario text"
RunInsert "ac-scripts-partial" "partial"
Write-Output "Inserting full tips text"
RebuildTips "ac-scripts-full" "full"
Write-Output "Inserting partial tips text"
RebuildTips "ac-scripts-partial" "partial"
Write-Output "Inserting full trigger_params text"
RebuildTriggerParams "ac-scripts-full" "full"
Write-Output "Inserting partial trigger_params text"
RebuildTriggerParams "ac-scripts-partial" "partial"

PrintSection "Reconstructing c0patch archives"
Write-Output "Rebuilding full c0patch"
RebuildC0patch "full"
Write-Output "Rebuilding partial c0patch"
RebuildC0patch "partial"
Write-Output "Rebuilding full config"
RebuildConfig "full"
Write-Output "Rebuilding partial config"
RebuildConfig "partial"
Write-Output "Rebuilding script"
RebuildScript
Write-Output "Rebuilding font"
RebuildFont

PrintSection "Copying content to DIST"
Copy-Item -Recurse -Force .\content\* .\DIST

PrintSection "Copying rebuilt archives to DIST"
New-Item -ItemType directory -Force -Path .\DIST\DIST_FULL\windata | Out-Null
New-Item -ItemType directory -Force -Path .\DIST\DIST_PARTIAL\windata | Out-Null
New-Item -ItemType directory -Force -Path .\DIST\DIST_COMMON\windata | Out-Null
Copy-Item -Force .\temp\full\c0patch\c0patch_info.psb.m, .\temp\full\c0patch\c0patch_body.bin .\DIST\DIST_FULL\windata
Copy-Item -Force .\temp\partial\c0patch\c0patch_info.psb.m, .\temp\partial\c0patch\c0patch_body.bin .\DIST\DIST_PARTIAL\windata
Copy-Item -Force .\temp\full\config\config_info.psb.m, .\temp\full\config\config_body.bin .\DIST\DIST_FULL\windata
Copy-Item -Force .\temp\partial\config\config_info.psb.m, .\temp\partial\config\config_body.bin .\DIST\DIST_PARTIAL\windata
Copy-Item -Force .\temp\common\script\script_info.psb.m, .\temp\common\script\script_body.bin .\DIST\DIST_COMMON\windata
Copy-Item -Force .\temp\common\font\font_info.psb.m, .\temp\common\font\font_body.bin .\DIST\DIST_COMMON\windata

PrintSection "Building and copying realboot"
cd launcher
& .\realboot_build.bat
cd ..
SetRealbootExeMetadata .\launcher\deploy\MAGESgamelauncher.exe
Copy-Item -Recurse -Force .\launcher\deploy\* .\DIST\DIST_COMMON
Copy-Item -Recurse -Force .\launcher\build\release\*.pdb .\symbols

PrintSection "Building noidget"
cd installer
& .\noidget_build.bat
cd ..
SetInstallerExeMetadata .\installer\deploy\noidget.exe
SetUninstallerExeMetadata .\installer\deployUninstaller\noidget.exe
Copy-Item -Recurse -Force .\installer\build\release\*.pdb .\symbols

PrintSection "Packing uninstaller"
cd installer\deployUninstaller
7z a -mx=0 ..\..\temp\sfxbaseUninstaller.7z .\*
cd ..\..
copy .\7zS2.sfx .\temp\UninstallerExtractor.exe
SetUninstallerExeMetadata -exePath .\temp\UninstallerExtractor.exe
cmd /c copy /b .\temp\UninstallerExtractor.exe + .\temp\sfxbaseUninstaller.7z DIST\DIST_COMMON\nguninstall.exe

PrintSection "Packing installer"
cd temp
$patchFolderName = "ACSteamPatch-v$version_string-Setup"
New-Item -ItemType directory -Path $patchFolderName | Out-Null
cd $patchFolderName
New-Item -ItemType directory -Path DIST | Out-Null
Move-Item -Force ..\..\DIST\* .\DIST
Move-Item -Force ..\..\installer\deploy\* .
Move-Item -Force .\noidget.exe .\ACSteamPatch-Installer.exe
cd ..\..\DIST
7z a -mx=5 "$patchFolderName.zip" "..\temp\$patchFolderName"
cd ..

PrintSection "Removing temp"
Remove-Item -Force -Recurse .\temp