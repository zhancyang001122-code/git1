[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not ("XiaozhiCredentialReader" -as [type])) {
  Add-Type @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct XiaozhiStoredCredential {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
}

public static class XiaozhiCredentialReader {
    [DllImport("Advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);

    [DllImport("Advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr buffer);
}
"@
}

$target = "xiaozhi-local-life/vercel/DEMO_ADMIN_TOKEN"
$pointer = [IntPtr]::Zero
if (-not [XiaozhiCredentialReader]::CredRead($target, 1, 0, [ref]$pointer)) {
  $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  throw "Xiaozhi admin token was not found. Windows error code: $code."
}

try {
  $credential = [Runtime.InteropServices.Marshal]::PtrToStructure(
    $pointer,
    [type][XiaozhiStoredCredential]
  )
  $secret = [Runtime.InteropServices.Marshal]::PtrToStringUni(
    $credential.CredentialBlob,
    [int]($credential.CredentialBlobSize / 2)
  )
  if ([string]::IsNullOrWhiteSpace($secret)) {
    throw "The Xiaozhi admin token stored in Windows is empty."
  }
  Set-Clipboard -Value $secret
  Write-Output "Admin token copied to the clipboard. Clear it after use."
} finally {
  [XiaozhiCredentialReader]::CredFree($pointer)
}
