# Building the patch

Step-by-step setup for a local build. If something here is wrong or missing, come discuss it on our [Discord server](https://discord.gg/rq4GGCh).

## 1. Prerequisites

- Windows, PowerShell 7+ (`pwsh`)
- .NET SDK 9.0+ (for `DoNut`)
- Python 3.10+
- Git, with submodule support
- Qt 5.15.x (MSVC 2019 build) and Visual Studio 2022 (for `installer/noidget` and `launcher/realboot`)
- 7-Zip
- A **legitimate copy of ANONYMOUS;CODE** (Steam). Several steps below read files out of your own install; none of that data is checked into this repo

## 2. Get the code

```powershell
git clone --recurse-submodules https://github.com/CommitteeOfZero/ac-patch.git
```

Submodules: `kawtools`, `DoNut`, `ac-scripts-full` / `ac-scripts-partial` (translation text), `installer/noidget`, `launcher/realboot`.

## 3. Local config

- Copy `config.ps1.sample` → `config.ps1` and edit the `PATH` entries (Qt, VC++ toolchain, 7-Zip) for your machine. `terribuild.ps1` refuses to run without this file.
- Copy `installer/noidget/conf.pri.sample` → `conf.pri` and point `INCLUDEPATH`/`HEADERS` at your local xdelta3 source checkout.

## 4. Populate `build-vortex/`

This is the manual, one-time-per-machine part. Everything here is your own extraction from your own game install.

For each archive, decompile it out of your game's `windata` folder:

```powershell
FreeMote\PsbDecompile.exe info-psb -k 5fWhAHt4zVn2X <path-to-game>\windata\<archive>_info.psb.m
```

This produces a loose folder of entries plus `<archive>_info.psb.m.json`/`.resx.json`. Where to put the output:

| Archive | Source file | Loose entries → | Also supply |
| --- | --- | --- | --- |
| `c0patch` (full) | `windata\c0patch_info.psb.m` | `build-vortex/full/c0patch/` | -- (manifest already tracked) |
| `c0patch` (partial) | same | `build-vortex/partial/c0patch/` | -- |
| `config` (full) | `windata\config_info.psb.m` | `build-vortex/full/config/` | `config_info.psb.m.resx.json` → `build-vortex/full/` |
| `config` (partial) | same | `build-vortex/partial/config/` | `config_info.psb.m.resx.json` → `build-vortex/partial/` |
| `script` | `windata\script_info.psb.m` | `build-vortex/common/script/` | -- |
| `font` | `windata\font_info.psb.m` | `build-vortex/common/font/` | -- |
| `c0sound` | `windata\c0sound_info.psb.m` | `build-vortex/common/c0sound/` | -- |

Notes:

- `c0patch` archives carry the modified images of the patch. If you wish to add or remove images, just do so, `DoNut` will do the rest. You also need the unpatched `scenario` files in there, so that the strings overwrite the json hosting the scenario.
- Only `config` needs you to manually supply its archive-level `.resx.json`; every other archive already has its manifest (`.json` + `.resx.json`) tracked in this repo, so just drop the loose entries in and leave the manifest files alone.
- Don't overwrite anything already tracked in these folders (e.g. `build-vortex/common/script/main.nut.m`, `build-vortex/full/config/init.psb.m.json`). Those are the patch's actual changes.
- If your game install already has this patch applied, use the `_original` backup next to each live archive instead (e.g. `windata\font_info_original.psb.m`), but copy and rename it back to its real name first (`font_info.psb.m`), or decompiling it will fail with a zlib error.
- `content/DIST_COMMON/windata/movie/` needs the patch-added `.mzv` movie files copied in directly from your install.

## 5. Build

```powershell
.\terribuild.ps1
```


