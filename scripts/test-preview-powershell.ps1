param(
    [Parameter(Mandatory)][string]$PreviewPath,
    [Parameter(Mandatory)][string]$Scenario
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module Microsoft.PowerShell.Utility
Import-Module Microsoft.PowerShell.Management
$PSModuleAutoLoadingPreference = 'None'
$global:PreviewTestCalls = [System.Collections.Generic.List[object]]::new()
$global:PreviewTestProfile = [pscustomobject]@{ Subscription = [pscustomobject]@{ Id = '11111111-1111-1111-1111-111111111111' } }

# Every Azure command is replaced locally; fail closed on unexpected commands.
function Get-AzContext {
    [CmdletBinding()] param()
    $global:PreviewTestCalls.Add(@{ command = 'Get-AzContext' })
    if ($Scenario -eq 'no-context') { return $null }
    if ($Scenario -eq 'wrong-subscription') {
        return [pscustomobject]@{ Subscription = [pscustomobject]@{ Id = '22222222-2222-2222-2222-222222222222' } }
    }
    return $global:PreviewTestProfile
}
function Get-AzResourceGroup {
    [CmdletBinding()] param([string]$Name, [object]$DefaultProfile)
    if ($DefaultProfile -ne $global:PreviewTestProfile) { throw 'Expected the explicitly checked profile.' }
    $global:PreviewTestCalls.Add(@{ command = 'Get-AzResourceGroup'; name = $Name })
    if ($Scenario -eq 'group-error') { throw 'Synthetic access denied.' }
    if ($Scenario -eq 'missing-group') { return $null }
    return [pscustomobject]@{ ResourceGroupName = $Name; Location = 'westeurope' }
}
function Get-AzResourceGroupDeploymentWhatIfResult {
    [CmdletBinding()] param(
        [string]$ResourceGroupName, [string]$TemplateFile,
        [hashtable]$TemplateParameterObject, [object]$DefaultProfile,
        [string]$Mode, [switch]$SkipTemplateParameterPrompt
    )
    if ($DefaultProfile -ne $global:PreviewTestProfile) { throw 'Preview lost its checked profile.' }
    $global:PreviewTestCalls.Add(@{
        command = 'Get-AzResourceGroupDeploymentWhatIfResult'
        group = $ResourceGroupName
        template = $TemplateFile
        parameters = $TemplateParameterObject
        mode = $Mode
        skipPrompt = [bool]$SkipTemplateParameterPrompt
    })
    if ($Scenario -eq 'preview-error') { throw 'Synthetic invalid template.' }
    return [pscustomobject]@{ Status = $(if ($Scenario -eq 'preview-failed-status') { 'Failed' } else { 'Succeeded' }); Changes = @() }
}
function Get-Command {
    [CmdletBinding()] param([string[]]$Name, [string]$CommandType)
    foreach ($item in $Name) {
        if ($Scenario -eq 'missing-command' -and $item -eq 'Get-AzResourceGroupDeploymentWhatIfResult') { throw 'Synthetic missing Az.Resources.' }
        if ($Scenario -eq 'missing-bicep' -and $item -eq 'bicep') { throw 'Synthetic missing Bicep CLI.' }
        if ($item -notin @('Get-AzContext', 'Get-AzResourceGroup', 'Get-AzResourceGroupDeploymentWhatIfResult', 'bicep')) { throw "Unexpected dependency: $item" }
        [pscustomobject]@{ Name = $item }
    }
}
function New-AzResourceGroup {
    [CmdletBinding()] param([string]$Name, [string]$Location, [switch]$Force)
    $global:PreviewTestCalls.Add(@{ command = 'FORBIDDEN:New-AzResourceGroup' })
    throw 'Resource writes are forbidden by this harness.'
}
function New-AzResourceGroupDeployment {
    [CmdletBinding(SupportsShouldProcess)] param([string]$Name, [string]$ResourceGroupName, [string]$TemplateFile, [hashtable]$TemplateParameterObject)
    $global:PreviewTestCalls.Add(@{ command = 'FORBIDDEN:New-AzResourceGroupDeployment' })
    throw 'Deployment commands are forbidden by this harness.'
}
function Connect-AzAccount {
    $global:PreviewTestCalls.Add(@{ command = 'FORBIDDEN:Connect-AzAccount' })
    throw 'Automatic sign-in is forbidden by this harness.'
}
function Write-Host { param([object]$Object) }

$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($PreviewPath, [ref]$tokens, [ref]$parseErrors)
$commands = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true) |
    ForEach-Object { $_.GetCommandName() })
$allowed = @(
    'Set-StrictMode', 'Join-Path', 'Test-Path', 'Get-Item', 'Get-Command',
    'Get-AzContext', 'Get-AzResourceGroup', 'Get-AzResourceGroupDeploymentWhatIfResult',
    'Write-Host', 'Out-Null',
    # Baseline commands are safe only because the harness defines throwing mocks.
    'New-AzResourceGroup', 'New-AzResourceGroupDeployment', 'Connect-AzAccount', 'Get-Random'
)
$unknown = @($commands | Where-Object { -not $_ -or $_ -notin $allowed })
$errorMessage = $null
if ($parseErrors.Count -gt 0 -or $unknown.Count -gt 0) {
    $errorMessage = 'Generated script failed parser/command allowlist checks.'
} else {
    try {
        if ($Scenario -eq 'cancel') {
            & $PreviewPath -WhatIf | Out-Null
        } elseif ($Scenario -eq 'confirmation-unavailable') {
            & $PreviewPath -Confirm | Out-Null
        } else {
            & $PreviewPath | Out-Null
        }
    } catch {
        $errorMessage = $_.Exception.Message
    }
}
[pscustomobject]@{
    error = $errorMessage
    commands = $commands
    parseErrors = @($parseErrors | ForEach-Object { $_.Message })
    calls = @($global:PreviewTestCalls.ToArray())
} | ConvertTo-Json -Depth 12 -Compress
