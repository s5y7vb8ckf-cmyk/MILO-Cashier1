/* MILO SMART 1.0 — read-only business intelligence add-on. No claims of automated compliance.
 * Loads verified invoice data from the existing authenticated API; no credentials persisted.
 * All anomalies are review signals, not accusations.
 */
'use strict';
function miloSmartSafe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function miloSmartMoney(x){return Number(x||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';}
function miloSmartDate(d){return (new Date(d)).toISOString().slice(0,10)}
function miloSmartCard(title,value,detail=''){return `<article class="ms-card"><small>${miloSmartSafe(title)}</small><strong>${miloSmartSafe(value)}</strong><span>${miloSmartSafe(detail)}</span></article>`;}
async function renderSmartSuite(){
  hdr('ميلو الذكي | MILO SMART','لوحة مراقبة ومساعد تحليلي مبنيان على بيانات حسابك الفعلية');
  setContent(`<section class="ms-wrap" id="msRoot"><div class="ms-toolbar"><label>الفترة من <input type="date" class="input" id="msFrom"></label><label>إلى <input type="date" class="input" id="msTo"></label><button class="btn primary" id="msReload">تحديث البيانات</button><button class="btn" id="msExport">تصدير التنبيهات CSV</button></div><p class="ms-note">التنبيهات مؤشرات للمراجعة فقط، وليست إثباتًا للاحتيال. يستند التحليل إلى الفواتير المتاحة في نطاق التاريخ.</p><div id="msResults"><p>جارٍ تحميل البيانات…</p></div><div class="ms-assist"><h2>اسأل ميلو — مساعد تحليلي محلي</h2><p>يحلّل الفواتير والمنتجات دون إرسال بياناتك إلى خدمة ذكاء اصطناعي خارجية.</p><div class="ms-quick"><button data-ms-question="today">كم بعت اليوم؟</button><button data-ms-question="top">وش أكثر المنتجات مبيعًا؟</button><button data-ms-question="stock">وش المنتجات الناقصة؟</button><button data-ms-question="risk">هل فيه عمليات تحتاج مراجعة؟</button></div><div id="msAnswer" aria-live="polite">اختر سؤالًا لعرض الإجابة.</div></div></section>`);
  if(!document.getElementById('msStyle')){
    const s=document.createElement('style');s.id='msStyle';s.textContent=`.ms-wrap{display:grid;gap:16px}.ms-toolbar{display:flex;flex-wrap:wrap;align-items:end;gap:10px}.ms-toolbar label{font-size:13px;display:grid;gap:4px}.ms-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.ms-card{border:1px solid #d9e9e7;background:linear-gradient(140deg,#fff,#f1fbf8);border-radius:15px;padding:18px;display:grid;gap:10px}.ms-card small{color:#526e6b}.ms-card strong{color:#00796b;font-size:23px}.ms-card span{font-size:12px;color:#60736e}.ms-panel,.ms-assist{background:#fff;border:1px solid #d9e9e7;border-radius:15px;padding:18px}.ms-note{font-size:13px;color:#64748b}.ms-table{width:100%;border-collapse:collapse}.ms-table td,.ms-table th{border-bottom:1px solid #edf2f1;padding:10px;text-align:right}.ms-table-wrap{overflow:auto}.ms-quick{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.ms-quick button{border:1px solid #c5e4dd;background:#f0faf7;color:#006e60;border-radius:10px;padding:10px;cursor:pointer}#msAnswer{padding:14px;background:#f5f8f7;border-radius:12px;min-height:45px}`;document.head.append(s);
  }
  const day=new Date();document.getElementById('msTo').value=miloSmartDate(day);
  document.getElementById('msFrom').value=miloSmartDate(new Date(day.getTime()-29*86400000));
  document.getElementById('msReload').onclick=()=>miloSmartReload();
  document.getElementById('msExport').onclick=()=>miloSmartExport();
  document.getElementById('msRoot').addEventListener('click',e=>{const q=e.target.closest('[data-ms-question]');if(q)miloSmartAnswer(q.dataset.msQuestion)});
  await miloSmartReload();
}
let miloSmartCache=null;
async function miloSmartReload(){
 const results=document.getElementById('msResults');if(!results)return;
 const from=document.getElementById('msFrom').value,to=document.getElementById('msTo').value;
 if(from>to){results.textContent='تاريخ البداية بعد النهاية';return;}
 results.textContent='جارٍ قراءة الفواتير والمنتجات من قاعدة البيانات…';
 try{
  const responses=await Promise.all([api('reports',{from,to}),api('products')]);
  const invoices=Array.isArray(responses[0].reports)?responses[0].reports:[];
  const products=Array.isArray(responses[1].products)?responses[1].products:[];
  const warnings=[],stockLow=[];let total=0,discount=0;
  for(const inv of invoices){
    const amount=Number(inv.total)||0;total+=amount;
    const disc=Number(inv.discount)||Number(inv.discountTotal)||0;discount+=disc;
    if(amount<0)warnings.push({kind:'قيمة سالبة',id:inv.invoiceId||'',note:'فاتورة بقيمة سالبة تحتاج مراجعة',date:inv.date||''});
    if(disc>0 && disc>amount*.3)warnings.push({kind:'خصم مرتفع',id:inv.invoiceId||'',note:'الخصم يتجاوز 30% من قيمة الفاتورة',date:inv.date||''});
    const cash=Number(inv.cash)||0,change=Number(inv.change)||0;
    if(change>cash && cash>=0)warnings.push({kind:'باقي نقدي غير متوقع',id:inv.invoiceId||'',note:'المبلغ المعاد أكبر من النقد المسجل',date:inv.date||''});
  }
  for(const p of products){if(p.unlimitedStock===true || p.unlimitedStock==='1')continue;const n=Number(p.stock);if(Number.isFinite(n)&&n<=5){stockLow.push({name:p.name||p.barcode||'منتج',stock:n,barcode:p.barcode||''})}}
  miloSmartCache={from,to,invoices,products,warnings,stockLow,total,discount};
  const avg=invoices.length?total/invoices.length:0;
  const cards=`<div class="ms-cards">${miloSmartCard('المبيعات خلال الفترة',miloSmartMoney(total),'من الفواتير المحملة')}${miloSmartCard('عدد الفواتير',invoices.length,'الفترة المحددة')}${miloSmartCard('متوسط الفاتورة',miloSmartMoney(avg),'المبيعات ÷ عدد الفواتير')}${miloSmartCard('تنبيهات تحتاج مراجعة',warnings.length,'قواعد فحص أولية')}${miloSmartCard('أصناف كميتها 5 أو أقل',stockLow.length,'باستثناء المخزون غير المحدود')}</div>`;
  const riskRows=warnings.slice(0,50).map(w=>`<tr><td>${miloSmartSafe(w.kind)}</td><td>${miloSmartSafe(w.id)}</td><td>${miloSmartSafe(w.note)}</td></tr>`).join('');
  const stockRows=stockLow.slice(0,50).map(p=>`<tr><td>${miloSmartSafe(p.name)}</td><td>${miloSmartSafe(p.stock)}</td><td>${miloSmartSafe(p.barcode)}</td></tr>`).join('');
  results.innerHTML=cards+`<div class="ms-panel"><h2>حارس ميلو — تنبيهات المراجعة (${warnings.length})</h2><div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>نوع التنبيه</th><th>رقم الفاتورة</th><th>التفاصيل</th></tr></thead><tbody>${riskRows||'<tr><td colspan="3">لا توجد تنبيهات ضمن القواعد المتاحة.</td></tr>'}</tbody></table></div></div><div class="ms-panel"><h2>المنتجات منخفضة المخزون (${stockLow.length})</h2><div class="ms-table-wrap"><table class="ms-table"><thead><tr><th>المنتج</th><th>الكمية</th><th>الباركود</th></tr></thead><tbody>${stockRows||'<tr><td colspan="3">لا توجد منتجات منخفضة المخزون.</td></tr>'}</tbody></table></div></div>`;
 }catch(e){results.innerHTML=`<p class="ms-note">تعذر جلب البيانات من الخادم: ${miloSmartSafe(e.message)}. تأكد من اتصال الحساب وصلاحياته.</p>`}
}
function miloSmartAnswer(question){
  const el=document.getElementById('msAnswer');const d=miloSmartCache;if(!el)return;
  if(!d){el.textContent='حدّث البيانات أولًا.';return;}
  if(question==='stock'){el.textContent=d.stockLow.length?`يوجد ${d.stockLow.length} منتج كميته 5 أو أقل. منها: ${d.stockLow.slice(0,5).map(x=>x.name).join('، ')}.`:'لا توجد منتجات كميتها 5 أو أقل في البيانات المحملة.';return;}
  if(question==='risk'){el.textContent=d.warnings.length?`توجد ${d.warnings.length} حالة تحتاج مراجعة حسب القواعد المتاحة. راجع جدول حارس ميلو.`:'لم ترصد القواعد الحالية حالات مشتبهًا بها في الفواتير المحملة. هذا ليس ضمانًا لعدم وجود مخالفات.';return;}
  if(question==='today'){
    const today=miloSmartDate(new Date());const rows=d.invoices.filter(x=>String(x.date||'').slice(0,10)===today);el.textContent=`مبيعات اليوم ضمن الفواتير المحملة ${miloSmartMoney(rows.reduce((s,x)=>s+(Number(x.total)||0),0))} عبر ${rows.length} فاتورة.`;return;
  }
  if(question==='top'){
    const map=new Map();for(const i of d.invoices){let items=i.items;if(typeof items==='string'){try{items=JSON.parse(items)}catch{items=[]}}if(!Array.isArray(items))continue;for(const x of items){const name=String(x.name||x.productName||x.barcode||'غير معروف');map.set(name,(map.get(name)||0)+(Number(x.qty||x.quantity)||0))}}
    const top=[...map].sort((a,b)=>b[1]-a[1]).slice(0,5);el.textContent=top.length?'الأصناف الأعلى حسب الكمية: '+top.map(x=>`${x[0]} (${x[1]})`).join('، '):'لا تتوفر بنود فواتير مفصلة كافية لتحديد المنتجات الأعلى مبيعًا.';
  }
}
function miloSmartExport(){
 if(!miloSmartCache){alert('حدّث البيانات أولًا');return;}
 const rows=[['نوع التنبيه','رقم الفاتورة','التفاصيل','التاريخ'],...miloSmartCache.warnings.map(x=>[x.kind,x.id,x.note,x.date])];
 const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='MILO_GUARD_ALERTS.csv';a.click();URL.revokeObjectURL(url);
}
