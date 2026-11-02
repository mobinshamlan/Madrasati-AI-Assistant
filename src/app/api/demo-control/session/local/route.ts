// Operator sessions have been removed. The demo uses a server database connection.
function removed() {
  return Response.json({ error: "لا يوجد تسجيل دخول للمشغّل. افتح لوحة الديمو مباشرة." }, { status: 410 });
}
export const GET = removed;
export const POST = removed;
export const DELETE = removed;
