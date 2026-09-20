export function emitAzureCliDraft(options: { sql: boolean; apim: boolean }): string {
  const lines = [
    "#!/usr/bin/env bash",
    "# Preview by default. --deploy explicitly executes the reviewed Bicep after What-If.",
    "# Requires Azure CLI and standalone Bicep CLI installed separately.",
    "set -euo pipefail",
    "umask 077",
    "",
    'fail() { printf "%s\\n" "$1" >&2; exit 1; }',
    'DEPLOY=false',
    'if (( $# > 1 )); then fail "Usage: deploy.sh [--deploy]"; fi',
    'case "${1:-}" in',
    '  "") ;;',
    '  --deploy) DEPLOY=true ;;',
    '  *) fail "Usage: deploy.sh [--deploy]" ;;',
    "esac",
    "",
    'SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"',
    'TEMPLATE_FILE="$SCRIPT_DIR/main.bicep"',
    '[[ -s "$TEMPLATE_FILE" ]] || fail "Download the matching nonempty main.bicep beside this script."',
    ': "${AZURE_SUBSCRIPTION_ID:?Set AZURE_SUBSCRIPTION_ID}"',
    ': "${AZURE_RESOURCE_GROUP:?Set AZURE_RESOURCE_GROUP to an existing group}"',
    ': "${AZURE_SUFFIX:?Set AZURE_SUFFIX to a globally unique namespace}"',
    'GUID_PATTERN="^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"',
    '[[ "$AZURE_SUBSCRIPTION_ID" =~ $GUID_PATTERN && "$AZURE_SUBSCRIPTION_ID" != "00000000-0000-0000-0000-000000000000" ]] || fail "AZURE_SUBSCRIPTION_ID must be a nonzero GUID."',
    '[[ "$AZURE_SUFFIX" =~ ^[a-z][a-z0-9]{2,9}$ ]] || fail "AZURE_SUFFIX must be 3-10 lowercase letters/digits, beginning with a letter."',
    '[[ "$AZURE_RESOURCE_GROUP" =~ [^[:space:]] ]] || fail "AZURE_RESOURCE_GROUP must not be blank."',
    'command -v az >/dev/null || fail "Install Azure CLI separately."',
    'command -v bicep >/dev/null || fail "Install standalone Bicep CLI separately."',
  ];
  if (options.sql) {
    lines.push(
      ': "${SQL_ADMIN_OBJECT_ID:?Set SQL_ADMIN_OBJECT_ID to an Entra group object ID}"',
      '[[ "$SQL_ADMIN_OBJECT_ID" =~ $GUID_PATTERN && "$SQL_ADMIN_OBJECT_ID" != "00000000-0000-0000-0000-000000000000" ]] || fail "SQL_ADMIN_OBJECT_ID must be a nonzero GUID."',
      'SQL_ADMIN_LOGIN="${SQL_ADMIN_LOGIN:-Azure SQL Administrators}"',
    );
  }
  if (options.apim) {
    lines.push(
      ': "${APIM_PUBLISHER_EMAIL:?Set APIM_PUBLISHER_EMAIL}"',
      '[[ "$APIM_PUBLISHER_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$ ]] || fail "APIM_PUBLISHER_EMAIL must be an email address."',
    );
  }
  lines.push(
    "",
    'COMPILED_TEMPLATE="$(mktemp)"',
    'trap \'rm -f -- "$COMPILED_TEMPLATE"\' EXIT',
    'bicep build "$TEMPLATE_FILE" --stdout > "$COMPILED_TEMPLATE"',
    'CURRENT_SUBSCRIPTION="$(az account show --query id --output tsv)"',
    '[[ "${CURRENT_SUBSCRIPTION,,}" == "${AZURE_SUBSCRIPTION_ID,,}" ]] || fail "Current Azure login does not match AZURE_SUBSCRIPTION_ID. No context was switched."',
    'GROUP_LOCATION="$(az group show --subscription "$AZURE_SUBSCRIPTION_ID" --name "$AZURE_RESOURCE_GROUP" --query location --output tsv)"',
    '[[ -n "$GROUP_LOCATION" ]] || fail "The existing resource group location is unavailable."',
    'LOCATION="${AZURE_LOCATION:-$GROUP_LOCATION}"',
    'PARAMETERS=("environmentName=$AZURE_SUFFIX" "location=$LOCATION")',
  );
  if (options.sql) lines.push('PARAMETERS+=("sqlAdminObjectId=$SQL_ADMIN_OBJECT_ID" "sqlAdminLogin=$SQL_ADMIN_LOGIN")');
  if (options.apim) lines.push('PARAMETERS+=("publisherEmail=$APIM_PUBLISHER_EMAIL")');
  lines.push(
    "",
    'az deployment group what-if --subscription "$AZURE_SUBSCRIPTION_ID" --resource-group "$AZURE_RESOURCE_GROUP" --name "diagrammatic-$AZURE_SUFFIX" --mode Incremental --template-file "$COMPILED_TEMPLATE" --parameters "${PARAMETERS[@]}"',
    'if [[ "$DEPLOY" == true ]]; then',
    '  az deployment group create --subscription "$AZURE_SUBSCRIPTION_ID" --resource-group "$AZURE_RESOURCE_GROUP" --name "diagrammatic-$AZURE_SUFFIX" --mode Incremental --template-file "$COMPILED_TEMPLATE" --parameters "${PARAMETERS[@]}"',
    "else",
    '  printf "%s\\n" "Preview only. Nothing deployed. Review the result; --deploy is a separate explicit write action."',
    "fi",
    "",
  );
  return lines.join("\n");
}
