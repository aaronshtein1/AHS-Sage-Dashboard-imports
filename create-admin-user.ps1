# Create the admin user shown in the demo credentials

Write-Host "Creating admin user..." -ForegroundColor Cyan

$registerBody = @{
    email = "admin@example.com"
    password = "password"
    name = "Admin User"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/auth/register' -Method POST -Body $registerBody -ContentType 'application/json'
    Write-Host "Success - Admin user created!" -ForegroundColor Green
    $token = $registerResponse.accessToken

    # Create an organization for the admin user
    Write-Host "Creating organization..." -ForegroundColor Cyan
    $headers = @{
        'Authorization' = "Bearer $token"
        'Content-Type' = 'application/json'
    }

    $orgBody = @{
        name = "Demo Organization"
    } | ConvertTo-Json

    $orgResponse = Invoke-RestMethod -Uri 'http://localhost:3019/api/orgs' -Method POST -Body $orgBody -Headers $headers -ContentType 'application/json'
    Write-Host "Success - Organization created!" -ForegroundColor Green

    Write-Host ""
    Write-Host "You can now login with:" -ForegroundColor Green
    Write-Host "  Email: admin@example.com" -ForegroundColor Cyan
    Write-Host "  Password: password" -ForegroundColor Cyan

} catch {
    if ($_.Exception.Message -like "*409*" -or $_.Exception.Message -like "*already exists*") {
        Write-Host "Admin user already exists - you can login" -ForegroundColor Yellow
        Write-Host "  Email: admin@example.com" -ForegroundColor Cyan
        Write-Host "  Password: password" -ForegroundColor Cyan
    } else {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
