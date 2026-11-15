/* MILO Reports Center - read-only, independent of sales/stock writes.
   Data: authenticated reports API + the product snapshot already loaded in the cashier.
   No fictitious profit or accounting figures are calculated here. */
(function(){
 'use strict';
 const safe=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const numeric=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
 const amount=v=>numeric(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
 const count=v=>numeric(v).toLocaleString('ar-SA',{maximumFractionDigits:2});
 const lastDay=()=>new Date(Date.now()+3*3600000).toISOString().slice(0,10);
 const definitions=[
  {id:'daily',title:'المبيعات اليومية',hint:'إجمالي الفواتير حسب اليوم',icon:'chart'},
  {id:'cashier',title:'المبيعات حسب الموظف',hint:'تجميع باسم الكاشير المسجل',icon:'users'},
  {id:'device',title:'المبيعات حسب الجهاز',hint:'تجميع الفواتير حسب جهاز البيع',icon:'monitor'},
  {id:'payment',title:'طرق الدفع',hint:'النقد والشبكة بعد احتساب الباقي',icon:'wallet'},
  {id:'customer',title:'مبيعات العملاء',hint:'المبيعات حسب اسم العميل المسجل',icon:'users'},
  {id:'products',title:'المنتجات الأكثر بيعًا',hint:'الكمية من تفاصيل الفواتير المتاحة',icon:'package'},
  {id:'categories',title:'الكميات حسب الفئات',hint:'اعتمادًا على تصنيف المنتج الحالي',icon:'boxes'},
  {id:'hours',title:'ساعات الذروة',hint:'قيمة المبيعات حسب ساعة الفاتورة',icon:'clock'},
  {id:'stock',title:'رصيد المخزون',hint:'الكمية الحالية للأصناف المحدودة',icon:'package'},
  {id:'low',title:'الأصناف منخفضة المخزون',hint:'مقارنة الرصيد بالحد الأدنى',icon:'alert-triangle'},
  {id:'valuation',title:'قيمة المخزون التقديرية',hint:'الرصيد × تكلفة الشراء المسجلة حاليًا',icon:'calculator'}
 ];
 const detail={cols:[],rows:[],note:'',title:''};
 let context=null,records=[],chosen='daily',inFlight=0,errorMessage='',range=null;
 function favoriteKey(){const a=context?.state?.account||{};return 'milo-report-favorites:'+String(a.storeCode||a.store_code||a.username||context?.state?.auth?.username||'local')}
 function favorites(){try{const data=JSON.parse(localStorage.getItem(favoriteKey())||'[]');return Array.isArray(data)?data.filter(v=>definitions.some(d=>d.id===v)):[]}catch{return []}}
 function writeFavorites(ids){try{localStorage.setItem(favoriteKey(),JSON.stringify(ids))}catch{}}
 function group(rows,selector){const map=new Map();for(const inv of rows){const label=String(selector(inv)||'غير مسجل').trim()||'غير مسجل';if(!map.has(label))map.set(label,{label,invoices:0,sales:0,cash:0,card:0,vat:0,discount:0});const x=map.get(label);x.invoices++;x.sales+=numeric(inv.total);x.cash+=Math.max(0,numeric(inv.cash)-numeric(inv.change));x.card+=numeric(inv.card);x.vat+=numeric(inv.vat);x.discount+=numeric(inv.discount)}return [...map.values()].sort((a,b)=>b.sales-a.sales)}
 function makeDetail(){
  const products=Array.isArray(context.state.products)?context.state.products:[];
  const source=(context.state.account?.storeName||'هذا المتجر');
  const grouped=(fn)=>group(records,fn).map(x=>[x.label,count(x.invoices),amount(x.sales),amount(x.cash),amount(x.card)]);
  const standard=['البند','الفواتير','إجمالي المبيعات','نقد','شبكة'];
  let cols=[],rows=[],note='تُعرض الفواتير المسجّلة في الخادم ضمن الفترة المحددة فقط.';
  if(chosen==='daily'){cols=standard;rows=grouped(x=>String(x.date||'').slice(0,10)||'بدون تاريخ').sort((a,b)=>String(b[0]).localeCompare(String(a[0])))}
  if(chosen==='cashier'){cols=standard;rows=grouped(x=>x.cashier||'غير محدد')}
  if(chosen==='device'){cols=standard;rows=grouped(x=>x.terminalName||x.terminal||'جهاز غير محدد')}
  if(chosen==='customer'){cols=standard;rows=grouped(x=>x.customer||'عميل نقدي')}
  if(chosen==='payment'){
    cols=['قناة الدفع','المبلغ المسجل','التوضيح'];
    const cash=records.reduce((sum,i)=>sum+Math.max(0,numeric(i.cash)-numeric(i.change)),0),card=records.reduce((sum,i)=>sum+numeric(i.card),0),mixed=records.filter(i=>numeric(i.cash)>0&&numeric(i.card)>0).length;
    rows=[['نقد',amount(cash),'بعد طرح المبلغ المعاد للعميل'],['شبكة',amount(card),'المبلغ المدفوع بالبطاقة'],['عمليات مختلطة',count(mixed),'عدد الفواتير التي تشمل نقدًا وشبكة']];
    note='إجمالي المدفوعات قد يختلف عن مجموع الفواتير إذا كانت هناك وسائل دفع أخرى أو سجلات قديمة ناقصة.';
  }
  if(chosen==='hours'){
    const hr=group(records,i=>{const m=String(i.date||'').match(/[T ](\d{2}):/);return m?m[1]+':00':'ساعة غير محددة'});
    cols=standard;rows=hr.map(x=>[x.label,count(x.invoices),amount(x.sales),amount(x.cash),amount(x.card)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    note='الساعة مأخوذة من نص تاريخ الفاتورة كما هو محفوظ في المصدر؛ لا يتم افتراض منطقة زمنية للسجلات الناقصة.';
  }
  if(chosen==='products'||chosen==='categories'){
    const parsed=context.productStats(records);
    if(chosen==='products'){
      cols=['المنتج','الكمية المسجلة','عدد مرات الظهور','ملاحظة'];
      rows=parsed.items.slice().sort((a,b)=>b.qty-a.qty).map(x=>[x.name,count(x.qty),count(x.occurrences),x.estimated?'الكمية تقديرية لبعض الفواتير':'من البيانات المسجلة']);
      note='إذا كانت تفاصيل فواتير سابقة مختصرة، فقد تكون الكمية تقديرية. لا تُحسب إيرادات صنف من إجمالي الفاتورة لتجنب نتائج غير صحيحة.';
    }else{
      const categories=new Map(),byName=new Map();
      for(const p of products){const key=String(p.name||'').trim();if(key)byName.set(key,String(p.category||'غير مصنف'))}
      let uncertain=0;
      for(const x of parsed.items){const category=byName.get(x.name)||'غير مرتبط بتصنيف حالي';if(!byName.has(x.name))uncertain++;const r=categories.get(category)||{name:category,qty:0,products:0};r.qty+=numeric(x.qty);r.products++;categories.set(category,r)}
      cols=['الفئة','الكمية من الفواتير','عدد الأصناف المختلفة'];
      rows=[...categories.values()].sort((a,b)=>b.qty-a.qty).map(x=>[x.name,count(x.qty),count(x.products)]);
      note=`التصنيف هو التصنيف الحالي للمنتج وليس بالضرورة تصنيفه وقت البيع. توجد ${count(uncertain)} أسماء لم تُطابق كتالوج المنتجات الحالي.`;
    }
  }
  if(chosen==='stock'||chosen==='low'||chosen==='valuation'){
    const limited=products.filter(p=>p.unlimitedStock!==true&&String(p.unlimitedStock)!=='1');
    if(chosen==='stock'){
      cols=['المنتج','الباركود','الفئة','الرصيد الحالي','الحد الأدنى'];
      rows=limited.slice().sort((a,b)=>numeric(a.stock)-numeric(b.stock)).map(p=>[p.name||'—',p.barcode||'—',p.category||'—',count(p.stock),count(p.minStock)]);
    }else if(chosen==='low'){
      cols=['المنتج','الباركود','الرصيد','الحد الأدنى','الحالة'];
      rows=limited.filter(p=>numeric(p.stock)<=numeric(p.minStock)).sort((a,b)=>numeric(a.stock)-numeric(b.stock)).map(p=>[p.name||'—',p.barcode||'—',count(p.stock),count(p.minStock),numeric(p.stock)<=0?'نفد':'منخفض']);
    }else{
      cols=['المنتج','الكمية','تكلفة الوحدة','القيمة التقديرية'];
      rows=limited.slice().map(p=>[p.name||'—',count(p.stock),amount(p.costPrice),amount(numeric(p.stock)*numeric(p.costPrice))]);
    }
    note='المخزون رصيد حالي من آخر تحميل للمنتجات، وليس حركة جرد تاريخية. منتجات المخزون غير المحدود مستبعدة.'+(chosen==='valuation'?' القيمة تقديرية بناءً على تكاليف الشراء الحالية، وليست أرباحًا أو بيانًا محاسبيًا.':'');
  }
  detail.title=(definitions.find(x=>x.id===chosen)||{}).title||'تقرير';detail.cols=cols;detail.rows=rows;detail.note=note;detail.source=source;
 }
 function cards(){
  const f=favorites();const filtered=definitions.slice().sort((a,b)=>(f.includes(b.id)?1:0)-(f.includes(a.id)?1:0));
  return filtered.map(x=>`<article class="milo-rc-card ${chosen===x.id?'is-current':''}" data-mi-card data-mi-search="${safe(x.title+' '+x.hint)}"><button class="milo-rc-pick" type="button" data-mi-select="${safe(x.id)}" aria-pressed="${chosen===x.id?'true':'false'}"><b>${safe(x.title)}</b><small>${safe(x.hint)}</small></button><button class="milo-rc-favorite ${f.includes(x.id)?'is-starred':''}" type="button" data-mi-favorite="${safe(x.id)}" title="${f.includes(x.id)?'إزالة من المفضلة':'أضف للمفضلة'}" aria-label="المفضلة">${f.includes(x.id)?'★':'☆'}</button></article>`).join('');
 }
 function render(){
  if(!context||context.state.page!=='insights')return;
  const d=range||{from:lastDay().slice(0,8)+'01',to:lastDay()};
  const sale=records.reduce((s,x)=>s+numeric(x.total),0);
  const cash=records.reduce((s,x)=>s+Math.max(0,numeric(x.cash)-numeric(x.change)),0);
  const card=records.reduce((s,x)=>s+numeric(x.card),0);
  const totals=[['إجمالي المبيعات',amount(sale)],['عدد الفواتير',count(records.length)],['متوسط الفاتورة',amount(records.length?sale/records.length:0)],['النقد',amount(cash)],['الشبكة',amount(card)]];
  makeDetail();
  context.setContent(`<div class="milo-rc" dir="rtl"><section class="milo-rc-hero"><div><span class="milo-rc-kicker">MILO • REPORT CENTER</span><h2>مركز التقارير المتقدمة</h2><p>تحليلات مبنية على مبيعات متجرك الفعلية، بتصميم ميلو الخاص.</p></div><span class="milo-rc-readonly">قراءة فقط · بدون تعديل البيانات</span></section>
  <section class="milo-rc-filters"><label>من تاريخ<input id="miloRcFrom" type="date" value="${safe(d.from)}" class="input"></label><label>إلى تاريخ<input id="miloRcTo" type="date" value="${safe(d.to)}" class="input"></label><button id="miloRcRefresh" class="btn primary" type="button">تحديث من الخادم</button><label class="milo-rc-search">بحث في أنواع التقارير<input id="miloRcSearch" type="search" class="input" placeholder="ابحث عن تقرير"></label></section>
  ${errorMessage?`<div class="milo-rc-error">تعذر تحديث التقارير: ${safe(errorMessage)}. البيانات المعروضة هي آخر قراءة ناجحة في هذه الصفحة.</div>`:''}
  <div class="milo-rc-summary">${totals.map(([label,value])=>`<article><small>${safe(label)}</small><strong>${safe(value)}</strong></article>`).join('')}</div>
  <section class="milo-rc-section"><div class="milo-rc-heading"><h3>اختر نوع التقرير</h3><span>${count(definitions.length)} تقريرًا</span></div><div class="milo-rc-cards">${cards()}</div></section>
  <section class="milo-rc-section milo-rc-table"><div class="milo-rc-heading"><div><h3>${safe(detail.title)}</h3><p>${safe(detail.note)}</p></div><button id="miloRcExport" type="button" class="btn outline">تصدير CSV</button></div><div class="table-scroll"><table class="data-table"><thead><tr>${detail.cols.map(c=>`<th>${safe(c)}</th>`).join('')}</tr></thead><tbody>${detail.rows.length?detail.rows.slice(0,500).map(row=>`<tr>${row.map(v=>`<td>${safe(v)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${detail.cols.length||1}" class="empty">لا توجد بيانات لهذا التقرير</td></tr>`}</tbody></table></div>${detail.rows.length>500?`<p class="milo-rc-hint">تُعرض أول ٥٠٠ صف، وملف CSV يحتوي كل الصفوف.</p>`:''}</section>
  <div class="milo-rc-foot">المصدر: بيانات متجر ${safe(detail.source)}. لا تُعرض أرباح صافية دون سجلات تكلفة متطابقة مع المبيعات؛ الأرقام لا تشمل الفواتير المعلّقة غير المتزامنة.</div></div>`);
 }
 async function load(){
  if(!context||context.state.page!=='insights')return;
  const from=document.getElementById('miloRcFrom')?.value||range.from,to=document.getElementById('miloRcTo')?.value||range.to;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to){errorMessage='تأكد من نطاق التاريخ';render();return}
  range={from,to};const seq=++inFlight;
  const b=document.getElementById('miloRcRefresh');if(b){b.disabled=true;b.textContent='جارٍ تحميل البيانات…'}
  try{const response=await context.api('reports',{from,to});if(seq!==inFlight||context.state.page!=='insights')return;records=Array.isArray(response.reports)?response.reports:[];errorMessage='';render()}catch(e){if(seq!==inFlight||context.state.page!=='insights')return;errorMessage=String(e?.message||'تعذر الاتصال');render()}
 }
 function cellForCsv(v){let text=String(v??'');if(/^[\s\uFEFF]*[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'}
 function exportCsv(){if(!detail.cols.length)return;const lines=[detail.cols,...detail.rows].map(row=>row.map(cellForCsv).join(','));const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='MILO-'+chosen+'-'+(range?.from||lastDay())+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
 document.addEventListener('click',event=>{
  if(!context||context.state.page!=='insights')return;
  const pick=event.target.closest('[data-mi-select]');if(pick){chosen=pick.dataset.miSelect;render();return}
  const star=event.target.closest('[data-mi-favorite]');if(star){const id=star.dataset.miFavorite;const f=favorites();writeFavorites(f.includes(id)?f.filter(x=>x!==id):[...f,id]);render();return}
  if(event.target.closest('#miloRcRefresh')){void load();return}
  if(event.target.closest('#miloRcExport'))exportCsv();
 });
 document.addEventListener('input',event=>{if(event.target?.id!=='miloRcSearch')return;const value=String(event.target.value||'').trim().toLowerCase();document.querySelectorAll('[data-mi-card]').forEach(el=>{el.hidden=!el.dataset.miSearch.toLowerCase().includes(value)})});
 window.MiloReportsCenter={
  render:async ctx=>{context=ctx;range={from:lastDay().slice(0,8)+'01',to:lastDay()};errorMessage='';records=[];ctx.hdr('مركز التقارير','تقارير متنوعة ومفضلة وتصدير CSV من البيانات الفعلية');render();await load()},
  definitions:definitions.map(({id,title})=>({id,title})),
  /* Exposed only for deterministic, isolated tests. */
  _test:{group,cellForCsv}
 };
})();
