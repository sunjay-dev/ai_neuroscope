FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
# CPU-only torch wheel: the default PyPI build pulls in ~8GB of CUDA
# dependencies that are useless without a GPU and bloat the image drastically.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch && \
    pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend

ENV NEUROSCOPE_MODEL=gpt2
EXPOSE 8000

CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
