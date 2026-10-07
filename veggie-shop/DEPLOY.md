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

## Step 3: Production Readiness Gate

Do not deploy this version for live sales yet. The application stores data in `shop.db` on the container filesystem, which is not durable across Cloud Run instance replacement and is not shared between instances. The application must first be migrated to a durable managed database.

Online payments are disabled. Paypack's official materials do not confirm Kenya, `+254`, KES, or transaction-currency verification for this integration. Do not configure its credentials or accept Paypack payments for this Kenyan KES store. Integrate a provider that officially supports KES and server-side settlement verification before accepting or fulfilling paid orders.

## Step 4: Deploy After the Readiness Gate

Set `JWT_SECRET` (at least 32 characters), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ALLOWED_ORIGINS` in the deployment environment. Use Secret Manager rather than putting secrets directly on the command line. Do not enable Paypack for live Kenyan KES payments unless compatibility is confirmed by Paypack.

```bash
gcloud run deploy veggie-shop \
  --image gcr.io/[PROJECT_ID]/veggie-shop \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,ALLOWED_ORIGINS=https://your-domain.example,ADMIN_EMAIL=admin@your-domain.example" \
  --set-secrets="JWT_SECRET=jwt-secret:latest,ADMIN_PASSWORD=admin-password:latest"
```

## ⚠️ Important Considerations

### 1. Database Persistence
Cloud Run is stateless. The application currently uses `shop.db` (SQLite), so data can be lost on instance replacement and is not shared across instances. Migrate the database layer to a durable managed database before deployment.

### 2. Secrets Management
Use Google Secret Manager for credentials. Do not commit `.env` or bake it into the container image.

### 3. Pricing
Cloud Run has a generous free tier, but monitor your usage in the [Google Cloud Billing Console](https://console.cloud.google.com/billing).
