@echo off
chcp 65001 >nul
setlocal
title Activar llamadas de Claude en este computador

rem Deja que Claude Code en este computador pueda llamarte al celular o dejarte mensajes en Pendientes.
rem Que hace: 1) baja la app a %USERPROFILE%\.pendientes\app  2) guarda tu codigo SOLO en este PC
rem 3) instala la habilidad "llamar-al-dueno" para Claude Code  4) prueba la conexion con tu celular.
rem Puedes abrir este archivo con el Bloc de notas y leerlo antes. Para actualizar, vuelve a abrirlo.

set "BASE=%USERPROFILE%\.pendientes"
set "APP=%BASE%\app"
set "CODEFILE=%BASE%\codigo.txt"
set "ZIP=%TEMP%\pendientes-app.zip"
set "ZIPURL=https://github.com/juanps4009/Aplicaci-n-Productividad-/archive/refs/heads/claude/hopeful-brahmagupta-m6bura.zip"
set "LLAMAR=%APP%\herramientas\llamar.mjs"
set "SKILLDIR=%USERPROFILE%\.claude\skills\llamar-al-dueno"

echo.
echo  === Activar llamadas de Claude en este computador ===
echo.

rem 1) Node.js
where node >nul 2>nul
if errorlevel 1 goto :sin_node

rem 2) Bajar o actualizar la app
echo  [1/4] Bajando la ultima version de la app...
if not exist "%BASE%" mkdir "%BASE%"
curl.exe -L -s -f -o "%ZIP%" "%ZIPURL%"
if errorlevel 1 goto :sin_descarga
if exist "%BASE%\tmp" rmdir /s /q "%BASE%\tmp"
mkdir "%BASE%\tmp"
tar -xf "%ZIP%" -C "%BASE%\tmp"
if errorlevel 1 goto :sin_descarga
if exist "%APP%" rmdir /s /q "%APP%"
for /d %%D in ("%BASE%\tmp\*") do move "%%D" "%APP%" >nul
rmdir /s /q "%BASE%\tmp"
del "%ZIP%" >nul 2>nul
if not exist "%LLAMAR%" goto :sin_descarga
echo        Listo.

rem 3) Codigo de sincronizacion (solo queda en este PC)
echo  [2/4] Codigo de sincronizacion...
if exist "%CODEFILE%" (
  echo        Ya estaba guardado en este PC. Para cambiarlo borra %CODEFILE% y vuelve a abrir este archivo.
  goto :skill
)
echo        En la app: Ajustes - Sincronizar mis dispositivos - Copiar.
echo        Pegalo aqui con clic derecho y pulsa Enter. No se vera en pantalla y no sale de este PC.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=Read-Host '        Codigo' -AsSecureString; $p=[Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); [IO.File]::WriteAllText($env:CODEFILE, $p.Trim())"
if errorlevel 1 goto :error

:skill
rem 4) Habilidad para Claude Code (con la ruta real de la herramienta)
echo  [3/4] Ensenandole a Claude Code a llamarte...
if not exist "%SKILLDIR%" mkdir "%SKILLDIR%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:APP+'\herramientas\claude-local\SKILL.md'); $t=$t.Replace('{{LLAMAR}}', $env:LLAMAR); [IO.File]::WriteAllText($env:SKILLDIR+'\SKILL.md', $t, (New-Object Text.UTF8Encoding $false))"
if errorlevel 1 goto :error
echo        Listo.

rem 5) Prueba
echo  [4/4] Probando la conexion con tu celular...
echo.
node "%LLAMAR%" estado
echo.
echo  Terminado. Cierra y vuelve a abrir Claude Code. Para probar, dile: "llamame para probar".
echo  Si arriba dice que falta el codigo o que no es valido, borra %CODEFILE% y vuelve a abrir este archivo.
goto :fin

:sin_node
echo  Falta Node.js, el programa que usa la herramienta de llamadas. Es gratis.
echo  Se abrira su pagina: descarga la version LTS, instalala con las opciones normales
echo  y vuelve a abrir este archivo.
start "" "https://nodejs.org/es/download"
goto :fin

:sin_descarga
echo  No pude bajar la app. Revisa tu internet y vuelve a abrir este archivo.
goto :fin

:error
echo  Algo fallo. Toma una captura de esta ventana y mandasela a Claude.

:fin
echo.
pause
