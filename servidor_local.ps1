$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8787
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$listener.Start()
Write-Host "A Lenda de Camutanga - servidor local" -ForegroundColor Green
Write-Host "Jogo: http://127.0.0.1:$port/index.html" -ForegroundColor Cyan
Write-Host "Feche esta janela para encerrar." -ForegroundColor Yellow
Start-Process "http://127.0.0.1:$port/index.html"

function Get-MimeType([string]$path) {
    switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
        '.html' { 'text/html; charset=utf-8' }
        '.js' { 'application/javascript; charset=utf-8' }
        '.json' { 'application/json; charset=utf-8' }
        '.css' { 'text/css; charset=utf-8' }
        '.png' { 'image/png' }
        '.jpg' { 'image/jpeg' }
        '.jpeg' { 'image/jpeg' }
        '.webp' { 'image/webp' }
        '.ogg' { 'audio/ogg' }
        '.m4a' { 'audio/mp4' }
        '.mp3' { 'audio/mpeg' }
        '.wav' { 'audio/wav' }
        '.ttf' { 'font/ttf' }
        '.woff' { 'font/woff' }
        '.woff2' { 'font/woff2' }
        '.webmanifest' { 'application/manifest+json; charset=utf-8' }
        default { 'application/octet-stream' }
    }
}

while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
        do { $line = $reader.ReadLine() } while ($line -ne $null -and $line -ne '')

        $parts = $requestLine.Split(' ')
        if ($parts.Length -lt 2) { continue }
        $urlPath = [Uri]::UnescapeDataString(($parts[1] -split '\?')[0])
        if ($urlPath -eq '/') { $urlPath = '/index.html' }
        $relative = $urlPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
        $candidate = [IO.Path]::GetFullPath((Join-Path $root $relative))
        $rootFull = [IO.Path]::GetFullPath($root + [IO.Path]::DirectorySeparatorChar)

        if (-not $candidate.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            $body = [Text.Encoding]::UTF8.GetBytes('404 - Arquivo nao encontrado')
            $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
            $hb = [Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($hb,0,$hb.Length); $stream.Write($body,0,$body.Length)
            continue
        }

        $bytes = [IO.File]::ReadAllBytes($candidate)
        $mime = Get-MimeType $candidate
        $cache = if ($candidate.EndsWith('.js') -or $candidate.EndsWith('.json') -or $candidate.EndsWith('.html')) { 'no-cache' } else { 'public, max-age=3600' }
        $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nCache-Control: $cache`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
        $hb = [Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($hb,0,$hb.Length); $stream.Write($bytes,0,$bytes.Length)
    } catch {
        Write-Host "Erro ao servir arquivo: $($_.Exception.Message)" -ForegroundColor DarkYellow
    } finally {
        if ($stream) { $stream.Dispose() }
        $client.Close()
    }
}
