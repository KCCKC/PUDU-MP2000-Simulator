# Lightweight zero-dependency HTTP server for Windows
$port = 8080
$dir = $PSScriptRoot
if (-not $dir) { $dir = Get-Location }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    $port = 8081
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
}

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".glb"  = "model/gltf-binary"
    ".wasm" = "application/wasm"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".webp" = "image/webp"
    ".svg"  = "image/svg+xml"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        $path = $req.Url.LocalPath
        if ($path -eq "/" -or $path -eq "") { $path = "/index.html" }
        $filePath = Join-Path $dir ($path.TrimStart("/").Replace("/", "\"))

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
            $res.AddHeader("Access-Control-Allow-Origin", "*")
            $res.AddHeader("Cache-Control", "no-cache")
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
        }
        $res.Close()
    } catch {
        # continue loop
    }
}
