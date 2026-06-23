#!/bin/zsh
# Experiment battery. Waits until NO REAL workerd binary is running (excluding
# shells/pgrep/this script), then runs serial install experiments solo.
set -u
cd /Users/netanelg/Development/vite-workerd-demo/experiments/npm-in-workerd/scratch-investigate
export MINIFLARE_WORKERD_PATH=/Users/netanelg/Development/workerd-vfs.bin
LOG=battery.log
: > $LOG
echo "=== battery start $(date) ===" >> $LOG

# REAL workerd binary processes (exclude shells, grep, this battery, our node)
real_busy() {
  ps -axo pid,command \
    | grep -E "workerd-vfs.bin serve --binary|workerd-bash/repl.mjs|do-machine-clean/run.mjs" \
    | grep -v grep | grep -v battery.sh | grep -v "install-only.mjs" | wc -l | tr -d ' '
}

wait_clear() {
  local n=0
  while [ "$(real_busy)" != "0" ]; do
    sleep 5; n=$((n+1))
    if [ $((n % 12)) -eq 0 ]; then echo "  [wait_clear] busy=$(real_busy) $(date)" >> $LOG; fi
  done
  sleep 3
}

wd_pids() { ps -axo pid,command | grep "workerd-vfs.bin serve --binary" | grep -v grep | awk '{print $1}' | sort; }

run() {
  local id=$1; local maxconc=$2
  wait_clear
  local before; before=$(wd_pids)
  echo "--- RUN $id (MAXCONC=$maxconc) start $(date) ---" >> $LOG
  RUN_ID=$id TIMEOUT=400000 MAXCONC=$maxconc node install-only.mjs >> $LOG 2>&1
  echo "--- RUN $id exit=$? $(date) ---" >> $LOG
  # reap ONLY workerd PIDs that did not exist before our run (i.e. ours)
  local after; after=$(wd_pids)
  for pid in ${(f)after}; do
    if ! echo "$before" | grep -qx "$pid"; then kill -9 $pid 2>/dev/null; fi
  done
  sleep 4
}

for i in 1 2 3 4 5; do run baseline-$i 0; done
for i in 1 2 3 4 5; do run conc6-$i 6; done
echo "=== battery done $(date) ===" >> $LOG
