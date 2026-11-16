'use strict';
/* Add-on to MILO CASHIER: kiosk functionality. No overrides of cashier login, checkout, or sales logic. */
const miloKioskState={config:null,orders:[],poll:null,busy:false,printing:false,loading:false,lastError:''};
const miloKioskAutoEnabled=()=>localStorage.getItem('milo_kiosk_auto_print')==='1';
const miloKioskReadyToPrint=()=>
 (localStorage.getItem('milo_print_mode')==='bridge'&&!!localStorage.getItem('milo_bridge_token')&&!!window.MiloPrintBridge)||
 (localStorage.getItem('milo_direct_mode')==='1'&&!!window.MiloDirectPrint);
function miloKioskLink(){
 if(!state.account?.storeCode||!miloKioskState.config?.enabled||!miloKioskState.config?.token)throw Error('فعّل شاشة الخدمة الذاتية أولاً');
 const url=new URL('kiosk.html',location.href);
 url.searchParams.set('store',state.account.storeCode);url.searchParams.set('key',miloKioskState.config.token);
 return url.href;
}
function miloKioskSettingsSection(){
 const c=miloKioskState.config;
 const loaded=!!c,enabled=!!c?.enabled;
 return `<div class="milo-settings-section"><div class="milo-settings-section-heading"><h2>شاشة الطلب الذاتي للمطعم</h2><span>رابط خاص لجهاز الخدمة الذاتية داخل المطعم</span></div>
 <div class="setting-grid"><div class="setting-tile milo-kiosk-setting-tile">
 <div class="milo-kiosk-tile-head"><span class="milo-kiosk-setting-symbol">▣</span><div><h3>شاشة الخدمة الذاتية</h3><p>يختار العميل منتجات المطعم من الشاشة، وتصل الطلبات مباشرة إلى قسم «طلبات الخدمة الذاتية».</p></div></div>
 <div class="milo-kiosk-feature-state"><span class="tag ${enabled?'':'amber'}">${!loaded?'جاري جلب الحالة':enabled?'مفعّلة':'متوقفة'}</span><span>الدفع عند الكاشير · الطلب منفصل عن فاتورة البيع</span></div>
 ${miloKioskState.lastError?`<p class="small-note milo-kiosk-error">${esc(miloKioskState.lastError)}</p>`:''}
 <div class="toolbar">${btn(enabled?'إيقاف شاشة الطلب':'تفعيل شاشة الطلب','kiosk-toggle','','primary',loaded?'':'disabled')} ${btn('تحديث الحالة','kiosk-settings-refresh','','outline')} ${btn('عرض الطلبات','kiosk-open-page','','secondary')}</div>
 ${enabled?`<div class="milo-kiosk-link-row"><input class="input" readonly id="miloKioskUrl" dir="ltr" value="${esc(miloKioskLink())}" aria-label="رابط الشاشة">${btn('نسخ الرابط','kiosk-copy','','primary')}${btn('فتح الشاشة','kiosk-open','','outline')}</div><div class="toolbar">${btn('تجديد رابط الشاشة','kiosk-rotate','','outline')}</div><p class="small-note">تجديد الرابط يُلغي الرابط القديم على جهاز المطعم. لا تنشره للعامة.</p>`:''}
 </div><div class="setting-tile milo-kiosk-print-config"><h3>طباعة الطلبات تلقائيًا</h3>
 <p>عند وصول طلب جديد، تُطبع تذكرة تحضير «غير مدفوعة» على هذا الكاشير فقط، وتُطبع الفاتورة النهائية بعد استلام المبلغ واعتماد البيع.</p>
 <label class="checkline"><input type="checkbox" id="miloKioskPrintCheckbox" ${miloKioskAutoEnabled()?'checked':''} data-action="kiosk-autoprint"> تفعيل الطباعة التلقائية على هذا الجهاز</label>
 <p class="small-note">${miloKioskReadyToPrint()?'طابعة MILO Bridge / ESC-POS متاحة بحسب إعدادات الجهاز.':'يلزم ربط طابعة MILO Bridge أو ESC/POS للطباعة الصامتة. المتصفح العادي يفتح نافذة طباعة.'}</p>
 <p class="small-note">تصل الطلبات حتى إذا كان هذا الجهاز غير مفعل للطباعة، ويمكن طباعة التذكرة يدويًا من صفحة الطلبات.</p>
 </div></div></div>`;
}
async function miloKioskLoadSettings(refresh=false){
 if(!state.auth)return;
 try{
  const d=await api('kioskConfig');miloKioskState.config={enabled:d.enabled===true,token:d.token||''};miloKioskState.lastError='';
 }catch(e){miloKioskState.lastError='خادم الخدمة الذاتية غير مُثبّت بعد: '+e.message;}
 if(refresh&&state.page==='settings')await renderSettingsPage();
}
async function miloKioskToggle(){
 if(!miloKioskState.config){await miloKioskLoadSettings();if(!miloKioskState.config)throw Error(miloKioskState.lastError);}
 const next=!miloKioskState.config.enabled;
 if(!next&&!confirm('إيقاف استقبال الطلبات الجديدة من الشاشة؟ الطلبات الموجودة لن تُحذف.'))return;
 const res=await api('kioskToggle',{enabled:next});
 miloKioskState.config={enabled:res.enabled===true,token:res.token||''};
 await renderSettingsPage();toast(next?'تم تفعيل شاشة الخدمة الذاتية. انسخ الرابط وافتحه على الجهاز.':'تم إيقاف استقبال طلبات الخدمة الذاتية');
}
async function miloKioskRotateToken(){
 if(!confirm('سيُلغى الرابط القديم فورًا. هل تريد إنشاء رابط جديد للشاشة؟'))return;
 const result=await api('kioskRotate');
 miloKioskState.config={enabled:result.enabled===true,token:result.token||''};
 await renderSettingsPage();toast('تم إصدار رابط جديد؛ افتحه على شاشة المطعم');
}
async function miloKioskCopyLink(){
 const link=miloKioskLink();
 try{await navigator.clipboard.writeText(link);toast('تم نسخ رابط الشاشة');}
 catch(_){showModal('رابط شاشة الخدمة الذاتية',`<input class="input" dir="ltr" value="${esc(link)}" readonly onclick="this.select()">`,[{label:'إغلاق',onClick:closeModal}]);}
}
function miloKioskOpenLink(){window.open(miloKioskLink(),'_blank','noopener,noreferrer');}
function miloKioskToggleAutoprint(){
 const enabled=!!$('miloKioskPrintCheckbox')?.checked;
 if(enabled&&!miloKioskReadyToPrint()){
  $('miloKioskPrintCheckbox').checked=false;
  throw Error('للطباعة التلقائية الصامتة يجب توصيل MILO Print Bridge أو ESC/POS أولاً');
 }
 localStorage.setItem('milo_kiosk_auto_print',enabled?'1':'0');
 toast(enabled?'تم تفعيل طباعة تذاكر الطلب على هذا الكاشير':'تم إيقاف الطباعة التلقائية على هذا الكاشير');
}
async function renderKioskOrdersPage(){
 hdr('طلبات الخدمة الذاتية','طلبات الشاشة داخل المطعم · لا تُسجَّل كفواتير إلا بعد تأكيد التحصيل',btn('تحديث الطلبات','kiosk-refresh','','secondary'));
 setContent('<div class="panel milo-kiosk-loading">جاري تحميل الطلبات من شاشة الخدمة الذاتية…</div>');
 try{const res=await api('kioskOrders');miloKioskState.orders=Array.isArray(res.orders)?res.orders:[];
  if(state.page==='kioskOrders')miloKioskRenderRows();
 }catch(e){setContent(`<div class="panel">${info('تعذر تحميل طلبات الخدمة الذاتية: '+e.message,'danger')}<div class="toolbar">${btn('إعادة المحاولة','kiosk-refresh','','primary')}</div></div>`);}
}
function miloKioskRenderRows(){
 const all=miloKioskState.orders,open=all.filter(o=>!['مكتمل','ملغي'].includes(o.status)),paid=all.filter(o=>o.invoiceId);
 setContent(`<div class="milo-kiosk-stats"><div class="metric"><span>كل الطلبات</span><b>${all.length}</b></div><div class="metric"><span>بانتظار التجهيز أو التحصيل</span><b>${open.length}</b></div><div class="metric"><span>فواتير معتمدة</span><b>${paid.length}</b></div></div>
 <div class="milo-kiosk-order-grid">${all.map(o=>{
 const confirmed=!!o.invoiceId;
 const labels=(o.items||[]).map(i=>`<div class="milo-kiosk-order-item"><span>${esc(i.name)} × ${Number(i.qty)}</span><b>${amt(i.total)}</b></div>`).join('');
 return `<article class="panel milo-kiosk-order-card"><header><div><small>طلب #${esc(o.orderId.slice(-8).toUpperCase())}</small><h3>${esc(o.serviceType||'محلي')}${o.tableNumber?' · طاولة '+esc(o.tableNumber):''}</h3></div><span class="tag">${esc(o.status)}</span></header>
 <p class="small-note">${esc(o.screenName||'شاشة الطلب')} · ${esc(vDate(o.createdAt))}</p><div class="milo-kiosk-order-lines">${labels}</div>
 <div class="milo-kiosk-order-total"><span>الإجمالي</span><strong>${amt(o.total)}</strong></div>
 ${o.notes?`<p class="small-note"><b>ملاحظات:</b> ${esc(o.notes)}</p>`:''}
 <p class="milo-kiosk-payment-hint">${confirmed?'فاتورة معتمدة: '+esc(o.invoiceId):'لم يتم تسجيل هذا الطلب كمبيعات حتى الآن.'}</p>
 <p class="small-note">التذكرة: ${esc(({pending:'بانتظار الطباعة',claimed:'جاري إرسال الطباعة',sent:'أُرسلت للطابعة',failed:'فشلت الطباعة'})[o.printStatus]||'غير مطبوعة')}${o.printError?' — '+esc(o.printError):''}</p>
 <div class="milo-kiosk-card-actions">${confirmed?btn('إعادة طباعة الفاتورة','kiosk-invoice',o.orderId,'secondary'):btn('تحصيل وإصدار فاتورة','kiosk-complete',o.orderId,'primary')}
 ${btn('طباعة تذكرة الطلب','kiosk-print',o.orderId,'outline')}${!confirmed&&!['مكتمل','ملغي'].includes(o.status)?`<div class="milo-kiosk-small-actions">${btn('قيد التجهيز','kiosk-status',o.orderId,'outline','data-status="قيد التجهيز"')}${btn('جاهز','kiosk-status',o.orderId,'outline','data-status="جاهز"')}${btn('إلغاء الطلب','kiosk-status',o.orderId,'danger','data-status="ملغي"')}</div>`:''}
 ${o.printStatus==='failed'?btn('إعادة محاولة الطباعة التلقائية','kiosk-retry',o.orderId,'outline'):''}</div></article>`;
 }).join('')||'<div class="panel milo-kiosk-empty">لا توجد طلبات من شاشة الخدمة الذاتية حتى الآن. فعّل الشاشة من الإعدادات وشارك الرابط مع جهاز المطعم.</div>'}</div>`);
}
async function miloKioskChangeStatus(id,status){
 const order=miloKioskState.orders.find(x=>x.orderId===id);if(!order)throw Error('الطلب غير موجود');
 if(status==='ملغي'&&!confirm('هل تريد إلغاء الطلب قبل التحصيل؟'))return;
 await api('kioskStatus',{orderId:id,status});toast('تم تحديث حالة الطلب');await renderKioskOrdersPage();
}
async function miloKioskComplete(id){
 const order=miloKioskState.orders.find(x=>x.orderId===id);if(!order)throw Error('الطلب غير موجود');
 if(order.invoiceId)return miloKioskReprintInvoice(id);
 if(!requireOpenShift())return;
 showModal('تحصيل طلب الخدمة الذاتية',`<div class="stack"><h3>طلب #${esc(id.slice(-8).toUpperCase())}</h3><p>الإجمالي: <strong>${amt(order.total)}</strong></p><div class="notice">لا تُصدر فاتورة البيع إلا بعد استلام المبلغ بالفعل. هذه الشاشة لا تتصل بجهاز دفع إلكتروني.</div><label>طريقة الدفع<select id="miloKioskPayment" class="input"><option value="cash">نقدًا</option><option value="card">شبكة (بعد إتمام العملية على جهاز الشبكة)</option></select></label></div>`,[
  {label:'إلغاء',onClick:closeModal},
  {label:'تأكيد استلام المبلغ وإصدار الفاتورة',style:'primary',onClick:async()=>{
   if(miloKioskState.busy)return;miloKioskState.busy=true;
   try{const r=await api('kioskComplete',{orderId:id,paymentMethod:$('miloKioskPayment').value,
     terminal:terminalId(),terminalName:state.terminalName||'',cashier:state.activeShift?.cashier||state.account.username});
    closeModal();await renderKioskOrdersPage();
    if(r.duplicate){toast('الفاتورة مسجلة سابقًا، استخدم إعادة الطباعة');return;}
    try{await printReceipt(r.invoice,false,false,false);toast('تم اعتماد البيع وإرسال الفاتورة للطباعة');}
    catch(e){toast('تم اعتماد الفاتورة، لكن تعذرت الطباعة: '+e.message,true);}
    void api('products').then(x=>{if(Array.isArray(x.products))state.products=x.products;}).catch(()=>{});
   }finally{miloKioskState.busy=false;}
  }}]);
}
async function miloKioskReprintInvoice(id){
 const r=await api('kioskGetInvoice',{orderId:id});await printReceipt(r.invoice,true,false,false);
 toast('تم إرسال نسخة الفاتورة المعتمدة للطباعة');
}
function miloKioskTicketHtml(o){
 const items=(o.items||[]).map(i=>`<tr><td>${esc(i.name)} × ${Number(i.qty)}</td><td>${amt(i.total)}</td></tr>`).join('');
 return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تذكرة طلب ذاتي</title><style>body{font:15px Tahoma,Arial,sans-serif;width:280px;margin:0 auto;padding:12px;color:#111}h1{font-size:19px;text-align:center}h2{font-size:18px;text-align:center}table{width:100%;border-collapse:collapse}td{padding:9px 0;border-bottom:1px dashed #888}b{font-weight:800}.no{border:2px solid #222;padding:8px;text-align:center}small{display:block;text-align:center;font-size:12px}</style><h1>${esc(state.account?.storeName||'ميلو')}</h1><div class="no"><h2>طلب خدمة ذاتية</h2><strong>${esc(o.orderId.slice(-8).toUpperCase())}</strong></div><p>النوع: ${esc(o.serviceType||'محلي')} ${o.tableNumber?' · طاولة '+esc(o.tableNumber):''}</p><p>الوقت: ${esc(vDate(o.createdAt))}</p><table>${items}</table><p><b>الإجمالي: ${amt(o.total)}</b></p>${o.notes?`<p>ملاحظات: ${esc(o.notes)}</p>`:''}<hr><small>غير مدفوع — تذكرة تجهيز فقط وليست فاتورة ضريبية</small></html>`;
}
function miloKioskManualPrint(id){
 const o=miloKioskState.orders.find(x=>x.orderId===id);if(!o)throw Error('الطلب غير موجود');
 const w=window.open('','_blank','width=440,height=720');if(!w)throw Error('اسمح بفتح نافذة طباعة الطلب');
 w.document.open();w.document.write(miloKioskTicketHtml(o));w.document.close();w.focus();w.print();
}
async function miloKioskRetryPrint(id){await api('kioskRetryPrint',{orderId:id});toast('أُعيدت التذكرة لقائمة انتظار الطباعة');await renderKioskOrdersPage();}
async function miloKioskAutoPrintTick(){
 if(miloKioskState.printing||!state.auth||!miloKioskAutoEnabled()||!miloKioskReadyToPrint()||document.hidden)return;
 miloKioskState.printing=true;
 try{
  const job=await api('kioskClaimPrint',{deviceCode:terminalId()});
  if(!job.order||!job.token)return;
  const o=job.order;let error='';let success=false;
  try{
   const task={html:miloKioskTicketHtml(o),receiptType:'kitchen'};
   if(localStorage.getItem('milo_print_mode')==='bridge')await window.MiloPrintBridge.printTask(task);
   else if(localStorage.getItem('milo_direct_mode')==='1')await window.MiloDirectPrint.printTask(task);
   else throw Error('الطابعة غير مهيأة للطباعة الصامتة');
   success=true;
  }catch(e){error=String(e?.message||e);toast('تعذرت طباعة تذكرة الخدمة الذاتية: '+error,true);}
  await api('kioskPrintResult',{orderId:o.orderId,token:job.token,success,message:error});
  if(success){toast('أُرسلت تذكرة طلب ذاتي جديد للطابعة');if(state.page==='kioskOrders')void renderKioskOrdersPage();}
 }catch(e){/* Server unavailable: do not mark an order as printed without acknowledgment. */
  if(state.page==='kioskOrders')console.warn('MILO kiosk print: '+e.message);
 }finally{miloKioskState.printing=false;}
}
function miloKioskStartPolling(){
 clearInterval(miloKioskState.poll);miloKioskState.config=null;miloKioskState.lastError='';
 void miloKioskLoadSettings();
 miloKioskState.poll=setInterval(()=>{
  if(!state.auth||document.hidden)return;
  if(state.page==='kioskOrders'&&$('modal')?.classList.contains('hidden'))void api('kioskOrders').then(d=>{
   if(state.page==='kioskOrders'&&$('modal')?.classList.contains('hidden')){
    miloKioskState.orders=Array.isArray(d.orders)?d.orders:[];miloKioskRenderRows();
   }
  }).catch(()=>{});
  void miloKioskAutoPrintTick();
 },12000);
}
