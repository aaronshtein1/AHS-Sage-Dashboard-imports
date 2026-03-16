# Test API endpoints

Write-Host "Testing Backend API..." -ForegroundColor Cyan

# Test health endpoint
Write-Host "`n1. Testing health endpoint..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri 'http://localhost:3019/api' -Method GET
Write-Host "Health: $health" -ForegroundColor Green

# Test registration
Write-Host "`n2. Testing user registration..." -ForegroundColor Yellow
$registerBody = @{
    email = "test@example.com"
    password = "password123"
    name = "Test User"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/auth/register' -Method POST -Body $registerBody -ContentType 'application/json'
    Write-Host "Registration successful!" -ForegroundColor Green
    $registerResponse | ConvertTo-Json
} catch {
    Write-Host "Registration error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test login
Write-Host "`n3. Testing user login..." -ForegroundColor Yellow
$loginBody = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
    Write-Host "Login successful!" -ForegroundColor Green
    $token = $loginResponse.accessToken
    Write-Host "Access Token: $($token.Substring(0,20))..." -ForegroundColor Green

    # Test Plaid link token
    Write-Host "`n4. Testing Plaid link token creation..." -ForegroundColor Yellow
    $headers = @{
        'Authorization' = "Bearer $token"
        'Content-Type' = 'application/json'
    }

    $plaidResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/plaid/link-token' -Method POST -Headers $headers
    Write-Host "Plaid link token created!" -ForegroundColor Green
    Write-Host "Link Token: $($plaidResponse.linkToken.Substring(0,30))..." -ForegroundColor Green

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nAll tests completed!" -ForegroundColor Cyan
