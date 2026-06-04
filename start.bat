@echo off
REM Inicio rápido en Windows
echo === Backend ===
cd backend\InformesTecnicos.Api
start "Backend" cmd /k "dotnet run"
cd ..\..
echo === Frontend ===
cd frontend
if not exist node_modules ( npm install )
start "Frontend" cmd /k "npm run dev"
cd ..
echo.
echo Backend:  http://localhost:5000/swagger
echo Frontend: http://localhost:5173
