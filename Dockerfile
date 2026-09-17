FROM python:3.11-slim

# LibreOffice (headless conversion to PDF) + poppler (PDF -> image for
# reading uploaded PDF tag sheets) + fonts so the report renders correctly.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-calc \
    poppler-utils \
    fonts-liberation \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
