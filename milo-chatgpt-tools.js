/* MILO ChatGPT tools navigation, read-only, no key exchange from browser.
   The connection is initiated and authorized IN ChatGPT against MILO's OAuth server.
   Never mark an account as connected from this client: only server-side OAuth can verify it.
*/
'use strict';
(function(){
  const clean = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cfg = () => window.MILO_CHATGPT_CONFIG || {};
  function validMcpUrl(){
    const raw = String(cfg().mcpUrl || '').trim();
    if (!raw) return '';
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || !u.hostname) return '';
      return u.href;
    } catch (_) { return ''; }
  }
  function pluginsUrl(){
    // Avoid sending merchants to a user-controlled destination.
    return 'https://chatgpt.com/plugins';
  }
  const payKey = () => 'milo_pay_enabled_v1_'+String(state?.account?.storeCode||'').trim();
  const payEnabled = () => !!String(state?.account?.storeCode||'').trim() && localStorage.getItem(payKey())==='1';
  window.renderMiloToolsPage = function renderMiloToolsPage(){
    hdr('الأدوات', 'تكاملات ميلو الخارجية وإدارة أدوات العمل');
    const configured = !!validMcpUrl();
    const accountName = clean(state?.account?.storeName || 'متجرك');
    setContent(`<section class="milo-tools-main" id="miloToolsMain">
      <div class="milo-tools-lead"><span class="milo-tools-eyebrow">MILO INTEGRATIONS</span>
        <h2>أدوات تساعدك تدير ${accountName} بذكاء</h2>
        <p>اربط أدوات التحليل بحساب ميلو دون تغيير المبيعات أو إعدادات جهاز الكاشير.</p>
      </div>
      <div class="milo-tools-grid">
        <article class="milo-ai-integration" aria-labelledby="miloAiTitle">
          <div class="milo-ai-header">
            <span class="milo-ai-symbol" aria-hidden="true">${MiloIcons.svg('shield')}</span>
            <div><h3 id="miloAiTitle">ChatGPT</h3><p>قراءة تقارير متجرك من داخل المحادثة</p></div>
            <span class="milo-ai-tag">OAuth 2.1</span>
          </div>
          <div class="milo-ai-features"><span>تقارير المبيعات</span><span>المنتجات الأكثر مبيعًا</span><span>تقارير الأجهزة</span></div>
          <div class="milo-ai-status" role="status"><span class="milo-ai-dot"></span>
            ${configured ? 'عنوان التكامل مُعدّ — حالة اتصال التاجر تُدار في ChatGPT' : 'بانتظار نشر خادم التكامل وتحديد رابطه'}
          </div>
          <button type="button" class="btn primary milo-ai-connect" id="miloChatgptConnect">${MiloIcons.svg('shield')} ربط ChatGPT</button>
          <p class="milo-ai-caption">بدون مفتاح API للتاجر · صلاحية التقارير فقط · موافقة صاحب الحساب مطلوبة</p>
        </article>
        <article class="milo-ai-integration" aria-labelledby="miloPayTitle">
          <div class="milo-ai-header"><span class="milo-ai-symbol" aria-hidden="true">${MiloIcons.svg('shield')}</span>
            <div><h3 id="miloPayTitle">MILO Pay | ميلو باي</h3><p>إرسال مبلغ الفاتورة إلى شاشة SUNMI V2s</p></div>
            <span class="milo-ai-tag" id="miloPayToolsBadge">${payEnabled()?'مفعّل':'غير مفعّل'}</span>
          </div>
          <p>بعد التفعيل يظهر زر «MILO Pay» في نافذة إتمام الدفع. يرسل المبلغ إلى صفحة MILO على جهاز SUNMI؛ لا يتحكم مباشرة في تطبيق رِواء باي.</p>
          <div class="milo-ai-status" role="status" id="miloPayToolsStatus">${payEnabled()?'مفعل على هذا الكاشير':'معطل على هذا الكاشير'}</div>
          <button type="button" class="btn primary milo-ai-connect" id="miloPayToolsToggle">${payEnabled()?'إيقاف ميلو باي':'تفعيل ميلو باي'}</button>
          <p class="milo-ai-caption">الإعداد محفوظ على هذا المتصفح لهذا المتجر فقط، وليس تفعيلًا بنكيًا أو اشتراكًا في مزود دفع.</p>
          ${payEnabled()?`<div class="milo-ai-status" style="margin-top:12px"><b>رابط تشغيل MILO Pay على SUNMI V2s</b><p style="margin:8px 0;font-size:12px;overflow-wrap:anywhere" id="miloPayReceiverUrl" dir="ltr">${clean(new URL('milo-sunmi-receiver.html',location.href).href)}</p><button class="btn outline" type="button" id="miloPayCopyReceiverUrl">نسخ رابط الجهاز</button> <a class="btn outline" href="milo-sunmi-receiver.html" target="_blank" rel="noopener noreferrer">فتح الرابط</a><p style="font-size:12px">افتح الرابط على SUNMI، ثم انسخ رمز الاقتران من الجهاز وأدخله عند أول إرسال مبلغ من الكاشير.</p></div>`:''}
        </article>
        <article class="milo-tools-privacy">
          <span class="milo-tools-privacy-icon" aria-hidden="true">${MiloIcons.svg('lock')}</span>
          <h3>ربط يحافظ على صلاحيات ميلو</h3>
          <p>لا ينقل زر الربط كلمات المرور أو الفواتير من المتصفح، ولا يُعدّل الكاشير أو Google Apps Script.</p>
          <p>تُرسل نتائج التقارير المطلوبة إلى ChatGPT فقط بعد تشغيل خادم ميلو وموافقة صاحب الحساب.</p>
        </article>
      </div>
    </section>`);
    document.getElementById('miloChatgptConnect')?.addEventListener('click', openMiloChatgptSetup);
    document.getElementById('miloPayCopyReceiverUrl')?.addEventListener('click', async ()=>{
      const url=new URL('milo-sunmi-receiver.html',location.href).href;
      try{await navigator.clipboard.writeText(url);toast('تم نسخ رابط SUNMI');}
      catch(_){const el=document.getElementById('miloPayReceiverUrl');if(el){const range=document.createRange();range.selectNodeContents(el);getSelection()?.removeAllRanges();getSelection()?.addRange(range);}toast('حدّد الرابط وانسخه يدويًا');}
    });
    document.getElementById('miloPayToolsToggle')?.addEventListener('click', ()=>{
      const code=String(state?.account?.storeCode||'').trim();
      if(!code){toast('سجّل الدخول إلى حساب المتجر أولًا',true);return;}
      localStorage.setItem(payKey(),payEnabled()?'0':'1');
      renderMiloToolsPage();
      toast(payEnabled()?'تم تفعيل ميلو باي على هذا الجهاز':'تم إيقاف ميلو باي على هذا الجهاز');
    });
  };
  function openMiloChatgptSetup(){
    const configured = validMcpUrl();
    if(!configured){
      const hasWrongValue = !!String(cfg().mcpUrl || '').trim();
      showModal('ربط ChatGPT | إعداد مطلوب', `<div class="milo-ai-dialog">
        <p class="milo-ai-dialog-lead">${hasWrongValue ? 'عنوان خادم ميلو غير صالح.' : 'تكامل ChatGPT لم يُنشر بعد.'}</p>
        <p>يلزم تشغيل خادم <b>MILO MCP + OAuth</b> المستقل على عنوان HTTPS ثم ضبط الرابط العام في ملف <code>milo-chatgpt-config.js</code>. لا تحتاج إلى إضافة مفتاح API داخل الكاشير.</p>
        <div class="milo-ai-steps"><b>بعد جاهزية الخادم:</b><ol><li>اضغط «ربط ChatGPT».</li><li>انسخ رابط ميلو.</li><li>أضف خادم MCP من صفحة Plugins داخل ChatGPT.</li><li>سجّل دخولك إلى حساب ميلو ووافق على قراءة التقارير.</li></ol></div>
        <p class="milo-ai-warning">الزر لا ينشئ اتصالًا وهميًا ولا يفعّل صلاحيات حتى يتم الربط عبر ChatGPT.</p>
      </div>`, [{label:'إغلاق',onClick:closeModal}]);
      return;
    }
    showModal('ربط ChatGPT بتقارير ميلو', `<div class="milo-ai-dialog">
      <p class="milo-ai-dialog-lead">اربط تقارير متجر ميلو داخل ChatGPT دون إدخال أي مفتاح API.</p>
      <div class="milo-ai-steps"><ol><li>انسخ عنوان خادم ميلو بالأسفل.</li><li>اضغط «فتح ChatGPT» وسجّل الدخول.</li><li>من <b>Plugins ← إضافة (+) ← إضافة خادم MCP مخصص</b> ألصق العنوان.</li><li>أكمل تسجيل دخول ميلو والموافقة على صلاحية <code>reports:read</code>.</li></ol></div>
      <label class="milo-ai-url-label" for="miloMcpServerUrl">رابط خادم MILO MCP</label>
      <div class="milo-ai-url-row"><input class="input" id="miloMcpServerUrl" value="${clean(configured)}" type="text" dir="ltr" readonly aria-label="رابط خادم ميلو"><button class="btn outline" type="button" id="miloAiCopyMcp">نسخ الرابط</button></div>
      <p class="milo-ai-warning">هذا إعداد للربط؛ لا يعني أن الحساب متصل الآن. يتحقق ChatGPT من الاتصال بعد اكتمال OAuth.</p>
    </div>`, [{label:'إغلاق',onClick:closeModal},{label:'فتح ChatGPT',style:'primary',onClick:()=>{window.open(pluginsUrl(),'_blank','noopener,noreferrer');}}]);
    document.getElementById('miloAiCopyMcp')?.addEventListener('click', async ()=>{
      const value=validMcpUrl(); if(!value)return;
      try { await navigator.clipboard.writeText(value); toast('تم نسخ رابط ميلو'); }
      catch(_){ const input=document.getElementById('miloMcpServerUrl');input?.focus();input?.select();toast('حدّد الرابط وانسخه يدويًا'); }
    });
  }
  // For offline, deterministic smoke tests. Not a connection indicator.
  window.MiloChatgptTools = Object.freeze({validMcpUrl,openMiloChatgptSetup});
})();
