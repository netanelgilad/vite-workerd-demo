#!/bin/zsh
# ONE clean instrumented install with host-side workerd RSS + system memory
# sampling. Refuses to start if another install/workerd is already running
# (prevents the duplicate-process confound).
set -u
cd /Users/netanelg/Development/vite-workerd-demo/experiments/npm-in-workerd/scratch-investigate
export MINIFLARE_WORKERD_PATH=/Users/netanelg/Development/workerd-vfs.bin
ID=${1:-clean}
MAXCONC=${2:-0}

reap_wd() { for pid in $(ps -axo pid,command | grep "workerd-vfs.bin serve --binary" | grep -v grep | awk '{print $1}'); do kill -9 $pid 2>/dev/null; done; }
trap 'reap_wd' EXIT
busy() { ps -axo command | grep -E "workerd-vfs.bin serve --binary|install-only.mjs|workerd-bash/repl.mjs" | grep -v grep | grep -v solo-run.sh | wc -l | tr -d ' '; }
if [ "$(busy)" != "0" ]; then echo "REFUSING: $(busy) install/workerd procs already running"; exit 2; fi

RSS=/tmp/wd-rss.$ID.log; : > $RSS
( while true; do
    ts=$(($(date +%s)))
    line=$(ps -axo pid,rss,command | grep "workerd-vfs.bin serve --binary" | grep -v grep | awk -v t=$ts '{print t" pid="$1" rss_mb="int($2/1024)}')
    [ -n "$line" ] && echo "$line"
    # macOS free memory pages
    fp=$(vm_stat 2>/dev/null | awk '/Pages free/{gsub(/\./,"",$3); print $3}')
    [ -n "$fp" ] && echo "$ts sys_free_mb=$(( fp*16384/1048576 ))"
    sleep 2
  done ) >> $RSS 2>&1 &
SAMPLER=$!

RUN_ID=$ID TIMEOUT=400000 MAXCONC=$MAXCONC node install-only.mjs > /tmp/$ID.console 2>&1
EC=$?
kill $SAMPLER 2>/dev/null

echo "=== install exit=$EC ==="
echo "=== peak workerd RSS ==="; awk -F'rss_mb=' '/rss_mb=/{if($2>max)max=$2}END{print "peak_rss_mb="max}' $RSS
echo "=== min sys free ==="; awk -F'sys_free_mb=' '/sys_free_mb=/{if(min==""||$2<min)min=$2}END{print "min_sys_free_mb="min}' $RSS
echo "=== result ==="; node -e "const r=require('./result.$ID.json'); console.log('result:',r.result,'ok:',r.ok,'wall:',r.wall,'installed:',r.installedCount,'err:',(r.error||'').slice(0,80))" 2>/dev/null
echo "=== last instr (non-idle) ==="; grep -vE "SAMPLE inflight=0 reqStart=0" result.$ID.instr.log 2>/dev/null | tail -8
# reap our workerd
for pid in $(ps -axo pid,command | grep "workerd-vfs.bin serve --binary" | grep -v grep | awk '{print $1}'); do kill -9 $pid 2>/dev/null; done
