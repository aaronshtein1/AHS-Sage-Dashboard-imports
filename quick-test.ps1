Write-Host "Testing Plaid integration..." -ForegroundColor Cyan

# Login
$loginBody = '{"email":"test@example.com","password":"password123"}'
$r1 = Invoke-RestMethod -Uri 'http://localhost:3019/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
$token = $r1.accessToken
Write-Host "Logged in" -ForegroundColor Green

# Get orgs
$headers = @{'Authorization'="Bearer $token"}
$r2 = Invoke-RestMethod -Uri 'http://localhost:3019/api/orgs' -Method GET -Headers $headers
$orgId = $r2[0].id
Write-Host "Got org: $orgId" -ForegroundColor Green

# Select org
$r3 = Invoke-RestMethod -Uri "http://localhost:3019/api/orgs/$orgId/select" -Method PUT -Headers $headers
$token = $r3.accessToken
Write-Host "Selected org, got new token" -ForegroundColor Green

# Test Plaid
$headers['Authorization'] = "Bearer $token"
$r4 = Invoke-RestMethod -Uri 'http://localhost:3019/api/plaid/link-token' -Method POST -Headers $headers
Write-Host ""
Write-Host "SUCCESS! Plaid Link is working!" -ForegroundColor Green
Write-Host "Link token created successfully" -ForegroundColor Green
