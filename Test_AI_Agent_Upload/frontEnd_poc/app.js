const $ = (id) => document.getElementById(id);
const selector=$("student-select"), info=$("student-info"), empty=$("empty-state"), chatPanel=$("chat-panel"), messages=$("messages");
const input=$("message-input"), send=$("send"), form=$("chat-form");
const startButton=$("start"), endButton=$("end"), statusText=$("status"), dot=$("status-dot");
const transcript=$("transcript"), answer=$("answer"), remoteAudio=$("remote-audio"), errorBox=$("error");
let studentId="", conversationId="", peer, channel, microphone, liveId, userTranscript="", assistantTranscript="", lookupBusy=false, transcriptTimeline=[], lastLookupOffset=0, sending=false, greetingText="", greetingSent=false;
function state(text,active=false){statusText.textContent=text;dot.className="dot"+(active?" active":"");}
function setText(el,value){el.textContent=value||"—";el.classList.toggle("placeholder",!value);}
function showError(message){errorBox.textContent=message;errorBox.hidden=false;}
async function request(path,options){const r=await fetch(path,options||{});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.detail?.message||data.detail||"تعذر الاتصال بالخادم.");return data;}
function addMessage(role,text){const article=document.createElement("article");article.className="message "+role;const label=document.createElement("b");label.textContent=role==="user"?"أنتِ":"لولوة";const body=document.createElement("p");body.textContent=text;article.append(label,body);messages.append(article);article.scrollIntoView({block:"nearest"});}
function clearConversation(){messages.replaceChildren();setText(transcript,"");setText(answer,"");userTranscript="";assistantTranscript="";transcriptTimeline=[];lastLookupOffset=0;errorBox.hidden=true;}
async function selectStudent(id){
 if(liveId) await end();
 const previous=conversationId;
 studentId=id;conversationId="";greetingText="";greetingSent=false;clearConversation();
 const selected=selector.selectedOptions[0];
 empty.hidden=Boolean(id);chatPanel.hidden=!id;input.disabled=!id;send.disabled=!id;startButton.disabled=!id;
 if(!id){info.textContent="اختاري طالباً لبدء محادثة.";return;}
 info.textContent=selected.dataset.details||"";
 try{const result=await request("/api/conversations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({student_id:id,previous_conversation_id:previous})});conversationId=result.conversation_id;greetingText=result.greeting||"";if(greetingText)addMessage("assistant",greetingText);}
 catch(e){showError(e.message);input.disabled=true;send.disabled=true;}
}
async function loadStudents(){
 try{const list=await request("/api/students");selector.replaceChildren(new Option("اختاري طالباً",""));for(const s of list){const details=[s.grade,s.school].filter(Boolean).join(" · ");const o=new Option(s.name,s.id);o.dataset.details=details;selector.add(o);}selector.disabled=false;}
 catch(e){selector.replaceChildren(new Option("تعذر تحميل قائمة الطلاب",""));selector.disabled=true;empty.textContent=e.message;}
}
selector.addEventListener("change",()=>selectStudent(selector.value));
form.addEventListener("submit",async(event)=>{
 event.preventDefault();const message=input.value.trim();if(!message||!studentId||!conversationId||sending)return;
 sending=true;send.disabled=true;addMessage("user",message);input.value="";
 const pending=document.createElement("article");pending.className="message assistant pending";pending.textContent="أبحث في بيانات الطالب…";messages.append(pending);
 try{const data=await request("/api/student/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({student_id:studentId,conversation_id:conversationId,message})});pending.remove();addMessage("assistant",data.answer);}
 catch(e){pending.remove();addMessage("assistant",e.message);}
 finally{sending=false;send.disabled=!studentId;}
});
function sendEvent(event){if(channel?.readyState==="open")channel.send(JSON.stringify(event));}
async function start(){
 errorBox.hidden=true;if(!studentId)return showError("اختاري طالباً أولاً.");
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)return showError("افتحي الصفحة على localhost أو HTTPS واسمحي باستخدام الميكروفون.");
 if(!window.confirm("بدء جلسة GPT-Live صوتية. قد تترتب عليها رسوم لدى مزود الخدمة. هل توافقين على بدء الجلسة الآن؟"))return;
 startButton.disabled=true;state("نطلب إذن الميكروفون…");
 try{
  microphone=await navigator.mediaDevices.getUserMedia({audio:true});peer=new RTCPeerConnection();
  peer.ontrack=(event)=>{remoteAudio.srcObject=event.streams[0]||new MediaStream([event.track]);remoteAudio.play().catch(()=>{});};
  peer.onconnectionstatechange=()=>{if(peer?.connectionState==="failed")showError("فشل اتصال الصوت المباشر.");};
  microphone.getTracks().forEach((track)=>peer.addTrack(track,microphone));
  channel=peer.createDataChannel("live-events");channel.onopen=()=>state("متصل — تفضلي بالكلام",true);
  channel.onmessage=(event)=>{try{onLiveEvent(JSON.parse(event.data));}catch{}};
  channel.onerror=()=>showError("تعذر استقبال أحداث المحادثة.");
  const offer=await peer.createOffer();await peer.setLocalDescription(offer);await waitForIce(peer);
  const created=await request("/api/live/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sdp:peer.localDescription.sdp,student_id:studentId,greet:!greetingSent})});
  liveId=created.session_id;greetingText=created.greeting||greetingText;await peer.setRemoteDescription({type:"answer",sdp:created.sdp});endButton.disabled=false;state("بانتظار بدء جلسة الصوت…");
 }catch(e){await cleanup();showError(e.message);startButton.disabled=false;}
}
function waitForIce(c){if(c.iceGatheringState==="complete")return Promise.resolve();return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error("انتهت مهلة إعداد الصوت.")),12000);c.addEventListener("icegatheringstatechange",()=>{if(c.iceGatheringState==="complete"){clearTimeout(timeout);resolve();}});});}
async function onLiveEvent(event){
 if(event.type==="session.started"){liveId=event.session?.id||liveId;state("المحادثة جاهزة — تحدثي الآن",true);if(greetingText&&!greetingSent){greetingSent=true;sendEvent({type:"session.commentary.append",event_id:crypto.randomUUID(),delegation_id:null,content:"ابدئي الآن بتحية ولي الأمر بهذه العبارة مرة واحدة، ثم توقفي للاستماع: "+greetingText});}return;}
 if(event.type==="session.input_transcript.delta"){userTranscript+=event.delta||"";transcriptTimeline.push({text:event.delta||"",start:event.start_ms||0,end:event.end_ms||0});setText(transcript,userTranscript);return;}
 if(event.type==="session.output_transcript.delta"){assistantTranscript+=event.delta||"";setText(answer,assistantTranscript);return;}
 if(event.type==="session.delegation.created"){await handleDelegation(event);return;}
 if(event.type==="session.closed"){await cleanup();state("انتهت المحادثة");}
 if(event.type==="error")showError(event.error?.message||"تعذر استمرار الصوت.");
}
async function handleDelegation(event){
 const did=event.delegation?.id;if(!did||lookupBusy)return;lookupBusy=true;
 sendEvent({type:"session.thinking.append",event_id:crypto.randomUUID(),delegation_id:did,content:""});
 try{
  await new Promise((resolve)=>setTimeout(resolve,500));const until=Number(event.offset_ms||Infinity);
  let question=transcriptTimeline.filter((p)=>p.end>lastLookupOffset&&p.start<=until+1500).map((p)=>p.text).join("").trim();
  if(!question)question=transcriptTimeline.slice(-4).map((p)=>p.text).join("").trim();if(!question)throw new Error("ما وصلني السؤال بوضوح، أعيديه لو سمحتي.");
  lastLookupOffset=Number.isFinite(until)?until:(transcriptTimeline.at(-1)?.end||lastLookupOffset);
  const result=await request("/api/student/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,session_id:liveId})});
  sendEvent({type:"session.commentary.append",event_id:crypto.randomUUID(),delegation_id:did,content:JSON.stringify(result)});
 }catch(e){sendEvent({type:"session.commentary.append",event_id:crypto.randomUUID(),delegation_id:did,content:"تعذر الوصول للسجلات. أخبري المستخدم أن البيانات غير متاحة ولا تخمني."});showError(e.message);}
 finally{lookupBusy=false;}
}
async function end(){const id=liveId;if(channel?.readyState==="open")sendEvent({type:"session.close"});if(id)request("/api/live/session/"+encodeURIComponent(id),{method:"DELETE"}).catch(()=>{});await cleanup();state("انتهت المحادثة");}
async function cleanup(){microphone?.getTracks().forEach((t)=>t.stop());microphone=null;channel?.close();channel=null;peer?.close();peer=null;remoteAudio.srcObject=null;liveId=null;startButton.disabled=!studentId;endButton.disabled=true;}
startButton.addEventListener("click",start);endButton.addEventListener("click",end);window.addEventListener("pagehide",()=>{microphone?.getTracks().forEach((t)=>t.stop());peer?.close();});
loadStudents();
