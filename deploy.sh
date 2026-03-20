#!/bin/bash
set -e

# --- Error Handler ---
error_handler() {
  local exit_code=$?
  local line_num=$1
  echo ""
  echo "❌ ERROR: Command failed at line $line_num with exit code $exit_code"
  
  if [ -t 0 ]; then
    echo "⏸️  Press [Enter] to exit and close this window..."
    read -r
  fi
  exit $exit_code
}
trap 'error_handler $LINENO' ERR
# ---------------------

# Default values
PROJECT_ID="gen-ai-4all"
REGION="us-central1"
SERVICE_NAME="spanner-forrester-retail"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Starting Local Deployment to Cloud Run..."

SERVICE_ACCOUNT="genai-592@gen-ai-4all.iam.gserviceaccount.com"

# 1. Build and Push using Cloud Build
echo "📦 Building and pushing Docker image using Cloud Build..."

# Temporarily copy frontend/.env to frontend/.env.production so Cloud Build can bake the Maps API key into Vite
if [ -f "frontend/.env" ]; then
  echo "🗺️  Injecting frontend environments variables to build..."
  cp frontend/.env frontend/.env.production
fi

gcloud builds submit --tag "$IMAGE_NAME" . --project="$PROJECT_ID" --impersonate-service-account="$SERVICE_ACCOUNT"

# Cleanup temporary env
if [ -f "frontend/.env.production" ]; then
  rm frontend/.env.production
fi

# 2. Deploy to Cloud Run
echo "🚢 Deploying to Cloud Run..."

# Load backend/.env variables, excluding Cloud Run config overrides
ENV_VARS=""
if [ -f ".env" ]; then
  echo "📄 Found .env, parsing variables..."
  ENV_VARS=$(grep -v '^#' .env | grep -v '^$' | grep -v 'GOOGLE_CLOUD_PROJECT=' | grep -v 'GOOGLE_CLOUD_LOCATION=' | tr -d '\r' | paste -s -d "," -)
fi

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --allow-unauthenticated \
  --no-cpu-throttling \
  --memory 1Gi \
  --service-account "$SERVICE_ACCOUNT" \
  --impersonate-service-account "$SERVICE_ACCOUNT" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION,OTEL_METRICS_EXPORTER=none${ENV_VARS:+,}${ENV_VARS}"

echo "✅ Deployment complete!"
APP_URL=$(gcloud run services describe "$SERVICE_NAME" --platform managed --region "$REGION" --project="$PROJECT_ID" --format='value(status.url)')
echo ""
echo "🌍 App URL: $APP_URL"
echo ""

# Wait for user input on success to prevent window from closing immediately
if [ -t 0 ]; then
  echo ""
  echo "⏸️  Press [Enter] to exit and close this window..."
  read -r
fi
