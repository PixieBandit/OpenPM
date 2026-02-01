$apiKey = "AIzaSyDAINWlPcxA96mQcMvUjjlfTiCV82bJCsw"

function Test-Model ($modelName) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/$($modelName):generateContent?key=$apiKey"
    Write-Host "`nTesting Model: $modelName" -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Headers @{"Content-Type" = "application/json" } -Body '{ "contents": [{"parts":[{"text": "Hello"}]}]}'
        Write-Host "SUCCESS!" -ForegroundColor Green
        Write-Host "Response: $($response.candidates[0].content.parts[0].text)"
    }
    catch {
        Write-Host "FAILED!" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)"
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream.CanRead) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $body = $reader.ReadToEnd()
                    Write-Host "Details: $body"
                }
            }
            catch {}
        }
    }
}

# Test 1: User suggested "3.0"
Test-Model "gemini-3.0-pro-preview"

# Test 2: Known "3" (no point zero)
Test-Model "gemini-3-pro-preview"
