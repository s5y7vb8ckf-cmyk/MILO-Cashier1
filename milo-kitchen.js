/* MILO Kitchen – cloud-backed customer orders. Does not issue sales invoices. */
(()=>{'use strict';
let ctx=null,rows=[],posRows=[],error='',loading=false,filter='active',lastRefresh=0,processing=new Set();
const isRestaurant=()=>String(ctx?.state?.settings?.restaurant_mode||'retail')==='restaurant';
function posRowsFromReports(reports){return (reports||[]).map(r=>({...r,source:'pos'}));}
function combined(){return [...posRows,...rows.map(x=>({...x,source:'web'}))].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))}
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';
const active=new Set(['جديد','قيد التجهيز']);
const ready=new Set(['جاهز للاستلام']);
const allowed=new Set(['قيد التجهيز','جاهز للاستلام']);
const $=id=>document.getElementById(id);
const orderKey=o=>String(o.source==='pos'?(o.orderId+'::'+o.terminal):o.orderId??'');
function decodeItems(o){let value=o.items??o.orderItems??[];if(typeof value==='string'){try{value=JSON.parse(value)}catch{value=value.split(' | ').filter(Boolean).map(s=>{const m=s.match(/^(.*?) ×([0-9.]+) = ([0-9.]+)$/);return m?{name:m[1],qty:Number(m[2]),total:Number(m[3])}:{name:s,qty:1}})}}return Array.isArray(value)?value:[]}
function row(o){const id=orderKey(o),status=String(o.status||'جديد'),items=decodeItems(o);
 const names=items.map(x=>{const name=x.name??x.product_name??x.title??'صنف';const qty=Number(x.qty??x.quantity??1)||1;return `<li><b>${safe(qty)} × ${safe(name)}</b>${x.notes?`<small>${safe(x.notes)}</small>`:''}</li>`}).join('');
 const disabled=processing.has(id)?'disabled':'';const isPos=o.source==='pos';
 return `<article class="mk-order"><div class="mk-head"><b>طلب ${safe(id.slice(-8)||'—')}</b><span class="mk-status">${safe(isPos?'الكاشير · '+status:'الموقع · '+status)}</span></div><div class="mk-meta"><span>${safe(o.customerName??o.customer_name??'طلب موقع الزبائن')}</span><span>${safe(o.createdAt??o.created_at??'')}</span>${o.serviceType?`<span>${safe(o.serviceType)}</span>`:''}</div><ul>${names||'<li>تفاصيل الأصناف غير متوفرة</li>'}</ul>${o.notes?`<p class="mk-note">ملاحظات: ${safe(o.notes)}</p>`:''}<div class="mk-bottom"><strong>${money(o.total)}</strong><div>${status==='جديد'?`<button type="button" data-mk-status="قيد التجهيز" data-mk-id="${safe(id)}" ${disabled}>بدء التجهيز</button>`:''}${status==='قيد التجهيز'?`<button type="button" data-mk-status="جاهز للاستلام" data-mk-id="${safe(id)}" ${disabled}>تم التجهيز</button>`:''}</div></div></article>`}
function draw(){if(!ctx||ctx.state.page!=='kitchenDisplay')return;
 const all=combined();const list=all.filter(o=>{const status=String(o.status||'جديد');return filter==='active'?active.has(status):filter==='new'?status==='جديد':filter==='preparing'?status==='قيد التجهيز':filter==='ready'?ready.has(status):true;});
 ctx.hdr('شاشة المطبخ','طلبات الكاشير المعتمدة وطلبات الموقع – تجهيز فقط دون إعادة تحصيل');
 ctx.setContent(`<section class="mk" dir="rtl"><div class="mk-banner"><div><h2>مطبخ ميلو</h2><p>عند تفعيل وضع المطعم تظهر الطلبات المعتمدة من شاشة البيع، وتظهر معها طلبات موقع الزبائن إذا كان مفعّلًا.</p></div><span>شاشة التشغيل</span></div><div class="mk-counters"><div>طلبات جديدة <b>${all.filter(o=>o.status==='جديد').length}</b></div><div>قيد التجهيز <b>${all.filter(o=>o.status==='قيد التجهيز').length}</b></div><div>جاهزة <b>${all.filter(o=>o.status==='جاهز للاستلام').length}</b></div></div><div class="mk-toolbar"><button type="button" data-mk-filter="active" class="${filter==='active'?'selected':''}">الطلبات النشطة (${all.filter(o=>active.has(String(o.status||'جديد'))).length})</button><button type="button" data-mk-filter="new" class="${filter==='new'?'selected':''}">الجديدة (${all.filter(o=>o.status==='جديد').length})</button><button type="button" data-mk-filter="preparing" class="${filter==='preparing'?'selected':''}">قيد التجهيز</button><button type="button" data-mk-filter="ready" class="${filter==='ready'?'selected':''}">الجاهزة</button><button type="button" data-mk-filter="all" class="${filter==='all'?'selected':''}">كل الطلبات</button><button type="button" data-mk-refresh>تحديث الآن</button><span>${lastRefresh?'آخر تحديث: '+new Date(lastRefresh).toLocaleTimeString('ar-SA'):''}</span></div>${error?`<p class="mk-warning" role="alert">${safe(error)}</p>`:''}${loading?'<p class="mk-hint">جارٍ تحميل الطلبات…</p>':''}<div class="mk-grid">${list.map(row).join('')||'<div class="mk-empty">لا توجد طلبات في هذا القسم حاليًا. ستظهر الطلبات الجديدة هنا بعد اعتمادها ومزامنتها مع الخادم.</div>'}</div><p class="mk-hint">تبويب الطلبات النشطة يعرض الطلبات الجديدة وقيد التجهيز فقط. تظهر طلبات الكاشير بعد اعتماد الفاتورة ومزامنتها مع الخادم، دون تسجيل بيع جديد. حالات تجهيز طلبات الكاشير محفوظة على الخادم وتُحدّث بين أجهزة المطبخ عند التحديث. هنقرستيشن يحتاج تكاملًا رسميًا.</p></section>`);
}
async function refresh(silent=false){if(!ctx||ctx.state.page!=='kitchenDisplay'||loading)return;
 if(!isRestaurant()){rows=[];posRows=[];error='فعّل وضع المطعم من إعدادات المتجر لعرض طلبات الكاشير في شاشة المطبخ.';draw();return}
 loading=true;if(!silent)draw();const errors=[];
 try{
  const today=new Date(Date.now()+3*3600000).toISOString().slice(0,10);
  const reports=await ctx.api('kitchenOrders',{day:today});
  if(ctx.state.page!=='kitchenDisplay')return;
  posRows=posRowsFromReports(reports.orders);
 }catch(e){errors.push('طلبات الكاشير: '+String(e?.message||e))}
 if(ctx.state.settings.customer_orders_enabled==='1'){
  try{const result=await ctx.api('customerOrders');if(ctx.state.page!=='kitchenDisplay')return;rows=Array.isArray(result.orders)?result.orders:[]}
  catch(e){errors.push('طلبات الموقع: '+String(e?.message||e))}
 }else rows=[];
 error=errors.length?'تعذر تحديث بعض الطلبات: '+errors.join(' | '):'';
 lastRefresh=Date.now();loading=false;draw();
}
async function change(id,status){if(!allowed.has(status)||!id||processing.has(id))return;
 const o=combined().find(o=>orderKey(o)===id);if(!o||!active.has(String(o.status)))return;
 processing.add(id);draw();try{
  if(o.source==='pos'){
   await ctx.api('updateKitchenOrder',{invoiceId:o.invoiceId,terminal:o.terminal,status});
   posRows=posRows.map(x=>orderKey(x)===id?{...x,status}:x);
  }else{
   if(o.invoiceId)return;
   await ctx.api('updateCustomerOrder',{orderId:id,status});await refresh();
  }
 }catch(e){error='لم يتم تأكيد تعديل الطلب: '+(e?.message||'خطأ')}
 finally{processing.delete(id);draw()}
}
document.addEventListener('click',ev=>{if(!ctx||ctx.state.page!=='kitchenDisplay')return;const changeBtn=ev.target.closest('[data-mk-status]');if(changeBtn){void change(changeBtn.dataset.mkId,changeBtn.dataset.mkStatus);return}const f=ev.target.closest('[data-mk-filter]');if(f){filter=f.dataset.mkFilter;draw();void refresh(true);return}if(ev.target.closest('[data-mk-refresh]'))void refresh()});
setInterval(()=>{if(ctx?.state?.auth&&ctx.state.page==='kitchenDisplay'&&document.visibilityState==='visible'&&!loading)void refresh(true)},10000);
window.MiloKitchen={render:async c=>{ctx=c;rows=[];posRows=[];error='';filter='active';lastRefresh=0;draw();await refresh()}};
})();
