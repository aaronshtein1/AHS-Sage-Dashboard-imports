# Complete Plaid Integration Test

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PLAID INTEGRATION TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Register new user
Write-Host "1. Registering new test user..." -ForegroundColor Yellow
$registerBody = @{
    email = "plaidtest@example.com"
    password = "test123"
    name = "Plaid Test User"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/auth/register' -Method POST -Body $registerBody -ContentType 'application/json'
    Write-Host "   Success - User registered successfully" -ForegroundColor Green
    $token = $registerResponse.accessToken
} catch {
    Write-Host "   User exists, logging in..." -ForegroundColor Yellow
    $loginBody = @{
        email = "plaidtest@example.com"
        password = "test123"
    } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
    $token = $loginResponse.accessToken
    Write-Host "   Success - Logged in successfully" -ForegroundColor Green
}

# Test 2: Create organization
Write-Host ""
Write-Host "2. Creating test organization..." -ForegroundColor Yellow
$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

$orgBody = @{
    name = "Plaid Test Healthcare"
} | ConvertTo-Json

try {
    $orgResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/orgs' -Method POST -Body $orgBody -Headers $headers -ContentType 'application/json'
    $orgId = $orgResponse.id
    Write-Host "   Success - Organization created" -ForegroundColor Green
} catch {
    $orgsResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/orgs' -Method GET -Headers $headers
    $orgId = $orgsResponse[0].id
    Write-Host "   Success - Using existing organization" -ForegroundColor Green
}

# Test 3: Select organization
Write-Host ""
Write-Host "3. Selecting organization..." -ForegroundColor Yellow
$selectResponse = Invoke-RestMethod -Uri "http://localhost:3019/api/orgs/$orgId/select" -Method PUT -Headers $headers
$token = $selectResponse.accessToken
Write-Host "   Success - Organization selected" -ForegroundColor Green
Write-Host "   Success - New token received with org context" -ForegroundColor Green

# Update headers with new token
$headers['Authorization'] = "Bearer $token"

# Test 4: Create Plaid Link Token
Write-Host ""
Write-Host "4. Creating Plaid Link Token..." -ForegroundColor Yellow
try {
    $plaidResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/plaid/link-token' -Method POST -Headers $headers
    Write-Host "   Success - Plaid Link Token created!" -ForegroundColor Green

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The Plaid Link integration is working correctly." -ForegroundColor White
    Write-Host ""
    Write-Host "Test in the browser:" -ForegroundColor White
    Write-Host "1. Go to http://localhost:3020" -ForegroundColor Cyan
    Write-Host "2. Login with: plaidtest@example.com / test123" -ForegroundColor Cyan
    Write-Host "3. Navigate to Bank Feeds" -ForegroundColor Cyan
    Write-Host "4. Click Connect Bank Account" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Plaid Sandbox Test Credentials:" -ForegroundColor White
    Write-Host "Username: user_good" -ForegroundColor Cyan
    Write-Host "Password: pass_good" -ForegroundColor Cyan
    Write-Host ""

} catch {
    Write-Host "   FAILED - Could not create Plaid Link Token" -ForegroundColor Red
    Write-Host "   Error:" $_.Exception.Message -ForegroundColor Red
}
