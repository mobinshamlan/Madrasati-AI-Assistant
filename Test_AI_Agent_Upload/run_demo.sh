#!/usr/bin/env bash
# يشغّل الديمو في الخلفية: الـ backend (Python) + ngrok + الموقع (Next).
#   ./run_demo.sh          تشغيل     ./run_demo.sh stop   إيقاف     ./run_demo.sh status  فحص
# الأسرار ما تنرفع: الموقع يقرأ ../.env.local (Supabase + حسابات الديمو + TAMMENI_DISPATCH_SECRET)،
# والـ backend يقرأ ./.env (Supabase + Twilio + PARENT_PHONE...). التفاصيل في docs/demo-control.md.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
WEB="$(cd "$HERE/.." && pwd)"
RUN="$HERE/.demo"; mkdir -p "$RUN"
PY="$HERE/.venv/bin/python"
if [ ! -x "$PY" ]; then
  echo "تجهيز بيئة Python (مرة وحدة)..."
  python3 -m venv "$HERE/.venv" && "$PY" -m pip install -q -r "$HERE/requirements.txt" || { echo "❌ فشل تجهيز البيئة"; exit 1; }
fi

# Only stop processes started by this launcher, never every server on a port.
stop_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do stop_tree "$child"; done
  kill "$1" 2>/dev/null || true
}

stop() {
  local n pid expected cwd args
  if [ "$(uname -s)" = Darwin ]; then
    "$PY" "$HERE/manage_backend.py" stop
  fi
  for n in backend ngrok web; do
    [ -f "$RUN/$n.pid" ] || continue
    pid="$(cat "$RUN/$n.pid")"
    case "$pid" in ''|*[!0-9]*) echo "Invalid saved PID for $n; skipped"; continue;; esac
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    args="$(ps -p "$pid" -o command= 2>/dev/null)"
    expected="$HERE"; [ "$n" = web ] && expected="$WEB"
    if [ "$cwd" = "$expected" ]; then
      case "$n:$args" in
        backend:*uvicorn*backend.app:app*|ngrok:*ngrok*http*8000*|web:*npm*dev*) stop_tree "$pid";;
        *) echo "Saved PID for $n no longer matches; left running";;
      esac
    fi
    rm -f "$RUN/$n.pid"
  done
}

ok()   { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; FAILED=1; }
has()  { grep -q "^$2=." "$1" 2>/dev/null; }   # ملف، مفتاح — بدون طباعة القيمة

status() {
  FAILED=0; echo "فحص الديمو:"
  curl -fs http://127.0.0.1:8000/api/health >/dev/null && ok "backend :8000" || fail "backend :8000"
  curl -fs http://127.0.0.1:3000/welcome >/dev/null && ok "الموقع :3000" || fail "الموقع :3000"
  URL="$(cat "$RUN/public_url" 2>/dev/null)"
  if [ "${1:-}" != local ]; then
    [ -n "$URL" ] && curl --max-time 5 -fs "$URL/api/health" -H "ngrok-skip-browser-warning: 1" >/dev/null && ok "ngrok: $URL" || fail "ngrok (Twilio ما يقدر يوصل لجهازك)"
  fi
  for k in SUPABASE_URL SUPABASE_PUBLISHABLE_KEY TAMMENI_DISPATCH_SECRET; do has "$HERE/.env" $k && ok "$k في .env" || fail "$k ناقص في Test_AI_Agent_Upload/.env"; done
  for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY TAMMENI_DEMO_PARENT_EMAIL TAMMENI_DEMO_PARENT_PASSWORD TAMMENI_DEMO_OPERATOR_EMAIL TAMMENI_DEMO_OPERATOR_PASSWORD TAMMENI_DISPATCH_SECRET; do
    has "$WEB/.env.local" $k && ok "$k في .env.local" || fail "$k ناقص في .env.local"
  done
  PROV="$(grep "^TAMMENI_PROVIDER=" "$HERE/.env" 2>/dev/null | cut -d= -f2)"; echo "  ℹ️  المزود: ${PROV:-mock} (mock = ما يرسل شي)"
  if [ "${PROV:-mock}" = twilio ]; then
    for k in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM PARENT_PHONE TAMMENI_ALLOWED_DESTINATIONS OPENAI_API_KEY; do has "$HERE/.env" $k && ok "$k في .env" || fail "$k ناقص في .env"; done
  fi
  return $FAILED
}

case "${1:-start}" in
  stop) stop; echo "تم الإيقاف"; exit 0;;
  status) status; exit $?;;
esac

# Reuse live managed processes only after stopping this launcher's own tree.
stop
for port in 8000 3000; do
  if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use. Stop that server explicitly or use it separately."
    exit 1
  fi
done
if [ "${1:-start}" != local ]; then
command -v ngrok >/dev/null || { echo "ngrok غير مثبت"; exit 1; }

( cd "$HERE"; exec ngrok http 8000 --log=stdout ) >"$RUN/ngrok.log" 2>&1 </dev/null & echo $! >"$RUN/ngrok.pid"
URL=""
for _ in $(seq 1 30); do
  URL="$(curl -fs http://127.0.0.1:4040/api/tunnels | "$PY" -c 'import sys,json;t=json.load(sys.stdin)["tunnels"];print(next((x["public_url"] for x in t if x["public_url"].startswith("https")),""))' 2>/dev/null)"
  [ -n "$URL" ] && break; sleep 1
done
[ -n "$URL" ] && echo "$URL" >"$RUN/public_url" || echo "⚠️ ما طلع رابط ngrok (راجع $RUN/ngrok.log)"

else
  URL=""
  echo "Local mode: SMS needs no tunnel. Voice requires PUBLIC_URL."
fi

# PUBLIC_URL من ngrok (يغلب أي قيمة قديمة في .env) عشان مكالمات Twilio ترجع لجهازك.
if [ "$(uname -s)" = Darwin ]; then
  PUBLIC_URL="${URL:-${PUBLIC_URL:-}}" "$PY" "$HERE/manage_backend.py" start
else
( cd "$HERE"; export PUBLIC_URL="${URL:-${PUBLIC_URL:-}}"; exec "$PY" -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 ) >"$RUN/backend.log" 2>&1 </dev/null & echo $! >"$RUN/backend.pid"
fi

# الموقع بوضع التطوير (npm run dev): هذا الوضع الوحيد اللي تشتغل فيه لوحة /demo-control بدون تسجيل دخول
# (TAMMENI_LOCAL_OPERATOR=1 في .env.local، ومن هذا الجهاز فقط). وبعد تغيير .env.local ما يحتاج إعادة بناء.
( cd "$WEB"; exec npm run dev -- -p 3000 ) >"$RUN/web.log" 2>&1 </dev/null & echo $! >"$RUN/web.pid"

for _ in $(seq 1 60); do curl -fs http://127.0.0.1:3000/welcome >/dev/null && break; sleep 1; done
status "${1:-start}"
echo
echo "ولي الأمر:  http://localhost:3000/welcome  ثم «ابدأ مع طمّني»"
echo "لوحة الديمو: http://localhost:3000/demo-control   (تفتح مباشرة بدون دخول، من هذا الجهاز فقط)"
