#!/bin/bash
set -eo pipefail
aws cloudformation deploy --template-file template-vpcefs.yml --stack-name mn-efs-nodejs-vpc
