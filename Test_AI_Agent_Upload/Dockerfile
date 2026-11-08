# Build context: this directory (Test_AI_Agent_Upload). Secrets come from the host's environment only.
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TAMMENI_PUBLIC_DEPLOYMENT=1

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
# Calls silently lose school background without this file, so a bad build must fail here.
RUN test -f backend/data/madrasati-dataset.json

RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin tammeni
USER tammeni

EXPOSE 8000
# Twilio's voice URL carries the call-context token, so uvicorn's access log stays off.
CMD ["sh", "-c", "exec uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --no-access-log"]
