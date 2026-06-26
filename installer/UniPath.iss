; UniPath Windows Installer
; Requires Inno Setup 6+ (https://jrsoftware.org/isdl.php)

#define MyAppName "UniPath"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "UniPath"
#define MyAppURL "https://unipath.app"
#define MyAppExeName "UniPath.exe"
#define MyAppAssocName "UniPath App"
#define MyAppAssocExt ".unipath"
#define MyAppAssocKey StringChange(MyAppAssocName, " ", "") + MyAppAssocExt

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
OutputDir=..\dist-installer
OutputBaseFilename=UniPath-Setup-{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
ShowLanguageDialog=no
SetupLogging=yes
UninstallDisplayIcon={app}\UniPath.exe
UninstallDisplayName={#MyAppName}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} - Opportunity Discovery Platform
VersionInfoProductName={#MyAppName}
VersionInfoVersion={#MyAppVersion}
TimeStampsInUTC=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: checkedonce
Name: "startupicon"; Description: "Create a &Start Menu shortcut"; GroupDescription: "Additional icons:"; Flags: checkedonce
Name: "firewall"; Description: "Add Windows Firewall &exception for the backend"; GroupDescription: "Additional tasks:"; Flags: checkedonce
Name: "autostart"; Description: "Launch UniPath &after installation"; GroupDescription: "Additional tasks:"; Flags: checkedonce

[Files]
; ── Main Electron App (from electron-builder output) ──
Source: "..\dist-setup\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: DirExists(ExpandConstant('{src}\..\dist-setup'))

; ── Fallback: Direct app files if electron-builder wasn't run ──
Source: "..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: not DirExists(ExpandConstant('{src}\..\dist-setup'))
Source: "..\dist-electron\*"; DestDir: "{app}\dist-electron"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: not DirExists(ExpandConstant('{src}\..\dist-setup'))
Source: "..\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: not DirExists(ExpandConstant('{src}\..\dist-setup'))
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion; Check: not DirExists(ExpandConstant('{src}\..\dist-setup'))

; ── Backend Binary ──
Source: "..\dist-backend\*"; DestDir: "{app}\backend-bin"; Flags: ignoreversion recursesubdirs createallsubdirs

; ── Launcher Scripts ──
Source: "scripts\unipath-launcher.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\unipath-port-detect.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\post-install.ps1"; Flags: dontcopy

; ── VC++ Redistributable Check ──
Source: "redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: ignoreversion deleteafterinstall; Check: not VCRedistInstalled

[Dirs]
Name: "{app}"; Permissions: users-modify
Name: "{localappdata}\{#MyAppName}"; Permissions: users-modify
Name: "{localappdata}\{#MyAppName}\data"; Permissions: users-modify

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: startupicon
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{autoprograms}\{#MyAppName} Launcher"; Filename: "{app}\unipath-launcher.bat"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: startupicon
Name: "{autodesktop}\{#MyAppName} Launcher"; Filename: "{app}\unipath-launcher.bat"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{autoprograms}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
; ── Install VC++ Redist if missing ──
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing Visual C++ Redistributables..."; Check: not VCRedistInstalled; Flags: skipifsilent

; ── Post-install PowerShell script ──
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{tmp}\post-install.ps1"" -InstallPath ""{app}"" -DataDir ""{localappdata}\{#MyAppName}\data"""; Flags: runhidden; StatusMsg: "Configuring UniPath..."

; ── Add firewall rule ──
Filename: "netsh.exe"; Parameters: "advfirewall firewall add rule name=""UniPath Backend"" dir=in action=allow program=""{app}\backend-bin\unipath-backend.exe"" enable=yes profile=private,domain description=""Allow UniPath backend server"""; Flags: runhidden; StatusMsg: "Adding firewall exception..."; Tasks: firewall; Check: FileExists(ExpandConstant('{app}\backend-bin\unipath-backend.exe'))

; ── Launch app after install ──
Filename: "{app}\{#MyAppExeName}"; Description: "Launch UniPath"; Flags: postinstall nowait skipifsilent; Tasks: autostart; WorkingDir: "{app}"

[UninstallRun]
Filename: "taskkill.exe"; Parameters: "/F /IM ""unipath-backend.exe"""; Flags: runhidden; RunOnceId: "KillBackend"
Filename: "taskkill.exe"; Parameters: "/F /IM ""{#MyAppExeName}"""; Flags: runhidden; RunOnceId: "KillApp"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\backend-bin"
Type: filesandordirs; Name: "{app}\dist"
Type: filesandordirs; Name: "{app}\dist-electron"
Type: filesandordirs; Name: "{app}\node_modules"
Type: files; Name: "{app}\*"
Type: dirifempty; Name: "{app}"

[Registry]
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocExt}\OpenWithProgids"; ValueType: string; ValueName: "{#MyAppAssocKey}"; ValueData: ""; Flags: uninsdeletevalue
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocKey}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppAssocName}"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocKey}\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocKey}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKA; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".myp"; ValueData: ""
Root: HKCU; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}"; ValueType: string; ValueName: "DataDir"; ValueData: "{localappdata}\{#MyAppName}\data"; Flags: uninsdeletekey

[Code]

function VCRedistInstalled: Boolean;
var
  Installed: Cardinal;
begin
  Result := False;
  if RegQueryDWordValue(HKLM, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Installed', Installed) then
    Result := (Installed = 1);
  if not Result then
    if RegQueryDWordValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Installed', Installed) then
      Result := (Installed = 1);
end;

function DirExists(Path: string): Boolean;
begin
  Result := DirExists(Path);
end;

function FileExists(Path: string): Boolean;
begin
  Result := FileExists(Path);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    ExtractTemporaryFile('post-install.ps1');
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: string;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    DataDir := ExpandConstant('{localappdata}') + '\UniPath\data';
    if MsgBox('Do you also want to remove your UniPath data (user accounts, database)?', mbConfirmation, MB_YESNO) = IDYES then
    begin
      if DelTree(DataDir, True, True, True) then
        Log('User data deleted: ' + DataDir);
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): string;
var
  ResultCode: Integer;
  AppRunning: Boolean;
begin
  AppRunning := False;
  if Exec('tasklist.exe', '/FI "IMAGENAME eq UniPath.exe" /NH', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode = 0 then
      AppRunning := True;
  end;
  if not AppRunning then
  begin
    if Exec('tasklist.exe', '/FI "IMAGENAME eq electron.exe" /NH', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      if ResultCode = 0 then
        AppRunning := True;
  end;

  if AppRunning then
  begin
    if MsgBox('UniPath is currently running. The installer needs to close it to continue.' + #13#10 + #13#10 + 'Click Yes to close UniPath and continue, or No to cancel.', mbConfirmation, MB_YESNO) = IDYES then
    begin
      Exec('taskkill.exe', '/F /IM "UniPath.exe"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('taskkill.exe', '/F /IM "unipath-backend.exe"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Sleep(1000);
    end else
      Result := 'Please close UniPath and run the installer again.';
  end;
end;
