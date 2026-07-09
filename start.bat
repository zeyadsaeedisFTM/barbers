@echo off
title Barbershop Queue Starter
echo ====================================================
echo   Barbershop Queue App Starter
echo ====================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js to run this app.
    pause
    exit /b
)

:: Navigate to root directory if not there
cd /d "%~dp0"

echo 1/2: Preparing Backend Server...
cd server
if not exist node_modules (
    echo Installing backend dependencies...
    call npm install
)
echo Launching backend server in a separate window...
start "Barber Server Backend" cmd /k "npm run dev"

echo.
echo 2/2: Preparing Frontend Client...
cd ../client
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
)
echo Launching frontend client in a separate window...
start "Barber Client Frontend" cmd /k "npm run dev"

echo.
echo ====================================================
echo   Success! App is starting.
echo   - Backend Server: http://localhost:5000
echo   - Frontend Client: http://localhost:5173
echo   (Press any key to close this launcher)
echo ====================================================
pause
