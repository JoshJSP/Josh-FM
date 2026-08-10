FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "piper-tts[http]>=1.3,<2"

# Free Dutch single-speaker voice. Downloaded once when Koyeb builds the image.
RUN mkdir -p /app/voices \
    && python -m piper.download_voices --data-dir /app/voices nl_NL-ronnie-medium

EXPOSE 5000

CMD ["python","-m","piper.http_server","-m","nl_NL-ronnie-medium","--data-dir","/app/voices","--host","0.0.0.0","--port","5000"]
