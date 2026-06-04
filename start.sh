#!/usr/bin/env bash
set -e
echo "=== Backend ==="
( cd backend/InformesTecnicos.Api && dotnet run ) &
BACK_PID=$!
echo "=== Frontend ==="
cd frontend
[ ! -d node_modules ] && npm install
npm run dev &
FRONT_PID=$!
cd ..
echo ""
echo "Backend:  http://localhost:5000/swagger"
echo "Frontend: http://localhost:5173"
trap "kill $BACK_PID $FRONT_PID" EXIT
wait
