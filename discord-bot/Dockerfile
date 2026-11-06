FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8

WORKDIR /app

COPY requirements.txt .
RUN grep -v '^pytest' requirements.txt > requirements.prod.txt && \
    pip install --no-cache-dir -r requirements.prod.txt && \
    rm requirements.prod.txt

COPY . .

RUN mkdir -p /app/data

VOLUME ["/app/data"]

CMD ["python", "bot.py"]
