param(
  [string]$BaseUrl = "http://127.0.0.1:8080",
  [string]$TenantSlug = "acme",
  [string]$TenantName = "Acme Inc",
  [string]$OrgAdminName = "Org Admin User",
  [string]$OrgAdminEmail = "org.admin@acme.com",
  [string]$OrgAdminPassword = "Passw0rd!",
  [string]$SystemAdminName = "System Admin",
  [string]$SystemAdminEmail = "allan@acme.com",
  [string]$SystemAdminPassword = "Passw0rd!",
  [switch]$RegisterSystemAdminIfMissing = $true
)

function Decode-JwtPayload {
  param([string]$Token)
  $parts = $Token.Split(".")
  if ($parts.Length -lt 2) { return $null }
  $payload = $parts[1].Replace('-', '+').Replace('_', '/')
  switch ($payload.Length % 4) {
    2 { $payload += "==" }
    3 { $payload += "=" }
  }
  $bytes = [Convert]::FromBase64String($payload)
  $json = [Text.Encoding]::UTF8.GetString($bytes)
  return $json | ConvertFrom-Json
}

Write-Host "== Register org-admin user =="
$registerBody = @{
  tenant_slug = $TenantSlug
  tenant_name = $TenantName
  name        = $OrgAdminName
  email       = $OrgAdminEmail
  password    = $OrgAdminPassword
} | ConvertTo-Json

try {
  $reg = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/register" -ContentType "application/json" -Body $registerBody
  Write-Host "Registered org admin: $OrgAdminEmail"
} catch {
  Write-Host "Register returned error (likely already exists), continuing..."
}

Write-Host "== Login org-admin user =="
$orgLoginBody = @{
  tenant_slug = $TenantSlug
  email       = $OrgAdminEmail
  password    = $OrgAdminPassword
} | ConvertTo-Json

$orgLogin = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" -ContentType "application/json" -Body $orgLoginBody
$orgToken = $orgLogin.token
$orgClaims = Decode-JwtPayload -Token $orgToken
$orgRole = if ($orgClaims -and $orgClaims.role) { $orgClaims.role } elseif ($orgLogin.user -and $orgLogin.user.role) { $orgLogin.user.role } else { "unknown" }
Write-Host "Org admin role:" $orgRole

Write-Host "== Login system-admin user (Allan) =="
$sysLoginBody = @{
  tenant_slug = $TenantSlug
  email       = $SystemAdminEmail
  password    = $SystemAdminPassword
} | ConvertTo-Json

$sysLogin = $null
try {
  $sysLogin = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" -ContentType "application/json" -Body $sysLoginBody
} catch {
  if ($RegisterSystemAdminIfMissing) {
    Write-Host "System admin login failed. Registering system admin in tenant '$TenantSlug'..."
    $sysRegisterBody = @{
      tenant_slug = $TenantSlug
      tenant_name = $TenantName
      name        = $SystemAdminName
      email       = $SystemAdminEmail
      password    = $SystemAdminPassword
    } | ConvertTo-Json
    try {
      Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/register" -ContentType "application/json" -Body $sysRegisterBody | Out-Null
    } catch {
      Write-Host "System admin register returned error (possibly already exists). Retrying login..."
    }
    $sysLogin = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" -ContentType "application/json" -Body $sysLoginBody
  } else {
    throw
  }
}
$sysToken = $sysLogin.token
$sysClaims = Decode-JwtPayload -Token $sysToken
$sysRole = if ($sysClaims -and $sysClaims.role) { $sysClaims.role } elseif ($sysLogin.user -and $sysLogin.user.role) { $sysLogin.user.role } else { "unknown" }
Write-Host "System admin role:" $sysRole

$orgHeaders = @{ Authorization = "Bearer $orgToken" }
$sysHeaders = @{ Authorization = "Bearer $sysToken" }

Write-Host "== Check org-admin cannot access system endpoints =="
try {
  Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/v1/system/analytics" -Headers $orgHeaders | Out-Null
  Write-Host "Unexpected: org-admin accessed system analytics"
} catch {
  Write-Host "Expected: org-admin blocked from system analytics"
}

Write-Host "== Check system-admin can access system endpoints =="
$sysAnalytics = $null
try {
  $sysAnalytics = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/v1/system/analytics" -Headers $sysHeaders
} catch {
  Write-Host "System endpoint check failed. If you get 404, restart backend with latest code:"
  Write-Host "  cd C:\Project_manager\Backmanager"
  Write-Host "  go run ."
  throw
}
$sysAnalytics | Format-List
