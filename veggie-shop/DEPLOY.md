# Deployment Guide: Veggie Shop to Google Cloud Run

This guide explains how to deploy the Veggie Shop application to Google Cloud Run using the provided `Dockerfile`.

## Prerequisites
1. [Google Cloud Account](https://console.cloud.google.com/)
2. [Google Cloud CLI (gcloud)](https://cloud.google.com/sdk/docs/install) installed locally.
3. [Docker](https://www.docker.com/products/docker-desktop/) installed locally.

## Step 1: Initialize Google Cloud
Open your terminal and run:
```bash
gcloud auth login
gcloud config set project [YOUR_PROJECT_ID]
gcloud auth configure-docker
```

## Step 2: Build and Push Docker Image
Replace `[PROJECT_ID]` with your actual Google Cloud Project ID.
```bash
# Build the image
docker build -t gcr.io/[PROJECT_ID]/veggie-shop .

# Push to Container Registry
docker push gcr.io/[PROJECT_ID]/veggie-shop
```

## Step 3: Deploy to Cloud Run
Deploy the container and set the necessary environment variables for security.

```bash
gcloud run deploy veggie-shop \
  --image gcr.io/[PROJECT_ID]/veggie-shop \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="JWT_SECRET=your_secure_secret,PAYPACK_CLIENT_ID=your_id,PAYPACK_CLIENT_SECRET=your_secret"
```

## ⚠️ Important Considerations

### 1. Database Persistence (SQLite)
Cloud Run is **stateless**. The application currently uses `veggie.db` (SQLite). 
- **What happens?**: Every time the container scales to zero or restarts, the database is reset to the state it was in when the image was built.
- **Production Solution**: For real use, migrate to **Google Cloud SQL** (PostgreSQL or MySQL) and update `database.js` to connect to it.

### 2. Secrets Management
The `--set-env-vars` flag is the simplest way to provide secrets. For better security, use **Google Secret Manager** and link the secrets to your Cloud Run service.

### 3. Pricing
Cloud Run has a generous free tier, but monitor your usage in the [Google Cloud Billing Console](https://console.cloud.google.com/billing).
