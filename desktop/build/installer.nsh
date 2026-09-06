!include "LogicLib.nsh"

!macro customInstall
  ; NDI is dynamically loaded by the OpticMesh native bridge. Respect an
  ; existing NDI 5/6 runtime and launch the official NDI 6 redistributable
  ; only when no compatible x64 runtime can be found.
  ReadEnvStr $0 "NDI_RUNTIME_DIR_V6"
  ${If} $0 != ""
    IfFileExists "$0\Processing.NDI.Lib.x64.dll" ndi_runtime_found
  ${EndIf}

  ReadEnvStr $0 "NDI_RUNTIME_DIR_V5"
  ${If} $0 != ""
    IfFileExists "$0\Processing.NDI.Lib.x64.dll" ndi_runtime_found
  ${EndIf}

  IfFileExists "$PROGRAMFILES64\NDI\NDI 6 Runtime\v6\Processing.NDI.Lib.x64.dll" ndi_runtime_found
  IfFileExists "$PROGRAMFILES64\NDI\NDI 5 Runtime\v5\Processing.NDI.Lib.x64.dll" ndi_runtime_found

  DetailPrint "Installing the NDI 6 Runtime required by LO2S - OpticMesh NDI features..."
  File /oname=$PLUGINSDIR\ndi-runtime.exe "${BUILD_RESOURCES_DIR}\ndi-runtime\NDI 6 Runtime.exe"
  ExecWait '"$PLUGINSDIR\ndi-runtime.exe" /NORESTART' $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "The NDI Runtime installer did not complete (exit code $0). LO2S - OpticMesh will still install, but NDI input and output will remain unavailable until the official NDI Runtime is installed."
    Goto ndi_runtime_done
  ${EndIf}

  IfFileExists "$PROGRAMFILES64\NDI\NDI 6 Runtime\v6\Processing.NDI.Lib.x64.dll" ndi_runtime_installed
  IfFileExists "$PROGRAMFILES64\NDI\NDI 5 Runtime\v5\Processing.NDI.Lib.x64.dll" ndi_runtime_installed
  MessageBox MB_OK|MB_ICONEXCLAMATION "LO2S - OpticMesh could not verify the NDI Runtime after installation. NDI features may require repairing the NDI Runtime installation and restarting OpticMesh."
  Goto ndi_runtime_done

ndi_runtime_found:
  DetailPrint "Compatible NDI Runtime detected; prerequisite installation skipped."
  Goto ndi_runtime_done

ndi_runtime_installed:
  DetailPrint "NDI Runtime installed successfully."

ndi_runtime_done:
!macroend
