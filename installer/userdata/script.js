var readmeText = ng.fs.global().readTextFile(':/userdata/README.txt');
var licenseText = ng.fs.global().readTextFile(':/userdata/LICENSE.txt');

var product =
    JSON.parse(ng.fs.global().readTextFile(':/userdata/product.json'));

var enscriptToc =
    JSON.parse(ng.fs.global().readTextFile(':/userdata/enscriptToc.json'));

var state = {};
state.discovery = {
  run: false,
  gameFound: false,
  patchFound: false,
  gameLocation: ''
};

var patchType = "";

function pad2(n) {
  if (n < 10) return '0' + n;
  return '' + n;
}

function checkConflictingProcesses(candidates) {
  var any = false;
  var closeList = '';
  candidates.forEach(function(candidate) {
    if (ng.systemInfo.isProcessRunning(candidate)) {
      any = true;
      closeList += candidate + '\n';
    }
  });
  if (any) {
    ng.window.modal(ng.view.DlgType.OK, function(dlg) {
      dlg.width = 300;
      var lbl = dlg.addLabel(
          'You are running the following programs which may conflict with installation. Please close them to continue.');
      dlg.addSpace(16);
      var tf = dlg.addTextField({text: closeList, richText: false});
      dlg.addSpace(16);
    });
  }
  return any;
}

function DiscoverExisting() {
  if (state.discovery.run) return;

  state.discovery.run = true;

  switch (ng.systemInfo.platform()) {
    case ng.systemInfo.OsFamily.Windows:
      if (ng.win32.registry().valueExists(
              ng.win32.RootKey.HKLM,
              product.platforms.windows.uninstallProductKey, false,
              'InstallLocation')) {
        state.discovery.gameFound = true;
        state.discovery.patchFound = true;
        state.discovery.gameLocation = ng.win32.registry().value(
            ng.win32.RootKey.HKLM,
            product.platforms.windows.uninstallProductKey, false,
            'InstallLocation');
      } else {
        // Steam discovery

        // Find library folders
        var libraryFolders = ['%STEAM_PATH%'];
        if (ng.fs.global().pathIsFile(
                '%STEAM_PATH%/steamapps/libraryfolders.vdf') &&
            ng.fs.global().pathIsReadable(
                '%STEAM_PATH%/steamapps/libraryfolders.vdf')) {
          libraryfoldersVdf = ng.fs.global().readTextFile(
              '%STEAM_PATH%/steamapps/libraryfolders.vdf');

          // parse text VDF, poorly
          var strLiteralRegex = /"([^"]*)"/g;
          while ((match = strLiteralRegex.exec(libraryfoldersVdf)) !== null) {
            var unescaped = eval(match[0]);  // yolo
            if (ng.fs.global().pathIsDirectory(unescaped))
              libraryFolders.push(unescaped);
          }
        }

        // check all library folders for our game
        var tryPath =
            function(path) {
          if (ng.fs.global().pathIsDirectory(path)) {
            state.discovery.gameFound = true;
            state.discovery.gameLocation = path;
            return true;
          }
          return false;
        }

        if (nglib.isSteamPlay()) {
          // missing slash here is intentional
          var compatdata =
              ng.fs.global().expandedPath('Z:%STEAM_COMPAT_DATA_PATH%');
          var startSteamapps = compatdata.indexOf('/steamapps/');
          if (startSteamapps !== -1) {
            libraryFolders.push(compatdata.substr(0, startSteamapps));
          }
        }

        // SteamApps is all lowercase for the main library, CamelCase for
        // others... and we should respect case sensitivity for Wine
        for (var i = 0; i < libraryFolders.length; i++) {
          if (tryPath(
                  libraryFolders[i] + '/steamapps/common/%GAME_STEAM_NAME%'))
            return;
          if (tryPath(
                  libraryFolders[i] + '/SteamApps/common/%GAME_STEAM_NAME%'))
            return;
        }
      }
      break;
  }
}

function DoTx() {
  ng.tx.tx().receiptPath = '%GAME_PATH%';
  ng.tx.tx().finishText = 'Installation has successfully completed.\n\nHack into God.';
  ng.tx.tx().cancelText =
      'You cancelled the installation.\n\nProgress has not been undone.\n\nA log of changes has been stored to %LOGPATH%.';
  ng.tx.tx().errorText =
      'An error has occurred during installation.\n\nProgress has not been undone.\n\nA log of changes has been stored to %LOGPATH%.';


  if (ng.systemInfo.platform() == ng.systemInfo.OsFamily.Windows) {
    var regSection = ng.tx.tx().addSection('Registration');

    regSection.setRegistryValue(
        ng.win32.RootKey.HKLM, product.platforms.windows.uninstallProductKey,
        false, 'DisplayName',
        product.platforms.windows.uninstallProductDisplayName);
    regSection.setRegistryValue(
        ng.win32.RootKey.HKLM, product.platforms.windows.uninstallProductKey,
        false, 'DisplayVersion',
        product.platforms.windows.uninstallProductDisplayVersion);
    regSection.setRegistryValue(
        ng.win32.RootKey.HKLM, product.platforms.windows.uninstallProductKey,
        false, 'InstallLocation', ng.fs.global().expandedPath('%GAME_PATH%'));
    var date = new Date();
    regSection.setRegistryValue(
        ng.win32.RootKey.HKLM, product.platforms.windows.uninstallProductKey,
        false, 'InstallDate',
        '' + date.getFullYear() + pad2(date.getMonth()) + pad2(date.getDate()));
    regSection.setRegistryValue(
        ng.win32.RootKey.HKLM, product.platforms.windows.uninstallProductKey,
        false, 'NoModify', 1);
    regSection.setRegistryValue(
        ng.win32.RootKey.HKLM, product.platforms.windows.uninstallProductKey,
        false, 'NoRepair', 1);
    regSection.setRegistryValue(
        ng.win32.RootKey.HKLM, product.platforms.windows.uninstallProductKey,
        false, 'VersionMajor',
        product.platforms.windows.uninstallProductVersionMajor);
    regSection.setRegistryValue(
        ng.win32.RootKey.HKLM, product.platforms.windows.uninstallProductKey,
        false, 'VersionMinor',
        product.platforms.windows.uninstallProductVersionMinor);
    regSection.setRegistryValue(
        ng.win32.RootKey.HKLM, product.platforms.windows.uninstallProductKey,
        false, 'UninstallString',
        ng.fs.global().expandedPath(
            product.platforms.windows.uninstallProductUninstallString));

    // Ensure LanguageBarrier gets loaded
    if (ng.systemInfo.isWine()) {
      regSection.setRegistryValue(
          ng.win32.RootKey.HKCU, 'Software\\Wine\\DllOverrides', true,
          'dinput8', 'native,builtin');
    }
  }

  // We're renaming the exe since we had to rename the launcher to be called by Steam since canaryMagesLauncher is dead.
  var applyPatchesSection = ng.tx.tx().addSection('Applying patches');

  applyPatchesSection.log('Renaming launcher executable...');

  if (!ng.fs.global().pathIsFile('%GAME_PATH%/MAGESgamelauncher_original.exe')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/MAGESgamelauncher.exe', '%GAME_PATH%/MAGESgamelauncher_original.exe');
  }

  //Renaming the ressources to not overwrite
  applyPatchesSection.log('Creating backups of original ressources...');

  //Inside windata/movie
  if (!ng.fs.global().pathIsFile('%GAME_PATH%/windata/movie/op_en_original.mzv')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/windata/movie/op_en.mzv', '%GAME_PATH%/windata/movie/op_en_original.mzv');
  }

  if (!ng.fs.global().pathIsFile('%GAME_PATH%/windata/movie/op_silent_original.mzv')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/windata/movie/op_silent.mzv', '%GAME_PATH%/windata/movie/op_silent_original.mzv');
  }

  if (!ng.fs.global().pathIsFile('%GAME_PATH%/windata/movie/op_original.mzv')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/windata/movie/op.mzv', '%GAME_PATH%/windata/movie/op_original.mzv');
  }

  if (!ng.fs.global().pathIsFile('%GAME_PATH%/windata/movie/normal_end_original.mzv')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/windata/movie/normal_end.mzv', '%GAME_PATH%/windata/movie/normal_end_original.mzv');
  }

  if (!ng.fs.global().pathIsFile('%GAME_PATH%/windata/movie/true_end_original.mzv')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/windata/movie/true_end.mzv', '%GAME_PATH%/windata/movie/true_end_original.mzv');
  }

  //Inside windata
  //Config
  if (!ng.fs.global().pathIsFile('%GAME_PATH%/windata/config_body_original.bin')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/windata/config_body.bin', '%GAME_PATH%/windata/config_body_original.bin');
  }

  if (!ng.fs.global().pathIsFile('%GAME_PATH%/windata/config_info_original.psb.m')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/windata/config_info.psb.m', '%GAME_PATH%/windata/config_info_original.psb.m');
  }
  
  //Font
  if (!ng.fs.global().pathIsFile('%GAME_PATH%/windata/font_body_original.bin')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/windata/font_body.bin', '%GAME_PATH%/windata/font_body_original.bin');
  }

  if (!ng.fs.global().pathIsFile('%GAME_PATH%/windata/font_info_original.psb.m')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/windata/font_info.psb.m', '%GAME_PATH%/windata/font_info_original.psb.m');
  }

  //Script
  if (!ng.fs.global().pathIsFile('%GAME_PATH%/windata/script_body_original.bin')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/windata/script_body.bin', '%GAME_PATH%/windata/script_body_original.bin');
  }

  if (!ng.fs.global().pathIsFile('%GAME_PATH%/windata/script_info_original.psb.m')) {
    applyPatchesSection.copyFiles('%GAME_PATH%/windata/script_info.psb.m', '%GAME_PATH%/windata/script_info_original.psb.m');
  }

  //Actual patching
  var patchContentSection = ng.tx.tx().addSection('Copying patch content');
  patchContentSection.log('Copying common resources...');
  patchContentSection.copyFiles('%PATCH_CONTENT_COMMON%/*', '%GAME_PATH%');

  if (patchType == "full") {
    patchContentSection.log('Copying Full Patch resources...');
    patchContentSection.copyFiles('%PATCH_CONTENT_FULL%/*', '%GAME_PATH%');
  } else if (patchType == "partial") {
    patchContentSection.log('Copying Partial Patch resources...');
    patchContentSection.copyFiles('%PATCH_CONTENT_PARTIAL%/*', '%GAME_PATH%');
  }





  // var buildScriptMpk =
  //     function(scriptMpkPath, scriptMpkToc, scriptDiffsPath) {
  //   var scriptMpk = applyPatchesSection.buildMpk(scriptMpkPath);
  //   scriptMpkToc.forEach(function(entry) {
  //     var diffPath = scriptDiffsPath + '/' + entry.filename + '.vcdiff';
  //     if (ng.fs.global().pathIsFile(diffPath)) {
  //       var stream = ng.tx.xdelta3Stream(
  //           ng.tx.mpkInputStream(product.origScriptArchivePath, entry.id),
  //           ng.tx.fileStream(diffPath));
  //       scriptMpk.addEntry({
  //         id: entry.id,
  //         name: entry.filename,
  //         source: stream,
  //         displaySize: entry.size
  //       });
  //     } else {
  //       scriptMpk.addEntry({
  //         id: entry.id,
  //         name: entry.filename,
  //         source: ng.tx.mpkInputStream(product.origScriptArchivePath, entry.id),
  //         displaySize: entry.size
  //       });
  //     }
  //   });
  // }

  // applyPatchesSection.log('Building patched script archive...');
  // buildScriptMpk('%ENSCRIPT_MPK%', enscriptToc, '%SCRIPT_DIFFS%');

  if (state.shouldCreateDesktopShortcut ||
      state.shouldCreateStartMenuShortcut) {
    var shortcutsSection = ng.tx.tx().addSection('Creating shortcuts');
    if (state.shouldCreateDesktopShortcut) {
      var desktopShortcut = JSON.parse(JSON.stringify(product.playShortcut));
      desktopShortcut.shortcutPath = '%DESKTOP_SHORTCUT_PATH%';
      shortcutsSection.createShortcut(desktopShortcut);
    }
    if (state.shouldCreateStartMenuShortcut) {
      var startMenuShortcut = JSON.parse(JSON.stringify(product.playShortcut));
      startMenuShortcut.shortcutPath = '%STARTMENU_SHORTCUT_PATH%';
      shortcutsSection.createShortcut(startMenuShortcut);
    }
  }

  // Yeah, these nested double-quotes work, really.
  if (state.shouldRunLauncher) {
    ng.tx.tx().addExecuteAfterFinish(ng.fs.global().expandedPath(
        'cmd /c "cd /d "%GAME_PATH%" & %LAUNCHER_EXE%"'));
  }

  // Proton currently has trouble with boot.bat, the solution is to replace it
  // with the launcher
  // And here the nested quotes don't quite work but we can escape them properly
  // ...in the first instance, anyway, haven't gotten that to work for the start
  // command, hence the shell script
  if (nglib.isSteamPlay()) {
    ng.tx.tx().addExecuteAfterFinish(ng.fs.global().expandedPath(
        'cmd /c "cd /d \"%GAME_PATH%\" & start Z:%SHELL% proton_boot_fix.sh"'));
  }

  // And hundreds of lines of code later...
  ng.tx.run();
}

var StartPage = function() {
  nglib.PageController.call(this, "");
  this.view.addTextField(
    "var StartPage = function() {\n" +
    "  nglib.PageController.call(this, \"\");\n" +
    "  this.view.addTextField(\n" +
    "    The future displayed by this data is rooted in the world you live in right now.\n" +
    "    That future is now yours to observe with your own eyes.\n" +
    "    It is our hope that you can witness firsthand what a game over within the simulation data will look like as well.\n" +
    "    Whether you yourself change the outcome, or the factor you interfere with changes things... That remains up to you.\n" +
    "    A world merely existing is not significant all on its own. It only takes on any definition once it is observed.\n" +
    "    With that in mind, it is our hope that your observation will have meaning.\n" +
    "  )\n" +
    "};\n" +
    "StartPage.prototype = Object.create(nglib.PageController.prototype);\n" +
    "StartPage.prototype.onNext = function() {\n" +
    "  (new ReadmePage()).push();\n" +
    "};\n"
  )
};
StartPage.prototype = Object.create(nglib.PageController.prototype);
StartPage.prototype.onNext = function() {
  (new ReadmePage()).push();
};


var ReadmePage = function() {
  nglib.PageController.call(this, 'Readme');
  this.view.addTextField(readmeText);
};
ReadmePage.prototype = Object.create(nglib.PageController.prototype);
ReadmePage.prototype.onNext = function() {
  (new LicensePage()).push();
};

var LicensePage = function() {
  nglib.PageController.call(this, 'License');
  this.view.addTextField(licenseText);
  this.acceptedCheckBox = this.view.addCheckBox(
      'I have read and accept these terms and conditions.');
};
LicensePage.prototype = Object.create(nglib.PageController.prototype);
LicensePage.prototype.onNext = function() {
  if (!this.acceptedCheckBox.checked) {
    ng.window.messageBox(
        'You cannot proceed if you do not accept the license agreements.');
    return;
  }

  DiscoverExisting();

  (new DubRespectPage()).push();
};

var DubRespectPage = function() {
  nglib.PageController.call(this, 'Dub Consistency');
  this.view.addTextField(
    "As this localization includes an English dub, we're offering two different patches: Partial and Full.\n\n" +

    "The Partial patch adds subtitles for songs and voice-only lines, but in the interest of immersion in regard to the EN dub, does not fix series-wide inconsistencies and grammar mistakes. This is because these changes would cause the written lines to occasionally not match the spoken ones in the dub.\n\n" +
    
    "The Full patch includes all of these fixes, as well as the subtitles. If you are playing with JP voices or do not mind some discrepancies with the EN dub, we suggest the Full patch.\n\n" +
    
    "If you wish to play with the Full patch, check the first box at the bottom. If you wish to play with the Partial patch, leave it unchecked."
  )

  this.patchCheckBox = this.view.addCheckBox(
      'Use the Full Patch');

  this.acceptedCheckBox = this.view.addCheckBox(
      'I have read and chosen the scope of the patch.');
};
DubRespectPage.prototype = Object.create(nglib.PageController.prototype);
DubRespectPage.prototype.onNext = function() {
  if (this.patchCheckBox.checked) {
    patchType = "full";
  } else {
    patchType = "partial";
  }
  if (!this.acceptedCheckBox.checked) {
    ng.window.messageBox(
      'You cannot proceed if you do not confirm the acknowledgement of different scopes.');
    return;
  }
    
  (new DirectoryPage()).push();
};

var DirectoryPage = function() {
  nglib.PageController.call(this, 'Settings');
  this.view.addLabel(
      'Choose directory where ' + product.gameTitle + ' (' +
      product.inputScriptVersionTitle +
      ') is installed, containing files like game.exe and the windata folder:');
  var pickerParams = {title: 'Choose game directory'};
  if (state.discovery.gameFound) {
    pickerParams.preset =
        ng.fs.global().expandedPath(state.discovery.gameLocation);
  }
  this.gameDirectoryPicker = this.view.addDirectoryPicker(pickerParams);
  this.view.addSpace(32);
  if (!nglib.isSteamPlay()) {
    this.desktopShortcutCb =
        this.view.addCheckBox({text: 'Create desktop shortcut', preset: true});
    this.startMenuShortcutCb = this.view.addCheckBox(
        {text: 'Create Start Menu shortcut', preset: true});
    this.launcherCb = this.view.addCheckBox(
        {text: 'Run launcher after installation', preset: true});
  }
};
DirectoryPage.prototype = Object.create(nglib.PageController.prototype);
DirectoryPage.prototype.onNext = function() {
  if (ng.systemInfo.platform() == ng.systemInfo.OsFamily.Windows) {
    if (checkConflictingProcesses(
            product.platforms.windows.conflictingProcesses))
      return;
  }

  ng.fs.global().setMacro('GAME_PATH', this.gameDirectoryPicker.value);

  if (!ng.fs.global().pathIsDirectory('%GAME_PATH%')) {
    ng.window.messageBox('Game directory doesn\'t exist or isn\'t a directory');
    return;
  }
  if (!ng.fs.global().pathIsWritable('%GAME_PATH%')) {
    ng.window.messageBox('Game directory isn\'t writable');
    return;
  }
  // if (!ng.fs.global().pathIsFile(product.origScriptArchivePath)) {
  //   ng.window.messageBox(
  //       'Could not find ' + product.gameTitle + ' (' +
  //       product.inputScriptVersionTitle + ') in specified directory.');
  //   return;
  // } else if (
  //     ng.fs.global().md5sum(product.origScriptArchivePath) !=
  //     product.origScriptArchiveHash) {
  //   ng.window.messageBox(
  //       'Game scripts present but invalid. Ensure you are using a fully updated ' +
  //       product.gameTitle + ' (' + product.inputScriptVersionTitle +
  //       ') and the latest patch version. If the game has recently received an official update, the patch may have to be updated to match, please check our website.');
  //   return;
  // }

  // TODO: check fs for same physical directory / ignore slashes difference
  // TODO: HTML escape?
  if (state.discovery.patchFound &&
      state.discovery.gameLocation != this.gameDirectoryPicker.value) {
    var shouldContinue = ng.window.modal(ng.view.DlgType.YesNo, function(dlg) {
      dlg.width = 300;
      var lbl = dlg.addLabel(
          'A previous installation of the patch has been found at:<br<br>' +
          state.discovery.gameLocation +
          '<br><br>If you continue, you will not be able to use the uninstaller for the previous installation.<br><br>Continue?');
      lbl.richText = true;
    });
    if (!shouldContinue) return;
  }

  if (nglib.isSteamPlay()) {
    state.shouldCreateDesktopShortcut = false;
    state.shouldCreateStartMenuShortcut = false;
    state.shouldRunLauncher = false;
  } else {
    state.shouldCreateDesktopShortcut = this.desktopShortcutCb.checked;
    state.shouldCreateStartMenuShortcut = this.startMenuShortcutCb.checked;
    state.shouldRunLauncher = this.launcherCb.checked;
  }

  DoTx();
};

ng.fs.global().addMacros(product.paths);
switch (ng.systemInfo.platform()) {
  case ng.systemInfo.OsFamily.Windows:
    ng.fs.global().addMacros(product.platforms.windows.paths);
    ng.fs.global().setMacro(
        'DESKTOP',
        ng.win32.registry().value(
            ng.win32.RootKey.HKCU,
            'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders',
            true, 'Desktop'));
    ng.fs.global().setMacro(
        'STARTMENU',
        ng.win32.registry().value(
            ng.win32.RootKey.HKCU,
            'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders',
            true, 'Start Menu'));
    ng.fs.global().setMacro(
        'MYDOCUMENTS',
        ng.win32.registry().value(
            ng.win32.RootKey.HKCU,
            'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders',
            true, 'Personal'));
    if (ng.win32.registry().valueExists(
            ng.win32.RootKey.HKCU, 'Software\\Valve\\Steam', true,
            'SteamPath')) {
      ng.fs.global().setMacro(
          'STEAM_PATH',
          ng.win32.registry().value(
              ng.win32.RootKey.HKCU, 'Software\\Valve\\Steam', true,
              'SteamPath'));
    }
    if (ng.win32.registry().valueExists(
            ng.win32.RootKey.HKCU, 'Software\\Valve\\Steam\\ActiveProcess', true,
            'ActiveUser')) {
      ng.fs.global().setMacro(
          'STEAM_ACTIVE_USER',
          ng.win32.registry().value(
              ng.win32.RootKey.HKCU, 'Software\\Valve\\Steam\\ActiveProcess', true,
              'ActiveUser'));
}
    break;
}

ng.window.setTitle(product.windowTitle);
ng.window.setMessageBoxIcon(':/userdata/alert.png');
ng.window.playBgm(
    {url: ':/userdata/bgm.mp3', loopStart: 0, loopEnd: 0});

if (ng.systemInfo.isWine()) {
  if (!nglib.isSteamPlay()) {
    ng.window.messageBox(
        'You are trying to install the patch on Wine outside of Steam Play. This is unsupported and probably not what you want. See our website for instructions.');
  }
}


(new StartPage()).push();