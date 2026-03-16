$body = '{"email":"test@example.com","password":"password123"}'
try {
    $r = Invoke-RestMethod -Uri 'http://localhost:3019/api/auth/login' -Method POST -Body $body -ContentType 'application/json'
    Write-Host 'Login SUCCESSFUL' -ForegroundColor Green
    Write-Host 'User:' $r.user.email
    Write-Host 'Has' $r.user.orgs.Count 'organizations'
} catch {
    Write-Host 'Login FAILED' -ForegroundColor Red
    Write-Host 'Error:' $_.Exception.Message
}
