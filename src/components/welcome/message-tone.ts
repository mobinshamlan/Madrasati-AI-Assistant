// The text message's tone, through Web Audio. Browsers allow a sound only after the visitor has pressed
// something, so a press opens the audio with an empty sound: nothing at all is heard on the press, because
// the tone itself is not touched until the message arrives.

const FILE = "/audio/message.m4a";

type Audio = typeof AudioContext;

let context: AudioContext | null = null;
let bytes: Promise<ArrayBuffer> | null = null;
let tone: Promise<AudioBuffer> | null = null;

const load = () => (bytes ??= fetch(FILE).then((reply) => reply.arrayBuffer()));

const decoded = (audio: AudioContext) =>
  (tone ??= load().then((data) => new Promise<AudioBuffer>((ok, failed) => void audio.decodeAudioData(data.slice(0), ok, failed))));

function open() {
  const Context: Audio | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Audio }).webkitAudioContext;
  if (!Context) return;
  // On iPhones this lets the tone sound like other media, also with the ringer switched to silent.
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  context ??= new Context();
  if (context.state !== "running") {
    context.resume().catch(() => {});
    const empty = context.createBufferSource();
    empty.buffer = context.createBuffer(1, 1, 22050);
    empty.connect(context.destination);
    empty.start(0);
  }
  decoded(context).catch(() => {
    tone = null;
  });
}

/** Opens the audio on the visitor's presses. Returns the function that stops listening. */
export function readyMessageTone() {
  load().catch(() => {
    bytes = null;
  });
  // None of these makes a sound, so every one a browser might count as a press is listened to.
  const events = ["pointerup", "touchend", "mousedown", "click", "keydown"] as const;
  events.forEach((name) => document.addEventListener(name, open, true));
  return () => events.forEach((name) => document.removeEventListener(name, open, true));
}

/**
 * Sounds the tone now. With no press yet the browser keeps the audio closed, and then nothing is queued:
 * a tone waiting in a closed player would go off on the visitor's next press instead.
 */
export async function soundMessageTone() {
  const audio = context;
  if (!audio) return;
  const asked = Date.now();
  if (audio.state !== "running") await Promise.race([audio.resume().catch(() => {}), new Promise((wake) => setTimeout(wake, 400))]);
  const buffer = await decoded(audio).catch(() => null);
  if (!buffer || audio.state !== "running" || Date.now() - asked > 1500) return;
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.connect(audio.destination);
  source.start(0);
}
