'use strict';
// Must match MILO CASHIER's existing API_URL (it is not the separate customer store URL).
const MILO_KIOSK_API_URL=(location.hostname==='127.0.0.1'&&location.port==='37941')?'/api':'https://script.google.com/macros/s/AKfycbykLLjtPih4c0JVw1MAk3mQ1BVG-s2TzyUcizmEC5UprlUxOVKAvz_80qLvi0NAiXQE/exec';
const miloKioskQuery=new URLSearchParams(location.search);
const miloKioskStore=miloKioskQuery.get('store')||'',miloKioskKey=miloKioskQuery.get('key')||'';
const q=id=>document.getElementById(id);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>Number(value||0).toFixed(2)+' ر.س';
let products=[],cart={},category='الكل',search='',pending=null,working=false,ready=false;
function message(t){q('kioskAlert').textContent=t;q('kioskAlert').hidden=false;clearTimeout(message.timer);message.timer=setTimeout(()=>q('kioskAlert').hidden=true,5000);}
function randOrder(){return crypto.randomUUID();}
async function api(action,extra={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const res=await fetch(MILO_KIOSK_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},credentials:'omit',redirect:'follow',body:JSON.stringify({action,storeCode:miloKioskStore,key:miloKioskKey,...extra}),signal:controller.signal});
  if(!res.ok)throw Error('تعذر الاتصال بالخادم');const data=await res.json();if(!data.ok)throw Error(data.message||'تعذر إكمال الطلب');return data;
 }finally{clearTimeout(timer);}
}
function cartCount(){return Object.values(cart).reduce((sum,x)=>sum+Number(x||0),0);}
function total(){return Object.entries(cart).reduce((sum,[bc,qty])=>sum+(Number(products.find(p=>p.barcode===bc)?.price||0)*qty),0);}
function changeQty(bc,step){const p=products.find(x=>x.barcode===bc);if(!p)return;
 const allowed=p.unlimitedStock?20:Math.max(0,Math.min(20,Number(p.stock)));
 const next=Math.max(0,Math.min(allowed,Number(cart[bc]||0)+step));if(next)cart[bc]=next;else delete cart[bc];render();
}
function render(){
 const cats=['الكل',...new Set(products.map(p=>p.category||'عام'))];
 q('kioskCategories').innerHTML=cats.map(c=>`<button type="button" class="${category===c?'active':''}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
 const filtered=products.filter(p=>(category==='الكل'||(p.category||'عام')===category)&&(!search||`${p.name} ${p.category||''} ${p.description||''}`.toLowerCase().includes(search)));
 q('kioskProducts').innerHTML=filtered.map(p=>{const available=p.unlimitedStock||Number(p.stock)>Number(cart[p.barcode]||0);
  return `<article class="kiosk-product"><div class="kiosk-product-photo">${/^https:\/\//.test(p.imageUrl||'')?`<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" referrerpolicy="no-referrer">`:'◈'}</div><div class="kiosk-product-body"><small>${escapeHtml(p.category||'عام')}</small><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml((p.description||'').slice(0,90))}</p><div class="kiosk-product-foot"><span class="kiosk-price">${money(p.price)}</span><button type="button" class="kiosk-add" data-add="${escapeHtml(p.barcode)}" ${available?'':'disabled'}>${available?'إضافة +':'غير متوفر'}</button></div></div></article>`;
 }).join('')||'<div class="kiosk-loading">لا توجد أصناف مطابقة.</div>';
 q('kioskCartItems').innerHTML=Object.entries(cart).length?Object.entries(cart).map(([bc,qty])=>{const p=products.find(x=>x.barcode===bc);if(!p)return '';
  return `<div class="kiosk-cart-row"><div><b>${escapeHtml(p.name)}</b><small>${money(p.price)} × ${qty}</small></div><b>${money(Number(p.price)*qty)}</b><div class="kiosk-quantity"><button type="button" data-qty="${escapeHtml(bc)}" data-step="1" aria-label="زيادة">+</button><strong>${qty}</strong><button type="button" data-qty="${escapeHtml(bc)}" data-step="-1" aria-label="تقليل">−</button></div></div>`;
 }).join(''):'<div class="kiosk-empty-cart">لم تضف أي صنف بعد</div>';
 q('kioskTotal').textContent=money(total());q('kioskItemCount').textContent=cartCount();q('kioskMobileCount').textContent=cartCount();
 q('kioskCheckout').disabled=!ready||!cartCount()||working;
}
function modal(title,body){q('kioskModalTitle').textContent=title;q('kioskModalBody').innerHTML=body;q('kioskModal').classList.remove('hidden');}
function closeModal(){if(working)return;q('kioskModal').classList.add('hidden');}
function checkout(){
 if(!cartCount()||working)return;
 modal('تأكيد طلبك',`<form class="kiosk-form" id="kioskSubmitForm"><label>نوع الطلب<select name="serviceType" id="kioskServiceType"><option value="محلي">محلي – داخل المطعم</option><option value="سفري">سفري – للاستلام</option></select></label><label id="kioskTableField">رقم الطاولة (اختياري)<input name="tableNumber" maxlength="12" placeholder="مثال: 12" autocomplete="off"></label><label>ملاحظات للطلب (اختياري)<textarea name="notes" maxlength="300" rows="2" placeholder="بدون بصل، إضافة صوص..."></textarea></label><div class="kiosk-order-preview"><h3>تفاصيل طلبك</h3>${Object.entries(cart).map(([bc,qty])=>{const p=products.find(x=>x.barcode===bc);return `<p>${escapeHtml(p?.name||'')} × ${qty}</p>`;}).join('')}<b>الإجمالي: ${money(total())}</b></div><p style="color:#63796a;font-size:12px">الطلب يُرسل للمطعم، والدفع عند الكاشير. هذه الشاشة لا تخصم من بطاقتك.</p><button class="kiosk-primary" id="kioskConfirm" type="submit">تأكيد وإرسال الطلب <span>←</span></button></form>`);
 q('kioskServiceType').addEventListener('change',e=>q('kioskTableField').hidden=e.target.value!=='محلي');
 q('kioskSubmitForm').addEventListener('submit',submit);
}
async function submit(ev){ev.preventDefault();if(working)return;
 const form=new FormData(ev.currentTarget);
 if(!pending)pending={orderId:randOrder(),serviceType:form.get('serviceType'),tableNumber:String(form.get('tableNumber')||''),notes:String(form.get('notes')||''),screenName:'شاشة المطعم',items:Object.entries(cart).map(([barcode,qty])=>({barcode,qty}))};
 working=true;q('kioskConfirm').disabled=true;q('kioskConfirm').textContent='جارٍ إرسال طلبك...';
 try{
  const r=await api('submitKioskOrder',{order:pending});
  cart={};pending=null;working=false;render();q('kioskCart').classList.remove('open');
  modal('تم استلام طلبك',`<div class="kiosk-confirmation"><h3>تم إرسال الطلب إلى المطعم بنجاح</h3><span class="number">${escapeHtml(r.orderId.slice(-8).toUpperCase())}</span><p>رقم طلبك يظهر أيضًا في قائمة «طلبات الخدمة الذاتية» بالكاشير.</p><p>يرجى التوجّه إلى الكاشير لإتمام الدفع، ثم الاحتفاظ بالفاتورة النهائية.</p><button type="button" class="kiosk-primary" id="kioskNewOrder">طلب جديد <span>←</span></button></div>`);
  q('kioskNewOrder').addEventListener('click',()=>{closeModal();window.scrollTo({top:0,behavior:'smooth'});});
 }catch(e){working=false;q('kioskConfirm').disabled=false;q('kioskConfirm').textContent='إعادة محاولة إرسال نفس الطلب';message(e.message+' — لا تعِد تكوين الطلب قبل التحقق من وصوله.');}
}
document.addEventListener('click',e=>{
 const add=e.target.closest('[data-add]');if(add)changeQty(add.dataset.add,1);
 const change=e.target.closest('[data-qty]');if(change)changeQty(change.dataset.qty,Number(change.dataset.step));
 const cat=e.target.closest('[data-category]');if(cat){category=cat.dataset.category;render();}
});
q('kioskSearch').addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();render();});
q('kioskCheckout').addEventListener('click',checkout);
q('kioskClose').addEventListener('click',closeModal);
q('kioskMobileCart').addEventListener('click',()=>q('kioskCart').classList.toggle('open'));
q('kioskCloseCart').addEventListener('click',()=>q('kioskCart').classList.remove('open'));
(async()=>{
 if(!miloKioskStore||!/^[a-f0-9]{48}$/.test(miloKioskKey)){
  q('kioskProducts').innerHTML='<div class="kiosk-loading">رابط الشاشة غير مكتمل. فعّل شاشة الخدمة الذاتية من إعدادات كاشير ميلو ثم افتح الرابط الذي ينشئه النظام.</div>';return;
 }
 try{
  const r=await api('publicKioskCatalog');products=Array.isArray(r.products)?r.products:[];
  q('brandName').textContent=r.storeName||'مطعم ميلو';document.title=(r.storeName||'مطعم ميلو')+' | الطلب الذاتي';
  ready=true;render();
 }catch(e){q('kioskProducts').innerHTML='<div class="kiosk-loading">'+escapeHtml(e.message)+'</div>';}
})();
