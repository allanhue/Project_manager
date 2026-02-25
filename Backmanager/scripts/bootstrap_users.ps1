param(
  [string]$BaseUrl = "http://127.0.0.1:8080",
  [string]$TenantSlug = "acme",
  [string]$TenantName = "Acme Inc",
  [string]$OrgAdminName = "Org Admin User",
  [string]$OrgAdminEmail = "org.admin@acme.com",
  [string]$OrgAdminPassword = "Passw0rd!",
  [string]$SystemAdminEmail = "centralhype9@gmail.com",
  [string]$SystemAdminPassword = "Passw0rd!"
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
Write-Host "Org admin role:" $orgClaims.role

Write-Host "== Login system-admin user (Allan) =="
$sysLoginBody = @{
  tenant_slug = $TenantSlug
  email       = $SystemAdminEmail
  password    = $SystemAdminPassword
} | ConvertTo-Json

$sysLogin = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" -ContentType "application/json" -Body $sysLoginBody
$sysToken = $sysLogin.token
$sysClaims = Decode-JwtPayload -Token $sysToken
Write-Host "System admin role:" $sysClaims.role

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
$sysAnalytics = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/v1/system/analytics" -Headers $sysHeaders
$sysAnalytics | Format-List
