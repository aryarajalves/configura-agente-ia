FROM rabbitmq:3-management

# Plugins adicionais podem ser habilitados aqui se necessário no futuro
# RUN rabbitmq-plugins enable --offline rabbitmq_consistent_hash_exchange

EXPOSE 5672 15672
