/* MILO cashier-only assistant: local help and read-only summaries. No external AI/API calls. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ui=document.createElement('div');ui.id='miloAssistantRoot';ui.innerHTML=`<button id="miloAssistantFab" type="button" aria-label="فتح مساعد ميلو" aria-controls="miloAssistantPanel" aria-expanded="false"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8.1 8.1 0 0 1-3.6-.85L4 20l1.85-4.9A8.1 8.1 0 0 1 5 11.5a7.5 7.5 0 0 1 15 0Z"/><path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01"/></svg></button><section id="miloAssistantPanel" class="milo-assistant-panel" role="dialog" aria-modal="false" aria-labelledby="miloAssistantTitle" hidden dir="rtl"><header class="milo-assistant-head"><div class="milo-assistant-brand"><div class="milo-assistant-brand-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8.1 8.1 0 0 1-3.6-.85L4 20l1.85-4.9A8.1 8.1 0 0 1 5 11.5a7.5 7.5 0 0 1 15 0Z"/><path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01"/></svg></div><div class="milo-assistant-brand-text"><strong id="miloAssistantTitle">مساعد ميلو</strong><small><span class="milo-assistant-status-dot"></span>نسعد بخدمتك</small></div></div><button id="miloAssistantClose" type="button" aria-label="إغلاق المحادثة"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header><div class="milo-assistant-section-label"><span>محادثة مباشرة</span><span>مـيـلـو</span></div><div class="milo-assistant-messages" id="miloAssistantMessages" aria-live="polite"></div><div class="milo-assistant-quick" id="miloAssistantQuick"><button type="button" id="miloAssistantSupportTab">محادثة الدعم</button><button type="button" data-ask="مبيعات اليوم">مبيعات اليوم</button><button type="button" data-ask="المنتجات الناقصة">المنتجات الناقصة</button><button type="button" data-ask="كيف أستخدم شاشة المطبخ؟">شاشة المطبخ</button><button type="button" data-ask="كيف أرسل فاتورة للجوال؟">الفاتورة للجوال</button></div><form id="miloAssistantForm" class="milo-assistant-form"><div class="milo-chat-compose"><div class="milo-chat-file-preview" id="miloAssistantFilePreview" hidden></div><textarea id="miloAssistantInput" rows="2" maxlength="350" placeholder="اكتب رسالتك هنا..." aria-label="اكتب رسالتك"></textarea><div class="milo-chat-compose-actions"><label id="miloAssistantAttachLabel" class="milo-chat-attach" for="miloAssistantFile" title="إرفاق صورة أو PDF" aria-label="إرفاق ملف"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5L13 3a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.2-8.2"/></svg></label><input id="miloAssistantFile" type="file" accept="image/png,image/jpeg,application/pdf" hidden><button type="submit" aria-label="إرسال الرسالة" title="إرسال الرسالة"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 14-7-5 14-2.5-6.5L5 12Z"/><path d="M11.5 12.5 19 5"/></svg><span>إرسال</span></button></div></div></form></section>`;
 document.body.appendChild(ui);
 const panel=$('miloAssistantPanel'), fab=$('miloAssistantFab'), messages=$('miloAssistantMessages');
 let supportMode=false,supportBusy=false,supportTimer=null,selectedFile=null;
 const welcome='أهلًا بك في مساعد ميلو 👋\nكيف يمكنني مساعدتك اليوم؟';
 function add(role,txt){const e=document.createElement('div');e.className='milo-assistant-bubble '+role;e.textContent=txt;messages.append(e);messages.scrollTop=messages.scrollHeight;}
 add('assistant',welcome);
 function loggedIn(){return !!(document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && typeof state!=='undefined' && state.account);}
 function toggle(open){if(open&&!loggedIn())return;panel.hidden=!open;fab.setAttribute('aria-expanded',String(open));if(open){$('miloAssistantInput').focus();if(supportMode)refreshSupport();}else stopSupport();}
 fab.addEventListener('click',()=>toggle(panel.hidden));$('miloAssistantClose').addEventListener('click',()=>toggle(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)toggle(false);});
 function money(v){return (Number(v)||0).toLocaleString('ar-SA',{maximumFractionDigits:2})+' ر.س';}
 function response(q){const s=q.toLocaleLowerCase('ar').replace(/[أإآ]/g,'ا');
  if(!loggedIn())return 'سجّل الدخول إلى الكاشير أولًا.';
  if(/مبيعات اليوم|كم بعنا اليوم|بيع اليوم|ايرادات اليوم/.test(s)){
    const reports=Array.isArray(state.reports)?state.reports:[];
    if(!reports.length)return 'لا توجد فواتير محمّلة في شاشة الكاشير الآن. افتح التقارير وحدّث البيانات للحصول على إجمالي موثوق.';
    const now=new Date(),day=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const rows=reports.filter(r=>String(r.date||'').slice(0,10)===day);
    return `بحسب الفواتير المحمّلة حاليًا على الجهاز: ${rows.length} فاتورة اليوم، بإجمالي ${money(rows.reduce((a,r)=>a+(Number(r.total)||0),0))}. قد لا يشمل ذلك فواتير الأجهزة الأخرى أو البيانات التي لم تتم مزامنتها.`;
  }
  if(/المنتجات الناقص|المخزون المنخفض|قربت تخلص|نفدت|ناقص/.test(s)){
    const ps=Array.isArray(state.products)?state.products:[];if(!ps.length)return 'لا توجد منتجات محمّلة حاليًا.';
    const low=ps.filter(p=>!p.unlimitedStock&&Number(p.stock||0)<=Number(p.minStock||0));
    return low.length?`عدد المنتجات التي وصلت للحد الأدنى: ${low.length}. أبرزها: ${low.slice(0,8).map(p=>`${p.name} (${p.stock||0})`).join('، ')}${low.length>8?'…':''}.`:'لا توجد منتجات دون الحد الأدنى في البيانات المحمّلة.';
  }
  if(/المطبخ|طلب مطعم|تحضير/.test(s))return 'من الإعدادات فعّل وضع المطعم. عند اعتماد طلب من شاشة البيع يصل إلى شاشة المطبخ المتصلة بالخادم، وتظهر الأصناف والكميات وحالة التجهيز. افتح شاشة المطبخ على جهاز منفصل للتجربة.';
  if(/فاتور|الجوال|واتساب|sms|رساله/.test(s))return 'أدخل رقم العميل أثناء الدفع، ثم استخدم خيار «إرسال للجوال» بعد اعتماد الفاتورة، أو من سجل الفواتير. واتساب وSMS يفتحان تطبيق الإرسال لتأكيده؛ الإرسال التلقائي يتطلب مزود رسائل.';
  if(/هنقر|توصيل/.test(s))return 'استقبال طلبات هنقرستيشن الفعلية يحتاج موافقة وتفعيل تكامل هنقرستيشن الرسمي. تهيئة الشاشة وحدها لا تكفي لتشغيل الاتصال.';
  if(/ورد|صندوق|كاشير/.test(s))return 'ابدأ الوردية بفتح الصندوق وتسجيل الرصيد الافتتاحي. بعد المبيعات أغلق الوردية وسجّل النقد المعدود لمقارنة الرصيد المتوقع بالفعلي.';
  if(/مساعد|ذكاء|chatgpt|من انت/.test(s))return 'أنا مساعد ميلو. يمكنني مساعدتك في استخدام الكاشير، ومراجعة مبيعات اليوم والمنتجات الناقصة بالاعتماد على البيانات المتاحة.';
  return 'يسعدني مساعدتك في المبيعات والمخزون وشاشة المطبخ والفواتير والورديات. جرّب اختيار أحد المواضيع أدناه أو اطرح سؤالًا محددًا.';
 }
 function ask(q){const x=String(q||'').trim();if(!x)return;add('user',x);add('assistant',response(x));}
 function stopSupport(){if(supportTimer){clearInterval(supportTimer);supportTimer=null;}}
 function supportView(enable){
  supportMode=!!enable;stopSupport();
  $('miloAssistantSupportTab').textContent=supportMode?'العودة للمساعد':'محادثة الدعم';
  $('miloAssistantInput').placeholder=supportMode?'اكتب رسالتك إلى فريق ميلو...':'اكتب رسالتك هنا...';
  $('miloAssistantAttachLabel').hidden=!supportMode;clearFile();
  $('miloAssistantInput').maxLength=supportMode?1200:350;
  messages.replaceChildren();
  if(supportMode){add('assistant','أهلًا بك في دعم ميلو. اكتب رسالتك هنا وسنرد عليك في نفس المحادثة.');refreshSupport();supportTimer=setInterval(()=>{if(!panel.hidden&&loggedIn())refreshSupport()},15000);}
  else add('assistant',welcome);
 }
 async function refreshSupport(){
  if(!supportMode||!loggedIn()||supportBusy)return;
  supportBusy=true;
  try{
   const result=await api('getSupportConversation');
   if(!supportMode)return;
   const items=Array.isArray(result.messages)?result.messages:[];
   messages.replaceChildren();
   if(!items.length)add('assistant','أهلًا بك في دعم ميلو. اكتب رسالتك هنا وسنرد عليك في نفس المحادثة.');
   items.forEach(t=>{add('user',t.description+(t.attachmentName?'\n📎 '+t.attachmentName:''));if(t.adminReply)add('assistant',t.adminReply)});
  }catch(e){if(!messages.children.length)add('assistant','تعذر تحديث المحادثة. حاول مرة أخرى.');}
  finally{supportBusy=false}
 }
 async function sendSupport(q,attachment){
  if(supportBusy)throw Error('جارٍ تحديث المحادثة، أعد المحاولة.');
  const id=uid();
  await api('submitSupportTicket',{ticket:{ticketId:id,storeCode:state.account.storeCode,deviceCode:terminalId(),deviceName:state.terminalName,occurredAt:dateTime(),description:q||'مرفق جديد',errorSummary:'',attachment:attachment||null}});
  add('user',q);await refreshSupport();
 }
 $('miloAssistantSupportTab').addEventListener('click',()=>supportView(!supportMode));
 window.MiloAssistantSupport={open(){supportView(true);toggle(true)}};
 const fileInput=$('miloAssistantFile'),preview=$('miloAssistantFilePreview');
 function clearFile(){selectedFile=null;if(fileInput)fileInput.value='';if(preview){preview.hidden=true;preview.replaceChildren();}}
 fileInput.addEventListener('change',()=>{const f=fileInput.files?.[0];if(!f){clearFile();return;}
  if(!['image/png','image/jpeg','application/pdf'].includes(f.type)||f.size>2*1024*1024){clearFile();add('assistant','يمكن إرفاق صورة JPG أو PNG أو ملف PDF بحجم لا يزيد عن 2 ميجابايت.');return;}
  selectedFile=f;preview.replaceChildren();const label=document.createElement('span');label.textContent='📎 '+f.name;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','إزالة المرفق');remove.addEventListener('click',clearFile);preview.append(label,remove);preview.hidden=false;
 });
 function readAttachment(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('تعذر قراءة المرفق'));r.onload=()=>resolve({name:file.name,mimeType:file.type,base64:String(r.result).split(',')[1]});r.readAsDataURL(file);});}
 $('miloAssistantInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('miloAssistantForm').requestSubmit();}});
 $('miloAssistantForm').addEventListener('submit',async e=>{e.preventDefault();const input=$('miloAssistantInput');const q=input.value.trim();if(!q&&!selectedFile)return;
  if(supportMode){input.disabled=true;const button=$('miloAssistantForm').querySelector('button[type=submit]');button.disabled=true;
   try{const attachment=selectedFile?await readAttachment(selectedFile):null;await sendSupport(q,attachment);input.value='';clearFile();}
   catch(err){add('assistant',err?.message||'تعذر إرسال الرسالة، حاول مرة أخرى.');}
   finally{input.disabled=false;button.disabled=false;input.focus();}}
  else{if(selectedFile){add('assistant','لإرسال المرفقات، اختر محادثة الدعم.');return;}ask(q);input.value='';input.focus();}
 });
 $('miloAssistantQuick').addEventListener('click',e=>{const b=e.target.closest('[data-ask]');if(b){if(supportMode)supportView(false);ask(b.dataset.ask)};});
 const observer=new MutationObserver(()=>{if(!loggedIn()&&!panel.hidden)toggle(false);ui.classList.toggle('milo-assistant-logged-in',loggedIn());});
 observer.observe($('app'),{attributes:true,attributeFilter:['class']});ui.classList.toggle('milo-assistant-logged-in',loggedIn());
})();
