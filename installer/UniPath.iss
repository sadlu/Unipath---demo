; UniPath Windows Installer
; Requires Inno Setup 6+ (https://jrsoftware.org/isdl.php)

#define MyAppName "UniPath"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "UniPath"
#define MyAppURL "https://github.com/sadlu/Unipath---demo"
#define MyAppExeName "UniPath.exe"

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
DisableDirPage=yes
OutputDir=..\dist-installer
OutputBaseFilename=UniPath-Setup-{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
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
Name: "firewall"; Description: "Add Windows Firewall &exception for the backend"; GroupDescription: "Additional tasks:"; Flags: checkedonce

[Files]
; ── Electron app from electron-builder ──
Source: "..\dist-setup\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: IsElectronBuilderOutput

; ── Fallback: raw app files ──
Source: "..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: not IsElectronBuilderOutput
Source: "..\dist-electron\*"; DestDir: "{app}\dist-electron"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: not IsElectronBuilderOutput
Source: "..\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: not IsElectronBuilderOutput
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion; Check: not IsElectronBuilderOutput

; ── Backend binary ──
Source: "..\dist-backend\*"; DestDir: "{app}\backend-bin"; Flags: ignoreversion recursesubdirs createallsubdirs

; ── Launcher scripts ──
Source: "scripts\unipath-launcher.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\unipath-port-detect.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\post-install.ps1"; Flags: dontcopy

; ── VC++ Redist (bundled) ──
Source: "redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: ignoreversion deleteafterinstall; Check: not VCRedistInstalled

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

function IsElectronBuilderOutput: Boolean;
begin
  Result := DirExists(ExpandConstant('{srcexe}') + '\..\dist-setup');
end;

[Dirs]
Name: "{app}"; Permissions: users-modify
Name: "{localappdata}\{#MyAppName}"; Permissions: users-modify
Name: "{localappdata}\{#MyAppName}\data"; Permissions: users-modify

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{autoprograms}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
; ── Install VC++ Redist if missing ──
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing Visual C++ Redistributables..."; Check: not VCRedistInstalled; Flags: skipifsilent

; ── Post-install config ──
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{tmp}\post-install.ps1"" -InstallPath ""{app}"" -DataDir ""{localappdata}\{#MyAppName}\data"""; Flags: runhidden; StatusMsg: "Configuring UniPath..."

; ── Firewall rule ──
Filename: "netsh.exe"; Parameters: "advfirewall firewall add rule name=""UniPath Backend"" dir=in action=allow program=""{app}\backend-bin\unipath-backend.exe"" enable=yes profile=private,domain description=""Allow UniPath backend server"""; Flags: runhidden; StatusMsg: "Adding firewall exception..."; Tasks: firewall; Check: FileExists(ExpandConstant('{app}\backend-bin\unipath-backend.exe'))

; ── Launch after install ──
Filename: "{app}\{#MyAppExeName}"; Description: "Launch UniPath"; Flags: postinstall nowait skipifsilent; WorkingDir: "{app}"

[UninstallRun]
Filename: "taskkill.exe"; Parameters: "/F /IM ""unipath-backend.exe"""; Flags: runhidden; RunOnceId: "KillBackend"
Filename: "taskkill.exe"; Parameters: "/F /IM ""{#MyAppExeName}"""; Flags: runhidden; RunOnceId: "KillApp"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Registry]
Root: HKCU; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}"; ValueType: string; ValueName: "DataDir"; ValueData: "{localappdata}\{#MyAppName}\data"; Flags: uninsdeletekey

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    ExtractTemporaryFile('post-install.ps1');
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: string;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    DataDir := ExpandConstant('{localappdata}') + '\UniPath\data';
    if MsgBox('Remove your UniPath data (accounts, database)?', mbConfirmation, MB_YESNO) = IDYES then
      if DelTree(DataDir, True, True, True) then
        Log('User data deleted: ' + DataDir);
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): string;
var
  ResultCode: Integer;
begin
  if Exec('tasklist.exe', '/FI "IMAGENAME eq UniPath.exe" /NH', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    if ResultCode = 0 then
    begin
      if MsgBox('UniPath is running. Close it to continue?', mbConfirmation, MB_YESNO) = IDYES then
      begin
        Exec('taskkill.exe', '/F /IM "UniPath.exe"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
        Exec('taskkill.exe', '/F /IM "unipath-backend.exe"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
        Sleep(1000);
      end else
        Result := 'Close UniPath and run the installer again.';
    end;
end;
