# Test API endpoints including org creation

Write-Host "Testing Backend API..." -ForegroundColor Cyan

# Test registration & login
Write-Host "`n1. Testing user login..." -ForegroundColor Yellow
$loginBody = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
$token = $loginResponse.accessToken
Write-Host "Login successful! Token: $($token.Substring(0,20))..." -ForegroundColor Green

# Create organization
Write-Host "`n2. Creating organization..." -ForegroundColor Yellow
$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

$orgBody = @{
    name = "Test Healthcare Org"
} | ConvertTo-Json

try {
    $orgResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/orgs' -Method POST -Body $orgBody -Headers $headers -ContentType 'application/json'
    Write-Host "Organization created!" -ForegroundColor Green
    $orgId = $orgResponse.id
    Write-Host "Org ID: $orgId" -ForegroundColor Green

    # Select organization
    Write-Host "`n3. Selecting organization..." -ForegroundColor Yellow
    $selectResponse = Invoke-RestMethod -Uri "http://localhost:3019/api/orgs/$orgId/select" -Method PUT -Headers $headers
    Write-Host "Organization selected!" -ForegroundColor Green

    # Test Plaid link token
    Write-Host "`n4. Testing Plaid link token creation..." -ForegroundColor Yellow
    $plaidResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/plaid/link-token' -Method POST -Headers $headers
    Write-Host "Plaid link token created!" -ForegroundColor Green
    Write-Host "Link Token: $($plaidResponse.linkToken.Substring(0,40))..." -ForegroundColor Green
    Write-Host "Expiration: $($plaidResponse.expiration)" -ForegroundColor Green

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host "`nAll tests completed!" -ForegroundColor Cyan
