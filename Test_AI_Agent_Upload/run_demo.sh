#!/usr/bin/env bash
# يشغّل كل شي للديمو في الخلفية: الـ backend + ngrok + واجهة Next. شغّله مرة قبل العرض.
#   ./run_demo.sh          تشغيل     ./run_demo.sh stop   إيقاف     ./run_demo.sh status  فحص
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
WEB="$(cd "$HERE/.." && pwd)"
RUN="$HERE/.demo"; mkdir -p "$RUN"
PY="$HERE/.venv/bin/python"
if [ ! -x "$PY" ]; then
  echo "تجهيز بيئة Python (مرة وحدة)..."
  python3 -m venv "$HERE/.venv" && "$PY" -m pip install -q -r "$HERE/requirements.txt" || { echo "❌ فشل تجهيز البيئة"; exit 1; }
fi

stop() {
  for n in backend ngrok web; do
    [ -f "$RUN/$n.pid" ] && kill "$(cat "$RUN/$n.pid")" 2>/dev/null; rm -f "$RUN/$n.pid"
  done
  lsof -ti tcp:8000 tcp:3000 2>/dev/null | xargs kill 2>/dev/null
  pkill -f "ngrok http 8000" 2>/dev/null
  pkill -f "uvicorn backend.app:app" 2>/dev/null
  pkill -f next-server 2>/dev/null
  sleep 1
  rm -f "$HERE/Data/public_url.txt"
}

ok()   { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; FAILED=1; }

status() {
  FAILED=0; echo "فحص الديمو:"
  curl -fs http://127.0.0.1:8000/api/health >/dev/null && ok "backend :8000" || fail "backend :8000"
  curl -fs http://127.0.0.1:3000/school >/dev/null && ok "واجهة الموقع :3000 (/assistant و/school)" || fail "واجهة الموقع :3000"
  curl -fs http://127.0.0.1:3000/api/health >/dev/null && ok "بروكسي /api من الموقع للـ backend" || fail "بروكسي /api"
  URL="$(cat "$HERE/Data/public_url.txt" 2>/dev/null)"
  [ -n "$URL" ] && curl -fs "$URL/api/health" -H "ngrok-skip-browser-warning: 1" >/dev/null && ok "ngrok: $URL" || fail "ngrok (تويليو ما يقدر يوصل لجهازك)"
  for k in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM PARENT_PHONE; do
    grep -q "^$k=." "$HERE/.env" 2>/dev/null && ok "$k موجود في .env" || fail "$k ناقص في .env"
  done
  grep -q "^\(OPENAI_API_KEY\|API_KEY\)=." "$HERE/.env" 2>/dev/null && ok "مفتاح OpenAI موجود" || fail "مفتاح OpenAI ناقص"
  return $FAILED
}

case "${1:-start}" in
  stop) stop; echo "تم الإيقاف"; exit 0;;
  status) status; exit $?;;
esac

stop
command -v ngrok >/dev/null || { echo "ngrok غير مثبت"; exit 1; }
rm -f "$HERE/Data/runtime_state.json"   # بداية نظيفة للعرض (تفضيلات وأحداث جديدة)

( cd "$HERE" && nohup "$PY" -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 >"$RUN/backend.log" 2>&1 & echo $! >"$RUN/backend.pid" )
nohup ngrok http 8000 --log=stdout >"$RUN/ngrok.log" 2>&1 & echo $! >"$RUN/ngrok.pid"

URL=""
for _ in $(seq 1 30); do
  URL="$(curl -fs http://127.0.0.1:4040/api/tunnels | "$PY" -c 'import sys,json;t=json.load(sys.stdin)["tunnels"];print(next((x["public_url"] for x in t if x["public_url"].startswith("https")),""))' 2>/dev/null)"
  [ -n "$URL" ] && break; sleep 1
done
[ -n "$URL" ] && echo "$URL" >"$HERE/Data/public_url.txt" || echo "⚠️ ما طلع رابط ngrok (راجع $RUN/ngrok.log)"

if [ ! -f "$WEB/.next/BUILD_ID" ] || [ "${REBUILD:-0}" = 1 ]; then
  echo "بناء الموقع (مرة وحدة، ياخذ دقيقة)..."
  ( cd "$WEB" && npm run build >"$RUN/build.log" 2>&1 ) || { echo "❌ فشل البناء، راجع $RUN/build.log"; exit 1; }
fi
( cd "$WEB" && nohup npm run start -- -p 3000 >"$RUN/web.log" 2>&1 </dev/null & echo $! >"$RUN/web.pid" )

for _ in $(seq 1 40); do curl -fs http://127.0.0.1:3000/school >/dev/null && break; sleep 1; done
status
echo
echo "ولي الأمر:  http://localhost:3000/assistant"
echo "المدرسة:    http://localhost:3000/school   (school / school123)"
