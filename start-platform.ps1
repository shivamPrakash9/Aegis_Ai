# AegisAI - Full Platform Launcher (PowerShell)
# Verifies Docker databases, seeds test accounts, and starts all 6 microservices + frontend.

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AegisAI Enterprise AI Security & Governance Platform   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Docker Databases
Write-Host "[1/3] Checking Docker database containers..." -ForegroundColor Yellow
$requiredContainers = @("aegisai-postgres", "aegisai-redis", "aegisai-mongo")
$runningContainers = docker ps --format "{{.Names}}"

foreach ($container in $requiredContainers) {
    if ($runningContainers -contains $container) {
        Write-Host "  ✓ $container is running." -ForegroundColor Green
    } else {
        Write-Host "  ⚠ $container is NOT running. Attempting to start..." -ForegroundColor Yellow
        docker start $container
    }
}

# 2. Build Identity Service & Seed Test Accounts
Write-Host "`n[2/3] Checking Identity service build and dev seed accounts..." -ForegroundColor Yellow
Write-Host "  Compiling Identity TypeScript..." -ForegroundColor Cyan
npm --prefix Identity run build
Write-Host "  Seeding development test accounts (idempotent upsert)..." -ForegroundColor Cyan
npm run seed:dev

# 3. Start All Services & Frontend
Write-Host "`n[3/3] Launching all 6 Microservices and Frontend Console..." -ForegroundColor Yellow
Write-Host "  Identity Service:     http://localhost:3000" -ForegroundColor Cyan
Write-Host "  AI Gateway:           http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Privacy Scanner:      http://localhost:3002" -ForegroundColor Cyan
Write-Host "  Policy Approval:      http://localhost:3003" -ForegroundColor Cyan
Write-Host "  Model Provider:       http://localhost:3004" -ForegroundColor Cyan
Write-Host "  Security Audit:       http://localhost:3005" -ForegroundColor Cyan
Write-Host "  Frontend Dashboard:   http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Test Accounts Available:" -ForegroundColor White
Write-Host "  Admin:     admin@enterprise.internal     / AdminSecurePassword!2026" -ForegroundColor Gray
Write-Host "  Developer: developer@enterprise.internal / DevSecurePassword!2026" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to terminate all services." -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

npm run start
