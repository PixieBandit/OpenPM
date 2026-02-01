# verify_gemini.ps1

# 1. Test Local Backend (Proxies to Google or Antigravity)
Write-Host "`n=== TEST 1: Local Backend (gemini-3-pro-preview) ===" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/generate" `
        -Method Post `
        -Headers @{ "Content-Type" = "application/json" } `
        -Body '{
            "model": "gemini-3-pro-preview",
            "contents": [{ "parts": [{ "text": "Explain quantum entanglement in one sentence." }] }]
        }'
    
    Write-Host "Success!" -ForegroundColor Green
    Write-Host "Response: $($response.candidates[0].content.parts[0].text)"
    Write-Host "Source: $($response.source)"
}
catch {
    Write-Host "Failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Server Error: $($reader.ReadToEnd())"
    }
}

# 2. Test Direct Google API (Bypasses Backend Logic)
Write-Host "`n=== TEST 2: Direct Google API (Sanity Check Key) ===" -ForegroundColor Cyan
# Try to find key in .env.local
$envContent = Get-Content ".env.local" -ErrorAction SilentlyContinue
$apiKey = $null
if ($envContent) {
    foreach ($line in $envContent) {
        if ($line -match "GOOGLE_API_KEY=(.+)") {
            $apiKey = $matches[1].Trim()
            break
        }
    }
}

if (-not $apiKey) {
    Write-Host "Could not find GOOGLE_API_KEY in .env.local" -ForegroundColor Yellow
}
else {
    Write-Host "Using Key: $($apiKey.Substring(0,10))..."
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=$apiKey"
    
    try {
        $response = Invoke-RestMethod -Uri $url `
            -Method Post `
            -Headers @{ "Content-Type" = "application/json" } `
            -Body '{
                "contents": [{ "parts": [{ "text": "Are you working?" }] }]
            }'
        
        Write-Host "Direct API Success!" -ForegroundColor Green
        Write-Host "Response: $($response.candidates[0].content.parts[0].text)"
    }
    catch {
        Write-Host "Direct API Failed!" -ForegroundColor Red
        Write-Host $_.Exception.Message
        # Print detailed 429/400 error body if possible
        if ($_.Exception.Response) {
            # Powershell 5.1 vs Core handling might vary, but printing output is helpful
            Write-Host "Status: $($_.Exception.Response.StatusCode)"
        }
    }
}

# 3. Test Gemini 2.0 Flash (Comparison)
Write-Host "`n=== TEST 3: Gemini 2.0 Flash (Availabilty Check) ===" -ForegroundColor Cyan
if ($apiKey) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$apiKey"
    try {
        $response = Invoke-RestMethod -Uri $url `
            -Method Post `
            -Headers @{ "Content-Type" = "application/json" } `
            -Body '{
                "contents": [{ "parts": [{ "text": "Hi" }] }]
            }'
        Write-Host "Gemini 2.0 Flash Success!" -ForegroundColor Green
    }
    catch {
        Write-Host "Gemini 2.0 Flash Failed!" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
}
