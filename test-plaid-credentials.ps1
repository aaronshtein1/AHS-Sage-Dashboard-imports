# Test Plaid sandbox credentials are valid

Write-Host "Testing Plaid Sandbox Credentials..." -ForegroundColor Cyan
Write-Host ""

# Login
$loginBody = '{"email":"admin@example.com","password":"password"}'
$r1 = Invoke-RestMethod -Uri 'http://localhost:3019/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
$token = $r1.accessToken

# Get orgs
$headers = @{'Authorization'="Bearer $token"}
$r2 = Invoke-RestMethod -Uri 'http://localhost:3019/api/orgs' -Method GET -Headers $headers
$orgId = $r2[0].id

# Select org
$r3 = Invoke-RestMethod -Uri "http://localhost:3019/api/orgs/$orgId/select" -Method PUT -Headers $headers
$token = $r3.accessToken
$headers['Authorization'] = "Bearer $token"

# Create Link Token
Write-Host "Creating Plaid Link Token..." -ForegroundColor Yellow
try {
    $plaid = Invoke-RestMethod -Uri 'http://localhost:3019/api/plaid/link-token' -Method POST -Headers $headers
    Write-Host "SUCCESS - Link Token Created!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Plaid Environment: SANDBOX" -ForegroundColor Cyan
    Write-Host "Link Token: $($plaid.linkToken.Substring(0,40))..." -ForegroundColor Gray
    Write-Host ""
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host "PLAID SANDBOX TEST CREDENTIALS" -ForegroundColor Cyan
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "In the Plaid Link modal, search for one of these banks:" -ForegroundColor White
    Write-Host "  - First Platypus Bank" -ForegroundColor Green
    Write-Host "  - Tartan Bank" -ForegroundColor Green
    Write-Host "  - Houndstooth Bank" -ForegroundColor Green
    Write-Host ""
    Write-Host "Then login with:" -ForegroundColor White
    Write-Host "  Username: user_good" -ForegroundColor Yellow
    Write-Host "  Password: pass_good" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "IMPORTANT: Type exactly as shown (all lowercase)" -ForegroundColor Red
    Write-Host ""
    Write-Host "If you get 'incorrect credentials', make sure:" -ForegroundColor White
    Write-Host "  1. You selected 'First Platypus Bank' from the list" -ForegroundColor Gray
    Write-Host "  2. Username is exactly: user_good (with underscore)" -ForegroundColor Gray
    Write-Host "  3. Password is exactly: pass_good (with underscore)" -ForegroundColor Gray
    Write-Host "  4. No extra spaces before or after" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "ERROR - Could not create link token" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
