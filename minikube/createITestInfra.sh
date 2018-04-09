#!/bin/sh

cd $(dirname $0)

if [ ! -z "$1" ]; then
  NAMESPACE="$1"
fi


./setup.sh create namespace $NAMESPACE
./setup.sh create mysql $NAMESPACE
./setup.sh create rabbitmq $NAMESPACE
./setup.sh create postgres $NAMESPACE
./setup.sh create localstack $NAMESPACE