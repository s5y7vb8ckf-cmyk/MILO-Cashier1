/** MILO SUNMI RECEIVER ADDON — no banking execution. Paste as NEW Apps Script file. */
function miloPayRelayAction_(req){
 const cmd=String(req.command||'').trim();
 const token=String(req.deviceToken||'').toUpperCase().trim();
 if(!/^[A-F0-9]{24}$/.test(token))return {ok:false,error:'invalid_pairing',message:'رمز اقتران غير صالح'};
 const cache=CacheService.getScriptCache();const key='milo:pay:relay:'+token;
 if(cmd==='poll'){
  const raw=cache.get(key);let payment=null;
  if(raw){try{payment=JSON.parse(raw)}catch(e){}}
  return {ok:true,payment};
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
