cd $(dirname $0)

configureRabbitMQ() {
  echo "Getting RabbitMQ pod" >&2
  POD_NAME=$(kubectl get pods --sort-by={.metadata.creationTimestamp} | grep rabbitmq-nuntius${MK_ENV} | tail -n 1 | cut -d" " -f1)
  while [ -z "$POD_NAME" ]; do
    sleep 1
    POD_NAME=$(kubectl get pods --sort-by={.metadata.creationTimestamp} | grep rabbitmq-nuntius${MK_ENV} | tail -n 1 | cut -d" " -f1)
  done
  echo "Found rabbitmq pod: ${POD_NAME}. Waiting for RabbitMQ to be available" >&2
  RABBITMQ_HOST=$(minikube ip)
  cat ../rabbitmq/nuntius-mandrill-setup.json | kubectl exec -i $POD_NAME -- /bin/bash -c 'cat > /tmp/base.json && rabbitmqadmin --vhost=/ import /tmp/base.json'
  cat ../rabbitmq/lux-setup.json | kubectl exec -i $POD_NAME -- /bin/bash -c 'cat > /tmp/base.json && rabbitmqadmin --vhost=/ import /tmp/base.json'
  cat ../rabbitmq/nuntius-channel-mandrill-webhook.json | kubectl exec -i $POD_NAME -- /bin/bash -c 'cat > /tmp/base.json && rabbitmqadmin --vhost=/ import /tmp/base.json'
  echo "RabbitMQ configured" >&2
}

isIn() {
  TOFIND=$1
  shift
  for TF in $@; do
    if [ "$TF" = "$TOFIND" ]; then
      return 0
    fi
  done
  return 1
}

printUsage() {
  echo "Usage: $0 action service [namespace]" >&2
  echo "Where:" >&2
  echo "  action is one of: $VALID_ACTIONS" >&2
  echo "  service is one of: $VALID_SERVICES" >&2
  echo "  namespace is the namespace to use, if you don't specify it it'll act on the default environment configured for kubectl." >&2
  exit 1
}

doCreate() {
  if [ "$SERVICE" = "namespace" ]; then
    createNamespaceIfNeeded
  else
    if [ -e "${SERVICE}.yaml" ]; then
      kubectl apply -f ${SERVICE}.yaml --namespace $NAMESPACE
      waitForPodsOfApp ${SERVICE}-inceptum
    else
      echo "Unimplemented service $SERVICE" >&2
      exit 1
    fi
  fi
}

doDestroy() {
  if [ "$SERVICE" = "namespace" ]; then
    destroyNamespaceIfNotDefault
  else
    if [ -e "${SERVICE}.yaml" ]; then
      kubectl delete -f ${SERVICE}.yaml --namespace $NAMESPACE
    else
      echo "Unimplemented service $SERVICE" >&2
      exit 1
    fi
  fi
}

doLoad() {
  if [ "$SERVICE" != "namespace" ]; then
    waitForPodsOfApp ${SERVICE}-inceptum
    POD_NAME=$(getPodOfApp ${SERVICE}-inceptum)
    case "$SERVICE" in
      "mysql")
        kubectl exec -i $POD_NAME --namespace $NAMESPACE -- /bin/bash -c "mysql -u root -pinceptum -e 'CREATE DATABASE IF NOT EXISTS testdb; CREATE TABLE testdb.table1 (id int(11) NOT NULL AUTO_INCREMENT, name varchar(20) NOT NULL, PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=UTF8'" 2>/dev/null
        kubectl exec -i $POD_NAME --namespace $NAMESPACE -- /bin/bash -c "mysql -u root -pinceptum -e 'TRUNCATE TABLE testdb.table1; INSERT INTO testdb.table1 (name) VALUES (\"User 1\"),(\"User 2\"),(\"User 3\")'" 2>/dev/null
        ;;
      "postgres")
        kubectl exec -i $POD_NAME --namespace $NAMESPACE -- /bin/sh -c "psql -c 'Create database testdb;' -U postgres" 2>/dev/null
        kubectl exec -i $POD_NAME --namespace $NAMESPACE -- /bin/sh -c "psql -c 'CREATE TABLE table1 (name varchar(20) not null);' -U postgres -d testdb" 2>/dev/null
        kubectl exec -i $POD_NAME --namespace $NAMESPACE -- /bin/sh -c "psql -c \"TRUNCATE TABLE table1;\" -U postgres -d testdb" 2>/dev/null
        kubectl exec -i $POD_NAME --namespace $NAMESPACE -- /bin/sh -c "psql -c \"INSERT INTO table1 (name) VALUES ('User 1'),('User 2'),('User 3');\" -U postgres -d testdb" 2>/dev/null
        ;;
      "rabbitmq")
        RABBITMQ_PORT=$(kubectl get svc rabbitmq-inceptum --namespace $NAMESPACE -o json | jq '.spec.ports | .[] | select(.port == 15672).nodePort')
        while ! curl -sSf http://$(minikube ip):${RABBITMQ_PORT}/ &> /dev/null; do
          sleep 1
        done
        cat ../itest/rabbitmq/definitions.json | kubectl exec -i $POD_NAME --namespace $NAMESPACE -- /bin/bash -c 'cat > /tmp/base.json && rabbitmqadmin --vhost=/ import /tmp/base.json'
        ;;
    esac
  fi
}

getPodOfApp() {
  kubectl get pod -l app=$1 --namespace=$NAMESPACE -o json | jq '.items[0].metadata.name' -r
}

waitForPodsOfApp() {
  STATUS=$(kubectl get pod -l app=$1 --namespace=$NAMESPACE -o json | \
    jq -r '.items[0].status.conditions | .[] | select(.type =="Ready") | select(.status == "True")' 2>/dev/null)
  RES=$?
  while [ $RES -ne 0 ] || [ -z "$STATUS" ]; do
    sleep 1
    STATUS=$(kubectl get pod -l app=$1 --namespace=$NAMESPACE -o json | \
      jq -r '.items[0].status.conditions | .[] | select(.type =="Ready") | select(.status == "True")' 2>/dev/null)
    RES=$?
  done
}

doGet() {
  waitForPodsOfApp ${SERVICE}-inceptum
  case "$SERVICE" in
    "mysql")
      echo "MYSQL_HOST=$(minikube ip)"
      echo "MYSQL_PORT=$(kubectl get svc mysql-inceptum --namespace $NAMESPACE -o json | jq '.spec.ports[0].nodePort')"
      echo "MYSQL_USER=root"
      echo "MYSQL_PASS=inceptum"
      ;;
    "postgres")
      echo "POSTGRES_HOST=$(minikube ip)"
      echo "POSTGRES_PORT=$(kubectl get svc postgres-inceptum --namespace $NAMESPACE -o json | jq '.spec.ports[0].nodePort')"
      echo "POSTGRES_USER=postgres"
      echo "POSTGRES_PASS=inceptum"
      ;;
    "rabbitmq")
      echo "RABBITMQ_HOST=$(minikube ip)"
      echo "RABBITMQ_PORT=$(kubectl get svc rabbitmq-inceptum --namespace $NAMESPACE -o json | jq '.spec.ports | .[] | select(.port == 5672).nodePort')"
      echo "RABBITMQ_USER=guest"
      echo "RABBITMQ_PASS=admin"
      echo "RABBITMQ_MGMT_HOST=$(minikube ip)"
      echo "RABBITMQ_MGMT_PORT=$(kubectl get svc rabbitmq-inceptum --namespace $NAMESPACE -o json | jq '.spec.ports | .[] | select(.port == 15672).nodePort')"
      ;;
    "localstack")
      echo "LS_HOST=$(minikube ip)"
      echo "LS_SQS_PORT=$(kubectl get svc localstack-inceptum --namespace $NAMESPACE -o json | jq '.spec.ports | .[] | select(.name == "sqs").nodePort')"
      echo "LS_SQS_REST_PORT=$(kubectl get svc localstack-inceptum --namespace $NAMESPACE -o json | jq '.spec.ports | .[] | select(.name == "sqs-rest").nodePort')"
      echo "LS_SNS_PORT=$(kubectl get svc localstack-inceptum --namespace $NAMESPACE -o json | jq '.spec.ports | .[] | select(.name == "sns").nodePort')"
      echo "LS_WEBUI_PORT=$(kubectl get svc localstack-inceptum --namespace $NAMESPACE -o json | jq '.spec.ports | .[] | select(.name == "webui").nodePort')"
      ;;
  esac
}

createNamespaceIfNeeded() {
  if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    echo "Creating namespace $NAMESPACE" >&2
    kubectl create namespace $NAMESPACE
  else
    echo "Namespace $NAMESPACE already exists" >&2
  fi
}

destroyNamespaceIfNotDefault() {
  if [ "$NAMESPACE" != "default" ]; then
    echo "Destroying namespace $NAMESPACE" >&2
    kubectl delete namespace $NAMESPACE
  fi
}


# --------------------------------------- main block

VALID_ACTIONS="create destroy rebuild load get"
VALID_SERVICES="namespace mysql postgres rabbitmq localstack"

if [ -z "$EXPECTED_ENV" ]; then
  EXPECTED_ENV=minikube
fi

CURRENT_KUBECTL_ENV=$(kubectl config get-contexts | grep "^*" | awk '{print $2}')
if [ "$CURRENT_KUBECTL_ENV" != "$EXPECTED_ENV" ]; then
  echo "Kubectl is not configured to talk to context $EXPECTED_ENV. Cowardly refusing to continue. Run 'kubectl config get-contexts' to see current context" >&2
  exit 1
fi

ACTION="$1"
if [ -z "$ACTION" ] || ! isIn $ACTION $VALID_ACTIONS; then
  echo "Please specify a valid command" >&2
  printUsage
fi
SERVICE="$2"
if [ -z "$SERVICE" ] || ! isIn $SERVICE $VALID_SERVICES; then
  echo "Please specify a valid service" >&2
  printUsage
fi

NAMESPACE=$3
if [ -z "$NAMESPACE" ]; then
  NAMESPACE=default
fi

case "$ACTION" in
  "create")
    doCreate
    doLoad
    ;;
  "destroy")
    doDestroy
    ;;
  "destroy")
    doDestroy
    doCreate
    doLoad
    ;;
  "load")
    doLoad
    ;;
  "get")
    doGet
esac
