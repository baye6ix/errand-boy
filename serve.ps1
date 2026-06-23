$port = 8080
$listener = New-Object System.Net.HttpListener

# Only use localhost prefix (does not require admin privileges)
$listener.Prefixes.Add("http://localhost:$port/")
Write-Output "Configured listener: http://localhost:$port/"

try {
    $listener.Start()
    Write-Output ""
    Write-Output "============================================="
    Write-Output "  ERRAND BOY Server Running!"
    Write-Output "  Local:   http://localhost:$port/"
    Write-Output "============================================="
    Write-Output ""
    Write-Output "Press Ctrl+C to stop the server."
} catch {
    Write-Error "Failed to start HTTP listener: $_"
    exit 1
}

# MIME Types mapping
$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
}

# Request loop
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }

        # Resolve local file path
        $cleanPath = $urlPath.Substring(1).Replace('/', '\')
        $filePath = Join-Path $PSScriptRoot $cleanPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "application/octet-stream"
            if ($mimeTypes.ContainsKey($ext)) {
                $contentType = $mimeTypes[$ext]
            }

            $response.ContentType = $contentType
            $response.StatusCode = 200

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)

            Write-Output "[$(Get-Date -Format 'HH:mm:ss')] 200 $urlPath"
        } else {
            $response.StatusCode = 404
            $response.ContentType = "text/plain; charset=utf-8"
            $msgBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $response.ContentLength64 = $msgBytes.Length
            $response.OutputStream.Write($msgBytes, 0, $msgBytes.Length)

            Write-Output "[$(Get-Date -Format 'HH:mm:ss')] 404 $urlPath"
        }
    } catch {
        Write-Warning "Error processing request: $_"
    } finally {
        if ($null -ne $response) {
            try { $response.Close() } catch {}
        }
    }
}
