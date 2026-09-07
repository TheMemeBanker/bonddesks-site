/* BOND Desks — live pool data + coupon calculator. All figures computed, never hardcoded. */
const POOL_WALLET = "94sBKofyYj2LoytYMF2Ld7nw82G5kuZrRB3vzf7LDRnK";
const OTC_MINT = "MukLDtJ8Cx9DxLbeyLRSWPSposTMWuwHANbuaudpump";
const RPCS = ["https://solana-rpc.publicnode.com","https://solana.drpc.org","https://rpc.ankr.com/solana","https://api.mainnet-beta.solana.com"];
const POOL_TOTAL = 50_000_000;          // program size
const WEEKS = 52;
const WEEKLY = POOL_TOTAL / WEEKS;      // 961,538.46
let otcPrice = null, poolBal = null;

const $ = (id) => document.getElementById(id);
const fmt = (n, d=0) => n==null ? "—" : n.toLocaleString("en-US",{maximumFractionDigits:d});
const parseNum = (s) => { const v = parseFloat(String(s).replace(/[^0-9.]/g,"")); return isFinite(v)&&v>0 ? v : 0; };

async function rpcCall(method, params){
  for(const url of RPCS){
    try{
      const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
      const j = await r.json(); if(j.result!==undefined) return j.result;
    }catch(e){}
  }
  return null;
}
async function loadPool(){
  try{
    const res = await rpcCall("getTokenAccountsByOwner",[POOL_WALLET,{mint:OTC_MINT},{encoding:"jsonParsed"}]);
    if(!res || !res.value){ $("stPool").innerHTML = '<a href="https://solscan.io/account/'+POOL_WALLET+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;border-bottom:1px dotted currentColor">verify ↗</a>'; return renderUsd(), buildRail(); }
    let bal = 0;
    for(const a of res.value) bal += a.account.data.parsed.info.tokenAmount.uiAmount||0;
    poolBal = bal;
    $("stPool").textContent = fmt(bal);
  }catch(e){ $("stPool").textContent = "on-chain"; }
  renderUsd(); buildRail();
}
async function loadPrice(){
  otcPrice = null;
  try{
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${OTC_MINT}`);
    const j = await r.json();
    const ps = (j?.pairs||[]).filter(p=>p.priceUsd).sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0));
    otcPrice = parseFloat(ps[0]?.priceUsd) || null;
  }catch(e){}
  if(otcPrice==null){
    try{
      const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${OTC_MINT}`);
      const j = await r.json();
      otcPrice = parseFloat(j?.[OTC_MINT]?.usdPrice ?? j?.data?.[OTC_MINT]?.price) || null;
    }catch(e){}
  }
  renderUsd(); calc(); buildRail();
}
function renderUsd(){
  if(poolBal!=null && otcPrice!=null) $("stPoolUsd").textContent = "$"+fmt(poolBal*otcPrice);
  else if(poolBal!=null) $("stPoolUsd").textContent = "—";
}
function calc(){
  const yours = parseNum($("cYours").value);
  const total = Math.max(parseNum($("cTotal").value), yours);
  const weeks = parseInt($("cDur").value,10)||52;
  const matEl = document.querySelector(".bd-mat-b.on");
  const w = matEl ? parseFloat(matEl.dataset.w) : 1;
  if(!yours || !total){ ["oWeight","oShare","oWeek","oTotal","oUsd"].forEach(i=>$(i).textContent="—"); return; }
  const myWeighted = yours*w;
  const share = myWeighted/total;                 // total = total WEIGHTED stake in pool
  const wk = WEEKLY*share;
  const tot = wk*weeks;
  $("oWeight").textContent = fmt(myWeighted)+" ("+w.toFixed(2)+"×)";
  $("oShare").textContent = (share*100).toLocaleString("en-US",{maximumFractionDigits:4})+"%";
  $("oWeek").textContent = fmt(wk,0);
  $("oTotal").textContent = fmt(tot,0);
  $("oUsd").textContent = otcPrice!=null ? "$"+fmt(tot*otcPrice) : "—";
  $("oNote").textContent = "over "+weeks+" week"+(weeks==1?"":"s")+" at a "+w.toFixed(2)+"× maturity, assuming your share holds steady";
}function buildRail(){
  const items = [
    ["POOL", poolBal!=null?fmt(poolBal)+" $OTC":"50,000,000 $OTC"],
    ["COUPON", fmt(WEEKLY,0)+" $OTC / week"],
    ["SCHEDULE", "52 weekly snapshots"],
    ["LOCKUPS", "none — tokens stay in your wallet"],
    ["POOL VALUE", (poolBal!=null&&otcPrice!=null)?"$"+fmt(poolBal*otcPrice):"verify on-chain"],
    ["VERIFY", "solscan → 94sB…DRnK"],
  ];
  const t = $("railTrack");
  const html = items.map(([k,v])=>`<span class="bd-tick"><b>${k}</b><span>${v}</span><span class="up">▮</span></span>`).join('<span class="bd-tick">·</span>');
  t.innerHTML = html + '<span class="bd-tick">·</span>' + html;
}
/* slider = log10 of total staked */
function sliderToTotal(v){ return Math.round(Math.pow(10, parseFloat(v))); }
$("cSlider").addEventListener("input", (e)=>{ $("cTotal").value = fmt(sliderToTotal(e.target.value)); calc(); });
document.querySelectorAll(".bd-mat-b").forEach(btn=>btn.addEventListener("click", ()=>{
  document.querySelectorAll(".bd-mat-b").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on");
  const wk = parseInt(btn.dataset.wk,10);
  if(wk>0){ $("cDur").value = wk; $("durVal").textContent = wk; }
  calc();
}));
$("cDur").addEventListener("input",(e)=>{ $("durVal").textContent = e.target.value; calc(); });
["cYours","cTotal"].forEach(id=>$(id).addEventListener("input", ()=>{ 
  if(id==="cTotal"){ const t=parseNum($("cTotal").value); if(t>0) $("cSlider").value = Math.log10(t).toFixed(2); }
  calc();
}));
$("themeBtn").addEventListener("click", ()=>{
  const cur = document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";
  document.documentElement.setAttribute("data-theme",cur);
  try{ localStorage.setItem("bond-theme",cur); }catch(e){}
});
buildRail(); calc(); loadPool(); loadPrice();
