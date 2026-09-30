#!/usr/bin/env bash
# Offline ART check without a device/emulator (Linux x86_64 host, needs sudo for loop mounts + chroot).
#
# Extracts ART from an Android emulator x86_64 system image, then runs that
# image's dex2oat64 with --compiler-filter=everything on the APK. That runs the
# real ART verifier and the optimizing compiler (the same backend the JIT uses)
# on every method, including the Sentry-woven RealCall.getResponseWithInterceptorChain.
#
# usage: scripts/art-dex2oat-check.sh <api-level> <path/to/app-release.apk>
# deps:  sdkmanager on PATH or $ANDROID_HOME, python3, e2fsprogs, unzip, sudo
set -euo pipefail
API=${1:?api level, e.g. 35}; APK=$(realpath "${2:?apk path}")
: "${ANDROID_HOME:?set ANDROID_HOME}"
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=${WORK:-/tmp/art-check-$API}; ROOT=$WORK/root
SI=$ANDROID_HOME/system-images/android-$API/default/x86_64
[ -f "$SI/system.img" ] || yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "system-images;android-$API;default;x86_64" >/dev/null

if [ ! -x "$ROOT/apex/com.android.art/bin/dex2oat64" ]; then
  mkdir -p "$WORK/mnt" "$WORK/ap"
  # system.img is a GPT disk; partition 2 is the dynamic-partitions "super" image
  start=$(sudo fdisk -l "$SI/system.img" | awk '/system.img2/{print $2}')
  count=$(sudo fdisk -l "$SI/system.img" | awk '/system.img2/{print $4}')
  dd if="$SI/system.img" of="$WORK/super.img" bs=512 skip="$start" count="$count" status=none
  python3 "$HERE/lpunpack.py" "$WORK/super.img" "$WORK/parts"
  sudo mount -o loop,ro "$WORK/parts/system.img" "$WORK/mnt"
  sudo mkdir -p "$ROOT" && sudo cp -a "$WORK/mnt/." "$ROOT/"
  for n in com.android.art com.android.runtime com.android.i18n com.android.os.statsd com.android.tzdata com.android.conscrypt; do
    a=$(ls "$WORK/mnt/system/apex/" | grep -E "^$n\.c?apex$" | head -1) || continue
    d="$WORK/apex/$n"; rm -rf "$d"; mkdir -p "$d"; (cd "$d" && unzip -q "$WORK/mnt/system/apex/$a")
    if [ -f "$d/original_apex" ]; then mkdir "$d/o"; (cd "$d/o" && unzip -q ../original_apex); P=$d/o/apex_payload.img; else P=$d/apex_payload.img; fi
    sudo mount -o loop,ro "$P" "$WORK/ap"; sudo mkdir -p "$ROOT/apex/$n"; sudo cp -a "$WORK/ap/." "$ROOT/apex/$n/"; sudo umount "$WORK/ap"
  done
  sudo umount "$WORK/mnt"
fi

LP=/apex/com.android.art/lib64:/apex/com.android.i18n/lib64:/apex/com.android.os.statsd/lib64:/system/lib64
ENVV=(LD_LIBRARY_PATH=$LP ANDROID_ROOT=/system ANDROID_ART_ROOT=/apex/com.android.art ANDROID_I18N_ROOT=/apex/com.android.i18n ANDROID_TZDATA_ROOT=/apex/com.android.tzdata ANDROID_DATA=/data)
mountpoint -q "$ROOT/proc" || sudo mount -t proc proc "$ROOT/proc"
mountpoint -q "$ROOT/dev" || sudo mount --bind /dev "$ROOT/dev"
run() { sudo env "${ENVV[@]}" chroot "$ROOT" "$@" 2> >(grep -v linkerconfig >&2); }

BCP=$(run /apex/com.android.art/bin/oatdump --oat-file=/system/framework/x86_64/boot.oat --header-only | awk -F' = ' '/^bootclasspath/{print $2}')
sudo mkdir -p "$ROOT/data/local/tmp"; sudo cp "$APK" "$ROOT/data/local/tmp/app.apk"
echo "== ART from $(grep ro.system.build.fingerprint "$SI/build.prop" | cut -d= -f2)"
echo "== dex2oat64 --compiler-filter=everything"
run /apex/com.android.art/bin/dex2oat64 \
  --runtime-arg -Xbootclasspath:"$BCP" --runtime-arg -Xbootclasspath-locations:"$BCP" \
  --boot-image=/system/framework/boot.art --dex-file=/data/local/tmp/app.apk \
  --oat-file=/data/local/tmp/app.odex --instruction-set=x86_64 --compiler-filter=everything -j1
echo "dex2oat exit=$?"

# RealCall's obfuscated name comes from the R8 mapping next to the APK build
MAP=$(dirname "$APK")/../../mapping/release/mapping.txt
CLS=$(awk '/^okhttp3.internal.connection.RealCall ->/{sub(":","",$3); print $3}' "$MAP" 2>/dev/null || true)
MTH=$(awk -v c="$CLS" '$0 ~ "^okhttp3.internal.connection.RealCall ->"{f=1;next} f&&/^[^ #]/{f=0} f&&/getResponseWithInterceptorChain/{print $NF; exit}' "$MAP" 2>/dev/null || true)
if [ -n "$CLS" ] && [ -n "$MTH" ]; then
  echo "== RealCall -> $CLS, getResponseWithInterceptorChain -> $MTH"
  run /apex/com.android.art/bin/oatdump --oat-file=/data/local/tmp/app.odex --boot-image=/system/framework/boot.art \
    --runtime-arg -Xbootclasspath:"$BCP" --runtime-arg -Xbootclasspath-locations:"$BCP" \
    --class-filter="$CLS" --method-filter="$MTH" > "$WORK/oatdump.txt"
  grep -E "L${CLS//./\/}; \(offset" "$WORK/oatdump.txt"
  awk -v m="$CLS.$MTH()" 'index($0,m)&&/dex_method_idx/{f=1} f&&/CODE: \(code_offset/{print "  " $0; exit}' "$WORK/oatdump.txt"
fi
