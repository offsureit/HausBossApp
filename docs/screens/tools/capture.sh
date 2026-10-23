#!/usr/bin/env bash
# Captures every screen for docs/screens on the Android emulator (dev client + Metro against the local seeded API).
# Needs: emulator unlocked, app at the sign-in screen, the seed data (Priya Patel job etc.). Output: $1 (full-size PNGs).
# Then: python3 docs/screens/make-pdf.py docs/screens/source docs/screens/captions.txt docs/screens/HausBoss-mobile-screens.pdf docs/screens
set -u
# The on-screen keyboard is switched off for the run (a floating Gboard intercepts taps); typing still works.
adb shell ime disable com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME >/dev/null 2>&1
trap 'adb shell ime enable com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME >/dev/null 2>&1; adb shell ime set com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME >/dev/null 2>&1' EXIT
O=${1:?output dir}; mkdir -p "$O"; T=$(dirname "$0")
JOB=${JOB:-8cc8b5fe-4172-4e8d-b620-33a9940724d0}; CUSTOMER=${CUSTOMER:-4d11d525-6103-4ed0-982a-576d0c221d9f}
ESTIMATE=${ESTIMATE:-404165e8-b07d-4228-bde3-0973625abd92}; TOKEN=${TOKEN:-a58ee78e-d22b-42be-b192-f9ea54bf4111}; CONV=${CONV:-5d3d09c2-032e-40c1-85fe-9e49efaf2835}
TECH=${TECH:-hausboss.alpha.tech@yopmail.com}; OWNER=${OWNER:-hausboss.alpha.owner@yopmail.com}; PASS=${PASS:-Password123!}
shot(){ sleep ${2:-3}; adb exec-out screencap -p > "$O/$1.png"; echo "shot $1"; }
tap(){ python3 "$T/tap.py" "$1" ${2:-} >/dev/null 2>&1; }
link(){ adb shell am start -a android.intent.action.VIEW -d "hausboss://$1" >/dev/null 2>&1; }
login(){ tap login-email; sleep 1; adb shell input text "$1"; sleep 1; tap login-password; sleep 1; adb shell input text "$PASS"; sleep 1; tap login-submit; sleep 12; tap "Not now"; }
signout(){ link more; sleep 2; adb shell input swipe 540 2000 540 600 300; sleep 2; tap "Sign out"; sleep 2; tap "SIGN OUT"; sleep 6; }
tabs_scroll(){ y=$(adb exec-out uiautomator dump /dev/stdout 2>/dev/null | grep -o 'text="Estimates"[^>]*bounds="\[[0-9]*,[0-9]*\]' | grep -o '\[[0-9]*,[0-9]*\]' | head -1 | tr -d '[]' | cut -d, -f2); adb shell input swipe 900 $((y+20)) 200 $((y+20)) 400; sleep 2; }

shot 01-login 2; tap "Forgot password?"; shot 02-forgot-password 3; adb shell input keyevent 4; sleep 2
login "$TECH"
shot 03-today 2
link calendar; shot 04-calendar 4
link chat; shot 05-team-chat 4
link messages; shot 06-customer-texts 4
link more; shot 07-more 3
link notifications; shot 08-notifications 4
link search; sleep 2; adb shell input text "Pa"; shot 09-search 3
link job/$JOB; shot 10-job-details 5
for t in Time Media Chat Estimates; do tap "$t"; shot "11-job-$(echo $t | tr A-Z a-z)" 3; done
tabs_scroll; tap Activity; shot 11-job-activity 3; tap Notes; shot 11-job-notes 3
link today; sleep 3; tap "On My Way"; shot 12-location-explainer 3; tap "Not now"; shot 13-on-my-way-sheet 4; tap Cancel; sleep 1
link settings/security; shot 14-security 3
link today; sleep 2; adb shell cmd connectivity airplane-mode enable; shot 15-offline-banner 6; adb shell cmd connectivity airplane-mode disable; sleep 4
adb shell cmd uimode night yes; sleep 3; shot 16-today-dark 2; link job/$JOB; shot 17-job-dark 5; adb shell cmd uimode night no; sleep 2
signout
login "$OWNER"
shot 20-calendar-owner 3
link dashboard; shot 21-dashboard 5
adb shell input swipe 540 2000 540 900 300; sleep 2; shot 22-dashboard-roster 2
row=$(adb exec-out uiautomator dump /dev/stdout 2>/dev/null | grep -o 'content-desc="Tom Tech: [^"]*"' | head -1 | sed 's/content-desc="//;s/"$//'); tap "$row"; shot 23-employee-sheet 4
b=$(adb exec-out uiautomator dump /dev/stdout 2>/dev/null | grep -o '<node[^>]*content-desc="Reassign"[^>]*>' | head -1 | grep -o 'bounds="\[[0-9]*,[0-9]*\]' | grep -o '[0-9]*,[0-9]*'); adb shell input tap $(( ${b%,*} + 140 )) $(( ${b#*,} + 48 )); shot 24-reassign-sheet 4; adb shell input keyevent 4; sleep 2
link job/new; shot 25-new-job 5
link customers; shot 26-customers 4
link customers/$CUSTOMER; shot 27-customer 5
link customers/new; shot 28-new-customer 4
link estimate/$ESTIMATE; shot 29-estimate-editor 5
link chat; shot 30-team-chat-owner 4; tap "Jane Homeowner"; shot 31-chat-thread 4
link messages; shot 32-customer-texts-owner 4; link messages/$CONV; shot 33-text-thread 5
for p in products inventory categories team leads billing; do link settings/$p; shot "34-settings-$p" 4; done
adb shell am start -n app.hausboss.mobile/.MainActivity -a android.intent.action.VIEW -d "https://hausboss.app/estimate/$TOKEN" >/dev/null 2>&1; shot 35-public-estimate 5
adb shell cmd uimode night yes; sleep 2; link dashboard; shot 36-dashboard-dark 5; link calendar; shot 37-calendar-dark 4; adb shell cmd uimode night no; sleep 2
echo done
