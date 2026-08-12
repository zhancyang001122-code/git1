[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
  [string]$Secret
)

begin {
  Set-StrictMode -Version Latest
  $ErrorActionPreference = "Stop"

  if (-not ("XiaozhiCredentialNative" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct XiaozhiCredential {
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

public static class XiaozhiCredentialNative {
    [DllImport("Advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredWrite(ref XiaozhiCredential credential, UInt32 flags);
}
"@
  }
}

process {
  if ($Secret.Length -lt 32) {
    throw "The admin token must contain at least 32 characters."
  }

  $target = "xiaozhi-local-life/vercel/DEMO_ADMIN_TOKEN"
  $bytes = [Text.Encoding]::Unicode.GetBytes($Secret)
  $blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
  try {
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
    $credential = [XiaozhiCredential]@{
      Flags = 0
      Type = 1
      TargetName = $target
      Comment = "Xiaozhi Production admin token"
      CredentialBlobSize = $bytes.Length
      CredentialBlob = $blob
      Persist = 2
      AttributeCount = 0
      Attributes = [IntPtr]::Zero
      TargetAlias = $null
      UserName = "xiaozhi-production-admin"
    }
    if (-not [XiaozhiCredentialNative]::CredWrite([ref]$credential, 0)) {
      $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      throw "Windows Credential Manager write failed with code $code."
    }
  } finally {
    for ($index = 0; $index -lt $bytes.Length; $index++) {
      [Runtime.InteropServices.Marshal]::WriteByte($blob, $index, 0)
    }
    [Runtime.InteropServices.Marshal]::FreeHGlobal($blob)
    [Array]::Clear($bytes, 0, $bytes.Length)
  }

  Write-Output "Admin token stored in Windows Credential Manager."
}
