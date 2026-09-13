/**
 * 聚合跳转版的唯一安全测试:matchDest 决定"跳哪个 URL",而 URL 只能来自白名单表。
 *
 * 需求澄清:Yield Terminal 和国库页面一样只做**聚合跳转** —— 给用户一个跳到第三方
 * (OKX earn / DEX)对应页的链接,用户在那边自己签。我们不代签、不碰钱。
 * 于是代签方案(曾经的八轮审计对象)整个废弃,那些测试(双花/闸门/回执核验)一并删除。
 *
 * 跳转版只剩一条铁律需要守:**落地 URL 是白名单里的常量,绝不从 DefiLlama 的行情字段拼**。
 * 否则被污染的行情能把用户导到"用 USD₮0 换一个假币"的页面。
 *
 * 直接从 terminal.html 抽真实的 <script> 跑,不复制一份逻辑来测(复制品会漂移)。
 */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HTML = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "terminal.html");
const js = fs.readFileSync(HTML, "utf8").match(/<script>([\s\S]*)<\/script>/)[1];

// DOM / fetch 打桩,让加载期副作用哑火
const stub = () => new Proxy({}, { get(t,k){
  return (k==="style"||k==="dataset"||k==="classList") ? stub()
    : (k==="value"||k==="textContent"||k==="href"||k==="innerHTML") ? ""
    : typeof k==="string" ? ()=>stub() : undefined; }, set(){return true;} });
const box = {
  document:{getElementById:stub, addEventListener(){}, body:stub(), createElement:stub,
            querySelector:()=>null, querySelectorAll:()=>[]},
  window:{}, fetch:()=>new Promise(()=>{}),
  crypto:{subtle:{digest:async()=>new ArrayBuffer(32)}},
  setTimeout, clearTimeout, console, Date, Number, Math, JSON, TextEncoder, Uint8Array,
  Array, Object, String, isFinite, parseInt, Set, Promise, AbortController,
};
box.globalThis = box; vm.createContext(box); vm.runInContext(js, box);
const { matchDest, destReason, row, DEST } = box;

let pass=0, fail=0;
const t=(name, cond, extra)=>{ if(cond){pass++;} else {fail++; console.log(`  ✗ ${name}${extra?"\n      "+extra:""}`);} };
const XL = "0x779Ded0c9e1022225f8E0630b35a9b54bE713736";
const entry = DEST["Xlayer"]["aave-v3"]["0x779ded0c9e1022225f8e0630b35a9b54be713736"];
const pool = (o) => ({ chain:"Xlayer", project:"aave-v3", exposure:"single", underlyingTokens:[XL], symbol:"USD₮0",
                       pool:"pid", tvlUsd:9e6, apy:3.5, apyMean30d:3.5, apyBase:3.5, apyReward:null, ...o });

console.log("\n=== 1. 正常命中 ===");
t("X Layer aave-v3 USD₮0 → 命中表里的条目", matchDest(pool()) === entry, true);
t("underlyingTokens 大小写不敏感", matchDest(pool({underlyingTokens:[XL.toUpperCase().replace("0X","0x")]})) === entry);
t("命中条目的 URL 是核对过的 OKX earn 页", entry.url==="https://web3.okx.com/earn/product/aave-v3-x-layer-usdt-33905", entry.url);

console.log("\n=== 2. 跨链同地址:不需要攻击者,当天诚实数据就会触发 ===");
t("Mantle 同地址 → 不命中(否则点 Mantle 跳 X Layer)", matchDest(pool({chain:"Mantle"})) === null);
t("Ethereum 同地址 → 不命中", matchDest(pool({chain:"Ethereum"})) === null);
t("链名大小写不同 → 不命中(不做模糊匹配)", matchDest(pool({chain:"XLayer"})) === null);

console.log("\n=== 3. underlyingTokens 形状 ===");
t("两个底层资产(LP)→ 不命中", matchDest(pool({underlyingTokens:[XL,"0x"+"11".repeat(20)]}))===null);
t("合法资产在第二位 → 不命中", matchDest(pool({underlyingTokens:["0x"+"11".repeat(20),XL]}))===null);
t("空数组 → 不命中", matchDest(pool({underlyingTokens:[]})) === null);
t("非数组 → 不命中", matchDest(pool({underlyingTokens:XL})) === null);
t("元素不是地址 → 不命中", matchDest(pool({underlyingTokens:["not-an-address"]})) === null);

console.log("\n=== 4. 其余字段污染 ===");
t("project 不在表里 → 不命中", matchDest(pool({project:"morpho-blue"})) === null);
t("exposure 非 single → 不命中", matchDest(pool({exposure:"multi"})) === null);
t("未知资产地址 → 不命中", matchDest(pool({underlyingTokens:["0x"+"ab".repeat(20)]})) === null);
t("null → 不命中", matchDest(null) === null);
t("字符串冒充池 → 不命中", matchDest("Xlayer") === null);
t("原型链键 __proto__ → 不命中", matchDest(pool({project:"__proto__"})) === null);

console.log("\n=== 5. 铁律:URL 来自表,不来自行情 ===");
{
  // 行情把 symbol/apy 全污染了,命中的仍是表里那个条目 —— URL 一个字节都不受影响
  const got = row(pool({ symbol:"<img src=x onerror=alert(1)>", apy:99999,
                         underlyingTokens:[XL] }), "X");
  t("行情被污染也命中", got.go_url === entry.url, got.go_url);
  t("go_url 就是表里的常量 URL", got.go_url === "https://web3.okx.com/earn/product/aave-v3-x-layer-usdt-33905");
  t("go_url 里没有行情字节(不含 <img)", !/</.test(got.go_url||""));
  t("按钮文案的币名取自表,不是行情的假 symbol", /USD₮0/.test(got.go_label) && !/img/.test(got.go_label), got.go_label);
  t("go_url 是 https", /^https:\/\//.test(got.go_url));
}

console.log("\n=== 6. 未命中 → 禁用并写明这一条自己的原因 ===");
{
  const eth = row(pool({chain:"Ethereum"}), "USDT");
  t("跨链未命中 → 没有 go_url", !eth.go_url);
  t("原因说明是链的问题", /X Layer only/.test(eth.go_reason), eth.go_reason);
  const mor = row(pool({project:"morpho-blue"}), "USDT");
  t("本链协议未配 → 原因点명协议", /morpho-blue/.test(mor.go_reason), mor.go_reason);
}

console.log("\n=== 7. 表本身:每条 URL 都是 https 且非空 ===");
for (const [chain, projs] of Object.entries(DEST))
  for (const [proj, byTok] of Object.entries(projs))
    for (const [key, e] of Object.entries(byTok)){
      t(`${chain}/${proj} 键是小写地址`, /^0x[0-9a-f]{40}$/.test(key), key);
      t(`${chain}/${proj} URL 是 https`, /^https:\/\//.test(e.url), e.url);
      t(`${chain}/${proj} 有 symbol 与 venue`, !!e.symbol && !!e.venue);
    }

console.log(`\n${"═".repeat(46)}\n通过 ${pass} · 失败 ${fail}\n${"═".repeat(46)}`);
process.exit(fail ? 1 : 0);
