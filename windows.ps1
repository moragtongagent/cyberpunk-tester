param([ValidateSet('discover','window','drive','launch','close','open','worker-session')] [string]$Mode)
$ErrorActionPreference = 'Stop'
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
if ($Mode -eq 'worker-session') {
    if (![Environment]::UserInteractive -or (Get-Process -Id $PID).SessionId -eq 0) {
        throw 'Start the worker in a logged-in Windows desktop session.'
    }
    exit
}
if ($Mode -eq 'discover') {
    $keys = @('HKLM:/SOFTWARE/Microsoft/Windows/CurrentVersion/Uninstall/*',
              'HKLM:/SOFTWARE/WOW6432Node/Microsoft/Windows/CurrentVersion/Uninstall/*')
    $entry = Get-ItemProperty $keys -ErrorAction SilentlyContinue |
        Where-Object DisplayName -eq 'Cyberpunk 2077' | Select-Object -First 1
    $entry.InstallLocation | ConvertTo-Json -Compress
    exit
}
if ($Mode -eq 'open') { Invoke-Item -LiteralPath $request.file; exit }
function Get-Game {
    Get-Process -Name Cyberpunk2077 -ErrorAction SilentlyContinue | Select-Object -First 1
}
if ($Mode -eq 'launch') {
    if (Get-Game) { throw 'Game already running. Inspect its state before attempting a restart.' }
    $options = @{ FilePath = $request.exe; WorkingDirectory = (Split-Path $request.exe) }
    if ($request.slot) { $options.ArgumentList = @('-modded', "-save=$($request.slot)") }
    $launched = Start-Process @options -PassThru
    @{pid=$launched.Id; started=$launched.StartTime.ToUniversalTime().Ticks.ToString()} | ConvertTo-Json -Compress
    exit
}
$game = Get-Game
if (!$game -or $game.MainWindowHandle -eq [IntPtr]::Zero) { throw 'The game window is not ready in this Windows session.' }
if ($Mode -eq 'close') {
    if ($game.Id -ne $request.pid -or $game.StartTime.ToUniversalTime().Ticks.ToString() -ne $request.started) {
        throw 'Only the game session launched by this ticket can be restarted.'
    }
    for ($attempt=0; $attempt -lt 10; $attempt++) {
        if ($game.HasExited) { exit }
        $game.Refresh()
        if ($game.CloseMainWindow() -and $game.WaitForExit(2500)) { exit }
        Start-Sleep -Milliseconds 600
    }
    throw 'The game still has an open window after a normal close request.'
    exit
}
if ($Mode -eq 'window') {
    @{handle=$game.MainWindowHandle.ToInt64().ToString(); pid=$game.Id; started=$game.StartTime.ToUniversalTime().Ticks.ToString()} | ConvertTo-Json -Compress
    exit
}
Add-Type -Path (Join-Path $PSScriptRoot 'GameInput.cs')
$hwnd = $game.MainWindowHandle
if ($hwnd.ToInt64().ToString() -ne $request.handle -or $game.StartTime.ToUniversalTime().Ticks.ToString() -ne $request.started) {
    throw 'Game session changed before input.'
}
[GameInput]::Focus($hwnd)
foreach ($action in $request.actions) {
    [GameInput]::Check($hwnd)
    switch ($action.type) {
        'key' { [GameInput]::Hold($hwnd, [int]$action.scan, [bool]$action.extended, [int]$action.ms) }
        'look' { [GameInput]::Look([int]$action.x,[int]$action.y) }
        'select' { [GameInput]::Select() }
        'scroll' { [GameInput]::Scroll([int]$action.ticks) }
        'click' { [GameInput]::Click($hwnd,[double]$action.x,[double]$action.y) }
        'wait' { Start-Sleep -Milliseconds $action.ms }
        default { throw 'Unknown action.' }
    }
}
