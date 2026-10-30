# Widget de Pendientes sin marco: una ventana propia con el motor de Edge (WebView2) que ya trae Windows 11.
# Muestra la pagina de la app en modo #widget. No guarda nada fuera de la carpeta %LOCALAPPDATA%\Pendientes.
param(
  [string]$Url = 'https://juanps4009.github.io/Aplicaci-n-Productividad-/',
  [string]$Dir = (Join-Path $env:LOCALAPPDATA 'Pendientes'),
  [switch]$SoloPreparar
)
$ErrorActionPreference = 'Stop'
$script:Lib = Join-Path $Dir 'webview2'
# Componente oficial de Microsoft (paquete NuGet Microsoft.Web.WebView2). Se comprueba su huella antes de usarlo.
$Version = '1.0.4191.47'
$Sha256 = 'F492BBF547D0DA329553B6727435B677579B1E9F91CC9E4A1AD029366D5F23D0'

function Preparar-Componente {
  $nombres = 'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll'
  if (-not ($nombres | Where-Object { -not (Test-Path (Join-Path $script:Lib $_)) })) { return }
  Write-Host ' Descargando el componente de Microsoft (WebView2, unos 9 MB)...'
  $ProgressPreference = 'SilentlyContinue'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('wv2-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    $zip = Join-Path $tmp 'wv2.zip'
    Invoke-WebRequest -UseBasicParsing -OutFile $zip -Uri "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$Version/microsoft.web.webview2.$Version.nupkg"
    if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $Sha256) { throw 'La descarga no coincide con la huella esperada; no se usara.' }
    Expand-Archive -Path $zip -DestinationPath (Join-Path $tmp 'x')
    New-Item -ItemType Directory -Force -Path $script:Lib | Out-Null
    $arq = if ([Environment]::Is64BitProcess) { 'win-x64' } else { 'win-x86' }
    Copy-Item -Force -Destination $script:Lib -Path @(
      (Join-Path $tmp 'x\lib\net462\Microsoft.Web.WebView2.Core.dll'),
      (Join-Path $tmp 'x\lib\net462\Microsoft.Web.WebView2.WinForms.dll'),
      (Join-Path $tmp "x\runtimes\$arq\native\WebView2Loader.dll"))
  } finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
try {
  Preparar-Componente
  if ($SoloPreparar) { return }

  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PW32 {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h, int a, ref int v, int s);
}
'@
  [void][PW32]::SetProcessDPIAware()   # nitidez en pantallas con zoom (125 %, 150 %...)
  [Windows.Forms.Application]::EnableVisualStyles()
  $env:PATH = "$script:Lib;$env:PATH"
  Add-Type -Path (Join-Path $script:Lib 'Microsoft.Web.WebView2.Core.dll')
  Add-Type -Path (Join-Path $script:Lib 'Microsoft.Web.WebView2.WinForms.dll')

  $nuevo = $false
  $script:Mutex = New-Object Threading.Mutex($true, 'Local\PendientesWidgetSinMarco', [ref]$nuevo)
  if (-not $nuevo) { return }   # ya hay un widget abierto

  $script:Url = $Url
  $script:Dir = $Dir
  $script:Origen = ([Uri]$Url).GetLeftPart([UriPartial]::Authority)
  $g = [Drawing.Graphics]::FromHwnd([IntPtr]::Zero); $script:Esc = $g.DpiX / 96; $g.Dispose()
  $script:Fondo = [Drawing.Color]::FromArgb(15, 23, 42)
  $script:Icono = [Drawing.SystemIcons]::Application
  try { $script:Icono = New-Object Drawing.Icon((Join-Path $Dir 'icon.ico')) } catch { }

  function Nuevo-Visor {
    $p = New-Object Microsoft.Web.WebView2.WinForms.CoreWebView2CreationProperties
    $p.UserDataFolder = Join-Path $script:Dir 'webview'   # mismo perfil en el widget y en la ventana de la app: comparten datos
    $v = New-Object Microsoft.Web.WebView2.WinForms.WebView2
    $v.CreationProperties = $p
    $v.Dock = 'Fill'
    $v.DefaultBackgroundColor = $script:Fondo
    $v.add_CoreWebView2InitializationCompleted({
      param($s, $e)
      if (-not $e.IsSuccess) {
        [void][Windows.Forms.MessageBox]::Show("No pude iniciar el motor de la ventana.`n$($e.InitializationException.Message)", 'Pendientes')
        return
      }
      $c = $s.CoreWebView2
      $c.Settings.AreDevToolsEnabled = $false
      $c.Settings.IsStatusBarEnabled = $false
      $c.Settings.IsZoomControlEnabled = $false
      $c.add_NewWindowRequested({ param($s2, $e2) $e2.Handled = $true; Abrir-App $e2.Uri })
      $c.add_NavigationStarting({
        param($s2, $e2)
        # solo se navega dentro de la app; los enlaces http(s) de otros sitios se abren en el navegador normal y nada mas se permite
        if ($e2.Uri.StartsWith($script:Url, [StringComparison]::OrdinalIgnoreCase)) { return }
        $e2.Cancel = $true
        if ($e2.Uri -match '^https?://') { Start-Process $e2.Uri }
      })
      $c.add_WebMessageReceived({
        param($s2, $e2)
        # el encabezado del widget arrastra la ventana: la pagina avisa "drag:start" y "drag:move" mientras se mantiene el boton;
        # el desplazamiento se mide con el cursor real (pixeles fisicos), asi funciona con cualquier zoom de pantalla
        if (-not $e2.Source.StartsWith($script:Origen, [StringComparison]::OrdinalIgnoreCase)) { return }
        $tipo = $e2.TryGetWebMessageAsString()
        if ($tipo -like 'drag:start*') {
          $c0 = [Windows.Forms.Control]::MousePosition
          $script:Arr = @($c0.X, $c0.Y, $script:Form.Left, $script:Form.Top)
        } elseif ($tipo -like 'drag:move*' -and $script:Arr) {
          $c1 = [Windows.Forms.Control]::MousePosition
          $script:Form.Location = New-Object Drawing.Point(($script:Arr[2] + $c1.X - $script:Arr[0]), ($script:Arr[3] + $c1.Y - $script:Arr[1]))
        }
      })
    })
    return $v
  }

  function Traer-Al-Frente($f) {   # Windows a veces deja la ventana nueva detras de las demas; asi sube al frente
    $arriba = $f.TopMost
    $f.TopMost = $true
    $f.TopMost = $arriba
    $f.Activate()
  }

  # Ventana normal (con marco) con la app completa; se abre al tocar una tarea o el boton de abrir
  function Abrir-App([string]$uri) {
    if (-not $uri) { $uri = $script:Url }
    if ($script:FormApp -and -not $script:FormApp.IsDisposed) {
      $script:VisorApp.Source = [Uri]$uri
      $script:FormApp.WindowState = 'Normal'
      Traer-Al-Frente $script:FormApp
      return
    }
    $wa = [Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $f = New-Object Windows.Forms.Form
    $f.Text = 'Pendientes'
    $f.Icon = $script:Icono
    $f.StartPosition = 'CenterScreen'
    $f.Size = New-Object Drawing.Size([int][Math]::Min(480 * $script:Esc, $wa.Width - 40), [int][Math]::Min(780 * $script:Esc, $wa.Height - 40))
    $v = Nuevo-Visor
    $f.Controls.Add($v)
    $f.add_FormClosed({ $script:VisorApp.Dispose(); $script:FormApp = $null })
    $script:FormApp = $f
    $script:VisorApp = $v
    $v.Source = [Uri]$uri
    $f.Show()
    Traer-Al-Frente $f
  }

  # ---- ventana del widget, sin marco ----
  $f = New-Object Windows.Forms.Form
  $script:Form = $f
  $f.Text = 'Pendientes (widget)'
  $f.Icon = $script:Icono
  $f.FormBorderStyle = 'None'
  $f.ShowInTaskbar = $false
  $f.BackColor = $script:Fondo
  $f.StartPosition = 'Manual'
  $f.Size = New-Object Drawing.Size([int](340 * $script:Esc), [int](480 * $script:Esc))
  $f.TopMost = Test-Path (Join-Path $Dir 'encima.txt')

  $wa = [Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $pos = New-Object Drawing.Point(($wa.Right - $f.Width - [int](20 * $script:Esc)), ($wa.Top + [int](40 * $script:Esc)))
  $archivoPos = Join-Path $Dir 'posicion.txt'
  try {   # recordar donde la dejaste, si esa posicion sigue dentro de alguna pantalla
    $t = (Get-Content -Path $archivoPos -ErrorAction Stop | Select-Object -First 1).Split(',')
    $p = New-Object Drawing.Point([int]$t[0], [int]$t[1])
    $vista = New-Object Drawing.Point(($p.X + [int](100 * $script:Esc)), ($p.Y + [int](20 * $script:Esc)))   # que se vea el encabezado, para poder arrastrarla
    if ([Windows.Forms.Screen]::AllScreens | Where-Object { $_.WorkingArea.Contains($vista) }) { $pos = $p }
  } catch { }
  $f.Location = $pos

  $f.add_HandleCreated({   # esquinas redondeadas en Windows 11 (si no se puede, no pasa nada)
    try { $r = 2; [void][PW32]::DwmSetWindowAttribute($script:Form.Handle, 33, [ref]$r, 4) } catch { }
  })
  $f.add_LocationChanged({ $script:PosSucia = $true })
  $timer = New-Object Windows.Forms.Timer
  $timer.Interval = 2000
  $timer.add_Tick({
    if ($script:PosSucia) {
      $script:PosSucia = $false
      try { "$($script:Form.Left),$($script:Form.Top)" | Set-Content -Path (Join-Path $script:Dir 'posicion.txt') } catch { }
    }
  })
  $timer.Start()

  $script:Visor = Nuevo-Visor
  $f.Controls.Add($script:Visor)
  $script:Visor.Source = [Uri]($Url.TrimEnd('#') + '#widget')

  # ---- icono junto al reloj: es la forma de mostrar, recargar o cerrar el widget ----
  $tray = New-Object Windows.Forms.NotifyIcon
  $tray.Icon = $script:Icono
  $tray.Text = 'Pendientes'
  $menu = New-Object Windows.Forms.ContextMenuStrip
  $miMostrar = $menu.Items.Add('Mostrar el widget')
  $miApp = $menu.Items.Add('Abrir la app completa')
  $miEncima = New-Object Windows.Forms.ToolStripMenuItem('Siempre encima de otras ventanas')
  $miEncima.CheckOnClick = $true
  $miEncima.Checked = $f.TopMost
  [void]$menu.Items.Add($miEncima)
  $miRecargar = $menu.Items.Add('Recargar')
  [void]$menu.Items.Add((New-Object Windows.Forms.ToolStripSeparator))
  $miCerrar = $menu.Items.Add('Cerrar el widget')
  $miMostrar.add_Click({ $script:Form.Show(); Traer-Al-Frente $script:Form })
  $miApp.add_Click({ Abrir-App $script:Url })
  $miEncima.add_Click({
    $script:Form.TopMost = $miEncima.Checked
    $marca = Join-Path $script:Dir 'encima.txt'
    if ($miEncima.Checked) { Set-Content -Path $marca -Value '1' } else { Remove-Item $marca -ErrorAction SilentlyContinue }
  })
  $miRecargar.add_Click({ $script:Visor.Reload() })
  $miCerrar.add_Click({ $script:Form.Close() })
  $tray.ContextMenuStrip = $menu
  $tray.add_MouseClick({ param($s, $e) if ($e.Button -eq 'Left') { $script:Form.Show(); Traer-Al-Frente $script:Form } })
  $tray.add_DoubleClick({ Abrir-App $script:Url })
  $tray.Visible = $true

  $f.add_FormClosed({
    $timer.Stop(); $timer.Dispose()
    if ($script:PosSucia) { try { "$($script:Form.Left),$($script:Form.Top)" | Set-Content -Path (Join-Path $script:Dir 'posicion.txt') } catch { } }
    $tray.Visible = $false
    $tray.Dispose()
    $script:Visor.Dispose()
    if ($script:FormApp -and -not $script:FormApp.IsDisposed) { $script:FormApp.Close() }
    try { $script:Mutex.ReleaseMutex() } catch { }
    $script:Mutex.Dispose()
    [Windows.Forms.Application]::ExitThread()
  }.GetNewClosure())
  [Windows.Forms.Application]::Run($f)
} catch {
  [void][Windows.Forms.MessageBox]::Show("No pude abrir el widget.`n`n$($_.Exception.Message)", 'Pendientes')
}
