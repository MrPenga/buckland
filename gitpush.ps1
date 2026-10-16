# Buckland Angling Club - Pubblicazione aggiornamenti GitHub
# Metti questo file nella cartella principale del repository clonato (quella con .git).
# Utilizzo: .\push-buckland.ps1
# Oppure: .\push-buckland.ps1 -Messaggio "Aggiornamento listini"

param(
    [string]$Messaggio = "Aggiornamento Buckland Angling Club"
)

$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERRORE: Git non e' installato o non e' nel PATH." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $repo '.git'))) {
    Write-Host "ERRORE: Questa cartella non contiene .git." -ForegroundColor Red
    Write-Host "Metti push-buckland.ps1 nella cartella del repository gia' clonato, senza cancellare .git."
    exit 1
}

Push-Location $repo
try {
    $branch = (git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') {
        Write-Host "ERRORE: Devi essere sul branch 'main'. Branch attuale: $branch" -ForegroundColor Red
        exit 1
    }

    $origin = git remote get-url origin 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $origin) {
        Write-Host "ERRORE: Nessun remote 'origin' configurato." -ForegroundColor Red
        exit 1
    }
    if ($origin.Trim() -notmatch 'github\.com[:/]Stenghela/buckland(?:\.git)?/?$') {
        Write-Host "ERRORE: 'origin' non e' il repository atteso: $origin" -ForegroundColor Red
        exit 1
    }

    Write-Host "Repository: $repo" -ForegroundColor Cyan
    Write-Host "Remote: $origin" -ForegroundColor Cyan

    git add -A
    if ($LASTEXITCODE -ne 0) { throw 'git add non riuscito.' }

    git diff --cached --quiet
    $diffExit = $LASTEXITCODE
    if ($diffExit -eq 0) {
        Write-Host "Nessuna modifica da pubblicare: i file sono gia' aggiornati localmente." -ForegroundColor Yellow
        exit 0
    }
    if ($diffExit -ne 1) { throw 'Errore nella verifica delle modifiche.' }

    git commit -m $Messaggio
    if ($LASTEXITCODE -ne 0) { throw 'Impossibile creare il commit.' }

    Write-Host "Sincronizzazione con GitHub..." -ForegroundColor Cyan
    git pull --rebase origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "STOP: aggiornamenti remoti in conflitto. Non ho eseguito il push." -ForegroundColor Red
        Write-Host "Controlla 'git status'. Se vuoi annullare il rebase: git rebase --abort" -ForegroundColor Yellow
        exit 1
    }

    git push -u origin main
    if ($LASTEXITCODE -ne 0) { throw 'Push non riuscito.' }

    Write-Host "PUBBLICATO! Modifiche inviate a GitHub." -ForegroundColor Green
    Write-Host "Repository: https://github.com/Stenghela/buckland"
    Write-Host "Sito: https://stenghela.github.io/buckland/"
}
catch {
    Write-Host "ERRORE: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
