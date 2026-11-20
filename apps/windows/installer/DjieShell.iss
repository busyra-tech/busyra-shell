; Installer Djie Shell untuk Windows (Inno Setup 6.3+).
; Build:
;   iscc /DAppVersion=0.1.0 /DArch=x64 /DSourceDir=..\publish\win-x64 /DOutputDir=..\dist DjieShell.iss
; Hasil: Djie-Shell-<versi>-Windows-<arch>-Setup.exe
; Dipasang per user (tanpa admin) di %LOCALAPPDATA%\Programs\Djie Shell.

#ifndef AppVersion
  #define AppVersion "0.4.0"
#endif
#ifndef Arch
  #define Arch "x64"
#endif
#ifndef SourceDir
  #define SourceDir "..\publish\win-" + Arch
#endif
#ifndef OutputDir
  #define OutputDir "..\dist"
#endif
; x64 juga boleh dipasang di Windows ARM (lewat emulasi)
#if Arch == "x64"
  #define ArchAllowed "x64compatible"
#else
  #define ArchAllowed "arm64"
#endif
; Skema URL login Google (sama dengan GoogleAuth.Scheme di app)
#define OAuthScheme "com.googleusercontent.apps.311371837872-fj25ea2esclbv4kt79beo4edjsutaig2"

[Setup]
AppId={{6E1C9B9A-4D7B-4F0E-9C5A-D71E5E11A001}
AppName=Djie Shell
AppVersion={#AppVersion}
AppVerName=Djie Shell {#AppVersion}
AppPublisher=Adjie Kurniawan
AppPublisherURL=https://masadjie.github.io/djie-shell/
AppSupportURL=https://github.com/masadjie/djie-shell/issues
AppUpdatesURL=https://github.com/masadjie/djie-shell/releases/latest
DefaultDirName={localappdata}\Programs\Djie Shell
DefaultGroupName=Djie Shell
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed={#ArchAllowed}
ArchitecturesInstallIn64BitMode={#ArchAllowed}
MinVersion=10.0.19041
OutputDir={#OutputDir}
OutputBaseFilename=Djie-Shell-{#AppVersion}-Windows-{#Arch}-Setup
SetupIconFile=..\DjieShell\Assets\djie.ico
UninstallDisplayIcon={app}\DjieShell.exe
UninstallDisplayName=Djie Shell
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=force
RestartApplications=no
VersionInfoVersion={#AppVersion}
VersionInfoProductName=Djie Shell

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[InstallDelete]
; Bersihkan versi lama supaya tidak ada DLL sisa
Type: filesandordirs; Name: "{app}\*"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Djie Shell"; Filename: "{app}\DjieShell.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\Djie Shell"; Filename: "{app}\DjieShell.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Registry]
; Supaya browser bisa kembali ke app setelah login Google
Root: HKCU; Subkey: "Software\Classes\{#OAuthScheme}"; ValueType: string; ValueName: ""; ValueData: "URL:Djie Shell"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\{#OAuthScheme}"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\{#OAuthScheme}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\DjieShell.exe"" ""%1"""

[Run]
Filename: "{app}\DjieShell.exe"; Description: "{cm:LaunchProgram,Djie Shell}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Hanya file sementara; vault & pengaturan di %APPDATA%\Djie Shell tetap aman
Type: filesandordirs; Name: "{localappdata}\Djie Shell\session-keys"
