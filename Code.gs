/** Milo Cashier - قاعدة البيانات السحابية backend. Bind script to the spreadsheet. */
const SHEETS = { accounts:'Accounts', products:'Products', reports:'Reports', shifts:'Shifts', customers:'Customers', suppliers:'Suppliers', storeSettings:'StoreSettings', expenses:'Expenses', promotions:'Promotions', employees:'Employees', returns:'Returns', purchases:'Purchases', purchaseItems:'PurchaseItems', vouchers:'Vouchers', deviceActivity:'DeviceActivity', deviceStatus:'DeviceStatus', deviceAlerts:'DeviceAlerts', supportTickets:'SupportTickets', reportDaily:'ReportDaily', deletedRecords:'DeletedRecords', customerOrders:'CustomerOrders', kitchenOrders:'KitchenOrders', categories:'Categories' };
const MILO_CATEGORY_HEADERS=['store_code','name','created_at'];
const ACCOUNT_HEADERS = ['store_code','username','password','owner_name','store_name','vat_number','district','phone','address','subscription_end','days_left','status','notes','max_devices','max_users'];
const PRODUCT_HEADERS = ['store_code','barcode','name','price','wholesale_price','cost_price','stock','category','unit','min_stock','description','image_url','unlimited_stock','restaurant_options_json'];
const REPORT_DAILY_HEADERS = ['store_code','report_id','device_code','report_date','invoice_count','subtotal','sales_total','vat','discount','cash','card','cost','gross_profit','top_products_json','updated_at','terminal_id','terminal_name'];
const KITCHEN_HEADERS = ['store_code','invoice_id','terminal','status','updated_at','updated_by'];
const REPORT_HEADERS = ['store_code','invoice_id','date','cashier','customer','customer_phone','subtotal','discount','total','vat','cash','card','change','terminal','items_count','items','print_status','print_token','print_time','print_error','terminal_name','service_type','invoice_share_token'];
const SHIFT_HEADERS = ['store_code','shift_id','terminal','cashier','opened_at','closed_at','opening_cash','closing_cash','expected_cash','invoice_count','cash_sales','card_sales','total_sales','vat','discount','updated_at'];
const CONTACT_HEADERS = ['store_code','contact_id','name','phone','address','vat_number','balance','notes','updated_at'];
const DELETED_HEADERS = ['store_code','entity_type','record_key','deleted_at'];
const STORE_SETTING_HEADERS = ['store_code','setting_key','setting_value','updated_at'];
const STORE_SETTING_KEYS = ['store_name','vat_number','phone','address','footer','invoice_header','restaurant_mode','customer_orders_enabled','customer_orders_token'];
const EXTRA_SCHEMAS = {
 expenses: {headers:['store_code','record_id','date','category','description','amount','payment_method','created_by','updated_at'], id:'record_id'},
 promotions: {headers:['store_code','record_id','name','discount_type','discount_value','barcode','start_date','end_date','enabled','updated_at'], id:'record_id'},
 employees: {headers:['store_code','record_id','name','username','role','enabled','updated_at'], id:'record_id'},
 returns: {headers:['store_code','record_id','invoice_id','date','items','total','reason','refund_method','created_by','updated_at'], id:'record_id'},
 purchases: {headers:['store_code','record_id','supplier_id','supplier_name','invoice_number','date','total','updated_at'], id:'record_id'},
 purchaseItems: {headers:['store_code','record_id','purchase_id','product_id','product_name','qty','unit_cost','line_total','updated_at'], id:'record_id'},
 vouchers: {headers:['store_code','record_id','kind','contact_type','contact_id','contact_name','date','amount','reference','notes','updated_at'], id:'record_id'}
};
const DEVICE_ACTIVITY_HEADERS = ['store_code','event_id','device_code','device_name','username','owner_name','event_type','occurred_at','received_at','details'];
const DEVICE_STATUS_HEADERS = ['store_code','device_code','device_name','username','owner_name','last_open','last_close','last_seen','current_status','inactivity_alert_at','updated_at'];
const DEVICE_ALERT_HEADERS = ['store_code','device_code','device_name','owner_name','alert_type','last_seen','alert_at','details'];
const SUPPORT_TICKET_HEADERS = ['store_code','ticket_id','occurred_at','received_at','device_code','device_name','username','owner_name','description','error_summary','status','admin_reply','reply_at','attachment_name','attachment_url'];
const ACTIVE_VALUES = ['مفعل','مفعّل','active','1','yes','true','نعم'];
function fail_(error,message){return {ok:false,error:error,message:message};}
function str_(v){return v==null?'':String(v).trim();}
function num_(v){const n=Number(str_(v).replace(/,/g,''));return isFinite(n)?n:0;}
function book_(){const ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error('اربط السكربت بملف قاعدة البيانات السحابية');return ss;}
function table_(name){const sh=book_().getSheetByName(name);if(!sh)throw Error('الورقة غير موجودة: '+name+'؛ شغّل setup');const values=sh.getDataRange().getValues();const headers=values[0].map(str_);const idx={};headers.forEach((h,i)=>idx[h]=i);return {sh,values,headers,idx};}
function requireCols_(t,cols){cols.forEach(c=>{if(t.idx[c]===undefined)throw Error('العمود ناقص: '+c);});}
function col_(t,row,key){return t.idx[key]===undefined?'':row[t.idx[key]];}
function dateStr_(v){if(v instanceof Date)return Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');const s=str_(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';}
function daysLeft_(v){const s=dateStr_(v);if(!s)return null;const today=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');return Math.round((Date.parse(s+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);}
// Web App: public health-check remains unchanged. Mobile dashboard is gated by account login.
function doGet(e){
 if(e && e.parameter && String(e.parameter.invoice||'')==='1')return miloSharedInvoicePage_(e.parameter);
 if(e && e.parameter && String(e.parameter.mobile||'')==='1'){
  return HtmlService.createHtmlOutputFromFile('MobileReports')
   .addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover')
   .setTitle('MILO | تقارير الجوال');
 }
 return ContentService.createTextOutput('Milo Cashier cloud is running');
}
function doPost(e){let out;try{const req=JSON.parse(e.postData.contents);out=route_(req);}catch(err){out=fail_('server','خطأ في الخادم: '+err.message);}return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);}
function authenticate_(req){const username=str_(req.username),password=str_(req.password);if(!username||!password)return fail_('bad_credentials','اكتب اسم المستخدم وكلمة السر');
 const cache=CacheService.getScriptCache();const key='fail:'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,username.toLowerCase())).slice(0,35);
 if(num_(cache.get(key))>=5)return fail_('too_many','محاولات خاطئة كثيرة. انتظر 10 دقائق');
 const t=table_(SHEETS.accounts);requireCols_(t,['store_code','username','password','subscription_end','status']);let row=null;
 for(let i=1;i<t.values.length;i++){let v=t.values[i];if(str_(col_(t,v,'username')).toLowerCase()===username.toLowerCase()&&str_(col_(t,v,'password'))===password){row=v;break;}}
 if(!row){cache.put(key,String(num_(cache.get(key))+1),600);return fail_('bad_credentials','اسم المستخدم أو كلمة السر غير صحيحة');}cache.remove(key);
 if(!ACTIVE_VALUES.includes(str_(col_(t,row,'status')).toLowerCase()))return fail_('locked','الحساب مغلق. تواصل مع الإدارة');
 const days=daysLeft_(col_(t,row,'subscription_end'));if(days===null||days<0)return fail_('expired','الاشتراك منتهي أو التاريخ غير صحيح');
 const get=k=>str_(col_(t,row,k));const storeCode=get('store_code');if(!storeCode)return fail_('locked','كود المحل غير موجود');
 return {ok:true,account:{storeCode,username:get('username'),ownerName:get('owner_name'),storeName:get('store_name'),vatNumber:get('vat_number'),district:get('district'),phone:get('phone'),address:get('address'),subscriptionEnd:dateStr_(col_(t,row,'subscription_end')),daysLeft:days,maxDevices:miloAccountLimit_(row,t,'max_devices'),maxUsers:miloAccountLimit_(row,t,'max_users')}};
}
// Limits: empty/zero = not configured (backward compatible); positive integers enforce caps.
function miloAccountLimit_(row,t,key){
 const raw=str_(col_(t,row,key));if(!raw)return 0;
 const n=Number(raw);return Number.isSafeInteger(n)&&n>0?n:0;
}
function miloStoreLimit_(storeCode,key){
 const t=table_(SHEETS.accounts);
 for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===storeCode)
  return miloAccountLimit_(t.values[i],t,key);
 return 0;
}
// Run manually once, instead of setup(), to append only the two account headers.
function miloInstallAccountLimits(){
 const sh=book_().getSheetByName(SHEETS.accounts);
 if(!sh)throw Error('ورقة Accounts غير موجودة');
 ensureSheet_(book_(),SHEETS.accounts,ACCOUNT_HEADERS);
 Logger.log('تمت إضافة أعمدة الحدود عند الحاجة، دون تغيير بيانات الحسابات');
}

// MILO device admission: registration happens during login under a script lock.
// Limit 0/empty means unlimited for older accounts. Device IDs identify browser
// installations, NOT tamper-proof physical hardware identities.
function miloDeviceAccess_(req,storeCode,register){
 const max=miloStoreLimit_(storeCode,'max_devices');
 if(max<=0)return {ok:true};
 const code=str_(req.deviceCode);
 if(!/^MILO-[0-9A-F]{20}$/.test(code))return fail_('device_required','يجب تحديث كاشير ميلو لتسجيل الدخول بمعرّف الجهاز');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  ensureSheet_(book_(),SHEETS.deviceStatus,DEVICE_STATUS_HEADERS);
  const t=table_(SHEETS.deviceStatus);requireCols_(t,DEVICE_STATUS_HEADERS);
  let count=0,found=false;
  for(let i=1;i<t.values.length;i++){
   const row=t.values[i];if(str_(col_(t,row,'store_code'))!==storeCode)continue;
   const id=str_(col_(t,row,'device_code'));
   if(!id)continue;
   count++;
   if(id===code)found=true;
  }
  if(found)return {ok:true,registered:true,maxDevices:max,usedDevices:count};
  const message='عذرًا، لقد تعديت عدد الأجهزة المسموح بها في حسابك. الحد المسموح: '+max+' جهاز. تواصل مع إدارة ميلو.';
  if(!register||count>=max)return fail_('device_limit',message);
  const now=new Date().toISOString();
  const row={store_code:storeCode,device_code:code,
   device_name:safeLimited_(req.deviceName||'MILO Cashier',80),
   username:safeLimited_(req.username,120),last_open:now,last_seen:now,
   current_status:'متصل',updated_at:now};
  t.sh.appendRow(rowFor_(t.headers,row));
  return {ok:true,registered:true,maxDevices:max,usedDevices:count+1};
 }finally{lock.releaseLock();}
}

function route_(req){const action=str_(req.action);if(action==='miloPayRelay')return miloPayRelayAction_(req);if(action==='miloFinance')return miloFinanceAction_(req);if(['publicKioskCatalog','submitKioskOrder','kioskConfig','kioskToggle','kioskRotate','kioskOrders','kioskStatus','kioskComplete','kioskGetInvoice','kioskClaimPrint','kioskPrintResult','kioskRetryPrint'].includes(action))return miloKioskAction_(action,req);if(action.startsWith('admin'))return miloAdminAction_(req);if(['publicCustomerCatalog','submitCustomerOrder','publicOrderStatus'].includes(action))return miloPublicOrderAction_(action,req);if(!['login','ping','products','categories','saveCategory','deleteCategory','reports','addInvoice','saveProducts','uploadProductImage','shifts','saveShifts','customers','saveCustomers','suppliers','saveSuppliers','claimPrint','completePrint','getStoreSettings','saveStoreSettings','expenses','saveExpenses','promotions','savePromotions','employees','saveEmployees','returns','saveReturns','purchases','savePurchases','purchaseItems','savePurchaseItems','vouchers','saveVouchers','saveDeviceEvents','submitSupportTicket','getSupportConversation','saveReportDaily','reportDaily','capabilities','deleteEntity','deletedRecords','purgeInvoices','purgeReports','purgeProducts','customerOrders','updateCustomerOrder','completeCustomerOrder','getCustomerOrderInvoice','kitchenOrders','updateKitchenOrder','invoiceShareLink','invoicePdf'].includes(action))return fail_('bad_request','طلب غير معروف');const auth=authenticate_(req);if(!auth.ok)return auth;const storeCode=auth.account.storeCode;const deviceAccess=miloDeviceAccess_(req,storeCode,action==='login');if(!deviceAccess.ok)return deviceAccess;
 if(action==='login'||action==='ping')return {ok:true,account:auth.account};
 if(action==='categories')return miloListCategories_(storeCode);
 if(action==='saveCategory')return miloSaveCategory_(storeCode,req.name);
 if(action==='deleteCategory')return miloDeleteCategory_(storeCode,req.name);
 if(action==='invoiceShareLink')return miloInvoiceShareLink_(storeCode,req);
 if(action==='invoicePdf')return miloInvoicePdfFile_(storeCode,req);
  if(action==='kitchenOrders')return miloKitchenOrders_(storeCode,req);
  if(action==='updateKitchenOrder')return miloUpdateKitchenOrder_(storeCode,req,auth.account);
  if(action==='customerOrders')return miloCustomerOrders_(storeCode);
  if(action==='updateCustomerOrder')return miloUpdateCustomerOrder_(storeCode,req);
  if(action==='completeCustomerOrder')return miloCompleteCustomerOrder_(storeCode,req,auth.account);
  if(action==='getCustomerOrderInvoice')return miloGetCustomerOrderInvoice_(storeCode,req);
 if(['purgeInvoices','purgeReports','purgeProducts','customerOrders','updateCustomerOrder'].includes(action))return miloPurgeStoreData_(action,auth.account,req);
 if(action==='capabilities')return {ok:true,reportsSyncVersion:2};
 if(action==='saveReportDaily')return saveReportDaily_(storeCode,req.records);
 if(action==='reportDaily')return {ok:true,dailyReports:readReportDaily_(storeCode,str_(req.from),str_(req.to))};
 if(action==='saveDeviceEvents')return saveDeviceEvents_(storeCode,auth.account,req.events);
 if(action==='submitSupportTicket')return submitSupportTicket_(storeCode,auth.account,req.ticket);
 if(action==='getSupportConversation')return miloSupportConversation_(storeCode,auth.account,req);
 if(action==='products'){
  const catalog=products_(storeCode),revision=productCatalogRevision_(catalog);
  if(str_(req.ifRevision)&&str_(req.ifRevision)===revision)
   return {ok:true,productsUnchanged:true,productsRevision:revision};
  return {ok:true,products:catalog,productsUnchanged:false,productsRevision:revision};
 }
 if(action==='saveProducts')return saveProducts_(storeCode,req.products);
 if(action==='uploadProductImage')return miloUploadProductImage_(storeCode,req);
 if(action==='deleteEntity')return deleteEntity_(storeCode,req.entityType,req.recordId);
 if(action==='deletedRecords')return {ok:true,deletedRecords:listDeletedRecords_(storeCode)};
 if(action==='shifts')return {ok:true,shifts:readEntities_(SHEETS.shifts,SHIFT_HEADERS,storeCode)};
 if(action==='customers')return {ok:true,customers:readEntities_(SHEETS.customers,CONTACT_HEADERS,storeCode)};
 if(action==='suppliers')return {ok:true,suppliers:readEntities_(SHEETS.suppliers,CONTACT_HEADERS,storeCode)};
 if(action==='saveShifts')return saveEntities_(SHEETS.shifts,SHIFT_HEADERS,storeCode,req.shifts,'shift_id',['shift_id','terminal']);
 if(action==='saveCustomers')return saveEntities_(SHEETS.customers,CONTACT_HEADERS,storeCode,req.customers,'contact_id',['contact_id']);
 if(action==='saveSuppliers')return saveEntities_(SHEETS.suppliers,CONTACT_HEADERS,storeCode,req.suppliers,'contact_id',['contact_id']);
 if(action==='getStoreSettings')return {ok:true,settings:getStoreSettings_(storeCode)};
 if(action==='saveStoreSettings')return saveStoreSettings_(storeCode,req.settings);
 for(const [category,schema] of Object.entries(EXTRA_SCHEMAS)){
  if(action===category)return {ok:true,records:readEntities_(SHEETS[category],schema.headers,storeCode)};
  if(action==='save'+category.charAt(0).toUpperCase()+category.slice(1))
   return saveExtraRecords_(SHEETS[category],schema,storeCode,req.records);
 }
 if(action==='claimPrint')return claimPrint_(storeCode);
 if(action==='completePrint')return completePrint_(storeCode,req);
 if(action==='reports')return {ok:true,account:auth.account,reports:reports_(storeCode,str_(req.from),str_(req.to))};
 const saved=addInvoice_(storeCode,req.invoice||{},req.noStockDeduction===true);return {ok:true,duplicate:!saved};
}

// Daily report snapshots contain derived totals, not invoices. A record is keyed by
// authenticated store_code + stable device_code + calendar date. Retrying replaces it.
// The source of truth remains the Reports invoice sheet; never add snapshots to it.
function saveReportDaily_(storeCode,records){
 if(!Array.isArray(records)||!records.length||records.length>50)
  return fail_('bad_request','يجب إرسال 1 إلى 50 تقريرًا يوميًا');
 const rows=[],seen=new Set();
 for(const record of records){
  if(!record||typeof record!=='object')return fail_('bad_request','سجل التقرير غير صحيح');
  const device=str_(record.deviceCode),day=str_(record.reportDate),id=str_(record.reportId);
  if(!/^MILO-[A-F0-9]{20}$/.test(device)||!/^\d{4}-\d{2}-\d{2}$/.test(day)||
     id!==device+':'+day||seen.has(id))return fail_('bad_request','معرف التقرير أو تاريخه غير صحيح');
  seen.add(id);
  const numbers=['invoiceCount','subtotal','salesTotal','vat','discount','cash','card','cost','grossProfit'];
  if(numbers.some(k=>typeof record[k]!=='number'||!isFinite(record[k])||Math.abs(record[k])>1000000000000))
   return fail_('bad_request','أرقام التقرير غير صحيحة');
  if(!Number.isInteger(record.invoiceCount)||record.invoiceCount<0)return fail_('bad_request','عدد الفواتير غير صحيح');
  const top=str_(record.topProductsJson);
  if(top.length>35000)return fail_('bad_request','تفاصيل المنتجات طويلة جدًا');
  let parsed;try{parsed=JSON.parse(top||'[]');}catch(e){return fail_('bad_request','تفاصيل المنتجات ليست JSON');}
  if(!Array.isArray(parsed)||parsed.length>20||parsed.some(x=>!x||typeof x.name!=='string'||x.name.length>300||
     !isFinite(x.qty)||!isFinite(x.total)))return fail_('bad_request','تفاصيل المنتجات غير صحيحة');
  rows.push({store_code:storeCode,report_id:id,device_code:device,report_date:day,
   invoice_count:record.invoiceCount,subtotal:record.subtotal,sales_total:record.salesTotal,
   vat:record.vat,discount:record.discount,cash:record.cash,card:record.card,
   cost:record.cost,gross_profit:record.grossProfit,top_products_json:top,
   terminal_id:safeCell_(str_(record.terminalId).slice(0,64)),terminal_name:safeCell_(str_(record.terminalName).slice(0,80)),
   updated_at:Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss')});
 }
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  ensureSheet_(book_(),SHEETS.reportDaily,REPORT_DAILY_HEADERS);
  const t=table_(SHEETS.reportDaily);requireCols_(t,REPORT_DAILY_HEADERS);
  const index=new Map();for(let i=1;i<t.values.length;i++){
   if(str_(col_(t,t.values[i],'store_code'))!==storeCode)continue;
   const id=str_(col_(t,t.values[i],'report_id'));if(id&&!index.has(id))index.set(id,i+1);
  }
  let added=0,updated=0;
  const append=[];
  for(const data of rows){
   const n=index.get(data.report_id);
   const vals=n?t.values[n-1].slice():Array(t.headers.length).fill('');
   REPORT_DAILY_HEADERS.forEach(h=>{vals[t.idx[h]]=data[h];});
   if(n){t.sh.getRange(n,1,1,t.headers.length).setValues([vals]);updated++;}
   else{append.push(vals);added++;}
  }
  if(append.length)t.sh.getRange(t.sh.getLastRow()+1,1,append.length,t.headers.length).setValues(append);
  SpreadsheetApp.flush();return {ok:true,added,updated,count:rows.length};
 }finally{lock.releaseLock();}
}
function readReportDaily_(storeCode,from,to){
 if((from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to)))
  throw Error('نطاق التاريخ غير صحيح');
 ensureSheet_(book_(),SHEETS.reportDaily,REPORT_DAILY_HEADERS);
 const t=table_(SHEETS.reportDaily);requireCols_(t,REPORT_DAILY_HEADERS);
 const data=[];
 for(let i=1;i<t.values.length;i++){
  const row=t.values[i];if(str_(col_(t,row,'store_code'))!==storeCode)continue;
  const day=dateStr_(col_(t,row,'report_date'));
  if((from&&day<from)||(to&&day>to))continue;
  data.push({reportId:str_(col_(t,row,'report_id')),deviceCode:str_(col_(t,row,'device_code')),
   terminalId:str_(col_(t,row,'terminal_id')),terminalName:str_(col_(t,row,'terminal_name')),
   reportDate:day,invoiceCount:num_(col_(t,row,'invoice_count')),
   subtotal:num_(col_(t,row,'subtotal')),salesTotal:num_(col_(t,row,'sales_total')),
   vat:num_(col_(t,row,'vat')),discount:num_(col_(t,row,'discount')),
   cash:num_(col_(t,row,'cash')),card:num_(col_(t,row,'card')),
   cost:num_(col_(t,row,'cost')),grossProfit:num_(col_(t,row,'gross_profit')),
   topProductsJson:str_(col_(t,row,'top_products_json')),updatedAt:str_(col_(t,row,'updated_at'))});
 }
 return data;
}

// Store-wide preferences: never accept store_code from the client or share device printer paths.
function getStoreSettings_(storeCode){
 const t=table_(SHEETS.storeSettings);requireCols_(t,STORE_SETTING_HEADERS);
 const result={};for(let i=1;i<t.values.length;i++){
  const v=t.values[i];if(str_(col_(t,v,'store_code'))!==storeCode)continue;
  const key=str_(col_(t,v,'setting_key'));if(STORE_SETTING_KEYS.includes(key))result[key]=str_(col_(t,v,'setting_value'));
 }return result;
}
function saveStoreSettings_(storeCode,settings){
 if(!settings||typeof settings!=='object'||Array.isArray(settings))return fail_('bad_request','إعدادات غير صحيحة');
 const entries=Object.entries(settings);
 if(!entries.length||entries.length>STORE_SETTING_KEYS.length||entries.some(([k,v])=>!STORE_SETTING_KEYS.includes(k)||typeof v!=='string'||v.length>1000))return fail_('bad_request','مفتاح إعدادات أو قيمة غير مسموح بها');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{const t=table_(SHEETS.storeSettings);requireCols_(t,STORE_SETTING_HEADERS);
  const rows={};for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===storeCode)rows[str_(col_(t,t.values[i],'setting_key'))]=i+1;
  const when=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss');
  const appended=[];for(const [key,value] of entries){
   const row={store_code:storeCode,setting_key:key,setting_value:safeCell_(value),updated_at:when};
   const vals=t.headers.map(h=>row[h]===undefined?'':row[h]);
   if(rows[key])t.sh.getRange(rows[key],1,1,vals.length).setValues([vals]);else appended.push(vals);
  }
  if(appended.length)t.sh.getRange(t.sh.getLastRow()+1,1,appended.length,t.headers.length).setValues(appended);
  return {ok:true,count:entries.length};
 }finally{lock.releaseLock();}
}
function saveExtraRecords_(name,schema,storeCode,records){
 if(!Array.isArray(records)||records.length<1||records.length>200)return fail_('bad_request','عدد السجلات غير صحيح');
 const known=new Set(schema.headers),seen=new Set(),items=[];
 for(const record of records){
  if(!record||typeof record!=='object'||Array.isArray(record))return fail_('bad_request','سجل غير صالح');
  const id=str_(record[schema.id]);if(!id||id.length>120||seen.has(id))return fail_('bad_request','معرف مفقود أو مكرر');seen.add(id);
  const entry={store_code:storeCode,updated_at:Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss')};
  for(const key of Object.keys(record))if(known.has(key)&&key!=='store_code'&&key!=='updated_at'){
   const val=record[key];if(typeof val!=='number'&&typeof val!=='string'&&typeof val!=='boolean')return fail_('bad_request','نوع حقل غير صالح');
   entry[key]=typeof val==='string'?safeCell_(val.slice(0,2000)):val;
  }
  entry[schema.id]=id;items.push(entry);
 }
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{const t=table_(name);requireCols_(t,schema.headers);const existing=new Map();
  for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===storeCode)existing.set(str_(col_(t,t.values[i],schema.id)),i+1);
  // Enforce max_users only for new enabled employees; updates to existing records remain possible.
  if(name===SHEETS.employees){
   const cap=miloStoreLimit_(storeCode,'max_users');
   if(cap>0){
    const active=new Set();
    for(let i=1;i<t.values.length;i++){
     const r=t.values[i];
     if(str_(col_(t,r,'store_code'))!==storeCode)continue;
     const enabled=str_(col_(t,r,'enabled')).toLowerCase();
     if(!['false','0','no','لا','معطل','مغلق'].includes(enabled))active.add(str_(col_(t,r,'record_id')));
    }
    for(const item of items){
     const enabled=str_(item.enabled).toLowerCase();
     if(['false','0','no','لا','معطل','مغلق'].includes(enabled))active.delete(item.record_id);
     else active.add(item.record_id);
    }
    if(active.size>cap)return fail_('user_limit','تم بلوغ الحد المسموح للمستخدمين: '+cap);
   }
  }
  const append=[];for(const item of items){const vals=t.headers.map(h=>item[h]===undefined?'':item[h]);
   if(existing.has(item[schema.id]))t.sh.getRange(existing.get(item[schema.id]),1,1,vals.length).setValues([vals]);else append.push(vals);
  }
  if(append.length)t.sh.getRange(t.sh.getLastRow()+1,1,append.length,t.headers.length).setValues(append);
  return {ok:true,count:items.length,added:append.length};
 }finally{lock.releaseLock();}
}
// Generic store-isolated reads / idempotent upserts for business records.
function safeCell_(value){const s=str_(value);return /^[=+@\-]/.test(s)&&!/^-[0-9.]+$/.test(s)?"'"+s:s;}
function readEntities_(name,headers,storeCode){
 const t=table_(name);requireCols_(t,headers);const out=[];
 const entityType=name===SHEETS.customers?'customer':name===SHEETS.suppliers?'supplier':'';
 const deleted=entityType?deletedKeys_(storeCode,entityType):new Set();
 for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===storeCode&&
    (!entityType||!deleted.has(str_(col_(t,t.values[i],'contact_id'))))){
  const obj={};headers.forEach(h=>{if(h!=='store_code'){
   let v=col_(t,t.values[i],h);obj[h]=v instanceof Date?Utilities.formatDate(v,Session.getScriptTimeZone(),"yyyy-MM-dd'T'HH:mm:ss"):v;
  }});out.push(obj);
 }return out;
}
function saveEntities_(name,headers,storeCode,incoming,idField,keyFields){
 if(!Array.isArray(incoming)||incoming.length<1||incoming.length>250)return fail_('bad_request','يجب إرسال 1 إلى 250 سجلاً');
 const items=[],seen=new Set();
 for(const original of incoming){
  if(!original||typeof original!=='object')return fail_('bad_request','السجل غير صحيح');
  const entry={store_code:storeCode};
  headers.forEach(h=>{if(h!=='store_code')entry[h]=typeof original[h]==='number'?original[h]:safeCell_(original[h]);});
  if(!str_(entry[idField])||str_(entry[idField]).length>120)return fail_('bad_request','معرف السجل مفقود');
  if(name!==SHEETS.shifts&&!str_(entry.name))return fail_('bad_request','اسم العميل أو المورد مطلوب');
  const key=keyFields.map(h=>str_(entry[h])).join('::');
  if(seen.has(key))return fail_('bad_request','سجل مكرر في الطلب');
  seen.add(key);entry.updated_at=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyy-MM-dd HH:mm:ss");items.push({key,entry});
 }
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const t=table_(name);requireCols_(t,headers);const indexed=new Map();
  const entityType=name===SHEETS.customers?'customer':name===SHEETS.suppliers?'supplier':'';
  const deleted=entityType?deletedKeys_(storeCode,entityType):new Set();
  for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===storeCode){
   const key=keyFields.map(h=>str_(col_(t,t.values[i],h))).join('::');if(!indexed.has(key))indexed.set(key,i+1);
  }
  const append=[];let added=0,updated=0,skipped=0;
  for(const item of items){
   if(deleted.has(str_(item.entry[idField]))){skipped++;continue;}
   const vals=t.headers.map(h=>item.entry[h]===undefined?'':item.entry[h]);
   if(indexed.has(item.key)){t.sh.getRange(indexed.get(item.key),1,1,vals.length).setValues([vals]);updated++;}
   else{append.push(vals);added++;}
  }
  if(append.length)t.sh.getRange(t.sh.getLastRow()+1,1,append.length,t.headers.length).setValues(append);
  SpreadsheetApp.flush();return {ok:true,added,updated,skipped,count:items.length};
 }finally{lock.releaseLock();}
}

// Product-sheet rollover within the same spreadsheet. Workbook quotas still apply.
const MILO_PRODUCT_ROWS_PER_SHEET_=20000;
function miloProductTables_(){
 const ss=book_();return ss.getSheets().filter(sh=>/^Products(?:_[2-9][0-9]*)?$/.test(sh.getName()))
  .sort((a,b)=>miloProductSheetNumber_(a.getName())-miloProductSheetNumber_(b.getName()))
  .map(sh=>table_(sh.getName()));
}
function miloProductSheetNumber_(name){return name==='Products'?1:Number(name.slice(9));}
function miloProductWriteTable_(){
 const ts=miloProductTables_();if(!ts.length)throw Error('ورقة Products غير موجودة');
 const last=ts[ts.length-1];requireCols_(last,PRODUCT_HEADERS);
 if(last.sh.getLastRow()-1<MILO_PRODUCT_ROWS_PER_SHEET_)return last;
 const next='Products_'+(miloProductSheetNumber_(last.sh.getName())+1);
 ensureSheet_(book_(),next,PRODUCT_HEADERS);
 return table_(next);
}
function miloFindProductRow_(store,barcode){
 for(const t of miloProductTables_())for(let i=1;i<t.values.length;i++)
  if(str_(col_(t,t.values[i],'store_code'))===store&&str_(col_(t,t.values[i],'barcode'))===barcode)
   return {t,row:i+1,values:t.values[i]};
 return null;
}
function miloProductStockDeduct_(store,items){
 const sums={};for(const it of items){const b=str_(it.barcode),q=num_(it.qty);if(b&&q>0)sums[b]=(sums[b]||0)+q;}
 for(const [barcode,qty] of Object.entries(sums)){
  const found=miloFindProductRow_(store,barcode);if(!found)continue;
  if(['1','true','yes','نعم'].includes(str_(col_(found.t,found.values,'unlimited_stock')).toLowerCase()))continue;
  found.t.sh.getRange(found.row,found.t.idx.stock+1).setValue(Math.max(0,num_(col_(found.t,found.values,'stock'))-qty));
 }
}
function miloProductStorageStatus(){return miloProductTables_().map(t=>({sheet:t.sh.getName(),products:t.values.length-1}));}

function products_(storeCode){const out=new Map();
 const deleted=deletedKeys_(storeCode,'product');
 for(const t of miloProductTables_()){requireCols_(t,['store_code','barcode','name','price']);for(let r=1;r<t.values.length;r++){
  const v=t.values[r],barcode=str_(col_(t,v,'barcode'));
  if(str_(col_(t,v,'store_code'))!==storeCode||!barcode||!str_(col_(t,v,'name'))||
    deleted.has(barcode)||out.has(barcode))continue;
  // Existing duplicate barcodes in older sheets are read only once; no history is deleted.
  out.set(barcode,{barcode,name:str_(col_(t,v,'name')),price:num_(col_(t,v,'price')),
   wholesalePrice:num_(col_(t,v,'wholesale_price')),costPrice:num_(col_(t,v,'cost_price')),
   stock:num_(col_(t,v,'stock')),category:str_(col_(t,v,'category')),
   unit:str_(col_(t,v,'unit')),minStock:num_(col_(t,v,'min_stock')),
   description:str_(col_(t,v,'description')),imageUrl:str_(col_(t,v,'image_url')),
   unlimitedStock:['1','true','yes','نعم'].includes(str_(col_(t,v,'unlimited_stock')).toLowerCase()),
   restaurantOptionsJson:str_(col_(t,v,'restaurant_options_json'))});
 }
 }return Array.from(out.values());
}
// Stable store-specific digest: if unchanged, the second terminal downloads NO catalog.
// No extra columns and no product duplication. Local edits still queue on save.
function productCatalogRevision_(items){
 const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(items),Utilities.Charset.UTF_8);
 return Utilities.base64EncodeWebSafe(digest);
}
// Store-scoped batch upsert. Never accept store_code from client payload.
function saveProducts_(storeCode, incoming){
 if(!Array.isArray(incoming)||incoming.length<1||incoming.length>300) return fail_('bad_request','عدد المنتجات غير صالح (1 إلى 300)');
 const validated=[],seen=new Set();
 for(const item of incoming){
  const barcode=str_(item.barcode),name=str_(item.name);
  const keys=['price','wholesalePrice','costPrice','stock','minStock'];
  if(!barcode||barcode.length>120||!name||name.length>500||seen.has(barcode)||keys.some(k=>!Number.isFinite(Number(item[k]))||Number(item[k])<0))
   return fail_('invalid_product','بيانات منتج غير صالحة أو باركود مكرر');
  seen.add(barcode);
  validated.push({store_code:storeCode,barcode,name,price:num_(item.price),wholesale_price:num_(item.wholesalePrice),cost_price:num_(item.costPrice),stock:num_(item.stock),category:str_(item.category),unit:str_(item.unit)||'حبة',min_stock:num_(item.minStock),description:str_(item.description),image_url:/^https:\/\//i.test(str_(item.imageUrl))?str_(item.imageUrl).slice(0,2000):'',unlimited_stock:item.unlimitedStock===true?1:(item.unlimitedStock===false?0:undefined),restaurant_options_json:str_(item.restaurantOptionsJson).slice(0,18000)});
 }
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const deleted=deletedKeys_(storeCode,'product');
  let added=0,updated=0,skipped=0;
  for(const item of validated){
   if(deleted.has(item.barcode)){skipped++;continue;}
   const found=miloFindProductRow_(storeCode,item.barcode);
   const t=found?found.t:miloProductWriteTable_();requireCols_(t,PRODUCT_HEADERS);
   const old=found?found.values:null;
   const vals=t.headers.map((h,i)=>item[h]===undefined?(old?old[i]:''):item[h]);
   if(found){
    if(vals.some((v,j)=>String(v??'')!==String(old[j]??''))){t.sh.getRange(found.row,1,1,vals.length).setValues([vals]);updated++;}
    else skipped++;
   }else{t.sh.appendRow(vals);added++;}
  }
  SpreadsheetApp.flush();return {ok:true,added,updated,skipped,count:validated.length};
 }finally{lock.releaseLock();}
}
// Deletion is immediate and account-scoped. Historic invoices/ledger entries are never removed.
// A tombstone prevents an offline terminal's next upsert from re-creating a deleted record.
function deletedKeys_(storeCode, entityType){
 const sh=book_().getSheetByName(SHEETS.deletedRecords);
 if(!sh)return new Set();
 const t=table_(SHEETS.deletedRecords);requireCols_(t,DELETED_HEADERS);
 return new Set(t.values.slice(1).filter(v=>str_(col_(t,v,'store_code'))===storeCode&&
   str_(col_(t,v,'entity_type'))===entityType).map(v=>str_(col_(t,v,'record_key'))));
}
function listDeletedRecords_(storeCode){
 const sh=book_().getSheetByName(SHEETS.deletedRecords);if(!sh)return [];
 const t=table_(SHEETS.deletedRecords);requireCols_(t,DELETED_HEADERS);
 return t.values.slice(1).filter(r=>str_(col_(t,r,'store_code'))===storeCode)
  .map(r=>({entityType:str_(col_(t,r,'entity_type')),recordId:str_(col_(t,r,'record_key'))}));
}
function deleteEntity_(storeCode,entityType,recordId){
 const targets={product:{name:SHEETS.products,column:'barcode'},
                customer:{name:SHEETS.customers,column:'contact_id'},
                supplier:{name:SHEETS.suppliers,column:'contact_id'}};
 const kind=str_(entityType),key=str_(recordId),target=targets[kind];
 if(!target||!key||key.length>120||/[\r\n]/.test(key)||/^[=+@]/.test(key))
   return fail_('bad_request','معرف السجل غير صالح');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
   // Keep the deletion record first. On a partial failure a later retry can finish deletion safely.
   const tomb=ensureSheet_(book_(),SHEETS.deletedRecords,DELETED_HEADERS);
   const saved=deletedKeys_(storeCode,kind);
   if(!saved.has(key)){
     const ts=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss');
     const t=table_(SHEETS.deletedRecords);
     t.sh.appendRow(t.headers.map(h=>({store_code:storeCode,entity_type:kind,record_key:key,deleted_at:ts}[h]||'')));
     SpreadsheetApp.flush();
   }
   const tables=kind==='product'?miloProductTables_():[table_(target.name)];
   let removed=0;
   for(const t of tables){requireCols_(t,['store_code',target.column]);
    for(let i=t.values.length-1;i>=1;i--){const v=t.values[i];
     if(str_(col_(t,v,'store_code'))===storeCode&&str_(col_(t,v,target.column))===key){t.sh.deleteRow(i+1);removed++;}
    }
   }
   return {ok:true,deleted:true,count:removed};
 }finally{lock.releaseLock();}
}
function reports_(storeCode,from,to){ensureSheet_(book_(),SHEETS.reports,REPORT_HEADERS);if(from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))throw Error('تاريخ البداية غير صحيح');if(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to))throw Error('تاريخ النهاية غير صحيح');
 const t=table_(SHEETS.reports);requireCols_(t,['store_code','invoice_id','date']);const out=[];
 for(let r=1;r<t.values.length;r++){const v=t.values[r];if(str_(col_(t,v,'store_code'))!==storeCode)continue;let raw=col_(t,v,'date');let date=raw instanceof Date?Utilities.formatDate(raw,Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss'):str_(raw);const day=date.slice(0,10);if((from&&day<from)||(to&&day>to))continue;
 out.push({invoiceId:str_(col_(t,v,'invoice_id')),date,terminalName:str_(col_(t,v,'terminal_name')),cashier:str_(col_(t,v,'cashier')),customer:str_(col_(t,v,'customer')),customerPhone:str_(col_(t,v,'customer_phone')),subtotal:num_(col_(t,v,'subtotal')),discount:num_(col_(t,v,'discount')),total:num_(col_(t,v,'total')),vat:num_(col_(t,v,'vat')),cash:num_(col_(t,v,'cash')),card:num_(col_(t,v,'card')),change:num_(col_(t,v,'change')),terminal:str_(col_(t,v,'terminal')),itemsCount:num_(col_(t,v,'items_count')),items:str_(col_(t,v,'items')),serviceType:str_(col_(t,v,'service_type'))});}
 out.sort((a,b)=>b.date.localeCompare(a.date));return out;
}
function addInvoice_(storeCode,inv,skipStockDeduction){ensureSheet_(book_(),SHEETS.reports,REPORT_HEADERS);const id=str_(inv.invoiceId),terminal=str_(inv.terminal);if(!id)throw Error('رقم الفاتورة ناقص');const lock=LockService.getScriptLock();lock.waitLock(25000);try{
 const t=table_(SHEETS.reports);requireCols_(t,['store_code','invoice_id']);for(let i=1;i<t.values.length;i++){const v=t.values[i];if(str_(col_(t,v,'store_code'))===storeCode&&str_(col_(t,v,'invoice_id'))===id&&str_(col_(t,v,'terminal'))===terminal)return false;}
 const items=Array.isArray(inv.items)?inv.items:[];if(items.length>500)throw Error('عدد المنتجات كبير جدًا');
 const values={store_code:storeCode,invoice_id:id,date:str_(inv.date),cashier:str_(inv.cashier),customer:str_(inv.customer),customer_phone:str_(inv.customerPhone),subtotal:num_(inv.subtotal),discount:num_(inv.discount),total:num_(inv.total),vat:num_(inv.vat),cash:num_(inv.cash),card:num_(inv.card),change:num_(inv.change),terminal,terminal_name:safeCell_(str_(inv.terminalName).slice(0,80)),items_count:items.length,items:items.map(it=>str_(it.name)+' ×'+num_(it.qty)+' = '+num_(it.total)).join(' | '),service_type:safeCell_(str_(inv.serviceType||'')),invoice_share_token:Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'')};
 t.sh.appendRow(t.headers.map(h=>values[h]===undefined?'':values[h]));
 // The terminal already decremented local stock and queued an absolute stock value.
 // Avoid deducting again for synced invoices and historical backfill.
 if(!skipStockDeduction)miloProductStockDeduct_(storeCode,items);
 return true;
 }finally{lock.releaseLock();}}
// Restaurant kitchen: cloud-synchronized statuses. Never creates an invoice or changes inventory.
function miloKitchenMode_(store){return str_(getStoreSettings_(store).restaurant_mode)==='restaurant';}
function miloKitchenOrders_(store,req){
 if(!miloKitchenMode_(store))return fail_('restaurant_disabled','فعّل وضع المطعم من إعدادات المتجر');
 const day=str_(req.day)||Utilities.formatDate(new Date(),'Asia/Riyadh','yyyy-MM-dd');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return fail_('bad_request','تاريخ الطلب غير صحيح');
 const report=reports_(store,day,day);
 ensureSheet_(book_(),SHEETS.kitchenOrders,KITCHEN_HEADERS);
 const t=table_(SHEETS.kitchenOrders),statuses=new Map();
 for(let i=1;i<t.values.length;i++){
  const r=t.values[i];if(str_(col_(t,r,'store_code'))!==store)continue;
  statuses.set(str_(col_(t,r,'invoice_id'))+'::'+str_(col_(t,r,'terminal')),{status:str_(col_(t,r,'status')),updatedAt:str_(col_(t,r,'updated_at'))});
 }
 const orders=report.filter(r=>['محلي','سفري'].includes(str_(r.serviceType))).map(r=>{
  const state=statuses.get(r.invoiceId+'::'+r.terminal)||{};
  return {orderId:r.invoiceId,invoiceId:r.invoiceId,terminal:r.terminal,createdAt:r.date,customerName:r.customer||r.serviceType,
    serviceType:r.serviceType,items:r.items,total:r.total,status:state.status||'جديد',updatedAt:state.updatedAt||r.date};
 });
 return {ok:true,orders};
}
function miloUpdateKitchenOrder_(store,req,account){
 if(!miloKitchenMode_(store))return fail_('restaurant_disabled','وضع المطعم غير مفعل');
 const invoiceId=str_(req.invoiceId),terminal=str_(req.terminal),status=str_(req.status);
 if(!invoiceId||invoiceId.length>150||!terminal||terminal.length>150||!['قيد التجهيز','جاهز للاستلام'].includes(status))return fail_('bad_request','بيانات حالة الطلب غير صحيحة');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const rt=table_(SHEETS.reports);
  let exists=false;
  for(let i=1;i<rt.values.length;i++){
   const row=rt.values[i];
   if(str_(col_(rt,row,'store_code'))===store&&str_(col_(rt,row,'invoice_id'))===invoiceId&&str_(col_(rt,row,'terminal'))===terminal&&['سفري','محلي'].includes(str_(col_(rt,row,'service_type')))){exists=true;break;}
  }
  if(!exists)return fail_('not_found','فاتورة مطعم غير موجودة في متجرك');
  ensureSheet_(book_(),SHEETS.kitchenOrders,KITCHEN_HEADERS);
  const t=table_(SHEETS.kitchenOrders);let rowNum=0,previous='جديد';
  for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===store&&str_(col_(t,t.values[i],'invoice_id'))===invoiceId&&str_(col_(t,t.values[i],'terminal'))===terminal){rowNum=i+1;previous=str_(col_(t,t.values[i],'status'));break;}
  if(previous===status)return {ok:true,status,duplicate:true};
  if((previous==='جديد'&&status!=='قيد التجهيز')||(previous==='قيد التجهيز'&&status!=='جاهز للاستلام')||previous==='جاهز للاستلام')return fail_('invalid_transition','تغيرت حالة الطلب؛ حدّث الشاشة ثم حاول مجددًا');
  const data={store_code:store,invoice_id:invoiceId,terminal,status,updated_at:new Date().toISOString(),updated_by:safeLimited_(account.username,100)};
  const vals=t.headers.map(h=>data[h]||'');
  if(rowNum)t.sh.getRange(rowNum,1,1,vals.length).setValues([vals]);else t.sh.appendRow(vals);
  return {ok:true,status};
 }finally{lock.releaseLock();}
}

// Queue control: manual rows must include store_code and invoice_id; only literal طباعة/PENDING triggers printing.
function ensurePrintColumns_(){
 const sh=book_().getSheetByName(SHEETS.reports);if(!sh)throw Error('ورقة Reports غير موجودة');
 const names=['print_status','print_token','print_time','print_error'];
 let hdr=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(str_);
 names.forEach(name=>{if(hdr.indexOf(name)<0){let c=hdr.length+1;
  if(c>sh.getMaxColumns()){
   miloMakeRoomForColumns_(book_(),sh,1);
   sh.insertColumnAfter(sh.getMaxColumns());
  }
  sh.getRange(1,c).setValue(name);hdr.push(name);}});
 return table_(SHEETS.reports);
}
function claimPrint_(storeCode){
 const lock=LockService.getScriptLock();lock.waitLock(25000);
 try{const t=ensurePrintColumns_();
  for(let r=1;r<t.values.length;r++){
   const v=t.values[r];if(str_(col_(t,v,'store_code'))!==storeCode)continue;
   if(!str_(col_(t,v,'invoice_id')))continue;
   const state=str_(col_(t,v,'print_status')).toLowerCase();
   const ready=state==='طباعة'||state==='pending'||state==='print';
   if(!ready)continue;
   const token=Utilities.getUuid(),row=r+1;
   t.sh.getRange(row,t.idx.print_status+1).setValue('جاري الطباعة');
   t.sh.getRange(row,t.idx.print_token+1).setValue(token);
   t.sh.getRange(row,t.idx.print_error+1).clearContent();
   const get=k=>col_(t,v,k);
   return {ok:true,job:{token,invoiceId:str_(get('invoice_id')),date:get('date') instanceof Date?Utilities.formatDate(get('date'),Session.getScriptTimeZone(),"yyyy-MM-dd HH:mm:ss"):str_(get('date')),cashier:str_(get('cashier')),customer:str_(get('customer')),subtotal:num_(get('subtotal')),discount:num_(get('discount')),total:num_(get('total')),vat:num_(get('vat')),cash:num_(get('cash')),card:num_(get('card')),items:str_(get('items')),serviceType:str_(get('service_type'))}};
  }return {ok:true,job:null};
 }finally{lock.releaseLock();}
}
function completePrint_(storeCode,req){
 const token=str_(req.token);if(!token)return fail_('bad_request','رمز المهمة ناقص');
 const lock=LockService.getScriptLock();lock.waitLock(25000);
 try{const t=ensurePrintColumns_();for(let r=1;r<t.values.length;r++){
  const v=t.values[r];if(str_(col_(t,v,'store_code'))!==storeCode||str_(col_(t,v,'print_token'))!==token)continue;
  t.sh.getRange(r+1,t.idx.print_status+1).setValue(req.success===true?'تمت الطباعة':'فشلت الطباعة');
  t.sh.getRange(r+1,t.idx.print_error+1).setValue(req.success===true?'':str_(req.message).slice(0,200));
  return {ok:true};
 }return fail_('not_found','مهمة الطباعة منتهية أو غير موجودة');
 }finally{lock.releaseLock();}
}
// MILO V13.3.15: Google Sheets counts ALLOCATED rows * columns in every tab
// against the workbook's 20M-cell limit, including entirely blank cells.
// This helper only removes trailing EMPTY grid space after the last data/formula
// cell. It NEVER touches occupied rows/columns or invoice/product records.
// Note: formatting / validations on unused trailing cells may be removed.
const MILO_WORKBOOK_CELL_LIMIT_ = 10000000;
function miloAllocatedCellCount_(ss){
 return ss.getSheets().reduce((total,tab)=>total+tab.getMaxRows()*tab.getMaxColumns(),0);
}
function miloWorkbookCapacityReport(){
 const ss=book_(),rows=ss.getSheets().map(tab=>({
  name:tab.getName(),maxRows:tab.getMaxRows(),usedRows:tab.getLastRow(),
  maxCols:tab.getMaxColumns(),usedCols:tab.getLastColumn(),
  allocated:tab.getMaxRows()*tab.getMaxColumns()
 })).sort((a,b)=>b.allocated-a.allocated);
 const sum=rows.reduce((a,r)=>a+r.allocated,0);
 Logger.log('MILO: الخلايا المحجوزة '+sum.toLocaleString()+' / '+MILO_WORKBOOK_CELL_LIMIT_.toLocaleString());
 rows.forEach(r=>Logger.log(r.name+': '+r.allocated.toLocaleString()+
  ' خلية محجوزة، الصفوف '+r.usedRows+'/'+r.maxRows+'، الأعمدة '+r.usedCols+'/'+r.maxCols));
 return rows;
}
function miloMakeRoomForColumns_(ss,target,extraCols){
 if(extraCols<=0)return;
 const shortage=()=>miloAllocatedCellCount_(ss)+target.getMaxRows()*extraCols-MILO_WORKBOOK_CELL_LIMIT_;
 if(shortage()<=0)return;
 // Prioritize tabs with the most trailing EMPTY rows; keep at least 25 spare
 // rows for new sales, and at least 100 rows on small sheets.
 const candidates=ss.getSheets().map(tab=>{
  const spare=Math.max(0,tab.getMaxRows()-Math.max(100,tab.getLastRow()+25));
  return {tab,spare,gain:spare*(tab.getMaxColumns()+(tab===target?extraCols:0))};
 }).sort((a,b)=>b.gain-a.gain);
 for(const entry of candidates){
  const left=shortage();if(left<=0)break;
  const tab=entry.tab;
  const freedPerRow=tab.getMaxColumns()+(tab===target?extraCols:0);
  const n=Math.min(entry.spare,Math.ceil(left/freedPerRow));
  if(n<1)continue;
  try{
   const from=tab.getMaxRows()-n+1;
   tab.deleteRows(from,n);
   Logger.log('MILO: تم تحرير '+n+' صف فارغ أسفل '+tab.getName()+' لتوفير مساحة للعمود الجديد');
  }catch(e){Logger.log('تعذر تحرير صفوف '+tab.getName()+': '+e.message);}
 }
 // Also reclaim trailing completely unused columns from OTHER sheets.
 if(shortage()>0){
  const tabs=ss.getSheets().filter(tab=>tab!==target).sort((a,b)=>
   (b.getMaxColumns()-Math.max(2,b.getLastColumn()+1))*b.getMaxRows()-
   (a.getMaxColumns()-Math.max(2,a.getLastColumn()+1))*a.getMaxRows());
  for(const tab of tabs){
   if(shortage()<=0)break;
   const keep=Math.max(2,tab.getLastColumn()+1);
   const free=Math.max(0,tab.getMaxColumns()-keep);
   const n=Math.min(free,Math.ceil(shortage()/tab.getMaxRows()));
   if(n<1)continue;
   try{
    tab.deleteColumns(tab.getMaxColumns()-n+1,n);
    Logger.log('MILO: تم تحرير '+n+' عمود فارغ من '+tab.getName());
   }catch(e){Logger.log('تعذر تحرير أعمدة '+tab.getName()+': '+e.message);}
  }
 }
 if(shortage()>0)
  throw Error('قاعدة البيانات ممتلئة (10 ملايين خلية) حتى بعد فحص الصفوف الفارغة؛ '
   +'شغّل miloWorkbookCapacityReport لمعرفة الأوراق الكبيرة، '
   +'ثم انقل السجلات القديمة إلى ملف أرشيف منفصل بعد أخذ نسخة احتياطية. لم يتم حذف بيانات.');
}
// MILO SAFE FIX (2026-11): the default blank Google sheet allocates
// approximately 1,000 rows x 26 columns. Reserve that space before inserting.
// Only trailing rows/columns AFTER existing data or formulas are removed.
// Existing account, sale, product, and invoice cells are never touched.
// Formatting / validation on unused trailing grid cells may be lost.
function miloReserveCellsForNewSheet_(ss,newSheetName){
 const capacity=1000*26;
 const shortage=()=>miloAllocatedCellCount_(ss)+capacity-MILO_WORKBOOK_CELL_LIMIT_;
 if(shortage()<=0)return;
 const tabs=ss.getSheets();
 // Try unused trailing ROWS first. Keep a minimum 100 rows and at least
 // 25 free rows beyond the last content row to support new transactions.
 const rowCandidates=tabs.map(tab=>{
  const rows=tab.getMaxRows(),cols=tab.getMaxColumns();
  const keep=Math.max(100,tab.getLastRow()+25);
  const spare=Math.max(0,rows-keep);
  return {tab,spare,potential:spare*cols};
 }).sort((a,b)=>b.potential-a.potential);
 for(const candidate of rowCandidates){
  if(shortage()<=0)break;
  const tab=candidate.tab;
  const n=Math.min(candidate.spare,Math.ceil(shortage()/tab.getMaxColumns()));
  if(n<=0)continue;
  const start=tab.getMaxRows()-n+1;
  try{
   tab.deleteRows(start,n);
   Logger.log('MILO: تحرير '+n+' صفوف شبكة فارغة من '+tab.getName());
  }catch(err){Logger.log('MILO: لم يمكن تحرير صفوف '+tab.getName()+': '+err.message);}
 }
 // Then try unused trailing COLUMNS; preserve every used column + one spare.
 if(shortage()>0){
  const colCandidates=tabs.map(tab=>{
   const keep=Math.max(2,tab.getLastColumn()+1);
   const spare=Math.max(0,tab.getMaxColumns()-keep);
   return {tab,spare,potential:spare*tab.getMaxRows()};
  }).sort((a,b)=>b.potential-a.potential);
  for(const candidate of colCandidates){
   if(shortage()<=0)break;
   const tab=candidate.tab;
   const n=Math.min(candidate.spare,Math.ceil(shortage()/tab.getMaxRows()));
   if(n<=0)continue;
   const start=tab.getMaxColumns()-n+1;
   try{
    tab.deleteColumns(start,n);
    Logger.log('MILO: تحرير '+n+' أعمدة شبكة فارغة من '+tab.getName());
   }catch(err){Logger.log('MILO: لم يمكن تحرير أعمدة '+tab.getName()+': '+err.message);}
  }
 }
 if(shortage()>0){
  throw Error('تعذر إنشاء الورقة '+newSheetName+'؛ اقترب الملف من حد 10 ملايين خلية ولا توجد شبكة فارغة كافية. شغّل miloWorkbookCapacityReport. لم تُمسح سجلات المبيعات أو الحسابات.');
 }
 Logger.log('MILO: تم توفير مساحة آمنة قبل إنشاء الورقة '+newSheetName);
}

// Non-destructive schema upgrade: match columns by header name, never rewrite or reorder existing ones.
function ensureSheet_(ss,name,headers){
 let sh=ss.getSheetByName(name);
 if(!sh){miloReserveCellsForNewSheet_(ss,name);sh=ss.insertSheet(name);}
 const existing=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(str_);
 const hasHeaders=existing.some(h=>h!=='');
 if(!hasHeaders){
   if(sh.getMaxColumns()<headers.length){
     const n=headers.length-sh.getMaxColumns();
     miloMakeRoomForColumns_(ss,sh,n);sh.insertColumnsAfter(sh.getMaxColumns(),n);
   }
   sh.getRange(1,1,1,headers.length).setValues([headers]);
 }else{
   // Preserve all old headers and cells, including separately-added printed_at / printed_by.
   // Do not silently create a duplicate store_code when an existing table has malformed headers.
   if(sh.getLastRow()>1&&!existing.includes('store_code'))
     throw Error('الورقة '+name+' تحتوي بيانات بدون عمود store_code؛ راجع صف العناوين قبل التحديث');
   const missing=headers.filter(h=>!existing.includes(h));
   if(missing.length){
     const from=existing.length+1;
     const needed=from+missing.length-1-sh.getMaxColumns();
     if(needed>0){
       miloMakeRoomForColumns_(ss,sh,needed);
       sh.insertColumnsAfter(sh.getMaxColumns(),needed);
     }
     sh.getRange(1,from,1,missing.length).setValues([missing]);
     Logger.log(name+': أضيفت الأعمدة: '+missing.join(', '));
   }
 }
 sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight('bold').setBackground('#14745E').setFontColor('#FFFFFF');
 sh.setFrozenRows(1);
 return sh;
}
function setup(){
 const ss=book_();
 for(const [name,headers] of [[SHEETS.accounts,ACCOUNT_HEADERS],[SHEETS.products,PRODUCT_HEADERS],
 [SHEETS.reports,REPORT_HEADERS],[SHEETS.categories,MILO_CATEGORY_HEADERS],[SHEETS.kitchenOrders,KITCHEN_HEADERS],[SHEETS.customerOrders,MILO_CUSTOMER_ORDER_HEADERS],[SHEETS.reportDaily,REPORT_DAILY_HEADERS],[SHEETS.shifts,SHIFT_HEADERS],[SHEETS.customers,CONTACT_HEADERS],
 [SHEETS.suppliers,CONTACT_HEADERS],[SHEETS.deletedRecords,DELETED_HEADERS],[SHEETS.storeSettings,STORE_SETTING_HEADERS],
 [SHEETS.deviceActivity,DEVICE_ACTIVITY_HEADERS],[SHEETS.deviceStatus,DEVICE_STATUS_HEADERS],
 [SHEETS.deviceAlerts,DEVICE_ALERT_HEADERS],[SHEETS.supportTickets,SUPPORT_TICKET_HEADERS],
 ...Object.entries(EXTRA_SCHEMAS).map(([key,schema])=>[SHEETS[key],schema.headers])])ensureSheet_(ss,name,headers);
 ensurePrintColumns_();
 // Existing accounts, invoices and products are never cleared, reordered or replaced.
 Logger.log('تم تجهيز الأوراق دون استبدال بيانات المحلات: '+ss.getUrl());
}
function checkMiloDatabase(){
 const ss=book_();Object.values(SHEETS).forEach(name=>{
  const sh=ss.getSheetByName(name);Logger.log(name+': '+(sh?'جاهزة، الصفوف '+sh.getLastRow():'غير موجودة'));
 });
}


// Device log + support requests: authenticated per store_code, idempotent by event/ticket ID.
// These logs are visible to the administrator in the spreadsheet. No silent uninstall protection.
function rowFor_(headers,obj){return headers.map(h=>obj[h]===undefined?'':obj[h]);}
function safeLimited_(s,max){return safeCell_(str_(s).slice(0,max));}
function requireDeviceCode_(s){const v=str_(s);if(!/^MILO-[0-9A-F]{20}$/.test(v))throw Error('كود الجهاز غير صحيح');return v;}
function ensureMonitorSheets_(){
 const ss=book_();
 for(const [n,h] of [[SHEETS.deviceActivity,DEVICE_ACTIVITY_HEADERS],[SHEETS.deviceStatus,DEVICE_STATUS_HEADERS],
                    [SHEETS.deviceAlerts,DEVICE_ALERT_HEADERS],[SHEETS.supportTickets,SUPPORT_TICKET_HEADERS]])
   ensureSheet_(ss,n,h);
}
function saveDeviceEvents_(storeCode,account,events){
 if(!Array.isArray(events)||events.length<1||events.length>30)return fail_('bad_request','عدد الأحداث غير صحيح');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  ensureMonitorSheets_();
  const a=table_(SHEETS.deviceActivity),s=table_(SHEETS.deviceStatus);
  requireCols_(a,DEVICE_ACTIVITY_HEADERS);requireCols_(s,DEVICE_STATUS_HEADERS);
  const seen=new Set(a.values.slice(1).filter(r=>str_(col_(a,r,'store_code'))===storeCode).map(r=>str_(col_(a,r,'event_id'))));
  const index=new Map();for(let i=1;i<s.values.length;i++)if(str_(col_(s,s.values[i],'store_code'))===storeCode)
    index.set(str_(col_(s,s.values[i],'device_code')),i+1);
  // Validate the complete batch before writing any events; never count login attempts.
  const cap=miloStoreLimit_(storeCode,'max_devices');
  if(cap>0){
   const registered=new Set(index.keys());
   for(const e of events){
    if(!e||typeof e!=='object')return fail_('bad_request','حدث جهاز غير صحيح');
    if(str_(e.storeCode)!==storeCode)return fail_('bad_request','حدث تابع لمحل آخر');
    const code=requireDeviceCode_(e.deviceCode);
    if(!['open','close','heartbeat'].includes(str_(e.eventType)))return fail_('bad_request','نوع حدث غير معروف');
    // A close event does not register a new device.
    if(str_(e.eventType)!=='close')registered.add(code);
   }
   if(registered.size>cap)return fail_('device_limit','تم بلوغ الحد المسموح للأجهزة: '+cap);
  }
  const now=new Date().toISOString();let accepted=0;
  for(const e of events){
   if(!e||typeof e!=='object'||!/^[a-f0-9-]{36}$/i.test(str_(e.eventId)))return fail_('bad_request','معرف حدث غير صحيح');
   const code=requireDeviceCode_(e.deviceCode),kind=str_(e.eventType);
   if(str_(e.storeCode)!==storeCode)return fail_('bad_request','حدث تابع لمحل آخر');
   if(!['open','close','heartbeat'].includes(kind))return fail_('bad_request','نوع حدث غير معروف');
   const occurred=/^\d{4}-\d\d-\d\dT/.test(str_(e.occurredAt))?str_(e.occurredAt).slice(0,35):now;
   if(!seen.has(str_(e.eventId))){
    const row={store_code:storeCode,event_id:str_(e.eventId),device_code:code,device_name:safeLimited_(e.deviceName,80),
      username:safeLimited_(account.username,120),owner_name:safeLimited_(account.ownerName,150),
      event_type:kind,occurred_at:occurred,received_at:now,details:safeLimited_(e.details,160)};
    a.sh.appendRow(rowFor_(a.headers,row));seen.add(str_(e.eventId));accepted++;
   }
   const pos=index.get(code);
   if(kind==='close'&&!pos)continue;
   const prior=pos?s.sh.getRange(pos,1,1,s.headers.length).getValues()[0]:null;
   const get=h=>prior?str_(col_(s,prior,h)):'';
   // Use received time as last_seen to avoid a stale clock or old offline events triggering a false inactivity alert.
   const row={store_code:storeCode,device_code:code,device_name:safeLimited_(e.deviceName,80),
    username:safeLimited_(account.username,120),owner_name:safeLimited_(account.ownerName,150),
    last_open:kind==='open'?now:get('last_open'),last_close:kind==='close'?now:get('last_close'),
    last_seen:now,current_status:kind==='close'?'مغلق':'متصل',inactivity_alert_at:'',updated_at:now};
   const values=rowFor_(s.headers,row);
   if(pos)s.sh.getRange(pos,1,1,values.length).setValues([values]);
   else{const nr=s.sh.getLastRow()+1;s.sh.getRange(nr,1,1,values.length).setValues([values]);index.set(code,nr);}
  }
  return {ok:true,accepted};
 }finally{lock.releaseLock();}
}
function submitSupportTicket_(storeCode,account,ticket){
 if(!ticket||typeof ticket!=='object'||!/^[a-f0-9-]{36}$/i.test(str_(ticket.ticketId)))return fail_('bad_request','رقم البلاغ غير صالح');
 const code=requireDeviceCode_(ticket.deviceCode),description=str_(ticket.description);
 if(str_(ticket.storeCode)!==storeCode)return fail_('bad_request','البلاغ تابع لمحل آخر');
 if(description.length<2||description.length>1200)return fail_('bad_request','وصف المشكلة غير كافٍ');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  ensureMonitorSheets_();ensureSheet_(book_(),SHEETS.supportTickets,SUPPORT_TICKET_HEADERS);const t=table_(SHEETS.supportTickets);requireCols_(t,SUPPORT_TICKET_HEADERS);
  if(t.values.slice(1).some(r=>str_(col_(t,r,'store_code'))===storeCode&&str_(col_(t,r,'ticket_id'))===str_(ticket.ticketId)))
    return {ok:true,duplicate:true};
  let attachmentName='',attachmentUrl='';
  if(ticket.attachment){
   const a=ticket.attachment;
   const mime=str_(a.mimeType);
   const base=str_(a.base64);
   if(!['image/jpeg','image/png','application/pdf'].includes(mime)||base.length>2800000||!/^[A-Za-z0-9+/]+={0,2}$/.test(base))return fail_('bad_request','المرفق غير صالح أو كبير جدًا');
   const bytes=Utilities.base64Decode(base);
   if(bytes.length>2*1024*1024||bytes.length<4)return fail_('bad_request','حجم المرفق غير مسموح');
   const first=bytes.slice(0,5).map(x=>x&255);
   const good=mime==='application/pdf'?first[0]===37&&first[1]===80&&first[2]===68&&first[3]===70:
     mime==='image/png'?first[0]===137&&first[1]===80&&first[2]===78&&first[3]===71:
     first[0]===255&&first[1]===216&&first[2]===255;
   if(!good)return fail_('bad_request','نوع الملف غير مطابق للمحتوى');
   attachmentName=safeLimited_(str_(a.name).replace(/[\\/]/g,'_'),100)||'مرفق';
   // Kept private in the script owner's Google Drive; only the owner can open the sheet link.
   const file=DriveApp.createFile(Utilities.newBlob(bytes,mime,'MILO_'+str_(ticket.ticketId)+'_'+attachmentName));
   attachmentUrl=file.getUrl();
  }
  const now=new Date().toISOString();const row={store_code:storeCode,ticket_id:str_(ticket.ticketId),
   occurred_at:safeLimited_(ticket.occurredAt,35),received_at:now,device_code:code,
   device_name:safeLimited_(ticket.deviceName,80),username:safeLimited_(account.username,120),
   owner_name:safeLimited_(account.ownerName,150),description:safeLimited_(description,1200),
   error_summary:safeLimited_(ticket.errorSummary,400),status:'جديد',attachment_name:attachmentName,attachment_url:attachmentUrl};
  t.sh.appendRow(rowFor_(t.headers,row));return {ok:true};
 }finally{lock.releaseLock();}
}

// Read-only, authenticated conversation for the SAME store and same cashier device.
// Admin types into admin_reply in the SupportTickets sheet; no public reply endpoint.
function miloSupportConversation_(storeCode,account,req){
 const device=requireDeviceCode_(req.deviceCode);
 ensureSheet_(book_(),SHEETS.supportTickets,SUPPORT_TICKET_HEADERS);
 const t=table_(SHEETS.supportTickets);requireCols_(t,SUPPORT_TICKET_HEADERS);
 const entries=[];
 for(let i=1;i<t.values.length;i++){
  const r=t.values[i];
  if(str_(col_(t,r,'store_code'))!==storeCode||str_(col_(t,r,'device_code'))!==device)continue;
  const val=k=>col_(t,r,k);
  const format=v=>v instanceof Date?Utilities.formatDate(v,Session.getScriptTimeZone(),"yyyy-MM-dd'T'HH:mm:ss"):str_(v);
  entries.push({ticketId:str_(val('ticket_id')),description:str_(val('description')),
   occurredAt:format(val('occurred_at')),receivedAt:format(val('received_at')),
   status:str_(val('status')),attachmentName:str_(val('attachment_name')),adminReply:str_(val('admin_reply')).slice(0,3000),replyAt:format(val('reply_at'))});
 }
 entries.sort((a,b)=>String(a.receivedAt).localeCompare(String(b.receivedAt)));
 return {ok:true,messages:entries.slice(-100)};
}

// Runs independently of cash register; it can report a device that has not connected for >48h.
function checkDeviceInactivity(){
 ensureMonitorSheets_();const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const t=table_(SHEETS.deviceStatus),a=table_(SHEETS.deviceAlerts);
  requireCols_(t,DEVICE_STATUS_HEADERS);requireCols_(a,DEVICE_ALERT_HEADERS);
  const now=new Date(),nowIso=now.toISOString(),threshold=48*60*60*1000;let count=0;
  for(let i=1;i<t.values.length;i++){
   const v=t.values[i],last=col_(t,v,'last_seen');
   const parsed=new Date(last instanceof Date?last.getTime():str_(last));
   if(isNaN(parsed.getTime())||now.getTime()-parsed.getTime()<=threshold)continue;
   if(str_(col_(t,v,'current_status'))==='غائب أكثر من يومين')continue;
   const row={store_code:str_(col_(t,v,'store_code')),device_code:str_(col_(t,v,'device_code')),
    device_name:str_(col_(t,v,'device_name')),owner_name:str_(col_(t,v,'owner_name')),
    alert_type:'inactive_48h',last_seen:parsed.toISOString(),alert_at:nowIso,
    details:'لم يسجل الجهاز نشاط اتصال لأكثر من 48 ساعة؛ قد يكون مطفأ أو خارج الشبكة'};
   a.sh.appendRow(rowFor_(a.headers,row));
   t.sh.getRange(i+1,t.idx.current_status+1).setValue('غائب أكثر من يومين');
   t.sh.getRange(i+1,t.idx.inactivity_alert_at+1).setValue(nowIso);
   count++;
  }
  Logger.log('أجهزة غائبة جديدة: '+count);return count;
 }finally{lock.releaseLock();}
}
function installDeviceInactivityMonitor(){
 ensureMonitorSheets_();
 const name='checkDeviceInactivity';
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===name).forEach(t=>ScriptApp.deleteTrigger(t));
 ScriptApp.newTrigger(name).timeBased().everyHours(6).create();
 Logger.log('تم تشغيل مراقبة غياب الأجهزة كل 6 ساعات. تنبيهات أكثر من 48 ساعة تظهر بورقة DeviceAlerts.');
}

// One-column, non-destructive upgrade for optional unlimited stock.
// Run this once after updating Code.gs. It does not run setup or insert demo accounts.
function enableUnlimitedStockProducts(){
 const sh=book_().getSheetByName(SHEETS.products);
 if(!sh)throw Error('ورقة Products غير موجودة');
 const headers=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(str_);
 if(headers.includes('unlimited_stock')){
  Logger.log('unlimited_stock موجود مسبقًا — لم يتم تعديل المنتجات');return;
 }
 const next=headers.length+1;
 if(next>sh.getMaxColumns()){
   miloMakeRoomForColumns_(book_(),sh,1);sh.insertColumnsAfter(sh.getMaxColumns(),1);
 }
 sh.getRange(1,next).setValue('unlimited_stock')
  .setBackground('#14745E').setFontColor('#FFFFFF').setFontWeight('bold');
 Logger.log('تم إضافة عمود unlimited_stock دون تغيير بيانات المنتجات السابقة');
}


// MILO mobile reports: separate read-only dashboard for the authenticated store.
// IMPORTANT: do not accept a store code from the browser or expose customer data.
function mobileReportDashboard(req){
 try{
  if(!req||typeof req!=='object')return fail_('bad_request','طلب غير صالح');
  const from=str_(req.from),to=str_(req.to);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)
   return fail_('bad_request','الرجاء تحديد فترة صحيحة');
  const start=Date.parse(from+'T12:00:00Z'),end=Date.parse(to+'T12:00:00Z');
  if(!isFinite(start)||!isFinite(end)||(end-start)>186*86400000)
   return fail_('bad_request','الحد الأقصى للفترة هو 6 أشهر');
  const auth=authenticate_({username:req.username,password:req.password});
  if(!auth.ok)return auth;
  const store=auth.account.storeCode;
  const dailySheet=book_().getSheetByName(SHEETS.reportDaily);
  const snapshots=dailySheet?readReportDaily_(store,from,to):[];
  const invoices=book_().getSheetByName(SHEETS.reports)?reports_(store,from,to):[];

  // Repeated snapshots overwrite by ID; if old duplicate rows exist, latest wins.
  const latest=new Map();
  snapshots.forEach(r=>{if(r.reportId)latest.set(r.reportId,r);});
  const reports=Array.from(latest.values());
  const totals={invoiceCount:0,subtotal:0,sales:0,vat:0,discount:0,cash:0,card:0,cost:0,grossProfit:0};
  const graph=new Map(),products=new Map();
  let lastUpdated='';
  if(reports.length){
   reports.forEach(r=>{
    totals.invoiceCount+=num_(r.invoiceCount);
    totals.subtotal+=num_(r.subtotal);
    totals.sales+=num_(r.salesTotal);
    totals.vat+=num_(r.vat);
    totals.discount+=num_(r.discount);
    totals.cash+=num_(r.cash);
    totals.card+=num_(r.card);
    totals.cost+=num_(r.cost);
    totals.grossProfit+=num_(r.grossProfit);
    graph.set(r.reportDate,(graph.get(r.reportDate)||0)+num_(r.salesTotal));
    if(r.updatedAt>lastUpdated)lastUpdated=r.updatedAt;
    let top=[];
    try{top=JSON.parse(r.topProductsJson||'[]');}catch(_){top=[];}
    if(!Array.isArray(top))top=[];
    top.slice(0,20).forEach(p=>{
     const name=str_(p.name).slice(0,100);
     if(!name)return;
     const old=products.get(name)||{name,qty:0,total:0};
     old.qty+=num_(p.qty);old.total+=num_(p.total);products.set(name,old);
    });
   });
  }else{
   // If daily snapshots have not synced yet, show available invoice-level sales.
   invoices.forEach(r=>{
    totals.invoiceCount++;
    totals.subtotal+=num_(r.subtotal);
    totals.sales+=num_(r.total);
    totals.vat+=num_(r.vat);
    totals.discount+=num_(r.discount);
    totals.cash+=Math.max(0,num_(r.cash)-num_(r.change));
    totals.card+=num_(r.card);
    const day=str_(r.date).slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(day))graph.set(day,(graph.get(day)||0)+num_(r.total));
   });
   totals.cost=null;totals.grossProfit=null;
  }
  // Round display totals without modifying any source records.
  Object.keys(totals).forEach(k=>{if(totals[k]!==null)totals[k]=Math.round(totals[k]*100)/100;});
  return {ok:true,
   storeName:auth.account.storeName||'محلك',ownerName:auth.account.ownerName||'',
   from,to,summarySource:reports.length?'daily':'invoices',
   totals,days:Array.from(graph.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([day,sales])=>({day,sales:Math.round(sales*100)/100})),
   topProducts:Array.from(products.values()).sort((a,b)=>b.total-a.total).slice(0,12),
   recentInvoices:invoices.slice(0,40).map(i=>({invoiceId:i.invoiceId,date:i.date,total:i.total,
    cash:Math.max(0,i.cash-i.change),card:i.card,itemsCount:i.itemsCount})),
   lastUpdated,invoiceRowsCount:invoices.length
  };
 }catch(err){
  // Do not leak internal spreadsheet or account details to the mobile browser.
  console.error('MILO mobile report failed: '+String(err&&err.message||err));
  return fail_('report_error','تعذر تحميل التقارير. تأكد من اكتمال المزامنة ثم حاول مجددًا');
 }
}

// MILO V13.3.14 — Add the optional restaurant options column without rewriting product rows.
function enableRestaurantProductOptions(){
 const ss=book_();
 // Only the needed product schema is checked; setup() and other sheets are not initialized.
 ensureSheet_(ss,SHEETS.products,PRODUCT_HEADERS);
 Logger.log('تم تجهيز خيارات الأحجام والإضافات للمنتجات دون حذف أي منتج سابق.');
 Logger.log('الخلايا المستخدمة فعليًا في شبكة الأوراق: '+miloAllocatedCellCount_(ss).toLocaleString());
}


// MILO maintenance: destructive actions require signed-in account and exact typed confirmation.
// WARNING: without a separate admin PIN, any user with valid store login can perform deletion.
function miloPurgeStoreData_(action,account,req){
 const types={purgeInvoices:{sheet:SHEETS.reports,phrase:'حذف الفواتير'},purgeReports:{sheet:SHEETS.reportDaily,phrase:'حذف التقارير'},purgeProducts:{sheet:SHEETS.products,phrase:'حذف المنتجات'}};
 const type=types[action],storeCode=str_(account.storeCode);
 if(!type||!storeCode)return fail_('bad_request','عملية غير معروفة');
 if(str_(req.confirmation)!==type.phrase)return fail_('confirmation_required','عبارة التأكيد غير صحيحة');
 // Scope is derived from authenticated Accounts record only. Ignore client storeCode.
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(30000))return fail_('busy','قاعدة البيانات مشغولة');
 try{
  const ss=book_();
  const tables=action==='purgeProducts'?miloProductTables_():[table_(type.sheet)];
  const targets=tables.map(t=>{requireCols_(t,['store_code']);const rows=[];for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===storeCode)rows.push(i+1);return {t,rows};});
  if(!targets.some(x=>x.rows.length))return {ok:true,deleted:true,scopeVerified:true,deletedCount:0};
  // Automatic full-spreadsheet backup. Abort if this fails.
  let backup;
  try{const stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd_HHmmss');backup=DriveApp.getFileById(ss.getId()).makeCopy('MILO_BACKUP_BEFORE_'+action+'_'+stamp);}
  catch(e){console.error('Backup failed: '+e.message);return fail_('backup_failed','تعذر إنشاء النسخة الاحتياطية؛ لم يتم حذف شيء');}
  let count=0;
  for(const {t,rows} of targets){if(!rows.length)continue;const sh=t.sh;
   let upper=rows[rows.length-1],lower=upper;
   const remove=()=>{sh.deleteRows(lower,upper-lower+1);count+=upper-lower+1;};
   for(let i=rows.length-2;i>=0;i--){if(rows[i]===lower-1){lower=rows[i];continue;}remove();upper=lower=rows[i];}
   remove();
  }
  SpreadsheetApp.flush();
  return {ok:true,deleted:true,scopeVerified:true,deletedCount:count,backupUrl:backup.getUrl(),sheet:type.sheet};
 }catch(e){console.error('Purge error: '+e.message);return fail_('purge_failed','قد يكون الحذف جزئيًا؛ راجع الجدول والنسخة الاحتياطية قبل إعادة المحاولة');}
 finally{lock.releaseLock();}
}


// MILO customer online ordering V1 — orders are NOT sales invoices.
const MILO_CUSTOMER_ORDER_HEADERS=['store_code','order_id','created_at','customer_name','customer_phone','fulfillment','address','notes','items_json','total','status','updated_at','requested_time','invoice_id','payment_method','completed_at'];
const MILO_CUSTOMER_STATUSES=['جديد','قيد التجهيز','جاهز للاستلام','في الطريق','مكتمل','ملغي'];
function miloOrdersSheet_(){return ensureSheet_(book_(),SHEETS.customerOrders,MILO_CUSTOMER_ORDER_HEADERS);}
function miloOrderPublicStore_(req){
 const store=str_(req.storeCode),key=str_(req.key);
 if(!store||!key||!/^[a-f0-9]{48}$/.test(key))return null;
 const acct=table_(SHEETS.accounts);const active=acct.values.slice(1).some(row=>str_(col_(acct,row,'store_code'))===store&&ACTIVE_VALUES.includes(str_(col_(acct,row,'status')).toLowerCase())&&daysLeft_(col_(acct,row,'subscription_end'))>=0);
 if(!active)return null;
 const settings=getStoreSettings_(store);
 if(settings.customer_orders_enabled!=='1'||settings.customer_orders_token!==key)return null;
 return {store,settings};
}
function miloPublicOrderAction_(action,req){
 const account=miloOrderPublicStore_(req);
 if(!account)return fail_('not_available','المتجر غير متاح لاستقبال الطلبات');
 const store=account.store;
 if(action==='publicCustomerCatalog')return {ok:true,storeName:account.settings.store_name||'متجر ميلو',products:products_(store).filter(p=>p.unlimitedStock||p.stock>0).map(p=>({barcode:p.barcode,name:p.name,price:p.price,category:p.category,description:p.description,imageUrl:p.imageUrl,stock:p.stock,unlimitedStock:p.unlimitedStock}))};
 if(action==='publicOrderStatus'){
  const id=str_(req.orderId),phone=str_(req.customerPhone);if(!id||!phone)return fail_('bad_request','بيانات الطلب ناقصة');
  const t=table_(SHEETS.customerOrders);
  for(let i=1;i<t.values.length;i++){const row=t.values[i];if(str_(col_(t,row,'store_code'))===store&&str_(col_(t,row,'order_id'))===id&&str_(col_(t,row,'customer_phone'))===phone)return {ok:true,orderId:id,status:str_(col_(t,row,'status'))};}
  return fail_('not_found','لم يتم العثور على الطلب');
 }
 const o=req.order||{},id=str_(o.orderId),name=str_(o.customerName),phone=str_(o.customerPhone),notes=str_(o.notes),address=str_(o.address),fulfillment=str_(o.fulfillment),items=o.items,requestedTime=str_(o.requestedTime);
 if(!/^[0-9a-f-]{36}$/i.test(id)||name.length<2||name.length>100||!/^\+?[0-9 ]{8,16}$/.test(phone)||notes.length>500||address.length>250||!['استلام من المحل','توصيل'].includes(fulfillment)||!Array.isArray(items)||!items.length||items.length>30)return fail_('invalid_order','بيانات الطلب غير مكتملة');
 if(fulfillment==='توصيل'&&address.length<5)return fail_('invalid_address','عنوان التوصيل مطلوب');
 // The requested appointment is Saudi local time (UTC+03), independent of the script timezone.
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(requestedTime))return fail_('invalid_time','حدد تاريخ ووقت الاستلام أو التوصيل');
 const appointment=new Date(requestedTime+':00+03:00'),gap=appointment.getTime()-Date.now();
 if(!Number.isFinite(appointment.getTime())||gap<10*60000||gap>30*86400000)return fail_('invalid_time','اختر موعدًا بعد 10 دقائق على الأقل وخلال 30 يومًا');
 const seen=new Set(),catalog=new Map(products_(store).map(x=>[x.barcode,x])),lines=[];let total=0;
 for(const it of items){const bc=str_(it.barcode),qty=Number(it.qty),p=catalog.get(bc);
  if(!p||!Number.isInteger(qty)||qty<1||qty>50||seen.has(bc)||(!p.unlimitedStock&&p.stock<qty))return fail_('invalid_product','منتج غير متاح أو كمية غير صحيحة');
  seen.add(bc);const sum=Math.round(p.price*qty*100)/100;total+=sum;lines.push({barcode:bc,name:p.name,qty,price:p.price,total:sum});
 }
 total=Math.round(total*100)/100;if(total>100000)return fail_('invalid_total','قيمة الطلب تتجاوز الحد المسموح');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{miloOrdersSheet_();const t=table_(SHEETS.customerOrders);for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===store&&str_(col_(t,t.values[i],'order_id'))===id)return {ok:true,duplicate:true,orderId:id,status:str_(col_(t,t.values[i],'status'))};
  const now=new Date().toISOString(),data={store_code:store,order_id:id,created_at:now,customer_name:safeCell_(name),customer_phone:phone,fulfillment,address:safeCell_(address),notes:safeCell_(notes),items_json:JSON.stringify(lines),total,status:'جديد',updated_at:now,requested_time:requestedTime};
  t.sh.appendRow(t.headers.map(h=>data[h]===undefined?'':data[h]));return {ok:true,orderId:id,status:'جديد',total};
 }finally{lock.releaseLock();}
}
function miloCustomerOrders_(store){miloOrdersSheet_();const t=table_(SHEETS.customerOrders),out=[];
 for(let i=1;i<t.values.length;i++){const row=t.values[i];if(str_(col_(t,row,'store_code'))!==store)continue;
  let items=[];try{items=JSON.parse(str_(col_(t,row,'items_json'))||'[]');}catch(_){}
  out.push({orderId:str_(col_(t,row,'order_id')),createdAt:str_(col_(t,row,'created_at')),customerName:str_(col_(t,row,'customer_name')),customerPhone:str_(col_(t,row,'customer_phone')),fulfillment:str_(col_(t,row,'fulfillment')),address:str_(col_(t,row,'address')),notes:str_(col_(t,row,'notes')),requestedTime:str_(col_(t,row,'requested_time')),items,total:num_(col_(t,row,'total')),status:str_(col_(t,row,'status')),updatedAt:str_(col_(t,row,'updated_at')),invoiceId:str_(col_(t,row,'invoice_id')),paymentMethod:str_(col_(t,row,'payment_method'))});
 }out.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));return {ok:true,orders:out.slice(0,250)};
}
function miloUpdateCustomerOrder_(store,req){const id=str_(req.orderId),status=str_(req.status);if(!id||!MILO_CUSTOMER_STATUSES.includes(status))return fail_('bad_request','رقم الطلب أو الحالة غير صحيحة');
 if(status==='مكتمل')return fail_('payment_required','لإكمال الطلب وتسجيل الفاتورة استخدم تأكيد التحصيل');
 const lock=LockService.getScriptLock();lock.waitLock(30000);try{miloOrdersSheet_();const t=table_(SHEETS.customerOrders);
  for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===store&&str_(col_(t,t.values[i],'order_id'))===id){if(str_(col_(t,t.values[i],'invoice_id')))return fail_('invoice_issued','لا يمكن تغيير حالة طلب صدر له فاتورة');t.sh.getRange(i+1,t.idx.status+1).setValue(status);t.sh.getRange(i+1,t.idx.updated_at+1).setValue(new Date().toISOString());return {ok:true,status};}
  return fail_('not_found','الطلب غير موجود');
 }finally{lock.releaseLock();}
}


// Completing a web order is a NEW and isolated sale path. Never change the
// legacy addInvoice_, ordinary checkout(), or receipt rendering logic.
// A deterministic invoice ID + script lock prevents a double sale on retries.
function miloCompleteCustomerOrder_(store,req,account){
 const id=str_(req.orderId),method=str_(req.paymentMethod),terminal=str_(req.terminal),cashier=str_(req.cashier);
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['cash','card'].includes(method)||!terminal||terminal.length>120||cashier.length>120)
  return fail_('bad_request','بيانات الطلب أو التحصيل غير صحيحة');
 const invoiceId='MILO-WEB-'+id.toUpperCase();
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  miloOrdersSheet_();ensureSheet_(book_(),SHEETS.reports,REPORT_HEADERS);
  const orders=table_(SHEETS.customerOrders),reports=table_(SHEETS.reports);
  requireCols_(orders,['store_code','order_id','status','items_json','invoice_id','payment_method','completed_at']);
  requireCols_(reports,['store_code','invoice_id','terminal']);
  let rowNumber=-1,row=null;
  for(let i=1;i<orders.values.length;i++)if(str_(col_(orders,orders.values[i],'store_code'))===store&&str_(col_(orders,orders.values[i],'order_id'))===id){rowNumber=i+1;row=orders.values[i];break;}
  if(!row)return fail_('not_found','طلب الزبون غير موجود');
  const status=str_(col_(orders,row,'status')),savedInvoice=str_(col_(orders,row,'invoice_id'));
  if(status==='ملغي')return fail_('invalid_status','لا يمكن تحصيل طلب ملغي');
  if(savedInvoice&&savedInvoice!==invoiceId)return fail_('conflict','الطلب مرتبط بفاتورة أخرى، راجع المبيعات');
  if(status==='مكتمل'&&!savedInvoice)return fail_('conflict','الطلب مكتمل سابقاً بلا فاتورة؛ يلزم مراجعته يدوياً لتجنب التكرار');
  // Check an open shift for the actual POS terminal before accepting payment.
  const shifts=table_(SHEETS.shifts);
  const open=shifts.values.slice(1).some(v=>str_(col_(shifts,v,'store_code'))===store&&str_(col_(shifts,v,'terminal'))===terminal&&!str_(col_(shifts,v,'closed_at')));
  if(!open && !savedInvoice)return fail_('shift_closed','افتح وردية على هذا الجهاز أولاً');
  const previous=reports.values.slice(1).find(v=>str_(col_(reports,v,'store_code'))===store&&str_(col_(reports,v,'invoice_id'))===invoiceId);
  let items=[];try{items=JSON.parse(str_(col_(orders,row,'items_json')));}catch(_){}
  if(!Array.isArray(items)||!items.length||items.length>30)return fail_('invalid_order','أصناف الطلب غير صالحة');
  const total=num_(col_(orders,row,'total'));
  if(!(total>0)||total>100000)return fail_('invalid_total','إجمالي الطلب غير صحيح');
  const vatNumber=str_(account.vatNumber)||str_(getStoreSettings_(store).vat_number);
  const vat=vatNumber?Math.round(total*15/115*100)/100:0;
  const now=new Date().toISOString();
  const invoice={invoiceId,orderNumber:String(parseInt(id.replace(/-/g,'').slice(-8),16)),date:now,
   terminal,terminalName:safeCell_(str_(req.terminalName).slice(0,80)),cashier,
   customer:str_(col_(orders,row,'customer_name')),customerPhone:str_(col_(orders,row,'customer_phone')),serviceType:'سفري',fulfillment:str_(col_(orders,row,'fulfillment')),
   subtotal:total,discount:0,total,vat,cash:method==='cash'?total:0,card:method==='card'?total:0,change:0,
   items:items.map(it=>({barcode:str_(it.barcode),name:str_(it.name),qty:num_(it.qty),price:num_(it.price),total:num_(it.total)}))};
  if(!previous){
   // Revalidate stock, but preserve accepted online-order prices on the invoice.
   const catalog=new Map(products_(store).map(p=>[p.barcode,p]));
   for(const it of invoice.items){const p=catalog.get(it.barcode);
    if(!p||!Number.isInteger(it.qty)||it.qty<1||!Number.isFinite(it.total)||it.total<0||(!p.unlimitedStock&&p.stock<it.qty))
     return fail_('stock_unavailable','منتج غير متاح أو المخزون لا يكفي؛ لم يتم اعتماد الفاتورة');
   }
   const values={store_code:store,invoice_id:invoiceId,date:now,cashier:safeCell_(cashier),customer:safeCell_(invoice.customer),customer_phone:invoice.customerPhone,
    subtotal:total,discount:0,total,vat,cash:invoice.cash,card:invoice.card,change:0,
    terminal,terminal_name:invoice.terminalName,items_count:invoice.items.length,service_type:invoice.serviceType||'سفري',
    items:invoice.items.map(it=>safeCell_(it.name)+' ×'+it.qty+' = '+it.total).join(' | ')};
   // Reports remains the original accounting sheet with its existing schema.
   reports.sh.appendRow(reports.headers.map(h=>values[h]===undefined?'':values[h]));
   SpreadsheetApp.flush();
   // The invoice's presence is the stock-deduction idempotency marker.
   // If deduction fails, manual inventory reconciliation may be necessary.
   miloProductStockDeduct_(store,invoice.items);
  }
  orders.sh.getRange(rowNumber,orders.idx.invoice_id+1).setValue(invoiceId);
  orders.sh.getRange(rowNumber,orders.idx.payment_method+1).setValue(method);
  orders.sh.getRange(rowNumber,orders.idx.completed_at+1).setValue(now);
  orders.sh.getRange(rowNumber,orders.idx.status+1).setValue('مكتمل');
  orders.sh.getRange(rowNumber,orders.idx.updated_at+1).setValue(now);
  return {ok:true,invoice,duplicate:!!previous,status:'مكتمل',invoiceId};
 }finally{lock.releaseLock();}
}

function miloGetCustomerOrderInvoice_(store,req){
 const id=str_(req.orderId);
 if(!/^[0-9a-f-]{36}$/i.test(id))return fail_('bad_request','رقم الطلب غير صالح');
 miloOrdersSheet_();const t=table_(SHEETS.customerOrders);
 let order=null;for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===store&&str_(col_(t,t.values[i],'order_id'))===id){order=t.values[i];break;}
 if(!order||!str_(col_(t,order,'invoice_id')))return fail_('not_found','لا توجد فاتورة معتمدة لهذا الطلب');
 const invoiceId=str_(col_(t,order,'invoice_id'));
 const reports=table_(SHEETS.reports);
 let sale=null;for(let i=1;i<reports.values.length;i++)if(str_(col_(reports,reports.values[i],'store_code'))===store&&str_(col_(reports,reports.values[i],'invoice_id'))===invoiceId){sale=reports.values[i];break;}
 if(!sale)return fail_('not_found','سجل الفاتورة غير موجود؛ لا يمكن إعادة الطباعة');
 let items=[];try{items=JSON.parse(str_(col_(t,order,'items_json')));}catch(_){}
 const get=k=>col_(reports,sale,k);
 return {ok:true,invoice:{invoiceId,orderNumber:String(parseInt(id.replace(/-/g,'').slice(-8),16)),date:str_(get('date')),
  cashier:str_(get('cashier')),customer:str_(get('customer')),customerPhone:str_(get('customer_phone')),serviceType:str_(get('service_type'))||'سفري',fulfillment:str_(col_(t,order,'fulfillment')),
  terminal:str_(get('terminal')),terminalName:str_(get('terminal_name')),subtotal:num_(get('subtotal')),
  discount:num_(get('discount')),total:num_(get('total')),vat:num_(get('vat')),
  cash:num_(get('cash')),card:num_(get('card')),change:num_(get('change')),items}};
}

// MILO product photo upload: authenticated store-scoped JPEGs in Google Drive.
// Images are published by link for viewing on cashier devices and the customer storefront.
function miloUploadProductImage_(storeCode,req){
 const barcode=str_(req.barcode),data=str_(req.imageData);
 if(!barcode||barcode.length>120||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data)||data.length>900000)return fail_('invalid_photo','صورة المنتج غير صالحة أو أكبر من الحجم المسموح');
 try{
  const bytes=Utilities.base64Decode(data.slice(data.indexOf(',')+1));
  if(bytes.length>700000)return fail_('photo_too_large','الصورة تتجاوز الحد المسموح');
  // Fixed owner-selected Google Drive folder. Never create an alternative folder silently.
  const folderId='1IVEXo8_hOmjQJt0VtLPoDfsmZc_D8jIE';
  let folder;
  try{folder=DriveApp.getFolderById(folderId);folder.getName();}
  catch(e){return fail_('photo_folder_access','تعذر الوصول إلى مجلد صور المنتجات المحدد. تأكد أن حساب نشر Apps Script يمتلك صلاحية التحرير للمجلد.');}
  const safeStore=storeCode.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,50),safeBarcode=barcode.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60);
  const file=folder.createFile(Utilities.newBlob(bytes,'image/jpeg',safeStore+'_'+safeBarcode+'_'+Date.now()+'.jpg'));
  try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW)}catch(e){file.setTrashed(true);return fail_('photo_permissions','تعذر السماح بعرض الصورة بواسطة رابط عام. تحقق من إعدادات مشاركة Google Drive.')}
  return {ok:true,imageUrl:'https://drive.google.com/thumbnail?id='+encodeURIComponent(file.getId())+'&sz=w800'};
 }catch(e){return fail_('photo_upload_failed','تعذر رفع صورة المنتج إلى Google Drive: '+e.message)}
}

// === MILO ADMIN: included in this Code.gs (do not keep another AdminBackend.gs) ===
/** MILO ADMIN API — shared Accounts login.
 *  Install in the EXISTING Apps Script spreadsheet-bound project as AdminBackend.gs.
 *  Existing Code.gs must stay untouched. Authentication uses authenticate_() from Code.gs.
 *  Login looks up username and password by the Accounts table header names (B and C).
 */
const MILO_ADMIN_SESS_SECONDS=21600;
const MILO_ADMIN_RECORDS={
 customers:{sheet:'customers',id:'contact_id',fields:['name','phone','address','notes']},
 suppliers:{sheet:'suppliers',id:'contact_id',fields:['name','phone','address','notes']},
 employees:{sheet:'employees',id:'record_id',fields:['name','username','role','enabled']},
 expenses:{sheet:'expenses',id:'record_id',fields:['date','category','description','amount','payment_method','created_by']},
 promotions:{sheet:'promotions',id:'record_id',fields:['name','discount_type','discount_value','barcode','start_date','end_date','enabled']},
 purchases:{sheet:'purchases',id:'record_id',fields:['supplier_id','supplier_name','invoice_number','date','total']},
 returns:{sheet:'returns',id:'record_id',fields:['invoice_id','date','items','total','reason','refund_method','created_by']},
 vouchers:{sheet:'vouchers',id:'record_id',fields:['kind','contact_type','contact_id','contact_name','date','amount','reference','notes']}
};
function miloAdminDigest_(str){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,str,Utilities.Charset.UTF_8)).replace(/=+$/,'');}
function miloAdminTokenKey_(token){return 'milo-adm:'+miloAdminDigest_(token).slice(0,48);}
// Admin login uses Accounts: username (column B), password (column C).
// Authentication stays on the server. No passwords are sent back to the browser.
function miloAdminLogin_(req){
 const username=str_(req.username),password=String(req.password||'');
 if(!username||!password)return fail_('bad_credentials','أدخل اسم المستخدم وكلمة المرور');
 const verified=authenticate_({username:username,password:password});
 if(!verified.ok)return verified;
 const account=verified.account,store=account.storeCode;
 const token=Utilities.getUuid()+Utilities.getUuid();
 const session={store:store,username:account.username.toLowerCase(),
  fingerprint:miloAdminDigest_(store+'|'+account.username.toLowerCase()+'|'+password)};
 CacheService.getScriptCache().put(miloAdminTokenKey_(token),JSON.stringify(session),MILO_ADMIN_SESS_SECONDS);
 return {ok:true,token:token,storeCode:store,username:account.username,
  storeName:account.storeName,expiresIn:MILO_ADMIN_SESS_SECONDS};
}
function miloAdminAuth_(req){
 const token=str_(req.token);
 if(!/^[0-9a-f-]{72}$/i.test(token))return null;
 const cache=CacheService.getScriptCache(),raw=cache.get(miloAdminTokenKey_(token));
 if(!raw)return null;
 try{
  const session=JSON.parse(raw);
  if(!session||!session.store||!session.username||!session.fingerprint)return null;
  const t=table_(SHEETS.accounts);
  const acc=t.values.slice(1).find(r=>str_(col_(t,r,'store_code'))===session.store&&
   str_(col_(t,r,'username')).toLowerCase()===session.username);
  if(!acc||!ACTIVE_VALUES.includes(str_(col_(t,acc,'status')).toLowerCase())||
     daysLeft_(col_(t,acc,'subscription_end'))===null||
     daysLeft_(col_(t,acc,'subscription_end'))<0)return null;
  const fingerprint=miloAdminDigest_(session.store+'|'+session.username+'|'+String(col_(t,acc,'password')));
  if(fingerprint!==session.fingerprint){cache.remove(miloAdminTokenKey_(token));return null;}
  return session;
 }catch(_){return null;}
}
function miloAdminAction_(req){
 const action=str_(req.action);
 // Public, data-free compatibility check used by MILO ADMIN mobile diagnostics.
 if(action==='adminVersion')return {ok:true,service:'MILO_ADMIN',version:'2026.11.15.mobile-v5',authSource:'Accounts'};
 if(action==='adminLogin')return miloAdminLogin_(req);
 const auth=miloAdminAuth_(req);if(!auth)return fail_('admin_unauthorized','انتهت جلسة الإدارة. سجل الدخول مرة أخرى');
 const store=auth.store;
 if(action==='adminPing')return {ok:true,username:auth.username,storeCode:store};
 // Published CSV is intentionally disabled: authenticated store data comes directly from Sheets.
 if(action==='adminLogout'){CacheService.getScriptCache().remove(miloAdminTokenKey_(str_(req.token)));return {ok:true};}
 if(action==='adminDashboard')return miloAdminDashboard_(store,req);
 if(action==='adminReports')return miloAdminReports_(store,req);
 if(action==='adminDbStatus')return miloAdminDbStatus_(store);
 if(action==='adminDevices')return miloAdminDevices_(store,req);
 if(action==='adminDeviceReport')return miloAdminDeviceReport_(store,req);
 if(action==='adminList')return miloAdminList_(store,req);
 if(action==='adminSaveProduct')return miloAdminSaveProduct_(store,req);
 if(action==='adminRemoveProductImage')return miloDeleteRemovedProductPhoto_(store,req);
 if(action==='adminSaveRecord')return miloAdminSaveRecord_(store,req);
 if(action==='adminOrderStatus')return miloUpdateCustomerOrder_(store,{orderId:req.orderId,status:req.status});
 if(action==='adminSettings')return {ok:true,settings:getStoreSettings_(store)};
 if(action==='adminSaveSettings'){
  const allowed=['store_name','vat_number','phone','address','footer','invoice_header','restaurant_mode'];
  if(!req.settings||Object.keys(req.settings).some(k=>!allowed.includes(k)))return fail_('invalid','إعدادات غير مسموح بها');
  return saveStoreSettings_(store,req.settings);
 }
 
 return fail_('bad_request','عملية إدارية غير معروفة');
}
// Read-only invoices for administration: unlike reports_() this never creates a sheet.
function miloAdminSales_(store,from,to){
 const sh=book_().getSheetByName(SHEETS.reports);
 if(!sh || sh.getLastRow()<2)return [];
 const t=table_(SHEETS.reports);requireCols_(t,['store_code','invoice_id','date']);
 const out=[];
 for(let i=1;i<t.values.length;i++){
  const r=t.values[i];if(str_(col_(t,r,'store_code'))!==store)continue;
  const raw=col_(t,r,'date');const date=raw instanceof Date?Utilities.formatDate(raw,Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss'):str_(raw);
  const day=date.slice(0,10);if((from&&day<from)||(to&&day>to))continue;
  out.push({invoiceId:str_(col_(t,r,'invoice_id')),date,cashier:str_(col_(t,r,'cashier')),
   customer:str_(col_(t,r,'customer')),total:num_(col_(t,r,'total')),
   cash:num_(col_(t,r,'cash')),card:num_(col_(t,r,'card')),
   vat:num_(col_(t,r,'vat')),discount:num_(col_(t,r,'discount')),
   change:num_(col_(t,r,'change')),terminal:str_(col_(t,r,'terminal'))});
 }
 return out.sort((a,z)=>z.date.localeCompare(a.date));
}
function miloAdminDashboard_(store,req){
 const from=str_(req.from),to=str_(req.to);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000)return fail_('dates','الفترة يجب أن تكون صحيحة وأقل من سنة');
 const sales=miloAdminSales_(store,from,to),daily=new Map(),totals={sales:0,cash:0,card:0,vat:0,discount:0,invoices:sales.length};
 sales.forEach(i=>{totals.sales+=num_(i.total);totals.cash+=Math.max(0,num_(i.cash)-num_(i.change));totals.card+=num_(i.card);totals.vat+=num_(i.vat);totals.discount+=num_(i.discount);const d=str_(i.date).slice(0,10);if(d>=from&&d<=to)daily.set(d,(daily.get(d)||0)+num_(i.total));});
 const out=Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,Math.round(v*100)/100]));
 const products=products_(store),orderSheet=book_().getSheetByName(SHEETS.customerOrders);
 const orders=orderSheet?miloCustomerOrders_(store).orders:[];
 return {ok:true,totals:out,days:Array.from(daily,([day,total])=>({day,total:Math.round(total*100)/100})).sort((a,b)=>a.day.localeCompare(b.day)),
  recent:sales.slice(0,40).map(i=>({invoiceId:i.invoiceId,date:i.date,customer:i.customer,total:i.total,cash:i.cash,card:i.card})),
  productCount:products.length,lowStock:products.filter(p=>!p.unlimitedStock&&p.stock<=p.minStock).length,pendingOrders:orders.filter(o=>!['ملغي','مكتمل'].includes(o.status)).length};
}
function miloAdminList_(store,req){
 const type=str_(req.type);
 if(type==='products')return {ok:true,items:products_(store)};
 if(type==='orders')return book_().getSheetByName(SHEETS.customerOrders)?miloCustomerOrders_(store):{ok:true,orders:[]};
 if(type==='shifts')return {ok:true,items:readEntities_(SHEETS.shifts,SHIFT_HEADERS,store).slice(-150).reverse()};
 if(type==='customers'||type==='suppliers')return {ok:true,items:readEntities_(SHEETS[type],CONTACT_HEADERS,store).slice(-300).reverse()};
 const cfg=MILO_ADMIN_RECORDS[type];if(!cfg)return fail_('bad_request','القسم غير موجود');
 const sch=EXTRA_SCHEMAS[type];if(!sch)return fail_('bad_request','القسم غير متاح');
 return {ok:true,items:readEntities_(SHEETS[type],sch.headers,store).slice(-300).reverse()};
}
function miloAdminSaveProduct_(store,req){
 const p=req.product;if(!p||typeof p!=='object'||Array.isArray(p))return fail_('invalid','بيانات المنتج ناقصة');
 const bc=str_(p.barcode);if(!bc||bc.length>120)return fail_('invalid','باركود المنتج غير صالح');
 const existing=products_(store).find(x=>x.barcode===bc)||{};
 const fields=['name','price','wholesalePrice','costPrice','stock','category','unit','minStock','description','imageUrl','unlimitedStock','restaurantOptionsJson'];
 if(Object.keys(p).some(k=>!['barcode',...fields].includes(k)))return fail_('invalid','حقل منتج غير مسموح به');
 const merged={...existing,...p,barcode:bc,wholesalePrice:p.wholesalePrice??existing.wholesalePrice??0,costPrice:p.costPrice??existing.costPrice??0,stock:p.stock??existing.stock??0,minStock:p.minStock??existing.minStock??0,category:p.category??existing.category??'',unit:p.unit??existing.unit??'حبة',description:p.description??existing.description??'',imageUrl:p.imageUrl??existing.imageUrl??'',unlimitedStock:p.unlimitedStock===undefined?existing.unlimitedStock===true:p.unlimitedStock===true,restaurantOptionsJson:p.restaurantOptionsJson??existing.restaurantOptionsJson??''};
 return saveProducts_(store,[merged]);
}
function miloAdminSaveRecord_(store,req){
 const type=str_(req.type),cfg=MILO_ADMIN_RECORDS[type],raw=req.record;
 if(!cfg||!raw||typeof raw!=='object'||Array.isArray(raw))return fail_('invalid','سجل غير صالح');
 if(Object.keys(raw).some(k=>![cfg.id,...cfg.fields].includes(k)))return fail_('invalid','حقول غير مسموح بها');
 const id=str_(raw[cfg.id])||Utilities.getUuid();if(id.length>120)return fail_('invalid','معرف طويل جدًا');
 const item={[cfg.id]:id};for(const f of cfg.fields)if(raw[f]!==undefined)item[f]=raw[f];
 if(type==='customers'||type==='suppliers'){
  if(!str_(item.name))return fail_('invalid','الاسم مطلوب');
  // Preserve other columns on existing contacts, including balances/tax IDs.
  const old=readEntities_(SHEETS[type],CONTACT_HEADERS,store).find(r=>str_(r.contact_id)===id)||{};
  return saveEntities_(SHEETS[type],CONTACT_HEADERS,store,[{...old,...item}],cfg.id,[cfg.id]);
 }
 const sch=EXTRA_SCHEMAS[type];const old=readEntities_(SHEETS[type],sch.headers,store).find(r=>str_(r.record_id)===id)||{};
 return saveExtraRecords_(SHEETS[type],sch,store,[{...old,...item}]);
}
function miloAdminChangePassword_(auth,req){
 return fail_('shared_login','بيانات الإدارة مرتبطة بحساب الكاشير في Accounts. غيّر كلمة المرور عبر إدارة الحسابات المعتمدة.');
}


// Administrative read-only reports from the existing cashier Reports sheet.
function miloAdminReports_(store,req){
 const from=str_(req.from),to=str_(req.to);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000)
  return fail_('dates','الفترة يجب أن تكون صحيحة وأقل من سنة');
 const sales=miloAdminSales_(store,from,to);
 const totals={sales:0,cash:0,card:0,vat:0,discount:0,invoices:sales.length};
 sales.forEach(x=>{totals.sales+=num_(x.total);totals.cash+=Math.max(0,num_(x.cash)-num_(x.change));totals.card+=num_(x.card);totals.vat+=num_(x.vat);totals.discount+=num_(x.discount);});
 for(const k of ['sales','cash','card','vat','discount'])totals[k]=Math.round(totals[k]*100)/100;
 return {ok:true,totals,invoices:sales.slice(0,300).map(x=>({invoiceId:x.invoiceId,date:x.date,cashier:x.cashier,customer:x.customer,total:x.total,cash:x.cash,card:x.card})),truncated:sales.length>300};
}

// Check real store-scoped data from the very same bound spreadsheet as the cashier.
function miloAdminDbStatus_(store){
 const labels={Accounts:'accounts',Products:'products',Reports:'reports',Shifts:'shifts',StoreSettings:'storeSettings',CustomerOrders:'customerOrders',Customers:'customers',Suppliers:'suppliers',Expenses:'expenses',Employees:'employees',Purchases:'purchases'};
 const ss=book_(),tables={};
 for(const [label,property] of Object.entries(labels)){
  const sheet=ss.getSheetByName(SHEETS[property]);if(!sheet){tables[label]={exists:false,count:0};continue;}
  const nrows=sheet.getLastRow(),ncols=sheet.getLastColumn();let count=0;
  if(nrows>1&&ncols>0){const heads=sheet.getRange(1,1,1,ncols).getValues()[0].map(str_),idx=heads.indexOf('store_code');
   if(idx>=0){const values=sheet.getRange(2,idx+1,nrows-1,1).getValues();count=values.reduce((n,r)=>n+(str_(r[0])===store?1:0),0);}
  }
  tables[label]={exists:true,count};
 }
 const a=table_(SHEETS.accounts),row=a.values.slice(1).find(r=>str_(col_(a,r,'store_code'))===store);
 return {ok:true,storeCode:store,storeName:row?str_(col_(a,row,'store_name')):'',checkedAt:new Date().toISOString(),tables};
}


// Devices: ADMIN READ ONLY. All records are filtered by the authenticated store.
// Device status is a last-seen observation, not a remote connection or control channel.
function miloAdminDeviceTable_(name){
 const sh=book_().getSheetByName(name);
 if(!sh||sh.getLastRow()<2)return null;
 return table_(name);
}
function miloAdminDeviceRows_(name,store){
 const t=miloAdminDeviceTable_(name);
 if(!t||t.idx.store_code===undefined)return [];
 return t.values.slice(1).filter(r=>str_(col_(t,r,'store_code'))===store).map(r=>{
  const item={};for(const h of t.headers)item[h]=col_(t,r,h);
  return item;
 });
}
function miloAdminDeviceDate_(x){
 if(x instanceof Date)return x.toISOString();
 const s=str_(x);if(!s)return '';
 const ms=Date.parse(s);return isFinite(ms)?new Date(ms).toISOString():s;
}
function miloAdminDeviceTime_(x){const v=Date.parse(miloAdminDeviceDate_(x));return isFinite(v)?v:0;}
function miloAdminDevicePeriod_(req){
 const from=str_(req.from),to=str_(req.to);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000)return null;
 return {from,to};
}
function miloAdminDeviceCatalog_(store){
 const map={};
 function add(id,name='',source='',lastSeen=''){
  id=str_(id);if(!id||id.length>120)return;
  if(!map[id])map[id]={deviceCode:id,deviceName:'',sourceTypes:[],lastSeen:'',lastOpen:'',lastClose:'',username:'',ownerName:'',reportedStatus:''};
  const item=map[id];
  if(str_(name)&&(!item.deviceName||source==='status'))item.deviceName=str_(name).slice(0,80);
  if(source&&!item.sourceTypes.includes(source))item.sourceTypes.push(source);
  if(miloAdminDeviceTime_(lastSeen)>miloAdminDeviceTime_(item.lastSeen))item.lastSeen=miloAdminDeviceDate_(lastSeen);
  return item;
 }
 for(const r of miloAdminDeviceRows_(SHEETS.deviceStatus,store)){
  const o=add(r.device_code,r.device_name,'status',r.last_seen);
  if(!o)continue;
  o.lastOpen=miloAdminDeviceDate_(r.last_open);
  o.lastClose=miloAdminDeviceDate_(r.last_close);
  o.username=str_(r.username);o.ownerName=str_(r.owner_name);
  o.reportedStatus=str_(r.current_status);
 }
 for(const r of miloAdminDeviceRows_(SHEETS.deviceActivity,store))add(r.device_code,r.device_name,'activity',r.received_at||r.occurred_at);
 for(const r of miloAdminDeviceRows_(SHEETS.reports,store))add(r.terminal,r.terminal_name,'sales',r.date);
 for(const r of miloAdminDeviceRows_(SHEETS.shifts,store))add(r.terminal,'','shift',r.updated_at||r.closed_at||r.opened_at);
 for(const r of miloAdminDeviceRows_(SHEETS.reportDaily,store))add(r.device_code||r.terminal_id,r.terminal_name,'daily',r.updated_at);
 return Object.values(map).map(d=>{
  const elapsed=Date.now()-miloAdminDeviceTime_(d.lastSeen);
  // Treat stale event timestamps conservatively, never assert live connection.
  d.connectionLabel=!d.lastSeen?'لا توجد بيانات اتصال':elapsed<0?'الوقت غير مؤكد':elapsed<=5*60000&&d.reportedStatus==='متصل'&&d.sourceTypes.includes('status')?'شوهد مؤخرًا':'آخر نشاط مسجل';
  return d;
 }).sort((a,b)=>miloAdminDeviceTime_(b.lastSeen)-miloAdminDeviceTime_(a.lastSeen));
}
function miloAdminDevices_(store,req){
 const list=miloAdminDeviceCatalog_(store);
 return {ok:true,devices:list,count:list.length,checkedAt:new Date().toISOString(),note:'لا توجد خدمة تحكم مباشر؛ حالة الاتصال تقديرية حسب آخر بيانات سجّلها الكاشير.'};
}
function miloAdminDeviceReport_(store,req){
 const id=str_(req.deviceCode),period=miloAdminDevicePeriod_(req);
 if(!period)return fail_('dates','اختر فترة صالحة لا تتجاوز سنة واحدة');
 if(!id||id.length>120)return fail_('invalid_device','معرّف جهاز غير صالح');
 const device=miloAdminDeviceCatalog_(store).find(x=>x.deviceCode===id);
 if(!device)return fail_('not_found','هذا الجهاز غير موجود ضمن أجهزة حسابك');
 const {from,to}=period;
 const within=v=>{const s=miloAdminDeviceDate_(v);const day=s.slice(0,10);return day>=from&&day<=to;};
 const invoices=miloAdminDeviceRows_(SHEETS.reports,store).filter(r=>str_(r.terminal)===id&&within(r.date));
 const shifts=miloAdminDeviceRows_(SHEETS.shifts,store).filter(r=>str_(r.terminal)===id&&(within(r.opened_at)||within(r.closed_at)||within(r.updated_at)));
 const events=miloAdminDeviceRows_(SHEETS.deviceActivity,store).filter(r=>str_(r.device_code)===id&&within(r.received_at||r.occurred_at));
 const alerts=miloAdminDeviceRows_(SHEETS.deviceAlerts,store).filter(r=>str_(r.device_code)===id&&within(r.alert_at));
 const tickets=miloAdminDeviceRows_(SHEETS.supportTickets,store).filter(r=>str_(r.device_code)===id&&within(r.received_at||r.occurred_at));
 const daily=miloAdminDeviceRows_(SHEETS.reportDaily,store).filter(r=>(str_(r.device_code)===id||str_(r.terminal_id)===id)&&str_(r.report_date)>=from&&str_(r.report_date)<=to);
 const totals={invoices:invoices.length,sales:0,cash:0,card:0,vat:0,discount:0,refunds:0,avgInvoice:0};
 const byDay={},byCashier={},top=[];
 for(const r of invoices){
  const total=num_(r.total),cash=Math.max(0,num_(r.cash)-num_(r.change)),card=num_(r.card);
  totals.sales+=total;totals.cash+=cash;totals.card+=card;totals.vat+=num_(r.vat);totals.discount+=num_(r.discount);
  const day=miloAdminDeviceDate_(r.date).slice(0,10),name=str_(r.cashier)||'غير محدد';
  if(!byDay[day])byDay[day]={day,invoices:0,sales:0,cash:0,card:0};
  byDay[day].invoices++;byDay[day].sales+=total;byDay[day].cash+=cash;byDay[day].card+=card;
  if(!byCashier[name])byCashier[name]={cashier:name,invoices:0,sales:0};
  byCashier[name].invoices++;byCashier[name].sales+=total;
 }
 for(const key of ['sales','cash','card','vat','discount'])totals[key]=Math.round(totals[key]*100)/100;
 totals.avgInvoice=totals.invoices?Math.round(totals.sales/totals.invoices*100)/100:0;
 const round=x=>Math.round(x*100)/100;
 return {ok:true,device,period,totals,
  daily:Object.values(byDay).sort((a,b)=>a.day.localeCompare(b.day)).map(x=>({...x,sales:round(x.sales),cash:round(x.cash),card:round(x.card)})),
  cashiers:Object.values(byCashier).sort((a,b)=>b.sales-a.sales).map(x=>({...x,sales:round(x.sales)})),
  shifts:shifts.sort((a,b)=>miloAdminDeviceTime_(b.opened_at)-miloAdminDeviceTime_(a.opened_at)).slice(0,100).map(r=>({shiftId:str_(r.shift_id),cashier:str_(r.cashier),openedAt:miloAdminDeviceDate_(r.opened_at),closedAt:miloAdminDeviceDate_(r.closed_at),openingCash:num_(r.opening_cash),closingCash:num_(r.closing_cash),expectedCash:num_(r.expected_cash),totalSales:num_(r.total_sales),invoiceCount:num_(r.invoice_count)})),
  recentInvoices:invoices.sort((a,b)=>miloAdminDeviceTime_(b.date)-miloAdminDeviceTime_(a.date)).slice(0,100).map(r=>({invoiceId:str_(r.invoice_id),date:miloAdminDeviceDate_(r.date),cashier:str_(r.cashier),customer:str_(r.customer),total:num_(r.total),cash:num_(r.cash),card:num_(r.card),vat:num_(r.vat),discount:num_(r.discount)})),
  events:events.sort((a,b)=>miloAdminDeviceTime_(b.received_at)-miloAdminDeviceTime_(a.received_at)).slice(0,60).map(r=>({at:miloAdminDeviceDate_(r.received_at||r.occurred_at),type:str_(r.event_type),details:str_(r.details)})),
  alerts:alerts.sort((a,b)=>miloAdminDeviceTime_(b.alert_at)-miloAdminDeviceTime_(a.alert_at)).slice(0,40).map(r=>({at:miloAdminDeviceDate_(r.alert_at),type:str_(r.alert_type),details:str_(r.details)})),
  tickets:tickets.sort((a,b)=>miloAdminDeviceTime_(b.received_at)-miloAdminDeviceTime_(a.received_at)).slice(0,40).map(r=>({at:miloAdminDeviceDate_(r.received_at||r.occurred_at),status:str_(r.status),description:str_(r.description).slice(0,160)})),
  dailyReports:daily.sort((a,b)=>str_(b.report_date).localeCompare(str_(a.report_date))).slice(0,90).map(r=>({day:str_(r.report_date),total:num_(r.sales_total),invoices:num_(r.invoice_count),profit:num_(r.gross_profit)})),
  records:{invoices:invoices.length,shifts:shifts.length,events:events.length,alerts:alerts.length,tickets:tickets.length,daily:daily.length},
  note:'الإجماليات من فواتير Reports لنفس الجهاز فقط. تقرير Daily منفصل ولا يضاف للمبيعات لتجنب التكرار. آخر نشاط لا يثبت اتصالًا مباشرًا.'};
}


/** فحص ذاتي اختياري من Apps Script؛ لا ينفذ طلبات فعلية ولا يغير البيانات. */
function miloAdminSelfTest(){
 const required=['miloAdminAction_','miloAdminLogin_','miloAdminDevices_','miloAdminDeviceReport_'];
 const exists={
  miloAdminAction_:typeof miloAdminAction_==='function',
  miloAdminLogin_:typeof miloAdminLogin_==='function',
  miloAdminDevices_:typeof miloAdminDevices_==='function',
  miloAdminDeviceReport_:typeof miloAdminDeviceReport_==='function'
 };
 const missing=required.filter(name=>!exists[name]);
 const result={ok:missing.length===0,missing,version:'accounts-login-2026-11-14'};
 Logger.log(JSON.stringify(result));
 return result;
}

/** Safe verification: no credentials, products or invoices are modified. */
function miloAdminRepairSelfTest(){
 const v=route_({action:'adminVersion'});
 const out={ok:v.ok===true&&v.service==='MILO_ADMIN'&&typeof miloAdminAction_==='function',service:v.service,version:v.version,adminActionsReady:typeof miloAdminDevices_==='function'&&typeof miloAdminDeviceReport_==='function'};
 Logger.log(JSON.stringify(out));return out;
}

/** Run from Apps Script editor — checks Accounts mapping, never logs credentials. */
function miloAdminAccountsCheck(){
 const t=table_(SHEETS.accounts);
 requireCols_(t,['store_code','username','password','status','subscription_end']);
 const columnsOK=t.headers[1]==='username'&&t.headers[2]==='password';
 const result={ok:columnsOK,source:'Accounts',usernameColumn:t.idx.username+1,
  passwordColumn:t.idx.password+1,accountRows:Math.max(0,t.values.length-1),
  apiVersion:route_({action:'adminVersion'}).version,
  message:columnsOK?'جاهز لتسجيل الدخول من Accounts':
   'عناوين username وpassword موجودة لكن ليست في العمودين B و C؛ راجع ترتيب الأعمدة'};
 Logger.log(JSON.stringify(result));return result;
}

// === MILO product image cleanup: included in Code.gs ===
// MILO: safely trash ONLY a photo uploaded for the authenticated store+product.
// Called after its product record has been saved without the old image URL.
// Never delete externally linked images, shared photos, or photos belonging to other stores.
function miloDeleteRemovedProductPhoto_(storeCode,req){
 const barcode=str_(req.barcode),oldUrl=str_(req.expectedImageUrl);
 if(!barcode||barcode.length>120||!oldUrl)return fail_('invalid_photo_delete','بيانات إزالة الصورة غير مكتملة');
 const match=oldUrl.match(/^https:\/\/drive\.google\.com\/thumbnail\?id=([A-Za-z0-9_-]{15,})&sz=w800$/);
 if(!match)return {ok:true,deleted:false,reason:'external_image'};
 const folderId='1IVEXo8_hOmjQJt0VtLPoDfsmZc_D8jIE';
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const products=products_(storeCode),current=products.find(p=>str_(p.barcode)===barcode);
  if(!current)return fail_('not_found','تعذر التحقق من المنتج');
  if(str_(current.imageUrl)===oldUrl)return fail_('photo_still_attached','احفظ إزالة الصورة من المنتج أولاً');
  // Across ALL product sheets and stores: never delete a referenced photo.
  for(const t of miloProductTables_())for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'image_url'))===oldUrl)
   return {ok:true,deleted:false,reason:'still_referenced'};
  const id=match[1];let folder,file;
  try{folder=DriveApp.getFolderById(folderId);file=DriveApp.getFileById(id);}catch(e){return fail_('photo_access','تعذر الوصول للصورة أو مجلدها');}
  const safeStore=storeCode.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,50);
  const safeBarcode=barcode.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60);
  if(!file.getName().startsWith(safeStore+'_'+safeBarcode+'_'))
   return {ok:true,deleted:false,reason:'not_owned_photo'};
  let inFolder=false;const parents=file.getParents();while(parents.hasNext())if(parents.next().getId()===folderId)inFolder=true;
  if(!inFolder)return {ok:true,deleted:false,reason:'outside_folder'};
  file.setTrashed(true);
  return {ok:true,deleted:true};
 }catch(e){return fail_('photo_delete_failed','تعذر حذف صورة المنتج من الأرشيف: '+String(e.message||e));}
 finally{lock.releaseLock();}
}


// MILO PAY 2026-11: standalone receiver relay, embedded to avoid missing addon deployments.
/** MILO SUNMI RECEIVER ADDON — no banking execution. Paste as NEW Apps Script file. */
function miloPayRelayAction_(req){
 const cmd=String(req.command||'').trim();
 const token=String(req.deviceToken||'').toUpperCase().trim();
 if(!/^[A-F0-9]{24}$/.test(token))return {ok:false,error:'invalid_pairing',message:'رمز اقتران غير صالح'};
 const cache=CacheService.getScriptCache();const key='milo:pay:relay:'+token;
 if(cmd==='poll'){
  const raw=cache.get(key);let payment=null;
  if(raw){try{payment=JSON.parse(raw)}catch(e){}}
  return {ok:true,payment,service:'MILO Pay Relay',version:'2.2'};
 }
 if(cmd==='push'){
  const auth=authenticate_(req);if(!auth.ok)return auth;
  const amount=Number(req.amount);
  if(!Number.isFinite(amount)||amount<=0||amount>1000000||Math.abs(Math.round(amount*100)-amount*100)>0.00001)return {ok:false,error:'amount',message:'مبلغ غير صالح'};
  const d={requestId:Utilities.getUuid(),invoiceId:String(req.invoiceId||'').slice(0,70),storeName:String(auth.account.storeName||'').slice(0,100),storeCode:auth.account.storeCode,amount,createdAt:new Date().toISOString()};
  cache.put(key,JSON.stringify(d),300);
  return {ok:true,requestId:d.requestId,delivery:'queued_unconfirmed'};
 }
 return {ok:false,error:'bad_command',message:'أمر غير معروف'};
}



// MILO: read-only, hard-to-guess customer invoice links. No login credentials or customer phone in URL.
function miloInvoiceHtmlEscape_(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function miloInvoiceShareLink_(storeCode,req){
 const invoiceId=str_(req.invoiceId);if(!invoiceId||invoiceId.length>150)return fail_('bad_request','رقم الفاتورة غير صحيح');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  ensureSheet_(book_(),SHEETS.reports,REPORT_HEADERS);
  const t=table_(SHEETS.reports);requireCols_(t,['store_code','invoice_id','invoice_share_token']);
  for(let i=1;i<t.values.length;i++){
   const row=t.values[i];if(str_(col_(t,row,'store_code'))!==storeCode||str_(col_(t,row,'invoice_id'))!==invoiceId)continue;
   let token=str_(col_(t,row,'invoice_share_token'));
   if(!/^[a-f0-9]{64}$/i.test(token)){
    token=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
    t.sh.getRange(i+1,t.idx.invoice_share_token+1).setValue(token);
   }
   const base=ScriptApp.getService().getUrl();
   if(!base)return fail_('not_deployed','انشر تطبيق الويب أولاً لتفعيل رابط الفاتورة');
   return {ok:true,url:base+'?invoice=1&token='+encodeURIComponent(token),invoiceId};
  }
  return fail_('not_found','الفاتورة غير موجودة في قاعدة البيانات');
 }finally{lock.releaseLock();}
}
function miloSharedInvoicePage_(params){
 const token=str_(params.token);
 if(!/^[a-f0-9]{64}$/i.test(token))return HtmlService.createHtmlOutput('رابط الفاتورة غير صحيح');
 const t=table_(SHEETS.reports);requireCols_(t,['invoice_share_token','store_code','invoice_id']);
 let row;
 for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'invoice_share_token'))===token){row=t.values[i];break;}
 if(!row)return HtmlService.createHtmlOutput('الفاتورة غير متاحة');
 const v=k=>miloInvoiceHtmlEscape_(col_(t,row,k));
 const store=str_(col_(t,row,'store_code'));
 const prefs=getStoreSettings_(store);
 const clean=k=>miloInvoiceHtmlEscape_(prefs[k]||'');
 const accountTable=table_(SHEETS.accounts);
 let merchant='ميلو',tax='';
 for(let i=1;i<accountTable.values.length;i++)if(str_(col_(accountTable,accountTable.values[i],'store_code'))===store){merchant=str_(col_(accountTable,accountTable.values[i],'store_name'))||merchant;tax=str_(col_(accountTable,accountTable.values[i],'vat_number'));break;}
 const money=k=>Number(col_(t,row,k)||0).toFixed(2);
 const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>فاتورة ميلو</title><style>body{background:#f0f5f4;font:16px Tahoma,Arial;color:#133c37;margin:0;padding:16px}.paper{background:white;border-radius:16px;padding:24px;max-width:570px;margin:25px auto;box-shadow:0 4px 20px #0001}h1{color:#087d70;font-size:26px}p{line-height:1.9;border-bottom:1px solid #e6eeeb;padding:6px 0}strong{float:left}small{color:#567}button{background:#087d70;color:white;border:0;border-radius:10px;padding:13px 20px;cursor:pointer}@media print{body{background:white}.paper{box-shadow:none;margin:0}button{display:none}}</style></head><body><main class="paper"><h1>${miloInvoiceHtmlEscape_(prefs.store_name||merchant)}</h1><small>نسخة إلكترونية للفاتورة المحفوظة في نظام ميلو</small><p>رقم الفاتورة <strong>${v('invoice_id')}</strong></p><p>التاريخ <strong>${v('date')}</strong></p><p>الرقم الضريبي <strong>${clean('vat_number')||miloInvoiceHtmlEscape_(tax)||'—'}</strong></p><p>الأصناف</p><div style="white-space:pre-wrap;line-height:2">${v('items').replace(/ \| /g,'\n')}</div><p>المجموع قبل الخصم <strong>${money('subtotal')} ر.س</strong></p><p>الخصم <strong>${money('discount')} ر.س</strong></p><p>ضريبة القيمة المضافة <strong>${money('vat')} ر.س</strong></p><p><b>الإجمالي</b> <strong>${money('total')} ر.س</strong></p><p>${clean('address')}</p><button onclick="window.print()">طباعة / حفظ PDF</button><p><small>هذه نسخة عرض وليست بحد ذاتها إقرار ربط مع فاتورة هيئة الزكاة والضريبة والجمارك.</small></p></main></body></html>`;
 return HtmlService.createHtmlOutput(html).setTitle('فاتورة ميلو');
}


// MILO Finance backend: separate store-scoped records, without POS stock/invoice mutation.
const MILO_FINANCE_SCHEMAS_ = {
 purchases: {sheet:'MiloFinancePurchases',fields:['record_id','invoice_number','supplier_id','supplier_name','date','subtotal','vat_rate','vat_amount','total','notes','items_json','created_at']},
 payments: {sheet:'MiloFinancePayments',fields:['record_id','supplier_id','supplier_name','purchase_id','amount','date','payment_method','reference','notes','created_at']},
 assets: {sheet:'MiloFinanceAssets',fields:['record_id','name','category','purchase_date','cost','salvage_value','life_months','notes','created_at']},
 journals: {sheet:'MiloFinanceJournals',fields:['record_id','date','reference','description','debit_total','credit_total','lines_json','created_at']},
 chart: {sheet:'MiloFinanceChart',fields:['record_id','code','name','type','parent_code','created_at']}
};
function miloFinanceTable_(kind){
 const schema=MILO_FINANCE_SCHEMAS_[kind];if(!schema)throw Error('قسم مالي غير معروف');
 ensureSheet_(book_(),schema.sheet,['store_code'].concat(schema.fields));
 const t=table_(schema.sheet);requireCols_(t,['store_code'].concat(schema.fields));return t;
}
function miloFinanceRead_(kind,store){
 if(kind==='suppliers'){
  return readEntities_(SHEETS.suppliers,CONTACT_HEADERS,store).map(s=>({
   id:str_(s.contact_id),name:str_(s.name),phone:str_(s.phone)
  }));
 }
 const t=miloFinanceTable_(kind),out=[];
 for(let i=1;i<t.values.length;i++){
  const r=t.values[i];if(str_(col_(t,r,'store_code'))!==store)continue;
  const x={};MILO_FINANCE_SCHEMAS_[kind].fields.forEach(k=>{
   const v=col_(t,r,k);x[k]=v instanceof Date?Utilities.formatDate(v,Session.getScriptTimeZone(),"yyyy-MM-dd'T'HH:mm:ss"):v;
  });
  if(kind==='purchases')try{x.items=JSON.parse(x.items_json||'[]');}catch(_){x.items=[];}
  if(kind==='journals')try{x.lines=JSON.parse(x.lines_json||'[]');}catch(_){x.lines=[];}
  out.push(x);
 }
 return out;
}
function miloFinanceText_(v,max){return safeCell_(str_(v).slice(0,max||500));}
function miloFinanceMoney_(v){
 const n=Number(v);if(!Number.isFinite(n)||n<0||n>1000000000)throw Error('مبلغ مالي غير صحيح');
 return Math.round(n*100)/100;
}
function miloFinanceDate_(v){const s=str_(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s+'T12:00:00Z')))throw Error('التاريخ غير صحيح');return s;}
function miloFinanceSupplier_(store,id){
 const found=miloFinanceRead_('suppliers',store).find(x=>x.id===str_(id));
 if(!found)throw Error('اختر موردًا مسجلًا في هذا المتجر');return found;
}
function miloFinanceValidate_(kind,store,item,id){
 if(!item||typeof item!=='object'||Array.isArray(item))throw Error('بيانات السجل غير صحيحة');
 const now=new Date().toISOString(),x={record_id:id,created_at:now};
 if(kind==='purchases'){
  const supplier=miloFinanceSupplier_(store,item.supplier_id);
  x.supplier_id=supplier.id;x.supplier_name=supplier.name;
  x.invoice_number=miloFinanceText_(item.invoice_number,65);if(!x.invoice_number)throw Error('رقم فاتورة المورد مطلوب');
  x.date=miloFinanceDate_(item.date);x.notes=miloFinanceText_(item.notes,1000);
  const rate=Number(item.vat_rate);if(![0,15].includes(rate))throw Error('نسبة الضريبة غير صحيحة');x.vat_rate=rate;
  if(!Array.isArray(item.items)||!item.items.length||item.items.length>100)throw Error('يجب إضافة صنف واحد على الأقل');
  const lines=item.items.map(line=>{
   const name=miloFinanceText_(line.name,160),qty=Number(line.qty),unit=miloFinanceMoney_(line.unit_cost);
   if(!name||!Number.isFinite(qty)||qty<=0||qty>100000)throw Error('اسم الصنف أو الكمية غير صحيحة');
   return {name,qty:Math.round(qty*1000)/1000,unit_cost:unit};
  });
  x.subtotal=Math.round(lines.reduce((a,l)=>a+l.qty*l.unit_cost,0)*100)/100;
  x.vat_amount=Math.round(x.subtotal*rate)/100;x.total=Math.round((x.subtotal+x.vat_amount)*100)/100;
  x.items_json=JSON.stringify(lines);if(x.items_json.length>35000)throw Error('تفاصيل الفاتورة طويلة جدًا');
 }else if(kind==='payments'){
  const supplier=miloFinanceSupplier_(store,item.supplier_id);
  x.supplier_id=supplier.id;x.supplier_name=supplier.name;x.purchase_id=miloFinanceText_(item.purchase_id,120);
  if(x.purchase_id){const inv=miloFinanceRead_('purchases',store).find(r=>r.record_id===x.purchase_id);if(!inv||inv.supplier_id!==supplier.id)throw Error('الفاتورة غير مرتبطة بالمورد المحدد');}
  x.amount=miloFinanceMoney_(item.amount);if(x.amount<=0)throw Error('المبلغ يجب أن يكون أكبر من صفر');
  x.date=miloFinanceDate_(item.date);x.payment_method=str_(item.payment_method);
  if(!['cash','card','bank'].includes(x.payment_method))throw Error('طريقة الدفع غير صحيحة');
  x.reference=miloFinanceText_(item.reference,180);x.notes=miloFinanceText_(item.notes,1000);
 }else if(kind==='assets'){
  x.name=miloFinanceText_(item.name,200);if(!x.name)throw Error('اسم الأصل مطلوب');
  x.category=miloFinanceText_(item.category,120);x.purchase_date=miloFinanceDate_(item.purchase_date);
  x.cost=miloFinanceMoney_(item.cost);x.salvage_value=miloFinanceMoney_(item.salvage_value||0);
  x.life_months=Number(item.life_months);if(x.cost<=0||x.salvage_value>x.cost||!Number.isInteger(x.life_months)||x.life_months<1||x.life_months>600)throw Error('التكلفة أو قيمة الخردة أو العمر غير صحيح');
  x.notes=miloFinanceText_(item.notes,1000);
 }else if(kind==='chart'){
  x.code=str_(item.code);if(!/^[A-Za-z0-9_.-]{1,35}$/.test(x.code))throw Error('رمز الحساب غير صحيح');
  x.name=miloFinanceText_(item.name,180);if(!x.name)throw Error('اسم الحساب مطلوب');
  x.type=str_(item.type);if(!['asset','liability','equity','revenue','expense'].includes(x.type))throw Error('تصنيف الحساب غير صحيح');
  x.parent_code=str_(item.parent_code);if(x.parent_code===x.code)throw Error('الحساب لا يمكن أن يكون أبًا لنفسه');
  const existing=miloFinanceRead_('chart',store);
  if(existing.some(r=>str_(r.code)===x.code))throw Error('رمز الحساب مستخدم سابقًا');
  if(x.parent_code&&!existing.some(r=>str_(r.code)===x.parent_code))throw Error('الحساب الأب غير موجود');
 }else if(kind==='journals'){
  x.date=miloFinanceDate_(item.date);x.reference=miloFinanceText_(item.reference,150);
  x.description=miloFinanceText_(item.description,500);if(!x.description)throw Error('بيان القيد مطلوب');
  if(!Array.isArray(item.lines)||item.lines.length<2||item.lines.length>50)throw Error('القيد يتطلب طرفين على الأقل');
  const accounts=new Set(miloFinanceRead_('chart',store).map(a=>str_(a.code)));
  const lines=item.lines.map(l=>{
   const code=str_(l.account_code),debit=miloFinanceMoney_(l.debit||0),credit=miloFinanceMoney_(l.credit||0);
   if(!accounts.has(code)||(!debit&&!credit)||(debit>0&&credit>0))throw Error('سطر القيد غير صحيح: الحساب أو المدين أو الدائن');
   return {account_code:code,debit,credit};
  });
  x.debit_total=Math.round(lines.reduce((a,l)=>a+l.debit,0)*100)/100;
  x.credit_total=Math.round(lines.reduce((a,l)=>a+l.credit,0)*100)/100;
  if(!x.debit_total||Math.abs(x.debit_total-x.credit_total)>0.001)throw Error('مجموع المدين يجب أن يساوي الدائن');
  x.lines_json=JSON.stringify(lines);
 }else throw Error('قسم مالي غير مدعوم');
 return x;
}
function miloFinanceAction_(req){
 const auth=authenticate_(req);if(!auth.ok)return auth;
 const store=auth.account.storeCode,access=miloDeviceAccess_(req,store,false);if(!access.ok)return access;
 const op=str_(req.op),kind=str_(req.kind);
 if(!MILO_FINANCE_SCHEMAS_[kind]&&kind!=='suppliers')return fail_('bad_request','القسم المالي غير معروف');
 if(op==='list')return {ok:true,rows:miloFinanceRead_(kind,store)};
 if(op!=='create'||kind==='suppliers')return fail_('bad_request','عملية مالية غير مدعومة');
 const id=str_(req.recordId);
 if(!/^mf_[A-Za-z0-9_-]{6,100}$/.test(id))return fail_('bad_request','معرف السجل غير صالح');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const t=miloFinanceTable_(kind);for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===store&&str_(col_(t,t.values[i],'record_id'))===id)
   return {ok:true,alreadyExists:true};
  const entry=miloFinanceValidate_(kind,store,req.item,id);entry.store_code=store;
  t.sh.appendRow(t.headers.map(h=>entry[h]===undefined?'':entry[h]));
  return {ok:true,recordId:id};
 }catch(e){return fail_('finance_validation',String(e.message||e));}
 finally{lock.releaseLock();}
}


// MILO PDF attachment: generates a real PDF from the authenticated store's saved invoice.
// Does NOT send an SMS/WhatsApp message; the browser may share the PDF file via OS share sheet.
function miloInvoicePdfFile_(storeCode,req){
 const invoiceId=str_(req.invoiceId);
 if(!invoiceId||invoiceId.length>150)return fail_('bad_request','رقم الفاتورة غير صحيح');
 ensureSheet_(book_(),SHEETS.reports,REPORT_HEADERS);
 const t=table_(SHEETS.reports);requireCols_(t,['store_code','invoice_id','date','total','items']);
 let record=null;
 for(let i=1;i<t.values.length;i++){
  const row=t.values[i];
  if(str_(col_(t,row,'store_code'))===storeCode&&str_(col_(t,row,'invoice_id'))===invoiceId){record=row;break;}
 }
 if(!record)return fail_('not_found','الفاتورة غير موجودة');
 const val=k=>str_(col_(t,record,k));
 const prefs=getStoreSettings_(storeCode);
 const merchant=str_(prefs.store_name)||'ميلو';
 const vat=str_(prefs.vat_number);
 const title=/^3\d{13}3$/.test(vat)?'فاتورة ضريبية مبسطة':'فاتورة مبيعات';
 let doc=null;
 try{
  doc=DocumentApp.create('MILO-INVOICE-'+invoiceId.slice(0,60));
  const body=doc.getBody();
  body.setMarginTop(30).setMarginBottom(30).setMarginLeft(34).setMarginRight(34);
  const center=DocumentApp.HorizontalAlignment.CENTER;
  const right=DocumentApp.HorizontalAlignment.RIGHT;
  function line(s,bold,size){const p=body.appendParagraph(str_(s));p.setAlignment(right);if(bold)p.editAsText().setBold(true);if(size)p.editAsText().setFontSize(size);return p;}
  const main=body.appendParagraph(merchant);main.setAlignment(center);main.editAsText().setBold(true).setFontSize(19);
  const header=body.appendParagraph(title);header.setAlignment(center);header.editAsText().setBold(true).setFontSize(13);
  line('رقم الفاتورة: '+invoiceId,true,11);
  line('التاريخ: '+val('date'));
  if(vat)line('الرقم الضريبي: '+vat);
  if(prefs.address)line('العنوان: '+prefs.address);
  if(prefs.phone)line('جوال المنشأة: '+prefs.phone);
  if(val('customer'))line('العميل: '+val('customer'));
  if(val('cashier'))line('الكاشير: '+val('cashier'));
  body.appendParagraph('');
  line('الأصناف',true,12);
  const raw=val('items');
  for(const item of raw.split(' | ').filter(Boolean).slice(0,300))line('• '+item);
  body.appendParagraph('');
  line('الإجمالي قبل الخصم: '+num_(val('subtotal')).toFixed(2)+' ر.س');
  line('الخصم: '+num_(val('discount')).toFixed(2)+' ر.س');
  line('ضريبة القيمة المضافة: '+num_(val('vat')).toFixed(2)+' ر.س');
  line('الإجمالي: '+num_(val('total')).toFixed(2)+' ر.س',true,15);
  // Tax QR is provided by the cashier (computed from invoice amounts, store and VAT).
  // Missing QR is never silently invented. The QR's bytes are limited and validated.
  const qr=str_(req.qrPng);
  if(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(qr)&&qr.length<130000&&/^3\d{13}3$/.test(vat)){
   const png=Utilities.base64Decode(qr.split(',')[1]);
   const paragraph=body.appendParagraph('');paragraph.setAlignment(center);
   const img=paragraph.appendInlineImage(Utilities.newBlob(png,'image/png','zatca-qr.png'));
   img.setWidth(130).setHeight(130);
  }
  const foot=body.appendParagraph('شكرًا لزيارتكم');foot.setAlignment(center);
  doc.saveAndClose();
  const file=DriveApp.getFileById(doc.getId());
  const pdf=file.getAs(MimeType.PDF);
  if(pdf.getBytes().length>3500000)return fail_('too_large','ملف الفاتورة كبير جدًا');
  return {ok:true,mimeType:'application/pdf',fileName:'MILO-Invoice-'+invoiceId.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,70)+'.pdf',pdfBase64:Utilities.base64Encode(pdf.getBytes())};
 }catch(err){return fail_('pdf_error','تعذر إنشاء ملف PDF: '+err.message);}
 finally{if(doc){try{DriveApp.getFileById(doc.getId()).setTrashed(true);}catch(ignore){}}}
}

// Store-scoped standalone categories (supports empty categories before any product is added).
function miloListCategories_(storeCode){
 const sh=ensureSheet_(book_(),SHEETS.categories,MILO_CATEGORY_HEADERS),t=table_(SHEETS.categories);
 const categories=[];
 for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===storeCode){
  const name=str_(col_(t,t.values[i],'name'));if(name&&!categories.includes(name))categories.push(name);
 }
 return {ok:true,categories};
}
function miloSaveCategory_(storeCode,name){
 name=str_(name);if(!name||name.length>80||/[\r\n]/.test(name)||name==='الكل')return fail_('bad_request','اسم التصنيف غير صالح');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{ensureSheet_(book_(),SHEETS.categories,MILO_CATEGORY_HEADERS);const t=table_(SHEETS.categories);
  for(let i=1;i<t.values.length;i++)if(str_(col_(t,t.values[i],'store_code'))===storeCode&&str_(col_(t,t.values[i],'name'))===name)return {ok:true,duplicate:true};
  if(t.values.filter(r=>str_(col_(t,r,'store_code'))===storeCode).length>=300)return fail_('limit','الحد الأقصى 300 تصنيف');
  const row={store_code:storeCode,name:safeCell_(name),created_at:new Date().toISOString()};t.sh.appendRow(t.headers.map(h=>row[h]||''));return {ok:true};
 }finally{lock.releaseLock();}
}
function miloDeleteCategory_(storeCode,name){
 name=str_(name);if(!name||name==='الكل')return fail_('bad_request','اسم التصنيف غير صالح');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{ensureSheet_(book_(),SHEETS.categories,MILO_CATEGORY_HEADERS);const t=table_(SHEETS.categories);
  for(let i=t.values.length-1;i>=1;i--)if(str_(col_(t,t.values[i],'store_code'))===storeCode&&str_(col_(t,t.values[i],'name'))===name)t.sh.deleteRow(i+1);
  return {ok:true};
 }finally{lock.releaseLock();}
}
