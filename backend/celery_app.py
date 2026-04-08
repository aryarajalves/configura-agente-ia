import os
from celery import Celery
from celery.schedules import crontab
from kombu import Exchange, Queue

# Configura o Broker URL do ambiente (RabbitMQ / Redis)
broker_url = os.getenv("CELERY_BROKER_URL", "amqp://guest:guest@rabbitmq:5672//")
result_backend = os.getenv("CELERY_RESULT_BACKEND", "rpc://")

app = Celery("ai_agent_celery", broker=broker_url, backend=result_backend, include=['tasks'])

app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='America/Sao_Paulo',
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_enable_remote_control=False,
    task_queues=[
        Queue('celery', Exchange('celery'), routing_key='celery',
              queue_arguments={'x-queue-type': 'classic'}),
        Queue('json_processing', Exchange('json_processing'), routing_key='json_processing',
              queue_arguments={'x-queue-type': 'classic'}),
    ],
)

# Definindo tarefas periódicas
app.conf.beat_schedule = {
    'delete-old-process-logs-every-midnight': {
        'task': 'tasks.delete_old_process_logs_task',
        'schedule': crontab(minute=0, hour=0), # Executa diariamente à meia-noite
        'args': ()
    },
}
