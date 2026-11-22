/* MILO cashier-only assistant: local help and read-only summaries. No external AI/API calls. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ui=document.createElement('div');ui.id='miloAssistantRoot';ui.innerHTML=`<button id="miloAssistantFab" type="button" aria-label="فتح مساعد ميلو" aria-controls="miloAssistantPanel" aria-expanded="false"><img src="icons/milo-assistant.png" alt=""><span class="milo-assistant-fab-label">مساعد ميلو</span></button><section id="miloAssistantPanel" class="milo-assistant-panel" role="dialog" aria-modal="false" aria-labelledby="miloAssistantTitle" hidden dir="rtl"><header class="milo-assistant-head"><div><strong id="miloAssistantTitle">مساعد ميلو</strong><small>مساعد الكاشير</small></div><button id="miloAssistantClose" type="button" aria-label="إغلاق">×</button></header><div class="milo-assistant-messages" id="miloAssistantMessages" aria-live="polite"></div><div class="milo-assistant-quick" id="miloAssistantQuick"><button type="button" data-ask="مبيعات اليوم">مبيعات اليوم</button><button type="button" data-ask="المنتجات الناقصة">المنتجات الناقصة</button><button type="button" data-ask="كيف أستخدم شاشة المطبخ؟">شاشة المطبخ</button><button type="button" data-ask="كيف أرسل فاتورة للجوال؟">الفاتورة للجوال</button></div><form id="miloAssistantForm" class="milo-assistant-form"><input id="miloAssistantInput" type="text" maxlength="350" autocomplete="off" placeholder="اسأل عن الكاشير أو التقارير..." aria-label="اكتب سؤالك" required><button type="submit">إرسال</button></form><div class="milo-assistant-note">مساعد إرشادي محلي؛ لا يتصل بنموذج ذكاء اصطناعي أو يرسل بياناتك خارجيًا.</div></section>`;
 document.body.appendChild(ui);
 const panel=$('miloAssistantPanel'), fab=$('miloAssistantFab'), messages=$('miloAssistantMessages');
 const welcome='مرحبًا! أقدر أساعدك في شرح استخدام ميلو وعرض ملخصات من البيانات المحمّلة حاليًا في الكاشير. اختر سؤالًا أو اكتبه.';
 function add(role,txt){const e=document.createElement('div');e.className='milo-assistant-bubble '+role;e.textContent=txt;messages.append(e);messages.scrollTop=messages.scrollHeight;}
 add('assistant',welcome);
 function loggedIn(){return !!(document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && typeof state!=='undefined' && state.account);}
 function toggle(open){if(open&&!loggedIn())return;panel.hidden=!open;fab.setAttribute('aria-expanded',String(open));if(open)$('miloAssistantInput').focus();}
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
  if(/مساعد|ذكاء|chatgpt|من انت/.test(s))return 'أنا مساعد ميلو داخل الكاشير. هذه النسخة تقدم إرشادات وملخصات محلية محددة، وليست محادثة ذكاء اصطناعي متصلة بخدمة خارجية.';
  return 'أقدر أساعدك في مبيعات اليوم، المنتجات الناقصة، شاشة المطبخ، الفاتورة للجوال، هنقرستيشن والورديات. أما الأسئلة المفتوحة فتحتاج تفعيل خدمة ذكاء اصطناعي آمنة لاحقًا.';
 }
 function ask(q){const x=String(q||'').trim();if(!x)return;add('user',x);add('assistant',response(x));}
 $('miloAssistantForm').addEventListener('submit',e=>{e.preventDefault();const input=$('miloAssistantInput');ask(input.value);input.value='';input.focus();});
 $('miloAssistantQuick').addEventListener('click',e=>{const b=e.target.closest('[data-ask]');if(b)ask(b.dataset.ask);});
 const observer=new MutationObserver(()=>{if(!loggedIn()&&!panel.hidden)toggle(false);ui.classList.toggle('milo-assistant-logged-in',loggedIn());});
 observer.observe($('app'),{attributes:true,attributeFilter:['class']});ui.classList.toggle('milo-assistant-logged-in',loggedIn());
})();
