#!/bin/bash
adb reverse tcp:8081 tcp:9173
pnpm start --port 9173
