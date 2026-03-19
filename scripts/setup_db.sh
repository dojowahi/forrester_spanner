#!/bin/bash
# Spanner Database Setup and Recreate Script

LOG_FILE="scripts/setup_db.log"
# Redirect stdout and stderr to a log file while still printing to console
exec > >(tee -i "$LOG_FILE") 2>&1
echo "=== Logging output to $LOG_FILE ==="

INSTANCE_ID="live-retail-geo"
DATABASE_ID="spanner-demo-db"
INSTANCE_CONFIG="regional-us-central1" # Base instance config

echo "=== Starting Geo-partitioned Spanner Database Setup ==="
echo "Instance: $INSTANCE_ID"
echo "Database: $DATABASE_ID"

# 1. Create Base Instance (If not exists)
echo "Checking instance $INSTANCE_ID..."
if ! gcloud spanner instances list --format="value(name)" | grep -q "$INSTANCE_ID"; then
    echo "Creating regional instance $INSTANCE_ID..."
    gcloud spanner instances create "$INSTANCE_ID" \
      --config="$INSTANCE_CONFIG" \
      --description="Geo-partitioning Retail Demo" \
      --nodes=1 \
      --edition=ENTERPRISE_PLUS
    if [ $? -ne 0 ]; then
        echo "Failed to create instance. Aborting."
        exit 1
    fi
else
    echo "Instance $INSTANCE_ID already exists."
fi

# 1b. Check if database exists (For Cleanup)
if gcloud spanner databases list --instance="$INSTANCE_ID" --format="value(name)" | grep -q "$DATABASE_ID"; then
    echo "Database $DATABASE_ID already exists."
    echo "Recreating database (Drop and Recreate) to ensure clean slate..."
    gcloud spanner databases delete "$DATABASE_ID" --instance="$INSTANCE_ID" --quiet
    if [ $? -ne 0 ]; then
        echo "Error deleting database. Proceeding to create..."
    else
        echo "Database deleted."
    fi
fi

# 2. Create Database
echo "Creating database $DATABASE_ID..."
gcloud spanner databases create "$DATABASE_ID" --instance="$INSTANCE_ID"
if [ $? -ne 0 ]; then
    echo "Failed to create database. Aborting."
    exit 1
fi
echo "Database created successfully."

# 2b. Enable Geo-partitioning Preview (Required for Placements)
echo "Enabling geo-partitioning preview..."
gcloud spanner databases ddl update "$DATABASE_ID" --instance="$INSTANCE_ID" \
  --ddl="ALTER DATABASE \`$DATABASE_ID\` SET OPTIONS (opt_in_dataplacement_preview = true)"
if [ $? -ne 0 ]; then
    echo "Failed to enable geo-partitioning preview. Proceeding anyway..."
fi

# 2c. Create Instance Partitions (Geography Nodes)
echo "Creating instance partitions..."
# Array structure: name|config|description
partitions=(
  "americas-partition|regional-us-east1|Americas Distribution"
  "europe-partition|regional-europe-west1|Europe Distribution"
  "asia-partition|regional-asia-southeast2|Asia Distribution"
)

for p in "${partitions[@]}"; do
    IFS="|" read -r name config desc <<< "$p"
    # Check if partition exists
    if ! gcloud beta spanner instance-partitions list --instance="$INSTANCE_ID" --format="value(name)" | grep -q "$name"; then
        echo "Creating partition $name in $config..."
        gcloud beta spanner instance-partitions create "$name" \
          --config="$config" \
          --description="$desc" \
          --instance="$INSTANCE_ID" \
          --nodes=1
        if [ $? -ne 0 ]; then
             echo "Warning: Failed to create partition $name. Continuing..."
        fi
    else
        echo "Partition $name already exists."
    fi
done

# 3. Clean DDL (Optional Placement Stripping)
SKIP_PLACEMENTS=false # Set to true to strip placements for regional instances

if [ "$SKIP_PLACEMENTS" = true ]; then
    echo "Cleaning schema DDL for regional instance compatibility..."
    sed -E 's/,? ?PLACEMENT KEY \([^)]+\)//Ig' scripts/schema.ddl | \
    grep -iv "CREATE PLACEMENT" > scripts/schema_clean.txt
else
    echo "Keeping full schema (with Placements)..."
    cp scripts/schema.ddl scripts/schema_clean.txt
fi

# 4. Apply DDL
echo "Applying DDL from clean schema..."
gcloud spanner databases ddl update "$DATABASE_ID" --instance="$INSTANCE_ID" --ddl-file=scripts/schema_clean.txt

if [ $? -eq 0 ]; then
    echo "Schema applied successfully."
else
    echo "Error applying schema."
    exit 1
fi

echo "=== Database Setup Complete ==="
rm scripts/schema_clean.txt
