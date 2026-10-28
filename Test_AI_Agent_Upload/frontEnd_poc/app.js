
const $ = (id) => document.getElementById(id);
const startButton = $("start"), endButton = $("end"), statusText = $("status"), dot = $("status-dot");
const transcript = $("transcript"), answer = $("answer"), remoteAudio = $("remote-audio"), errorBox = $("error");
let peer, channel, microphone, liveId, userTranscript = "", assistantTranscript = "", lookupBusy = false, transcriptTimeline = [], lastLookupOffset = 0;

function state(text, active = false) { statusText.textContent = text; dot.className = `dot${active ? " active" : ""}`; }
function stage(name, text, mode = "") { const el = document.querySelector(`[data-step="${name}"]`); el.querySelector("small").textContent = text; el.className = mode; }
function showError(message) { errorBox.textContent = message; errorBox.hidden = false; state("تعذر بدء أو استمرار المحادثة"); }
function setText(el, value) { el.textContent = value || "—"; el.classList.toggle("placeholder", !value); }
function sendEvent(event) { if (channel?.readyState === "open") channel.send(JSON.stringify(event)); }

async function postJson(path, body) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail?.message || data.detail || `تعذر الاتصال بالخادم (${response.status})`);
  return data;
}

async function start() {
  errorBox.hidden = true;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return showError("افتح الصفحة على localhost أو HTTPS واسمح باستخدام الميكروفون.");
  if (!window.confirm("سيبدأ اتصال GPT-Live مدفوع بسعر ‎$0.05 للدقيقة، محسوب بالثانية. إنشاء الجلسة والحديث يترتب عليهما رسوم. هل توافق على بدء جلسة الآن؟")) return;
  startButton.disabled = true; state("نطلب إذن الميكروفون…");
  try {
    microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
    stage("recording", "يعمل", "working");
    peer = new RTCPeerConnection();
    peer.ontrack = (event) => { remoteAudio.srcObject = event.streams[0] || new MediaStream([event.track]); remoteAudio.play().catch(() => {}); stage("playback", "يصل الصوت", "working"); };
    peer.onconnectionstatechange = () => { if (peer?.connectionState === "failed") showError("فشل اتصال الصوت المباشر."); };
    microphone.getTracks().forEach((track) => peer.addTrack(track, microphone));
    channel = peer.createDataChannel("live-events");
    channel.onopen = () => state("متصل — تفضل بالكلام", true);
    channel.onmessage = (event) => { try { onLiveEvent(JSON.parse(event.data)); } catch { /* ignore malformed server event */ } };
    channel.onerror = () => showError("تعذر استقبال أحداث المحادثة.");
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIce(peer);
    state("جارٍ إنشاء جلسة GPT-Live…");
    const created = await postJson("/api/live/session", { sdp: peer.localDescription.sdp });
    liveId = created.session_id;
    await peer.setRemoteDescription({ type: "answer", sdp: created.sdp });
    state("بانتظار تأكيد بدء الجلسة…");
    endButton.disabled = false;
  } catch (error) { await cleanup(); showError(error.message || "تعذر بدء جلسة الصوت."); startButton.disabled = false; }
}

remoteAudio.addEventListener("playing", () => stage("playback", "يشغّل الرد", "working"));
remoteAudio.addEventListener("ended", () => stage("playback", "اكتمل الرد", "done"));
remoteAudio.addEventListener("error", () => stage("playback", "تعذر تشغيل الصوت", "error"));

function waitForIce(connection) {
  if (connection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("انتهت مهلة إعداد اتصال الصوت.")), 12000);
    connection.addEventListener("icegatheringstatechange", () => {
      if (connection.iceGatheringState === "complete") { clearTimeout(timeout); resolve(); }
    });
  });
}

async function onLiveEvent(event) {
  if (event.type === "session.started") { liveId = event.session?.id || liveId; state("المحادثة جاهزة — تحدث الآن", true); stage("recording", "يستقبل الصوت", "done"); return; }
  if (event.type === "session.input_transcript.delta") { userTranscript += event.delta || ""; transcriptTimeline.push({ text: event.delta || "", start: event.start_ms || 0, end: event.end_ms || 0 }); setText(transcript, userTranscript); stage("transcript", "جارٍ التفريغ", "working"); return; }
  if (event.type === "session.output_transcript.delta") { assistantTranscript += event.delta || ""; setText(answer, assistantTranscript); stage("answer", "يرد GPT-Live", "working"); return; }
  if (event.type === "session.delegation.created") { await handleDelegation(event); return; }
  if (event.type === "session.output_audio.started") stage("playback", "يشغّل الرد", "working");
  if (event.type === "session.output_audio_stopped") stage("playback", "اكتمل الرد", "done");
  if (event.type === "session.closed") { await cleanup(); state("انتهت المحادثة"); }
  if (event.type === "error") showError(event.error?.message || "أرسل GPT-Live خطأ.");
}

async function handleDelegation(event) {
  const delegationId = event.delegation?.id;
  if (!delegationId || lookupBusy) return;
  lookupBusy = true; stage("answer", "يجري البحث في بيانات الطالب", "working");
  sendEvent({ type: "session.thinking.append", event_id: crypto.randomUUID(), delegation_id: delegationId, content: "" });
  try {
    // Transcript delivery is uneven. Allow the matching fragment a short window to arrive,
    // then select the transcript slice aligned to the delegation timestamp.
    await new Promise((resolve) => setTimeout(resolve, 600));
    const until = Number(event.offset_ms || Infinity);
    let question = transcriptTimeline.filter((part) => part.end > lastLookupOffset && part.start <= until + 1500).map((part) => part.text).join("").trim();
    if (!question) question = transcriptTimeline.slice(-4).map((part) => part.text).join("").trim();
    if (!question) throw new Error("لم يصل تفريغ السؤال بعد؛ أعد طرح السؤال بوضوح.");
    lastLookupOffset = Number.isFinite(until) ? until : (transcriptTimeline.at(-1)?.end || lastLookupOffset);
    const result = await postJson("/api/student/lookup", { question, session_id: liveId });
    sendEvent({ type: "session.commentary.append", event_id: crypto.randomUUID(), delegation_id: delegationId, content: JSON.stringify(result) });
    stage("answer", "تم التحقق من بيانات JSON", "done");
  } catch (error) {
    sendEvent({ type: "session.commentary.append", event_id: crypto.randomUUID(), delegation_id: delegationId, content: "تعذر الوصول إلى بيانات الطالب المحلية. أخبر المستخدم أن البيانات غير متاحة حالياً، ولا تخمن." });
    stage("answer", "تعذر البحث", "error");
    showError(error.message || "تعذر البحث في بيانات الطالب.");
  } finally { lookupBusy = false; }
}

async function end() {
  if (channel?.readyState === "open") sendEvent({ type: "session.close" });
  if (liveId) fetch(`/api/live/session/${encodeURIComponent(liveId)}`, { method: "DELETE" }).catch(() => {});
  await cleanup(); state("انتهت المحادثة");
}

async function cleanup() {
  microphone?.getTracks().forEach((track) => track.stop()); microphone = null;
  channel?.close(); channel = null;
  peer?.close(); peer = null;
  remoteAudio.srcObject = null;
  liveId = null; startButton.disabled = false; endButton.disabled = true;
}

startButton.addEventListener("click", start);
endButton.addEventListener("click", end);
window.addEventListener("pagehide", () => { microphone?.getTracks().forEach((track) => track.stop()); peer?.close(); });
