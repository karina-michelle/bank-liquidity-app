FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY ./scripts /app/scripts

COPY ./app /app/app
COPY ./config /app/config

ENV PYTHONPATH=/app

COPY entrypoint.sh .

RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload", "--log-config", "./config/log_conf.yaml"]