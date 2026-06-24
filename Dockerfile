FROM node:20-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ backend/
COPY --from=frontend-build /app/dist/ dist/
ENV UNIPATH_DATA_DIR=/data
ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080} --log-level info
