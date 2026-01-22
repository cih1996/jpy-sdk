#!/bin/bash
# Generate Go structs from TypeScript definitions
# This ensures that the Go CLI uses the same data models as the TypeScript SDK

TS_FILE="../jpy-sdk/src/middleware/types/index.ts"
TEMP_TS="tools/temp_types.ts"
OUTPUT_FILE="pkg/model/generated_types.go"

echo "Extracting types from $TS_FILE..."

# 1. Extract content, filtering out error classes that extend Error (quicktype issue)
# 2. Replace bigint with number (quicktype Go issue)
# 3. Rename ServerConfig to RemoteServerConfig to avoid conflict with CLI config
# Use sed to remove the MiddlewareError class block (from "export class" to first "}")
sed '/export class MiddlewareError/,/^}/d' "$TS_FILE" | \
sed 's/bigint/number/g' | \
sed 's/interface ServerConfig/interface RemoteServerConfig/g' > "$TEMP_TS"

echo "Generating Go types..."

# Use quicktype to generate Go code
npx quicktype \
  --src "$TEMP_TS" \
  --src-lang typescript \
  --lang go \
  --package model \
  --out "$OUTPUT_FILE" \
  --top-level TypeDefinitions

# Post-process Go file to use int instead of float64 for specific fields
# This makes the Go code more idiomatic
echo "Post-processing Go types..."

# Define fields that should be int
INT_FIELDS="Type|Seat|CPU|Width|Height|F|Seq|Code|Status|MaxDevices"

# Replace float64 with int for these fields (naive replacement but works for generated structs)
# Pattern: Field *float64 `json:"field"` -> Field *int `json:"field"`
sed -i '' -E "s/(${INT_FIELDS})[[:space:]]+\*float64/\1 *int/g" "$OUTPUT_FILE"
sed -i '' -E "s/(${INT_FIELDS})[[:space:]]+float64/\1 int/g" "$OUTPUT_FILE"

echo "Done. Generated $OUTPUT_FILE"
