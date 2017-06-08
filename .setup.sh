#!/bin/bash

echo 'README.md merge=ours' >> .gitattributes
git config merge.ours.driver true