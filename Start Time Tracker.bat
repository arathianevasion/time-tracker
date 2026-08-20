@echo off
rem Double-click entry point. All real logic lives in launcher.mjs, run by the Node binary
rem bundled in runtime\ - nothing on this machine needs to be installed first.
cd /d "%~dp0"
rem --use-system-ca: on a corporate network with a TLS-inspecting proxy, Windows trusts a
rem custom root CA that Node's own bundled cert store doesn't - without this, every HTTPS call
rem (update checks, Jira itself) would fail with an opaque certificate error.
runtime\node.exe --use-system-ca launcher.mjs
echo.
pause
