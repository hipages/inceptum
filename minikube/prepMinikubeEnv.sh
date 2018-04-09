#!/bin/sh

cd $(dirname $0)

# Make sure that the env var is set. Even if it's empty
if [ ! -z "$1" ]; then
  NAMESPACE="$1"
fi

FILE=/tmp/minikube_env_$NAMESPACE.txt

set -e

if [ -e "$FILE" ]; then
  rm $FILE
fi

./setup.sh get mysql $NAMESPACE > $FILE
echo "" >> $FILE

./setup.sh get rabbitmq $NAMESPACE >> $FILE
echo "" >> $FILE

./setup.sh get localstack $NAMESPACE >> $FILE
echo "" >> $FILE

./setup.sh get postgres $NAMESPACE >> $FILE
echo "" >> $FILE

echo "NEW_RELIC_ENABLED=false" >> $FILE
