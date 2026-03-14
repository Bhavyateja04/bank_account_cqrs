$ErrorActionPreference = "Stop"

function Assert-Equal {
  param (
    [Parameter(Mandatory = $true)] $Actual,
    [Parameter(Mandatory = $true)] $Expected,
    [Parameter(Mandatory = $true)] [string]$Message
  )

  if ($Actual -ne $Expected) {
    throw "$Message. Expected: $Expected, Actual: $Actual"
  }
}

$baseUrl = "http://localhost:8080"
$accountId = "acc-smoke-$(Get-Random -Minimum 100000 -Maximum 999999)"
$owner = "Smoke Tester"

Write-Host "Running smoke test with accountId=$accountId"

$health = Invoke-RestMethod -Method GET -Uri "$baseUrl/health"
Assert-Equal -Actual $health.status -Expected "ok" -Message "Health endpoint failed"
Write-Host "PASS health"

$createBody = @{
  accountId = $accountId
  ownerName = $owner
  currency = "USD"
  initialBalance = 0
} | ConvertTo-Json

$create = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/accounts" -ContentType "application/json" -Body $createBody
Assert-Equal -Actual $create.accountId -Expected $accountId -Message "Create account returned wrong accountId"
Assert-Equal -Actual $create.status -Expected "OPEN" -Message "Create account returned wrong status"
Write-Host "PASS create"

$depositBody = @{ amount = 500; description = "Salary"; transactionId = "tx-dep-$accountId" } | ConvertTo-Json
$deposit = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/accounts/$accountId/deposit" -ContentType "application/json" -Body $depositBody
Assert-Equal -Actual ([double]$deposit.balance) -Expected 500 -Message "Deposit balance mismatch"
Write-Host "PASS deposit"

$withdrawBody = @{ amount = 100; description = "Rent"; transactionId = "tx-wd-$accountId" } | ConvertTo-Json
$withdraw = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/accounts/$accountId/withdraw" -ContentType "application/json" -Body $withdrawBody
Assert-Equal -Actual ([double]$withdraw.balance) -Expected 400 -Message "Withdraw balance mismatch"
Write-Host "PASS withdraw"

$summary = Invoke-RestMethod -Method GET -Uri "$baseUrl/api/accounts/$accountId"
Assert-Equal -Actual ([double]$summary.balance) -Expected 400 -Message "Summary balance mismatch"
Assert-Equal -Actual $summary.status -Expected "OPEN" -Message "Summary status mismatch"
Write-Host "PASS summary"

$events = Invoke-RestMethod -Method GET -Uri "$baseUrl/api/accounts/$accountId/events"
Assert-Equal -Actual $events.Count -Expected 3 -Message "Event count mismatch after create/deposit/withdraw"
Write-Host "PASS events"

$transactions = Invoke-RestMethod -Method GET -Uri "$baseUrl/api/accounts/$accountId/transactions?page=1&pageSize=10"
Assert-Equal -Actual $transactions.totalCount -Expected 2 -Message "Transaction count mismatch"
Write-Host "PASS transactions"

$timestamp = (Get-Date).ToUniversalTime().AddMinutes(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
$balanceAt = Invoke-RestMethod -Method GET -Uri "$baseUrl/api/accounts/$accountId/balance-at/$timestamp"
Assert-Equal -Actual ([double]$balanceAt.balanceAt) -Expected 400 -Message "Time-travel balance mismatch"
Write-Host "PASS balance-at"

$status = Invoke-RestMethod -Method GET -Uri "$baseUrl/api/projections/status"
if ($status.totalEventsInStore -lt 3) {
  throw "Projection status reports too few events: $($status.totalEventsInStore)"
}
Write-Host "PASS projection status"

$rebuild = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/projections/rebuild"
if ($rebuild.rebuiltEvents -lt 3) {
  throw "Projection rebuild processed too few events: $($rebuild.rebuiltEvents)"
}
Write-Host "PASS projection rebuild"

$withdrawRestBody = @{ amount = 400; description = "Settle"; transactionId = "tx-wd2-$accountId" } | ConvertTo-Json
$withdrawRest = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/accounts/$accountId/withdraw" -ContentType "application/json" -Body $withdrawRestBody
Assert-Equal -Actual ([double]$withdrawRest.balance) -Expected 0 -Message "Final zero-out withdrawal mismatch"
Write-Host "PASS zero balance"

$closeBody = @{ reason = "Smoke test closure" } | ConvertTo-Json
$close = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/accounts/$accountId/close" -ContentType "application/json" -Body $closeBody
Assert-Equal -Actual $close.status -Expected "CLOSED" -Message "Close account status mismatch"
Write-Host "PASS close"

$finalSummary = Invoke-RestMethod -Method GET -Uri "$baseUrl/api/accounts/$accountId"
Assert-Equal -Actual $finalSummary.status -Expected "CLOSED" -Message "Final summary status mismatch"
Assert-Equal -Actual ([double]$finalSummary.balance) -Expected 0 -Message "Final summary balance mismatch"
Write-Host "PASS final summary"

Write-Host "All smoke tests passed."
