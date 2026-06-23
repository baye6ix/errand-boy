# Set TLS 1.2/1.3 protocol for API compatibility
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Read .env file from the current script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $scriptDir ".env"

if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $key, $value = $line -split '=', 2
            if ($key -and $value) {
                [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
            }
        }
    }
}

$token = [System.Environment]::GetEnvironmentVariable("GITHUB_TOKEN")
$repo = [System.Environment]::GetEnvironmentVariable("GITHUB_REPO")

if (-not $token -or $token -eq "your_personal_access_token_here") {
    Write-Error "Please configure a valid GITHUB_TOKEN in the .env file."
    exit 1
}

if (-not $repo -or $repo -eq "your_username/errand-boy") {
    Write-Error "Please configure a valid GITHUB_REPO in the .env file."
    exit 1
}

$repoParts = $repo -split '/'
if ($repoParts.Length -ne 2) {
    Write-Error "GITHUB_REPO must be in 'owner/repo' format."
    exit 1
}
$owner = $repoParts[0].Trim()
$repoName = $repoParts[1].Trim()

$headers = @{
    "Authorization" = "Bearer $token"
    "Accept"        = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent"    = "PowerShell-GitHub-Uploader"
}

# Check if the repo exists
$repoUri = "https://api.github.com/repos/$owner/$repoName"
$repoExists = $false
try {
    $null = Invoke-RestMethod -Uri $repoUri -Headers $headers -Method Get
    Write-Host "Repository $owner/$repoName exists."
    $repoExists = $true
} catch {
    # Extract status code if available
    $statusCode = 0
    if ($_.Exception -and $_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    
    if ($statusCode -eq 404) {
        Write-Host "Repository $owner/$repoName does not exist. Attempting to create it..."
        $createUri = "https://api.github.com/user/repos"
        $createBody = @{
            name = $repoName
            private = $false
            description = "Errand Boy application and live tracking dashboard"
        } | ConvertTo-Json
        
        try {
            $null = Invoke-RestMethod -Uri $createUri -Headers $headers -Method Post -Body $createBody -ContentType "application/json"
            Write-Host "Created repository '$repoName' successfully."
            $repoExists = $true
            # Sleep a moment for GitHub to initialize the repo
            Start-Sleep -Seconds 2
        } catch {
            Write-Error "Failed to create repository: $_"
            exit 1
        }
    } else {
        Write-Error "Error checking repository '$owner/$repoName': $_"
        exit 1
    }
}

if (-not $repoExists) {
    Write-Error "Repository check/creation failed."
    exit 1
}

# Find all files recursively in the project directory, excluding .env, upload.ps1, and git artifacts
$files = Get-ChildItem -Path $scriptDir -Recurse -File | Where-Object {
    $_.FullName -notlike "*\.env*" -and
    $_.FullName -notlike "*\upload.ps1*" -and
    $_.FullName -notlike "*\.git*"
}

Write-Host "Found $($files.Count) files to upload."

foreach ($file in $files) {
    # Calculate path relative to the script directory
    $relativePath = $file.FullName.Substring($scriptDir.Length + 1)
    # Replace backslashes with forward slashes for Git paths
    $gitPath = $relativePath -replace "\\", "/"
    
    Write-Host "Processing $gitPath..."
    
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $base64Content = [Convert]::ToBase64String($bytes)
    
    # Check if the file already exists on GitHub to obtain its SHA (required for updating)
    $fileUri = "https://api.github.com/repos/$owner/$repoName/contents/$gitPath"
    $sha = $null
    try {
        $existingFile = Invoke-RestMethod -Uri $fileUri -Headers $headers -Method Get -ErrorAction SilentlyContinue
        if ($existingFile) {
            $sha = $existingFile.sha
            Write-Host "File exists on GitHub (SHA: $sha). It will be updated."
        }
    } catch {
        # File doesn't exist, which is fine (we will perform a new create/upload)
    }
    
    $body = @{
        message = "Upload $gitPath"
        content = $base64Content
    }
    if ($sha) {
        $body.sha = $sha
    }
    
    $jsonBody = ConvertTo-Json $body -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri $fileUri -Headers $headers -Method Put -Body $jsonBody -ContentType "application/json"
        Write-Host "Successfully uploaded/updated $gitPath"
    } catch {
        Write-Error "Failed to upload $gitPath: $_"
    }
}

Write-Host "Done uploading files!"
