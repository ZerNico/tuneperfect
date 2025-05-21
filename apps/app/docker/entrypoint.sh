#!/bin/sh

import-meta-env -x .env.example -p index.html
serve -s .