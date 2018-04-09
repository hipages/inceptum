#!/bin/sh

cd $(dirname $0)

if [ ! -z "$1" ]; then
  NAMESPACE="$1"
fi

./setup.sh destroy mysql $NAMESPACE
./setup.sh destroy rabbitmq $NAMESPACE
./setup.sh destroy localstack $NAMESPACE
./setup.sh destroy postgres $NAMESPACE
./setup.sh destroy namespace $NAMESPACE