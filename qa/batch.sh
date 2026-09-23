#!/usr/bin/env bash
# Background batch for the remaining viewports (see REFERENCE_AUDIT_V2.md).
export RECREATION_URL=${RECREATION_URL:-http://localhost:4173/}
cd "$(dirname "$0")/.."
ONLY=ours TIER=medium node qa/compare.mjs 390 844 mobile all > qa/out/ours_390.log 2>&1
for v in "1920 1080" "1366 768" "1024 768"; do ONLY=ours TIER=medium node qa/compare.mjs $v desktop quick > "qa/out/ours_${v/ /x}.log" 2>&1; done
for v in "768 1024" "430 932" "375 812"; do ONLY=ours TIER=medium node qa/compare.mjs $v mobile quick > "qa/out/ours_${v/ /x}.log" 2>&1; done
for v in "1366 768" "1024 768"; do node qa/states.mjs ours $v > "qa/out/states_ours_${v/ /x}.log" 2>&1; done
for v in "768 1024" "390 844"; do node qa/states.mjs ours $v mobile > "qa/out/states_ours_${v/ /x}.log" 2>&1; done
node qa/states.mjs reference 390 844 mobile > qa/out/states_ref_390.log 2>&1
echo done > qa/out/batch.done
