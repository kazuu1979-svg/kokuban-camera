/* 黒板カメラ 版23（2026.10.20 黒板に日付の欄。版22＝2026.10.16 写真台帳（PDF）を外した。版21＝2026.10.15 事務所へ送る＝まとめて1つの zip。版20＝2026.10.13 一から作り直し）
   画面：はじめ・カメラ（＋選ぶ所）・黒板を入れる/直す・写真1枚・書き込み・工種の設定・渡す・工事を選ぶ・使い方
   写真は IndexedDB「kokuban-camera」の photos（版14 までと同じ場所。前の写真もそのまま読む） */
(function(){
'use strict';

const APP_VER = '29';
const $ = id => document.getElementById(id);
function h(tag, props, ...kids){
  const e = document.createElement(tag);
  if (props) for (const k of Object.keys(props)) {
    const v = props[k];
    if (v === undefined || v === null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'on') { for (const ev of Object.keys(v)) e.addEventListener(ev, v[ev]); }
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('aria-') || k.startsWith('data-') || k === 'role') e.setAttribute(k, String(v));
    else e[k] = v;
  }
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}
const pad = n => String(n).padStart(2, '0');
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = v => clamp(v, 0, 1);
// 中身を入れ替える（null や false は飛ばす）
const put = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false));

/* ---------- 選ぶ物の最初の一覧（過去の工事写真から作った案。工事ごとに直せる） ---------- */
const DEFAULT_KINDS = [
  {c:'A', n:'仮設足場工事', steps:['施工前','組立中','組立完了','是正前','是正後','解体中','解体完了'], parts:['外壁足場','養生シート','朝顔','昇降階段','壁つなぎ','是正箇所']},
  {c:'W', n:'洗浄作業', steps:['施工前','洗剤塗布','高圧水洗浄','施工後'], parts:['外壁タイル','外壁','共用廊下','階段・踊り場','屋上 平場','側溝・巾木','天井'],
   repairs:['高圧水洗浄','タイル洗浄（洗剤）']},
  {c:'K', n:'下地補修工事', num:true, steps:['施工前','カッター入れ','斫り','清掃','注入','目地詰め','樹脂モルタル充填','防錆処理','タイル張り','施工後'], parts:['外壁','バルコニー内壁','手摺壁','手摺天端','上裏','庇','梁・柱','タイル面'],
   repairs:['ひび割れ補修0.3mm未満','ひび割れ補修0.3mm以上','モルタル浮き補修','欠損部補修','鉄筋爆裂補修','脆弱塗膜補修','タイル面 ひび割れ補修','タイル面 浮き補修','タイル面 目地材劣化部補修']},
  {c:'S', n:'シーリング工事', steps:['施工前','撤去後','養生','プライマー塗布','シール材充填','ヘラ仕上げ','施工後'], parts:['建具廻り','外壁目地','外壁タイル目地','ベントキャップ廻り','ガラリ廻り','笠木','手摺根元','設備貫通部','PS扉廻り'],
   repairs:['打替え','新規打ち（入隅・端末）']},
  {c:'T', n:'塗装工事', steps:['施工前','下塗り','中塗り','上塗り','肌合わせ','施工後'], parts:['外壁','上裏（軒天）','バルコニー天井','共用廊下天井','階段・踊り場','手摺壁内側','庇','ボーダー','巾木'],
   repairs:['外壁塗装（下塗り＋2回）','外壁塗装（肌合わせあり）','天井・上裏塗装']},
  {c:'F', n:'鉄部塗装工事', steps:['施工前','ケレン','錆止め','中塗り','上塗り','施工後'], parts:['手摺','鉄骨階段','玄関扉・枠','PS扉','メーターボックス扉','隔て板','竪樋','ゴミ置場扉','EV機械室扉'],
   repairs:['鉄部（錆止め＋2回）','亜鉛めっき面（プライマー＋2回）']},
  {c:'B', n:'防水工事', steps:['施工前','ケレン・清掃','プライマー塗布','1層目','2層目','トップコート','施工後'], parts:['屋上 平場','屋上 立上り','笠木','バルコニー床','廊下・階段床','平場','庇天端','側溝・巾木','ドレン廻り'],
   repairs:['ウレタン塗膜防水 密着','ウレタン塗膜防水 通気緩衝','ウレタン塗膜防水 側溝・巾木（廊下・階段）','アスファルト防水（トーチ）','塩ビシート防水','防滑性塩ビシート貼（長尺）','改修用ドレン設置']},
  {c:'Z', n:'その他工事', steps:['施工前','施工中','施工後'], parts:[]},
  // 版28 で足した（本人 10/24）。前からある工種の番号（写真のフォルダの 01_〜08_）が変わらないよう一番下に置く
  {c:'H', n:'産廃搬出', steps:['施工前','施工中','施工後'], parts:['廃材置場','積込み','搬出車両','アスベスト含有廃材']}
];
// 補修項目ごとの工程（会社の標準の工法の順）。補修項目を選ぶと、工程はこの順になる。選んでいない時は工種の工程
const REPAIR_STEPS = {
  'ひび割れ補修0.3mm未満':   ['施工前','清掃','フィラー擦り込み','施工後'],
  'ひび割れ補修0.3mm以上':   ['施工前','Uカット','清掃','プライマー塗布','シール材充填','樹脂モルタル充填','施工後'],
  'モルタル浮き補修':        ['施工前','穿孔','孔内清掃','樹脂注入','ピン挿入','穴埋め','施工後'],
  '欠損部補修':              ['施工前','斫り','清掃','プライマー塗布','樹脂モルタル充填','施工後'],
  '鉄筋爆裂補修':            ['施工前','斫り','鉄筋ケレン','清掃','防錆処理','樹脂モルタル充填','施工後'],
  '脆弱塗膜補修':            ['施工前','脆弱塗膜除去','清掃','下地調整','施工後'],
  'タイル面 ひび割れ補修':   ['施工前','カッター入れ','タイル撤去','下地処理','タイル張り','目地詰め','施工後'],
  'タイル面 浮き補修':       ['施工前','穿孔','孔内清掃','樹脂注入','ピン挿入','目地仕上げ','施工後'],
  'タイル面 目地材劣化部補修': ['施工前','目地撤去','清掃','目地詰め','施工後'],
  // 下地補修のほかの工種の「仕様」（名前は日本財託の見積の雛形の項目に合わせた）
  '高圧水洗浄':              ['施工前','高圧水洗浄','施工後'],
  'タイル洗浄（洗剤）':      ['施工前','洗剤塗布','ブラシ洗い','水洗い','施工後'],
  '打替え':                  ['施工前','既存撤去','清掃','養生','バックアップ材','プライマー塗布','シール材充填','ヘラ仕上げ','養生撤去','施工後'],
  '新規打ち（入隅・端末）':  ['施工前','清掃','養生','プライマー塗布','シール材充填','ヘラ仕上げ','養生撤去','施工後'],
  '外壁塗装（下塗り＋2回）': ['施工前','下塗り','中塗り','上塗り','施工後'],
  '外壁塗装（肌合わせあり）': ['施工前','肌合わせ','下塗り','中塗り','上塗り','施工後'],
  '天井・上裏塗装':          ['施工前','下塗り','上塗り','施工後'],
  '鉄部（錆止め＋2回）':     ['施工前','ケレン','錆止め','中塗り','上塗り','施工後'],
  '亜鉛めっき面（プライマー＋2回）': ['施工前','ケレン','密着プライマー','中塗り','上塗り','施工後'],
  'ウレタン塗膜防水 密着':   ['施工前','ケレン・清掃','プライマー塗布','1層目','2層目','トップコート','施工後'],
  'ウレタン塗膜防水 通気緩衝': ['施工前','ケレン・清掃','プライマー塗布','通気緩衝シート張り','脱気筒取付','1層目','2層目','トップコート','施工後'],
  // 版29 で足した（本人 10/24。スカイコート横浜山手の廊下・階段の写真の黒板の書き方に合わせた）
  'ウレタン塗膜防水 側溝・巾木（廊下・階段）': ['施工前','高圧洗浄','高圧洗浄完了','ケレン','プライマー塗布','ウレタン1層目塗布','ウレタン2層目塗布','トップコート塗布','施工後'],
  'アスファルト防水（トーチ）': ['施工前','既存防水層撤去','ケレン・清掃','プライマー塗布','ルーフィング張り','端末処理','施工後'],
  '塩ビシート防水':          ['施工前','ケレン・清掃','絶縁シート敷き','固定金具取付','シート張り','端末シール','施工後'],
  '防滑性塩ビシート貼（長尺）': ['施工前','既存シート撤去','下地調整','接着剤塗布','シート張り','端末シール','施工後'],
  '改修用ドレン設置':        ['施工前','清掃','改修用ドレン取付','防水層との取合い','施工後']
};
// 工種の項目（下地補修は「補修項目」、ほかは「仕様」）。前に工事ごとに直した工種で項目が無い物は、最初の一覧の項目を使う
function itemsOf(k){
  if (Array.isArray(k.repairs)) return k.repairs;
  const d = DEFAULT_KINDS.find(x => x.c === k.c);
  return (d && d.repairs) || [];
}
const itemLabel = k => k.num ? '補修項目' : '仕様';
function stepsOf(k, repair){
  const r = repair && itemsOf(k).includes(repair) ? ((k.repSteps && k.repSteps[repair]) || REPAIR_STEPS[repair]) : null;
  return Array.isArray(r) && r.length ? r : k.steps;
}
const curSteps = () => stepsOf(kindOf(), st.sel.repair);
const FACES = ['北面','南面','東面','西面','屋上','共用部','廊下','階段','内部'];  // 廊下・階段は版29（本人 10/24）
const FLOORS = ['1階','2階','3階','4階','5階','6階','7階','8階','9階','10階','11階','12階','13階','14階','15階','屋上','全体'];
const FACE_L = {'北面':'N', '南面':'S', '東面':'E', '西面':'W', '屋上':'R'};

/* ---------- 状態（このスマホに覚えておく） ---------- */
const KEY = 'kokuban-camera-v3', OLDKEY = 'kokuban-camera-v2';
const defSel = () => ({kind:'S', face:'', floor:'', part:'', repair:'', numN:1, numOn:true, numFree:'', step:0, note:''});
const defBoard = () => ({style:'white', alpha:1, font:1, layout:'std', pos:{fx:1, fy:1, s:1}});
const defState = () => ({koji:'', recent:[], sites:[], projects:{}, sel:defSel(), board:defBoard(), myParts:{}, myNotes:[],
  rotMode:'auto', filter:'all', ledHead:'工事写真', ledCover:true, ledMaker:'', shareSites:false, mkColor:'#e53935', mkTool:'circle'});
let st = defState();
function loadState(){
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e) {}
  if (s && typeof s === 'object') {
    st = Object.assign(defState(), s);
    st.sel = Object.assign(defSel(), s.sel || {});
    st.board = Object.assign(defBoard(), s.board || {});
    st.board.pos = Object.assign({fx:1, fy:1, s:1}, (s.board && s.board.pos) || {});
  } else {
    // 版14 までの覚えた事を引き継ぐ
    let o = null; try { o = JSON.parse(localStorage.getItem(OLDKEY) || 'null'); } catch(e) {}
    if (o && typeof o === 'object') {
      st.koji = o.koji || ''; st.recent = o.recent || []; st.sites = o.sites || []; st.myParts = o.myParts || {};
      st.rotMode = o.rotMode || 'auto';
      st.board.style = o.style === 'green' ? 'green' : 'white';
      if (o.pos && typeof o.pos.fx === 'number') st.board.pos = {fx:o.pos.fx, fy:o.pos.fy, s:o.pos.s || 1};
      Object.assign(st.sel, {kind:o.kind || 'S', face:o.face || '', floor:o.floor || '', part:(o.partFree || '').trim() || o.part || '', repair:o.repair || '',
        numFree:o.num || '', numN:o.numN || 1, numOn:o.numOn !== false, step:o.step || 0});
    }
  }
  if (!Array.isArray(st.recent)) st.recent = [];
  if (!Array.isArray(st.sites)) st.sites = [];
  if (!st.projects || typeof st.projects !== 'object') st.projects = {};
  if (!st.myParts || typeof st.myParts !== 'object') st.myParts = {};
  if (!Array.isArray(st.myNotes)) st.myNotes = [];
}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e) {} }
function remember(k){ k = (k || '').trim(); if (!k) return; st.recent = [k].concat(st.recent.filter(x => x !== k)).slice(0, 8); }

/* ---------- 工種・測点・番号 ---------- */
function kindsFor(koji){ const p = st.projects[(koji || '').trim()]; return (p && Array.isArray(p.kinds) && p.kinds.length) ? p.kinds : DEFAULT_KINDS; }
const kindsNow = () => kindsFor(st.koji);
function kindOf(sel){ const list = kindsNow(); return list.find(k => k.c === (sel || st.sel).kind) || list[0]; }
function fixSel(){
  const k = kindOf();
  if (st.sel.kind !== k.c) { st.sel.kind = k.c; st.sel.step = 0; st.sel.part = ''; st.sel.repair = ''; }
  const n = curSteps().length;
  if (st.sel.step >= n) st.sel.step = Math.max(0, n - 1);
  if (st.sel.step < 0) st.sel.step = 0;
}
const sokutenOf = sel => [sel.face, sel.floor, (sel.part || '').trim()].filter(Boolean).join(' ');
function numOf(sel, k){
  if (!k.num) return '';
  if ((sel.numFree || '').trim()) return sel.numFree.trim();
  if (!sel.numOn) return '';
  const m = /^(\d+)階$/.exec(sel.floor || '');
  const fl = m ? m[1] : (sel.floor === '屋上' ? 'R' : '');
  return [FACE_L[sel.face] || '', String(sel.numN || 1), fl].filter(Boolean).join('-');
}
function stamp(d){ return {date: d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()), time: pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()), ts: d.getTime()}; }
function metaNow(t, board){
  const k = kindOf(), s = st.sel;
  return Object.assign({koji: st.koji.trim(), kc: k.c, kind: k.n, sokuten: sokutenOf(s), repair: itemsOf(k).includes(s.repair) ? s.repair : '', num: numOf(s, k),
    step: stepsOf(k, s.repair)[s.step] || '', stepIdx: s.step, bnote: (board || st.board).layout === 'note' ? (s.note || '').trim() : ''}, t || stamp(new Date()));
}
const groupKey = r => [r.kc, r.sokuten || '', r.repair || '', r.num || ''].join('|');
function curKey(){ const m = metaNow(); return groupKey(m); }
function doneSteps(key, koji){ const s = new Set(); photos.forEach(p => { if (p.koji === koji && groupKey(p) === key) s.add(p.step); }); return s; }
function selFromRec(rec){
  const o = rec.sel || {};
  const s = Object.assign(defSel(), {kind: rec.kc, face: o.face || '', floor: o.floor || '', part: (o.partFree || '').trim() || o.part || '', repair: rec.repair || '',
    numN: o.numN || 1, numOn: o.numOn !== undefined ? o.numOn : !!rec.num, numFree: o.numFree !== undefined ? o.numFree : (o.num || ''), step: rec.stepIdx || 0, note: rec.bnote || ''});
  if (rec.num && o.numN === undefined && o.numFree === undefined) s.numFree = rec.num;   // 版11 までの写真
  return s;
}
const recBoard = rec => rec.board ? Object.assign(defBoard(), rec.board) : Object.assign(defBoard(), {style: rec.style === 'green' ? 'green' : 'white', pos: rec.pos || {fx:1, fy:1, s:1}});
const recMeta = rec => ({koji: rec.koji, kind: rec.kind, sokuten: rec.sokuten, num: rec.num, repair: rec.repair, step: rec.step, bnote: rec.bnote || '', date: rec.date, time: rec.time});

/* ---------- 黒板を描く ---------- */
const FONT = '"BIZ UDPGothic","Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo","Noto Sans JP",sans-serif';
function fit(ctx, text, maxW, size, weight){
  let s = size;
  do { ctx.font = (weight || 400) + ' ' + s + 'px ' + FONT; if (ctx.measureText(text).width <= maxW) break; s -= Math.max(1, s * 0.06); } while (s > 8);
  return s;
}
const LAYOUT = {std:{rows:4, center:270, step:92}, note:{rows:5, center:270, step:88}, big:{rows:4, center:330, step:124}};
const STYLES = {white:{bg:'#ffffff', ink:'#111111', sub:'#333333', line:'#111111'}, green:{bg:'#245a3c', ink:'#ffffff', sub:'#e6efe9', line:'#ffffff'}, black:{bg:'#1d1f1e', ink:'#ffffff', sub:'#dddddd', line:'#ffffff'}};
// 黒板の場所：pos.fx・fy＝空いている所の中の位置（0＝左・上、1＝右・下）、pos.s＝大きさ
function boardRect(W, H, b){
  const L = LAYOUT[b.layout] || LAYOUT.std;
  let u = Math.min(W, H) / 1200 * (b.pos.s || 1);
  let w = 780 * u, bh = (60 * L.rows + L.center) * u, mg = 14 * u;
  const lim = Math.min((W - 2 * mg) / w, (H - 2 * mg) / bh, 1);
  if (lim < 1) { u *= lim; w *= lim; bh *= lim; mg *= lim; }
  return {x: mg + clamp01(b.pos.fx) * Math.max(0, W - w - 2 * mg), y: mg + clamp01(b.pos.fy) * Math.max(0, H - bh - 2 * mg), w, h: bh, u, mg, L};
}
function posFromXY(W, H, b, x, y){
  const r = boardRect(W, H, Object.assign({}, b, {pos: {fx:0, fy:0, s: b.pos.s}}));
  const fw = W - r.w - 2 * r.mg, fh = H - r.h - 2 * r.mg;
  return {fx: fw > 0 ? clamp01((x - r.mg) / fw) : 0, fy: fh > 0 ? clamp01((y - r.mg) / fh) : 0, s: b.pos.s};
}
// 黒板の日付：2026.10.20 → 2026年10月20日
const jpDate = d => { const a = String(d || '').split('.'); return a.length === 3 ? a[0] + '年' + (+a[1]) + '月' + (+a[2]) + '日' : String(d || ''); };
function drawBoard(ctx, W, H, m, b){
  const r = boardRect(W, H, b), u = r.u, x = r.x, y = r.y, bw = r.w, bh = r.h, L = r.L;
  const S = STYLES[b.style] || STYLES.white, fs = b.font || 1;
  const lw = Math.max(1, 3 * u), rowH = 60 * u, labW = 128 * u;
  ctx.save();
  ctx.globalAlpha = b.alpha == null ? 1 : b.alpha; ctx.fillStyle = S.bg; ctx.fillRect(x, y, bw, bh); ctx.globalAlpha = 1;
  ctx.strokeStyle = S.line; ctx.lineWidth = lw * 1.4; ctx.strokeRect(x, y, bw, bh); ctx.lineWidth = lw;
  const rows = [['工事名', m.koji || '（工事名を選んでください）'], ['工　種', m.kind || ''], ['測　点', m.sokuten || ''], ['日　付', jpDate(m.date)]];
  if (L.rows === 5) rows.push(['備　考', m.bnote || '']);
  ctx.fillStyle = S.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  rows.forEach((row, i) => {
    const ry = y + rowH * i;
    ctx.beginPath(); ctx.moveTo(x, ry + rowH); ctx.lineTo(x + bw, ry + rowH); ctx.stroke();
    fit(ctx, row[0], labW - 16 * u, 30 * u * Math.min(fs, 1.1), 700); ctx.fillText(row[0], x + 10 * u, ry + rowH / 2);
    fit(ctx, row[1], bw - labW - 20 * u, 34 * u * fs, 400); ctx.fillText(row[1], x + labW + 10 * u, ry + rowH / 2);
  });
  ctx.beginPath(); ctx.moveTo(x + labW, y); ctx.lineTo(x + labW, y + rowH * rows.length); ctx.stroke();
  const by = y + rowH * rows.length, bh2 = bh - rowH * rows.length, tw = bw - 32 * u, cx = x + bw / 2;
  const lines = [];
  if (m.num) lines.push([m.num, 46 * u * fs, 700]);
  if (m.repair) lines.push([m.repair, 40 * u * fs, 400]);
  lines.push([m.step || '', (lines.length ? L.step * 0.78 : L.step) * u * fs, 700]);
  ctx.textAlign = 'center';
  let sizes = lines.map(l => fit(ctx, l[0], tw, l[1], l[2]));
  const avail = bh2 - 24 * u;
  let total = sizes.reduce((a, s) => a + s * 1.22, 0);
  if (total > avail) { const k = avail / total; sizes = sizes.map(s => s * k); total = avail; }
  let ty = by + (bh2 - total) / 2;
  lines.forEach((l, i) => { ctx.font = l[2] + ' ' + sizes[i] + 'px ' + FONT; ctx.fillText(l[0], cx, ty + sizes[i] * 0.61); ty += sizes[i] * 1.22; });
  ctx.restore();
}

/* ---------- 丸・矢印・字（書き込み）を描く。場所は写真の幅・高さに対する割合 ---------- */
function outlineStroke(ctx, lw){
  const c = ctx.strokeStyle;
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = lw * 1.8; ctx.stroke(); ctx.restore();
  ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke();
}
function drawMark(ctx, W, H, mk){
  const base = Math.max(W, H), lw = base * 0.007;
  const x1 = mk.x1 * W, y1 = mk.y1 * H, x2 = (mk.x2 != null ? mk.x2 : mk.x1) * W, y2 = (mk.y2 != null ? mk.y2 : mk.y1) * H;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = mk.color; ctx.fillStyle = mk.color;
  if (mk.t === 'circle') {
    ctx.beginPath(); ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.max(3, Math.abs(x2 - x1) / 2), Math.max(3, Math.abs(y2 - y1) / 2), 0, 0, Math.PI * 2); outlineStroke(ctx, lw);
  } else if (mk.t === 'rect') {
    ctx.beginPath(); ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); outlineStroke(ctx, lw);
  } else if (mk.t === 'arrow') {
    const a = Math.atan2(y2 - y1, x2 - x1), hl = lw * 5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * hl * 0.7, y2 - Math.sin(a) * hl * 0.7); outlineStroke(ctx, lw);
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl * Math.cos(a - 0.45), y2 - hl * Math.sin(a - 0.45)); ctx.lineTo(x2 - hl * Math.cos(a + 0.45), y2 - hl * Math.sin(a + 0.45)); ctx.closePath();
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = lw * 0.8; ctx.stroke(); ctx.restore(); ctx.fill();
  } else if (mk.t === 'text' && mk.text) {
    const f = base * 0.045;
    ctx.font = '700 ' + f + 'px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.lineWidth = f * 0.16; ctx.strokeStyle = mk.color === '#111111' ? '#ffffff' : '#000000'; ctx.strokeText(mk.text, x1, y1); ctx.fillText(mk.text, x1, y1);
  }
  ctx.restore();
}
function drawMarks(ctx, W, H, marks){ (marks || []).forEach(mk => drawMark(ctx, W, H, mk)); }

/* ---------- 写真をスマホの中に残す（IndexedDB） ---------- */
let photos = [];
let idb = null;
function idbOpen(){
  return new Promise(res => {
    try {
      const r = indexedDB.open('kokuban-camera', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('photos')) r.result.createObjectStore('photos', {keyPath: 'id'}); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch(e) { res(null); }
  });
}
function idbAll(){
  if (!idb) return Promise.resolve([]);
  return new Promise(res => { try { const q = idb.transaction('photos').objectStore('photos').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); } catch(e) { res([]); } });
}
function idbPut(rec){
  if (!idb) return Promise.resolve(false);
  return new Promise(res => { try { const t = idb.transaction('photos', 'readwrite'); t.objectStore('photos').put(rec); t.oncomplete = () => res(true); t.onerror = () => res(false); t.onabort = () => res(false); } catch(e) { res(false); } });
}
function idbDel(id){
  if (!idb) return Promise.resolve();
  return new Promise(res => { try { const t = idb.transaction('photos', 'readwrite'); t.objectStore('photos').delete(id); t.oncomplete = () => res(); t.onerror = () => res(); } catch(e) { res(); } });
}
const urls = new Map();
function urlOf(rec, which){ const k = rec.id + ':' + which + ':' + (rec.rev || 0); if (!urls.has(k)) urls.set(k, URL.createObjectURL(rec[which])); return urls.get(k); }
function dropUrls(id){ for (const k of [...urls.keys()]) if (k.startsWith(id + ':')) { URL.revokeObjectURL(urls.get(k)); urls.delete(k); } }
async function putPhoto(rec){
  const i = photos.findIndex(p => p.id === rec.id);
  if (i >= 0) { dropUrls(rec.id); photos[i] = rec; } else photos.push(rec);
  const ok = await idbPut(rec);
  if (!ok && idb) toast('スマホの空きが少ないため、写真を残せませんでした。送ってから古い写真を消してください。', 6000);
  return ok;
}
async function deletePhotos(ids){
  for (const id of ids) { await idbDel(id); dropUrls(id); }
  photos = photos.filter(p => !ids.includes(p.id));
}

/* ---------- 写真を作る ---------- */
function loadImage(blob){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => res({img, url}); img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('写真を開けませんでした')); };
    img.src = url;
  });
}
async function blobToCanvas(blob){
  const {img, url} = await loadImage(blob);
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  cv.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(url);
  return cv;
}
const toBlob = (cv, q) => new Promise(r => cv.toBlob(r, 'image/jpeg', q));
const safe = s => String(s || '').replace(/[\\/:*?"<>|\s　]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
function scaledCanvas(src, w0, h0, long){
  const s = Math.min(1, long / Math.max(w0, h0));
  const cv = document.createElement('canvas'); cv.width = Math.round(w0 * s); cv.height = Math.round(h0 * s);
  cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
  return cv;
}
const LONG = 2048;
async function fileToBase(file){
  const {img, url} = await loadImage(file);
  const cv = scaledCanvas(img, img.naturalWidth, img.naturalHeight, LONG);
  URL.revokeObjectURL(url);
  const blob = await toBlob(cv, 0.9);
  if (!blob) throw new Error('写真を開けませんでした');
  return blob;
}
const fileName = m => [m.date, m.koji, m.kind, m.sokuten, m.num, m.repair, m.step, (m.time || '').replace(/:/g, '')].filter(Boolean).map(safe).join('_') + '.jpg';
// 黒板の無い写真＋黒板＋書き込み → 黒板入りの写真と小さい写真
async function composeBlobs(baseCv, meta, board, marks){
  const W = baseCv.width, H = baseCv.height;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); ctx.drawImage(baseCv, 0, 0);
  drawBoard(ctx, W, H, meta, board); drawMarks(ctx, W, H, marks);
  const blob = await toBlob(cv, 0.88), thumb = await toBlob(scaledCanvas(cv, W, H, 400), 0.8);
  if (!blob || !thumb) throw new Error('写真を作れませんでした');
  return {blob, thumb};
}
// いま選んでいる黒板で写真を残す。editOf があれば、その写真を直す（撮った日時・書き込み・備考はそのまま）
async function makeRecord(baseCv, baseBlob, t, editOf){
  const time = editOf ? {date: editOf.date, time: editOf.time, ts: editOf.ts} : t;
  const board = clone(st.board), m = metaNow(time, board), marks = editOf ? (editOf.marks || []) : [];
  const {blob, thumb} = await composeBlobs(baseCv, m, board, marks);
  const rec = Object.assign({}, editOf || {}, m, {
    id: editOf ? editOf.id : 'p' + m.ts + Math.random().toString(36).slice(2, 7),
    base: editOf ? editOf.base : baseBlob, sel: clone(st.sel), board, pos: clone(board.pos), style: board.style, marks,
    blob, thumb, sent: false, saved: false, filename: fileName(m), rev: ((editOf && editOf.rev) || 0) + 1
  });
  await putPhoto(rec);
  remember(m.koji);
  learnSel();
  return rec;
}
// 手で入れた部位・備考は覚えて、次から押すだけで選べるようにする
function learnSel(){
  const k = kindOf(), pf = (st.sel.part || '').trim();
  if (pf && !k.parts.includes(pf)) { const a = st.myParts[k.c] || []; st.myParts[k.c] = [pf].concat(a.filter(x => x !== pf)).slice(0, 15); }
  const nt = (st.sel.note || '').trim();
  if (nt && st.board.layout === 'note') st.myNotes = [nt].concat(st.myNotes.filter(x => x !== nt)).slice(0, 10);
}
function advanceStep(){
  const k = kindOf();
  if (st.sel.step < curSteps().length - 1) st.sel.step++;
  else if (k.num && !(st.sel.numFree || '').trim() && st.sel.numOn) { st.sel.numN = (st.sel.numN || 1) + 1; st.sel.step = 0; toast('施工後まで撮ったので、番号を ' + st.sel.numN + ' に進めました'); }
}

/* ---------- 画面の重なり（あとから開いた物が上）・戻るボタン ---------- */
let zTop = 40;
function show(el){ el.hidden = false; el.style.zIndex = String(++zTop); document.body.classList.add('lock'); guardBack(); }
function hide(el){ el.hidden = true; if (!anyOpen()) document.body.classList.remove('lock'); }
const OVERLAYS = ['mark', 'photo', 'editor', 'office', 'kinds', 'share', 'kojiSel', 'help', 'camScreen'];
const anyOpen = () => OVERLAYS.some(id => !$(id).hidden);
let guard = false;
function guardBack(){ if (!guard) { try { history.pushState({kokuban: 1}, ''); guard = true; } catch(e) {} } }
window.addEventListener('popstate', () => {
  guard = false;
  // スマホの「戻る」：いちばん上の画面を閉じる
  if (!$('camSheet').hidden && topOpen() === 'camScreen') { closeSheet(); }
  else {
    const top = topOpen();
    if (top) CLOSERS[top]();
  }
  if (anyOpen()) guardBack();
});
function topOpen(){ let best = null, z = -1; OVERLAYS.forEach(id => { const el = $(id); if (!el.hidden) { const v = +el.style.zIndex || 0; if (v > z) { z = v; best = id; } } }); return best; }

/* ---------- ちょっとした表示 ---------- */
let toastTimer = 0;
function toast(t, ms){ const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), ms || 2600); }
function busy(on, text){ $('busy').textContent = text || '少し待ってください…'; $('busy').hidden = !on; }
function setMsg(el, t, good){ el.textContent = t || ''; el.className = 'msg' + (t ? (good ? ' good' : ' bad') : ''); }
const chip = (text, on, click, cls) => h('button', {type:'button', class:'chip' + (cls ? ' ' + cls : ''), 'aria-pressed': !!on, on:{click}}, text);

/* ---------- 写真の向き（横に持ったら横の写真にする） ---------- */
let physRot = 0, motionOn = false;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(navigator.userAgent);
// Android の Chrome は zip を共有の画面に出せない（写真・PDF などだけ）ので、「ダウンロード」に保存して LINE WORKS の ＋ → ファイル から送ってもらう
const ZIP_SAVED_HOW = isAndroid ? '「ダウンロード」に保存しました。LINE WORKS（LINE）のトークで ＋ →「ファイル」→「ダウンロード」の中のファイルを選んで送り、送ったら「送った印を付ける」を押してください。'
  : '保存しました（' + (isIOS ? '「ファイル」アプリの「ダウンロード」' : 'ダウンロード') + 'に入ります）。LINE のトークで ＋ → ファイル から送り、送ったら「送った印を付ける」を押してください。';
const norm = a => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; };
function screenAngle(){
  if (screen.orientation && typeof screen.orientation.angle === 'number') return norm(screen.orientation.angle);
  if (typeof window.orientation === 'number') return norm(window.orientation);
  return 0;
}
function onMotion(e){
  const g = e.accelerationIncludingGravity; if (!g || g.x == null || g.y == null) return;
  let ax = g.x, ay = g.y; if (isIOS) { ax = -ax; ay = -ay; }
  let r = physRot;
  if (Math.abs(ay) > Math.abs(ax) + 2) r = ay > 0 ? 0 : 180;
  else if (Math.abs(ax) > Math.abs(ay) + 2) r = ax > 0 ? -90 : 90;
  if (r !== physRot) { physRot = r; }
}
async function startMotion(){
  if (motionOn) return;
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      if (await DeviceMotionEvent.requestPermission() !== 'granted') return;
    }
    window.addEventListener('devicemotion', onMotion); motionOn = true;
  } catch(e) {}
}
function stopMotion(){ if (motionOn) { window.removeEventListener('devicemotion', onMotion); motionOn = false; } }
function camRot(){
  const v = $('video'), wide = v.videoWidth > v.videoHeight;
  if (st.rotMode === 'land') return wide ? 0 : -90;
  if (st.rotMode === 'portrait') return wide ? 90 : 0;
  return norm(physRot + screenAngle());
}
const turned = r => r === 90 || r === -90;
function setPhotoToFrame(ctx, r, W, H){
  if (r === 90) ctx.setTransform(0, -1, 1, 0, 0, H);
  else if (r === -90) ctx.setTransform(0, 1, -1, 0, W, 0);
  else if (r === 180) ctx.setTransform(-1, 0, 0, -1, W, H);
  else ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function frameToPhoto(p, r, W, H){
  if (r === 90) return {x: H - p.y, y: p.x};
  if (r === -90) return {x: p.y, y: W - p.x};
  if (r === 180) return {x: W - p.x, y: H - p.y};
  return p;
}
function rotateCanvas(src, r){
  if (!r) return src;
  const W = src.width, H = src.height, cv = document.createElement('canvas');
  cv.width = turned(r) ? H : W; cv.height = turned(r) ? W : H;
  const c = cv.getContext('2d');
  if (r === 90) c.setTransform(0, 1, -1, 0, H, 0);
  else if (r === -90) c.setTransform(0, -1, 1, 0, 0, W);
  else c.setTransform(-1, 0, 0, -1, W, H);
  c.drawImage(src, 0, 0);
  return cv;
}

/* ---------- カメラ ---------- */
const cam = {on:false, stream:null, track:null, hw:false, zoom:1, zmin:1, zmax:4, torch:false, torchOn:false, shots:0, last:null, zTimer:0};
async function openCamera(){
  if (!st.koji.trim()) { openKojiSel('先に工事名を選んでください。'); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('camFile').click(); return; }
  startMotion();   // iPhone はここで「動作と方向」の許可を聞く（押した時でないと聞けない）
  fixSel();
  show($('camScreen'));
  cam.on = true; cam.shots = 0; cam.last = null;
  $('camCount').textContent = '0'; $('lastShot').style.backgroundImage = '';
  $('camHint').style.opacity = '1'; setTimeout(() => { $('camHint').style.opacity = '0'; }, 5000);
  camLayout(); updateCamInfo();
  await startStream();
}
async function startStream(resume){
  try {
    cam.stream = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: {ideal: 'environment'}, width: {ideal: 4032}, height: {ideal: 3024}, aspectRatio: {ideal: 4 / 3}}});
    const v = $('video'); v.srcObject = cam.stream; await v.play().catch(() => {});
    await new Promise(r => { if (v.videoWidth) r(); else v.onloadedmetadata = () => r(); setTimeout(r, 3000); });
    cam.track = cam.stream.getVideoTracks()[0];
    let caps = {}; try { caps = (cam.track.getCapabilities && cam.track.getCapabilities()) || {}; } catch(e) {}
    cam.hw = !!(caps.zoom && caps.zoom.max > 1);
    cam.zmin = cam.hw ? Math.max(1, caps.zoom.min || 1) : 1;
    cam.zmax = cam.hw ? Math.min(10, caps.zoom.max) : 4;
    cam.zoom = cam.zmin;
    cam.torch = !!caps.torch; cam.torchOn = false;
    $('torchBtn').hidden = !cam.torch; $('torchBtn').setAttribute('aria-pressed', 'false');
    renderZooms();
    layoutOverlay(); startLoop();
  } catch(e) {
    closeCamera();
    if (resume) { toast('カメラをもう一度開いてください。', 4000); return; }
    toast('カメラを使えませんでした。ふつうのカメラで撮って、あとから黒板を入れます。', 5000);
    $('camFile').click();
  }
}
function stopStream(){ if (cam.stream) { cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; cam.track = null; } $('video').srcObject = null; }
function closeCamera(){
  stopStream(); stopMotion(); cam.on = false;
  $('camSheet').hidden = true;
  hide($('camScreen'));
  renderHome();
}
function setZoom(z){
  z = clamp(z, cam.zmin, cam.zmax);
  cam.zoom = z;
  if (cam.hw && cam.track) {
    clearTimeout(cam.zTimer);
    cam.zTimer = setTimeout(() => { cam.track.applyConstraints({advanced: [{zoom: cam.zoom}]}).catch(() => { cam.hw = false; cam.zmax = 4; renderZooms(); }); }, 60);
  }
  renderZooms();
}
const zoomLevels = () => [1, 2, 4, 8].filter(l => l >= cam.zmin && l <= cam.zmax + 0.01);
function renderZooms(){
  const z0 = cam.zoom, near = zoomLevels().find(l => Math.abs(l - z0) < 0.05);
  $('zoomBtn').textContent = (near ? near : z0.toFixed(1)) + '×';
}
// 押すたびに 1× → 2× → 4× → 1×
function nextZoom(){ const lv = zoomLevels(); setZoom(lv.find(l => l > cam.zoom + 0.05) || lv[0]); }
function srcRect(){
  const v = $('video'), VW = v.videoWidth || 4, VH = v.videoHeight || 3, dz = cam.hw ? 1 : cam.zoom;
  const w = VW / dz, hh = VH / dz;
  return {sx: (VW - w) / 2, sy: (VH - hh) / 2, sw: w, sh: hh};
}
function camLayout(){
  const land = window.innerWidth > window.innerHeight;
  $('camScreen').classList.toggle('land', land);
}
const ovBox = {left:0, top:0, w:0, h:0};
function layoutOverlay(){
  camLayout();
  const vf = $('vf'), v = $('video'), ov = $('ov');
  const VW = v.videoWidth || 4, VH = v.videoHeight || 3;
  const k = Math.min(vf.clientWidth / VW, vf.clientHeight / VH);
  ovBox.w = VW * k; ovBox.h = VH * k; ovBox.left = (vf.clientWidth - ovBox.w) / 2; ovBox.top = (vf.clientHeight - ovBox.h) / 2;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.max(1, Math.round(ovBox.w * dpr)), ph = Math.max(1, Math.round(ovBox.h * dpr));
  if (ov.width !== pw || ov.height !== ph) { ov.width = pw; ov.height = ph; }
  const s = ov.style, L = ovBox.left + 'px', T = ovBox.top + 'px', Wp = ovBox.w + 'px', Hp = ovBox.h + 'px';
  if (s.left !== L) s.left = L; if (s.top !== T) s.top = T; if (s.width !== Wp) s.width = Wp; if (s.height !== Hp) s.height = Hp;
}
// カメラの映像と黒板を1枚の絵にまとめて描き直す（iPhone で重ねた黒板が出ない・遅れる対策＝版11 のやり方）
let boardCache = null, boardSig = '', loopOn = false, lastPaint = 0;
const camCovered = () => !$('photo').hidden || !$('editor').hidden || !$('mark').hidden;
function startLoop(){
  if (loopOn) return;
  loopOn = true;
  const step = () => { if (!cam.on) { loopOn = false; return; } if (!camCovered()) paintFrame(); requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
setInterval(() => { if (cam.on && !camCovered() && performance.now() - lastPaint > 250) paintFrame(); }, 250);
function paintFrame(){
  lastPaint = performance.now();
  layoutOverlay();
  const ov = $('ov'), c = ov.getContext('2d'), v = $('video');
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (v.videoWidth && v.readyState >= 2) { const r = srcRect(); c.drawImage(v, r.sx, r.sy, r.sw, r.sh, 0, 0, ov.width, ov.height); }
  else { c.fillStyle = '#000'; c.fillRect(0, 0, ov.width, ov.height); }
  const r = camRot(), W = turned(r) ? ov.height : ov.width, H = turned(r) ? ov.width : ov.height;
  const m = metaNow();
  const sig = [W, H, r, JSON.stringify(st.board), m.koji, m.kind, m.sokuten, m.num, m.repair, m.step, m.bnote, m.date, m.time.slice(0, 5)].join('|');
  if (sig !== boardSig || !boardCache) {
    boardCache = boardCache || document.createElement('canvas');
    boardCache.width = W; boardCache.height = H;
    const bc = boardCache.getContext('2d');
    bc.clearRect(0, 0, W, H);
    drawBoard(bc, W, H, m, st.board);
    boardSig = sig;
    $('rotBtn').textContent = rotLabel();
  }
  setPhotoToFrame(c, r, ov.width, ov.height);
  c.drawImage(boardCache, 0, 0);
  c.setTransform(1, 0, 0, 1, 0, 0);
}
function rotLabel(){
  const v = $('video'), r = camRot();
  const land = (turned(r) ? v.videoHeight : v.videoWidth) > (turned(r) ? v.videoWidth : v.videoHeight);
  return st.rotMode === 'auto' ? '向き 自動（' + (land ? '横' : '縦') + '）' : st.rotMode === 'land' ? '向き 横' : '向き 縦';
}
let shooting = false;
async function shoot(){
  if (!cam.on || !cam.stream || shooting) return;
  const v = $('video'); if (!v.videoWidth) return;
  shooting = true;
  const f = $('flash'); f.style.transition = 'none'; f.style.opacity = '0.85'; requestAnimationFrame(() => { f.style.transition = ''; f.style.opacity = '0'; });
  try { if (navigator.vibrate) navigator.vibrate(30); } catch(e) {}
  try {
    const t = stamp(new Date());
    const r = srcRect(), s = Math.min(1, LONG / Math.max(r.sw, r.sh));
    const grab = document.createElement('canvas'); grab.width = Math.round(r.sw * s); grab.height = Math.round(r.sh * s);
    grab.getContext('2d').drawImage(v, r.sx, r.sy, r.sw, r.sh, 0, 0, grab.width, grab.height);
    const baseCv = rotateCanvas(grab, camRot());
    const baseBlob = await toBlob(baseCv, 0.9);
    const rec = await makeRecord(baseCv, baseBlob, t, null);
    cam.last = rec; cam.shots++;
    $('camCount').textContent = String(cam.shots);
    $('lastShot').style.backgroundImage = 'url("' + urlOf(rec, 'thumb') + '")';
    advanceStep(); save(); updateCamInfo();
  } catch(e) { toast(e.message || '撮れませんでした'); }
  finally { shooting = false; }
}
function updateCamInfo(){
  fixSel();
  const k = kindOf(), s = st.sel, sk = sokutenOf(s), num = numOf(s, k);
  $('cvKind').textContent = k.n;
  const ks = kindsNow(), ki = ks.findIndex(x => x.c === k.c);
  $('kindPrev').disabled = ki <= 0; $('kindNext').disabled = ki >= ks.length - 1;
  const pos = [sk, num, itemsOf(k).includes(s.repair) ? s.repair : ''].filter(Boolean).join('　');
  $('cvPos').textContent = pos || '選んでいません（押して選ぶ）';
  $('cvPos').classList.toggle('none', !pos);
  const byNum = posByNum(k, s), fi = FLOORS.indexOf(s.floor);
  $('cvPosL').textContent = '測点 ›　◀▶ ' + (byNum ? '番号' : '階');
  $('posPrev').disabled = byNum ? (s.numN || 1) <= 1 : fi <= 0;
  $('posNext').disabled = !byNum && fi >= FLOORS.length - 1;
  const steps = curSteps();
  $('cvStep').textContent = steps[s.step] || '（工程なし）';
  const done = doneSteps(curKey(), st.koji.trim());
  $('cvStepN').textContent = (s.step + 1) + '/' + steps.length + (done.has(steps[s.step]) ? '　✓撮った' : '');
  $('stepPrev').disabled = s.step <= 0;
  $('stepNext').disabled = s.step >= steps.length - 1;
}
// 黒板を指で動かす・黒板の上を2本指＝黒板の大きさ・黒板の外を2本指＝カメラの拡大
(function(){
  const vf = $('vf'), pts = new Map();
  let drag = null, pinch = null, onBoardStart = false;
  const dims = () => { const r = camRot(); return {r, W: turned(r) ? ovBox.h : ovBox.w, H: turned(r) ? ovBox.w : ovBox.h}; };
  const local = e => { const b = $('ov').getBoundingClientRect(), d = dims(); return frameToPhoto({x: e.clientX - b.left, y: e.clientY - b.top}, d.r, ovBox.w, ovBox.h); };
  const dist = () => { const a = [...pts.values()]; return Math.hypot(a[0].sx - a[1].sx, a[0].sy - a[1].sy); };
  vf.addEventListener('pointerdown', e => {
    if (e.target.closest('.ctop')) return;
    try { vf.setPointerCapture(e.pointerId); } catch(err) {}
    const p = local(e); pts.set(e.pointerId, {x: p.x, y: p.y, sx: e.clientX, sy: e.clientY});
    if (pts.size === 1) {
      const d = dims(), r = boardRect(d.W, d.H, st.board);
      onBoardStart = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
      drag = onBoardStart ? {dx: p.x - r.x, dy: p.y - r.y} : null;
    } else if (pts.size === 2) {
      pinch = {mode: onBoardStart ? 'board' : 'zoom', d0: Math.max(1, dist()), s0: st.board.pos.s, z0: cam.zoom}; drag = null;
    }
  });
  vf.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const p = local(e); pts.set(e.pointerId, {x: p.x, y: p.y, sx: e.clientX, sy: e.clientY});
    if (pinch && pts.size === 2) {
      const k = dist() / pinch.d0;
      if (pinch.mode === 'board') st.board.pos.s = clamp(pinch.s0 * k, 0.45, 2.2);
      else setZoom(pinch.z0 * k);
    } else if (drag && pts.size === 1) {
      const d = dims(); st.board.pos = posFromXY(d.W, d.H, st.board, p.x - drag.dx, p.y - drag.dy);
    }
  });
  const up = e => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { drag = null; save(); } };
  vf.addEventListener('pointerup', up); vf.addEventListener('pointercancel', up);
})();
// 工種の ◀ ▶：前・次の工種（工種を選んだ時と同じく、部位・補修・工程は初めに戻す）
function kindMove(d){
  const ks = kindsNow(), i = ks.findIndex(x => x.c === st.sel.kind), n = i + d;
  if (i < 0 || n < 0 || n >= ks.length) return;
  Object.assign(st.sel, {kind: ks[n].c, part: '', repair: '', numFree: '', step: 0});
  changed();
}
// 測点の ◀ ▶：番号を振る工種は番号を1つずつ、ほかは階を1つずつ
const posByNum = (k, s) => !!(k.num && s.numOn && !(s.numFree || '').trim());
function posMove(d){
  const k = kindOf(), s = st.sel;
  if (posByNum(k, s)) { const n = (s.numN || 1) + d; if (n < 1) return; s.numN = n; }
  else { const i = FLOORS.indexOf(s.floor), n = i < 0 ? (d > 0 ? 0 : -1) : i + d; if (n < 0 || n >= FLOORS.length) return; s.floor = FLOORS[n]; }
  changed();
}
function openSheet(tab){ picker.cam.tab = tab; renderPicker(picker.cam); $('camSheet').hidden = false; $('camPick').scrollTop = 0; }
function closeSheet(){ $('camSheet').hidden = true; updateCamInfo(); }

/* ---------- 選ぶ所（カメラの上と、黒板を入れる画面の2か所で使う） ---------- */
const TABS = [['kind', '工種'], ['pos', '測点'], ['step', '工程'], ['board', '黒板']];
const picker = {cam: {tab: 'kind', tabs: 'camTabs', body: 'camPick'}, ed: {tab: 'kind', tabs: 'edTabs', body: 'edPick'}};
function changed(opts){
  fixSel(); save();
  if (cam.on) updateCamInfo();
  if (!$('editor').hidden) drawEditor();
  if (!(opts && opts.keepPicker)) {
    if (!$('camSheet').hidden) renderPicker(picker.cam);
    if (!$('editor').hidden) renderPicker(picker.ed);
  }
}
function renderPicker(p){
  $(p.tabs).replaceChildren(...TABS.map(([id, label]) => h('button', {type:'button', class:'tab', role:'tab', 'aria-selected': p.tab === id, text: label,
    on:{click: () => { p.tab = id; renderPicker(p); const sc = p === picker.cam ? $('camPick') : $('edPick').parentElement; sc.scrollTop = 0; }}})));
  const body = $(p.body);
  put(body, ...(PICK[p.tab] || PICK.kind)(p));
}
const secth = t => h('div', {class:'secth', text: t});
const PICK = {
  kind(p){
    return [
      h('div', {class:'kinds'}, kindsNow().map(k => chip(k.n, k.c === st.sel.kind, () => {
        if (st.sel.kind !== k.c) Object.assign(st.sel, {kind: k.c, part: '', repair: '', numFree: '', step: 0});
        p.tab = 'pos'; changed();
      }))),
      h('p', {class:'note', text:'工種を足す・名前を変える・並べ替えるのは、はじめの画面の「工種・部位」から。'})
    ];
  },
  pos(p){
    const k = kindOf(), s = st.sel;
    const row = (items, cur, set, grid, mine) => h('div', {class:'chips' + (grid ? ' grid' : '')},
      items.map(v => chip(v, v === cur, () => { set(v === cur ? '' : v); changed(); }, mine && mine.includes(v) ? 'mine' : '')));
    const mine = (st.myParts[k.c] || []).filter(x => !k.parts.includes(x));
    const parts = [...mine, ...k.parts];
    const inp = h('input', {type:'text', id: p === picker.cam ? 'partFreeC' : 'partFreeE', autocomplete:'off', placeholder:'一覧にない時：例 北側 階段 手摺',
      value: parts.includes(s.part) ? '' : (s.part || ''),
      on:{input: e => { s.part = e.target.value; changed({keepPicker: true}); }, change: () => { learnSel(); changed(); },
          keydown: e => { if (e.key === 'Enter') e.target.blur(); }}});
    const mic = h('button', {type:'button', class:'mic', 'aria-label':'声で入れる', text:'🎤', on:{click: () => voice(inp, mic, micNote)}});
    const micNote = h('p', {class:'note', hidden: true});
    const out = [
      secth('面'), row(FACES, s.face, v => s.face = v),
      secth('階'), row(FLOORS, s.floor, v => s.floor = v, true),
      secth('部位'), parts.length ? row(parts, s.part, v => s.part = v, false, mine) : null,
      h('div', {class:'inrow'}, inp, mic), micNote
    ];
    const items = itemsOf(k);
    if (items.length) out.push(secth(itemLabel(k)), row(items, s.repair, v => { if (v !== s.repair) s.step = 0; s.repair = v; }),
      h('p', {class:'note', text: itemLabel(k) + 'を選ぶと、工程がその' + (k.num ? '補修' : '仕様') + 'の順に変わります。'}));
    if (k.num) {
      out.push(secth('番号'),
        h('div', {class:'numrow'},
          h('button', {type:'button', class:'nb', 'aria-label':'番号を1つ戻す', text:'－', on:{click: () => { s.numFree = ''; s.numOn = true; s.numN = Math.max(1, (s.numN || 1) - 1); changed(); }}}),
          h('b', {class:'numview', text: numOf(s, k) || '番号なし'}),
          h('button', {type:'button', class:'nb', 'aria-label':'番号を1つ進める', text:'＋', on:{click: () => { s.numFree = ''; s.numOn = true; s.numN = (s.numN || 1) + 1; changed(); }}}),
          chip('番号なし', !s.numOn && !(s.numFree || '').trim(), () => { s.numFree = ''; s.numOn = !s.numOn; changed(); }, 'small')),
        h('p', {class:'note', text:'面と階は上で選んだ物から自動で入ります（南面・5階・3番 → S-3-5）。施工後まで撮ると、番号が1つ進んで施工前に戻ります。'}),
        h('details', {}, h('summary', {text:'番号を手で入れる'}),
          h('input', {type:'text', autocomplete:'off', placeholder:'例 S-1-5（入れると上の番号より優先）', value: s.numFree || '',
            on:{input: e => { s.numFree = e.target.value; changed({keepPicker: true}); }, change: () => changed()}})));
    }
    return out;
  },
  step(p){
    const k = kindOf(), done = doneSteps(curKey(), st.koji.trim());
    return [
      h('p', {class:'note', text:'撮ると次の工程へ進みます。✓ は、この測点で撮った工程です。' + (st.sel.repair && stepsOf(k, st.sel.repair) !== k.steps ? '（「' + st.sel.repair + '」の工程）' : '')}),
      h('div', {class:'steplist'}, curSteps().map((name, i) => h('button', {type:'button', class:'chip', 'aria-pressed': i === st.sel.step,
        on:{click: () => { st.sel.step = i; changed(); if (p === picker.cam) closeSheet(); }}},
        h('span', {text: (i + 1) + '. ' + name}), done.has(name) ? h('span', {class:'ok', text:'✓ 撮った'}) : h('span', {class:'n', text:'まだ'}))))
    ];
  },
  board(p){
    const b = st.board;
    const opt = (label, items, cur, set) => [secth(label), h('div', {class:'chips'}, items.map(([v, t]) => chip(t, v === cur, () => { set(v); changed(); }, 'small')))];
    const at = {lb:[0, 1], rb:[1, 1], lt:[0, 0], rt:[1, 0]};
    const out = [
      ...opt('形', [['std', 'ふつう'], ['note', '備考の欄つき'], ['big', '工程を大きく']], b.layout, v => b.layout = v),
      ...opt('色', [['white', '白'], ['green', '緑'], ['black', '黒']], b.style, v => b.style = v),
      ...opt('透かし', [[1, 'なし'], [0.75, '少し'], [0.5, '半分']], b.alpha, v => b.alpha = v),
      ...opt('字の大きさ', [[0.85, '小'], [1, '中'], [1.2, '大']], b.font, v => b.font = v),
      ...opt('黒板の大きさ', [[0.75, '小'], [1, '中'], [1.3, '大']], [0.75, 1, 1.3].find(v => Math.abs(v - b.pos.s) < 0.01), v => b.pos.s = v),
      secth('場所'), h('div', {class:'chips'}, Object.keys(at).map(key => chip({lb:'左下', rb:'右下', lt:'左上', rt:'右上'}[key], at[key][0] === b.pos.fx && at[key][1] === b.pos.fy,
        () => { b.pos.fx = at[key][0]; b.pos.fy = at[key][1]; changed(); }, 'small'))),
      h('p', {class:'note', text:'写真の上で、黒板を指で動かす・2本指で大きさを変えることもできます。'})
    ];
    if (b.layout === 'note') {
      out.splice(2, 0, secth('備考（黒板に出ます）'),
        h('input', {type:'text', autocomplete:'off', placeholder:'例：シール厚さ 10mm', value: st.sel.note || '',
          on:{input: e => { st.sel.note = e.target.value; changed({keepPicker: true}); }, change: () => { learnSel(); changed(); }}}),
        st.myNotes.length ? h('div', {class:'chips'}, st.myNotes.map(n => chip(n, n === st.sel.note, () => { st.sel.note = n === st.sel.note ? '' : n; changed(); }, 'small mine'))) : null);
    }
    return out;
  }
};
// 声で入れる（使えないスマホでは、キーボードのマイクを案内する）
function voice(inp, btn, note){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  note.hidden = false;
  if (!SR) { note.textContent = 'このスマホではこのボタンが使えません。左の欄を押して、キーボードのマイク（🎤）を押して話してください。'; inp.focus(); return; }
  try {
    const rec = new SR(); rec.lang = 'ja-JP'; rec.interimResults = false; rec.maxAlternatives = 1;
    btn.classList.add('on'); note.textContent = '話してください（例：北側 階段 手摺）';
    rec.onresult = e => { const t = (e.results[0][0].transcript || '').replace(/[。、\s]+$/, ''); if (t) { st.sel.part = t; inp.value = t; note.textContent = '「' + t + '」と入れました。'; learnSel(); changed(); } };
    rec.onerror = () => { note.textContent = 'うまく聞き取れませんでした。もう一度押すか、キーボードのマイクで話してください。'; };
    rec.onend = () => btn.classList.remove('on');
    rec.start();
  } catch(e) { note.textContent = 'このスマホではこのボタンが使えません。キーボードのマイク（🎤）で話してください。'; }
}

/* ---------- 黒板を入れる・直す（写真から選んだ写真・撮った写真の直し） ---------- */
const pend = [];        // {base: Blob, t: 撮った日時, editOf: 直す写真}
let pendImg = null, pendFor = null, decidedRun = 0, editSaved = null;
async function loadPend(){
  if (!pend.length) { pendImg = null; pendFor = null; return; }
  if (pendFor === pend[0]) return;
  const {img, url} = await loadImage(pend[0].base);
  if (pendImg && pendImg._url) URL.revokeObjectURL(pendImg._url);
  img._url = url; pendImg = img; pendFor = pend[0];
}
function edMeta(){ const p = pend[0]; return metaNow(p.editOf ? {date: p.editOf.date, time: p.editOf.time, ts: p.editOf.ts} : p.t); }
function drawEditor(){
  if (!pendImg || pendFor !== pend[0]) return;
  const cv = $('edCanvas'), w = pendImg.naturalWidth, hh = pendImg.naturalHeight;
  if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; layoutViewer(); }
  const c = cv.getContext('2d');
  c.drawImage(pendImg, 0, 0, w, hh);
  drawBoard(c, w, hh, edMeta(), st.board);
  if (pend[0].editOf) drawMarks(c, w, hh, pend[0].editOf.marks);
}
const z = {s:1, x:0, y:0, fw:0, fh:0, ox:0, oy:0};
function layoutViewer(){
  const v = $('viewer'), cv = $('edCanvas');
  if (!cv.width) return;
  const k = Math.min(v.clientWidth / cv.width, v.clientHeight / cv.height);
  z.fw = cv.width * k; z.fh = cv.height * k; z.ox = (v.clientWidth - z.fw) / 2; z.oy = (v.clientHeight - z.fh) / 2;
  cv.style.width = z.fw + 'px'; cv.style.height = z.fh + 'px';
  applyZoom();
}
const clampAxis = (off, size, view, base) => size <= view ? (view - size) / 2 - base : Math.min(-base, Math.max(view - size - base, off));
function applyZoom(){
  const v = $('viewer');
  z.s = clamp(z.s, 1, 6);
  z.x = clampAxis(z.x, z.fw * z.s, v.clientWidth, z.ox);
  z.y = clampAxis(z.y, z.fh * z.s, v.clientHeight, z.oy);
  $('edCanvas').style.transform = 'translate(' + (z.ox + z.x) + 'px,' + (z.oy + z.y) + 'px) scale(' + z.s + ')';
}
function zoomAt(ns, px, py){
  const ix = (px - (z.ox + z.x)) / z.s, iy = (py - (z.oy + z.y)) / z.s;
  z.s = clamp(ns, 1, 6); z.x = px - ix * z.s - z.ox; z.y = py - iy * z.s - z.oy; applyZoom();
}
function resetZoom(){ z.s = 1; z.x = 0; z.y = 0; applyZoom(); }
(function(){
  const v = $('viewer'), pts = new Map();
  let last = null, tapAt = 0, moved = 0, mode = 'view', drag = null, pinchB = null;
  const local = e => { const r = v.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; };
  const toImg = p => { const cv = $('edCanvas'), k = cv.width / z.fw; return {x: (p.x - (z.ox + z.x)) / z.s * k, y: (p.y - (z.oy + z.y)) / z.s * k}; };
  const onBoard = p => { const cv = $('edCanvas'), q = toImg(p), r = boardRect(cv.width, cv.height, st.board); return q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h ? {q, r} : null; };
  const pair = () => { const a = [...pts.values()]; return {d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2}; };
  v.addEventListener('pointerdown', e => {
    if (e.target.closest('.zoom')) return;
    try { v.setPointerCapture(e.pointerId); } catch(err) {}
    const p = local(e); pts.set(e.pointerId, p); moved = 0;
    if (pts.size === 1) { const hit = onBoard(p); mode = hit ? 'board' : 'view'; drag = hit ? {dx: hit.q.x - hit.r.x, dy: hit.q.y - hit.r.y} : null; }
    if (pts.size === 2) { last = pair(); if (mode === 'board') pinchB = {d: last.d, s: st.board.pos.s}; }
  });
  v.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const p = local(e), q = pts.get(e.pointerId); pts.set(e.pointerId, p);
    const cv = $('edCanvas');
    if (pts.size === 1) {
      moved += Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
      if (mode === 'board' && drag) { const ip = toImg(p); st.board.pos = posFromXY(cv.width, cv.height, st.board, ip.x - drag.dx, ip.y - drag.dy); drawEditor(); }
      else if (z.s > 1) { z.x += p.x - q.x; z.y += p.y - q.y; applyZoom(); }
    } else if (pts.size === 2) {
      const n = pair(); moved += 10;
      if (mode === 'board' && pinchB) { st.board.pos.s = clamp(pinchB.s * n.d / Math.max(1, pinchB.d), 0.45, 2.2); drawEditor(); }
      else if (last) { zoomAt(z.s * n.d / Math.max(1, last.d), n.x, n.y); z.x += n.x - last.x; z.y += n.y - last.y; applyZoom(); }
      last = n;
    }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId); pts.delete(e.pointerId); last = pts.size === 2 ? pair() : null;
    if (pts.size < 2) pinchB = null;
    if (pts.size === 0) {
      if (mode === 'board') { save(); if (picker.ed.tab === 'board') renderPicker(picker.ed); }
      else if (moved < 8) { const now = Date.now(); if (now - tapAt < 320) { zoomAt(z.s > 1.05 ? 1 : 2.5, p.x, p.y); tapAt = 0; } else tapAt = now; }
      mode = 'view'; drag = null;
    }
  };
  v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  v.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); zoomAt(z.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), p.x, p.y); }, {passive: false});
  const center = () => ({x: v.clientWidth / 2, y: v.clientHeight / 2});
  $('zoomIn').addEventListener('click', () => { const c = center(); zoomAt(z.s * 1.5, c.x, c.y); });
  $('zoomOut').addEventListener('click', () => { const c = center(); zoomAt(z.s / 1.5, c.x, c.y); });
  $('zoomFit').addEventListener('click', resetZoom);
})();
async function openEditor(){
  if (!pend.length) return;
  if (!st.koji.trim() && !pend[0].editOf) { openKojiSel('先に工事名を選んでください。選んだら「黒板待ち」を押してください。'); renderHome(); return; }
  await loadPend();
  const p = pend[0];
  $('edTitle').textContent = p.editOf ? '黒板を直す' : (pend.length > 1 ? '黒板を入れる（あと' + pend.length + '枚）' : '黒板を入れる');
  $('edDecide').textContent = p.editOf ? 'この黒板に直す' : 'この黒板で決める';
  $('edDiscard').textContent = p.editOf ? 'やめる' : '捨てる';
  fixSel();
  if ($('editor').hidden) show($('editor'));
  $('edCanvas').width = 0;
  renderPicker(picker.ed);
  drawEditor(); layoutViewer(); resetZoom();
  $('edPick').parentElement.scrollTop = 0;
}
function closeEditor(){
  hide($('editor'));
  if (editSaved) { Object.assign(st, editSaved); editSaved = null; save(); }   // 直す前に選んでいた物へ戻す
  if (cam.on) updateCamInfo();
  renderHome();
}
async function decide(){
  const p = pend[0]; if (!p) return;
  busy(true);
  try {
    const baseCv = await blobToCanvas(p.base);
    const rec = await makeRecord(baseCv, p.base, p.t, p.editOf);
    pend.shift(); decidedRun++;
    if (p.editOf) { closeEditor(); openPhoto(rec); }
    else { advanceStep(); save();
      if (pend.length) await openEditor();
      else { closeEditor(); if (decidedRun === 1) openPhoto(rec); else toast(decidedRun + '枚に黒板を入れました'); decidedRun = 0; } }
  } catch(e) { toast(e.message || '黒板を入れられませんでした'); }
  finally { busy(false); }
}
async function discard(){
  if (!pend.length) return;
  pend.shift();
  if (pend.length) await openEditor(); else { closeEditor(); decidedRun = 0; }
}
async function onFiles(ev){
  const files = Array.from(ev.target.files || []);
  ev.target.value = '';
  if (!files.length) return;
  busy(true, '写真を読んでいます…');
  try {
    for (const f of files) pend.push({base: await fileToBase(f), t: stamp(new Date(f.lastModified || Date.now())), editOf: null});
    await openEditor();
  } catch(e) { toast(e.message || '写真を開けませんでした'); }
  finally { busy(false); renderHome(); }
}
function fixPhoto(rec){
  editSaved = {sel: clone(st.sel), board: clone(st.board), koji: st.koji};
  st.koji = rec.koji; st.sel = selFromRec(rec); st.board = clone(recBoard(rec));
  pend.unshift({base: rec.base, t: null, editOf: rec});
  picker.ed.tab = 'pos';
  openEditor();
}

/* ---------- はじめの画面：撮った写真 ---------- */
let selecting = false;
const selected = new Set();
const today = () => stamp(new Date()).date;
function kindIndex(kc, koji){ const i = kindsFor(koji).findIndex(k => k.c === kc); return i < 0 ? 999 : i; }
function sortKey(a, b){
  const ka = kindIndex(a.kc, a.koji), kb = kindIndex(b.kc, b.koji);
  if (ka !== kb) return ka - kb;
  if (ka === 999 && a.kind !== b.kind) return String(a.kind).localeCompare(String(b.kind), 'ja');
  const c = [a.sokuten, a.num, a.repair].join(' ').localeCompare([b.sokuten, b.num, b.repair].join(' '), 'ja', {numeric: true});
  if (c) return c;
  return ((a.stepIdx || 0) - (b.stepIdx || 0)) || (a.ts - b.ts);
}
function albumList(){
  const koji = st.koji.trim();
  let list = photos.filter(p => p.koji === koji);
  if (st.filter === 'today') list = list.filter(p => p.date === today());
  else if (st.filter === 'unsent') list = list.filter(p => !p.sent);
  return list.sort(sortKey);
}
function renderHome(){
  const koji = st.koji.trim();
  const kn = $('kojiName'); kn.textContent = koji || 'まだ選んでいません（押して選ぶ）'; kn.className = koji ? '' : 'empty';
  const all = photos.filter(p => p.koji === koji), list = albumList();
  $('albumCount').textContent = koji ? all.length + '枚' : '';
  $('selMode').hidden = !all.length;
  put($('filters'), ...(all.length ? [['all', '全部（' + all.length + '）'], ['today', '今日（' + all.filter(p => p.date === today()).length + '）'], ['unsent', 'まだ送っていない（' + all.filter(p => !p.sent).length + '）']]
    .map(([v, t]) => chip(t, st.filter === v, () => { st.filter = v; save(); renderHome(); }, 'small')) : []));
  const box = $('album'); put(box, );
  if (!koji) box.append(h('div', {class:'empty', text:'工事名を選ぶと、その工事の写真がここに並びます。'}));
  else if (!all.length) box.append(h('div', {class:'empty', text:'まだありません。下の「カメラを開く」から撮ってください。'}));
  else if (!list.length) box.append(h('div', {class:'empty', text:'この絞り込みに合う写真はありません。'}));
  const groups = [];
  list.forEach(p => { const key = groupKey(p); let g = groups.find(x => x.key === key); if (!g) { g = {key, kc: p.kc, kind: p.kind, items: []}; groups.push(g); } g.items.push(p); });
  let lastKind = null;
  const kinds = kindsFor(koji);
  groups.forEach(g => {
    const k = kinds.find(x => x.c === g.kc);
    if (g.kc !== lastKind) { box.append(h('p', {class:'kindhead', text: k ? k.n : g.kind})); lastKind = g.kc; }
    const p0 = g.items[0];
    const allInGroup = photos.filter(p => p.koji === koji && groupKey(p) === g.key);
    const done = new Set(allInGroup.map(p => p.step));
    const steps = k ? stepsOf(k, p0.repair) : [...done];
    const nextIdx = steps.findIndex(s => !done.has(s));
    const head = h('div', {class:'ghead'}, h('b', {text: [p0.sokuten || '（測点なし）', p0.num, p0.repair].filter(Boolean).join(' ')}), h('span', {class:'cnt', text: allInGroup.length + '枚'}));
    if (k && nextIdx >= 0 && !selecting) head.append(h('button', {type:'button', class:'btn slim primary', text:'続きを撮る（' + steps[nextIdx] + '）', on:{click: () => {
      const last = allInGroup.slice().sort((a, b) => b.ts - a.ts)[0];
      st.sel = selFromRec(last); st.sel.step = nextIdx; save(); openCamera();
    }}}));
    const sr = h('div', {class:'steprow'}, steps.map(s => h('span', {class:'st ' + (done.has(s) ? 'done' : 'todo'), text: (done.has(s) ? '✓ ' : 'まだ ') + s})));
    const th = h('div', {class:'thumbs'}, g.items.map(p => {
      const mk = (p.sent ? '送' : '') + (p.saved ? '保' : '');
      return h('button', {type:'button', class: selected.has(p.id) ? 'sel' : '', 'aria-label': p.step + '（' + p.date + ' ' + (p.time || '').slice(0, 5) + '）', on:{click: () => {
        if (selecting) { selected.has(p.id) ? selected.delete(p.id) : selected.add(p.id); renderHome(); } else openPhoto(p, list);
      }}},
        h('img', {src: urlOf(p, 'thumb'), alt: '', loading: 'lazy'}), h('span', {class:'cap', text: p.step}),
        mk ? h('i', {class:'bd', text: mk}) : null, (p.marks && p.marks.length) ? h('i', {class:'mk', text:'書'}) : null);
    }));
    box.append(h('div', {class:'group'}, head, sr, th));
  });
  const others = [...new Set(photos.map(p => p.koji))].filter(k => k && k !== koji);
  put($('otherKoji'), ...(others.length ? [h('span', {class:'note', text:'ほかの工事の写真：'}), ...others.map(k => chip(k + '（' + photos.filter(p => p.koji === k).length + '）', false, () => setKoji(k), 'small'))] : []));
  // 下のボタン
  $('homeBar').hidden = selecting; $('selBar').hidden = !selecting;
  $('selMode').textContent = selecting ? '選ぶのをやめる' : '選ぶ';
  $('selInfo').textContent = selected.size ? selected.size + '枚を選んでいます' : '写真を押して選んでください';
  ['selSend', 'selSave', 'selOffice', 'selDel'].forEach(id => $(id).disabled = !selected.size);
  $('openPend').hidden = !pend.length || !$('editor').hidden;
  $('openPend').textContent = '黒板待ち ' + pend.length + '枚';
  storeNote();
}
async function storeNote(){
  let t = idb ? 'このスマホに残っている写真：全部で ' + photos.length + '枚。' : 'このブラウザでは写真を残せません（閉じると消えます）。撮ったら LINE へ送ってください。';
  try { if (idb && navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e.usage) t += '（' + Math.round(e.usage / 1048576) + 'MB）'; } } catch(e) {}
  $('storeNote').textContent = t + ' 大事な写真は LINE へ送るか携帯に保存してください。';
}
function endSelect(){ selecting = false; selected.clear(); $('selDelConfirm').hidden = true; renderHome(); }

/* ---------- 写真1枚（撮った後） ---------- */
let ph = {list: [], i: 0};
function openPhoto(rec, list){
  ph.list = (list && list.length ? list : albumListFor(rec)).map(p => p.id);
  ph.i = Math.max(0, ph.list.indexOf(rec.id));
  if (ph.i < 0 || !ph.list.length) { ph.list = [rec.id]; ph.i = 0; }
  if ($('photo').hidden) show($('photo'));
  drawPhoto();
}
function albumListFor(rec){ return photos.filter(p => p.koji === rec.koji).sort(sortKey); }
const curPhoto = () => photos.find(p => p.id === ph.list[ph.i]);
function drawPhoto(){
  const rec = curPhoto();
  if (!rec) { closePhoto(); return; }
  $('phImg').src = urlOf(rec, 'blob');
  $('phTitle').textContent = rec.step + '　' + (rec.sokuten || '');
  $('phPos').textContent = (ph.i + 1) + ' / ' + ph.list.length;
  $('phPrev').disabled = ph.i <= 0; $('phNext').disabled = ph.i >= ph.list.length - 1;
  const rows = [['工事名', rec.koji], ['工種', rec.kind], ['測点', [rec.sokuten, rec.num, rec.repair].filter(Boolean).join(' ')], ['工程', rec.step], ['撮影', rec.date + ' ' + (rec.time || '').slice(0, 5)]];
  if (rec.bnote) rows.push(['黒板の備考', rec.bnote]);
  put($('phMeta'), ...rows.filter(r => r[1]).flatMap(([a, b]) => [h('dt', {text: a}), h('dd', {text: b})]));
  put($('phBadges'), h('span', {class:'badge' + (rec.sent ? ' on' : ''), text: rec.sent ? '送った' : 'まだ送っていない'}), h('span', {class:'badge' + (rec.saved ? ' on' : ''), text: rec.saved ? '携帯に保存した' : '携帯に保存していない'}),
    (rec.marks && rec.marks.length) ? h('span', {class:'badge on', text:'書き込みあり'}) : null);
  if (document.activeElement !== $('phNote')) $('phNote').value = rec.note || '';
  $('phDelConfirm').hidden = true;
  setMsg($('phMsg'), '');
}
function closePhoto(){ $('phNote').blur(); hide($('photo')); if (!cam.on) renderHome(); else updateCamInfo(); }
function navPhoto(d){ $('phNote').blur(); const n = ph.i + d; if (n < 0 || n >= ph.list.length) return; ph.i = n; drawPhoto(); }
(function(){
  const box = $('phBox'); let sx = 0, sy = 0, on = false;
  box.addEventListener('pointerdown', e => { if (e.target.closest('.navb')) return; on = true; sx = e.clientX; sy = e.clientY; });
  box.addEventListener('pointerup', e => { if (!on) return; on = false; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) navPhoto(dx < 0 ? 1 : -1); });
  box.addEventListener('pointercancel', () => { on = false; });
})();

/* ---------- LINE へ送る・携帯に保存（スマホの共有の画面） ---------- */
const fileOf = p => new File([p.blob], p.filename || 'photo.jpg', {type: 'image/jpeg'});
function download(files){ files.forEach(f => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); }
async function sendPhotos(list, msgEl){
  if (!list.length) return;
  const files = list.map(fileOf);
  try {
    if (navigator.canShare && navigator.share && navigator.canShare({files})) await navigator.share({files});
    else { download(files); setMsg(msgEl, 'この機械では共有の画面が出せないので、保存しました。', true); for (const p of list) { p.saved = true; await idbPut(p); } return; }
    for (const p of list) { p.sent = true; await idbPut(p); }
    setMsg(msgEl, list.length > 1 ? list.length + '枚を渡しました。' : '渡しました。', true);
  } catch(e) {
    setMsg(msgEl, e && e.name === 'AbortError' ? 'やめました。' : '共有の画面を出せませんでした。写真を長押しして保存してください。', false);
  }
}
// iPhone はページから写真アプリへ直接入れられないので、共有の画面の「画像を保存」を押してもらう。Android などはそのまま保存
async function savePhotos(list, msgEl){
  if (!list.length) { setMsg(msgEl, '保存する写真がありません。', true); return; }
  const files = list.map(fileOf);
  try {
    if (isIOS && navigator.canShare && navigator.share && navigator.canShare({files})) {
      setMsg(msgEl, '出てきた画面で「' + (list.length > 1 ? list.length + '枚の画像を保存' : '画像を保存') + '」を押してください。', true);
      await navigator.share({files});
      setMsg(msgEl, '「画像を保存」を押していれば、写真アプリに入りました。', true);
    } else {
      download(files);
      setMsg(msgEl, list.length + '枚を保存しました（写真のアプリの「ダウンロード」に入ります）。' + (isAndroid && list.length > 1 ? '「複数のファイルをダウンロード」と聞かれたら「許可」を押してください。' : ''), true);
    }
    for (const p of list) { p.saved = true; await idbPut(p); }
  } catch(e) {
    setMsg(msgEl, e && e.name === 'AbortError' ? 'やめました。' : '保存できませんでした。写真を長押しして「"写真"に保存」を押してください。', false);
  }
}

/* ---------- 事務所へ送る：写真をまとめて1つのファイル（zip）に。JPEG はもう縮んでいるので圧縮しない ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(u8){ let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
// entries：[{name, data（Blob か 文字）, ts}]。名前は UTF-8（日本語の名前のまま Windows で開ける）
async function makeZip(entries, onStep){
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const blob = typeof e.data === 'string' ? new Blob([enc.encode(e.data)]) : e.data;
    const crc = crc32(new Uint8Array(await blob.arrayBuffer())), size = blob.size;
    const name = enc.encode(e.name), d = new Date(e.ts || Date.now());
    const dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    const dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(lh.buffer, name, blob);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(ch.buffer, name);
    off += 30 + name.length + size;
    if (onStep) onStep(i + 1, entries.length);
  }
  const csize = central.reduce((a, b) => a + b.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, end.buffer], {type: 'application/zip'});
}
const OFFICE_MAX = 100 * 1048576;   // 1つのファイルの大きさの目安（これを超えたら「その2」に分ける）
const office = {scope: 'unsent', only: null, zips: null};
function officeAll(){ const koji = st.koji.trim(); let l = photos.filter(p => p.koji === koji); if (office.only) l = l.filter(p => office.only.has(p.id)); return l; }
function officeList(){
  let l = officeAll();
  if (!office.only) { if (office.scope === 'unsent') l = l.filter(p => !p.sent); else if (office.scope === 'today') l = l.filter(p => p.date === today()); }
  return l.sort(sortKey);
}
const mb = n => n >= 1048576 ? (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';
function openOffice(onlyIds){
  if (!st.koji.trim()) { openKojiSel('先に工事名を選んでください。'); return; }
  office.only = onlyIds ? new Set(onlyIds) : null; office.zips = null;
  if (!office.only && !officeList().length && officeAll().length) office.scope = 'all';
  setMsg($('oMsg'), '');
  show($('office'));
  renderOffice();
}
function renderOffice(){
  const all = officeAll(), list = officeList();
  put($('oScope'), ...(office.only ? [h('span', {class:'note', text:'選んだ写真 ' + all.length + '枚'})]
    : [['unsent', 'まだ送っていない（' + all.filter(p => !p.sent).length + '）'], ['today', '今日（' + all.filter(p => p.date === today()).length + '）'], ['all', '全部（' + all.length + '）']]
      .map(([v, t]) => chip(t, office.scope === v, () => { if (office.scope === v) return; office.scope = v; office.zips = null; setMsg($('oMsg'), ''); renderOffice(); }, 'small'))));
  const size = list.reduce((a, p) => a + (p.blob ? p.blob.size : 0), 0);
  const byKind = []; list.forEach(p => { const e = byKind.find(x => x.kind === p.kind); if (e) e.n++; else byKind.push({kind: p.kind, n: 1}); });
  put($('oSum'), ...(list.length ? [h('b', {text: list.length + '枚'}), '（約 ' + mb(size) + (size > OFFICE_MAX ? '・' + Math.ceil(size / OFFICE_MAX) + 'つ前後に分けます' : '') + '）', h('br'),
    byKind.map(e => e.kind + ' ' + e.n + '枚').join('　')] : ['この絞り込みに送る写真はありません。']));
  put($('oParts'), ...(office.zips ? office.zips.map((z, i) => h('div', {class:'opart' + (z.sent ? ' done' : '')},
    h('span', {class:'on', text: (z.sent ? '✓ ' : '') + z.file.name + '（' + z.ids.length + '枚・' + mb(z.file.size) + '）'}),
    h('button', {type:'button', class:'btn slim primary', text: z.sent ? 'もう一度送る' : '送る', on:{click: () => sendZip(i)}}),
    h('button', {type:'button', class:'btn slim', text:'ファイルに保存', on:{click: () => saveZip(i)}}),
    (z.saved && !z.sent) ? h('button', {type:'button', class:'btn slim', text:'送った印を付ける', on:{click: () => markZip(i, 'LINE で送った印を付けました。')}}) : null)) : []));
  $('oMake').hidden = !!office.zips; $('oMake').disabled = !list.length;
  $('oAlbumSave').textContent = '① 携帯に保存（' + list.length + '枚）';
  $('oAlbumSave').disabled = $('oAlbumName').disabled = !list.length;
  $('oAlbumText').textContent = list.length ? 'アルバム名：' + albumName(list) : '';
}
// LINE のアルバムの名前：工事名＋工種（1つの時）＋撮った日
function albumName(list){
  const kinds = [...new Set(list.map(p => p.kind))], ds = list.map(p => p.date).filter(Boolean).sort();
  const md = d => { const a = String(d).split('.'); return a.length === 3 ? (+a[1]) + '/' + (+a[2]) : d; };
  const day = ds.length ? md(ds[0]) + (ds[ds.length - 1] !== ds[0] ? '〜' + md(ds[ds.length - 1]) : '') : '';
  return [st.koji.trim(), kinds.length === 1 ? kinds[0] : '工事写真', day].filter(Boolean).join(' ');
}
async function copyAlbumName(){
  const list = officeList(); if (!list.length) return;
  const name = albumName(list);
  try { await navigator.clipboard.writeText(name); setMsg($('oMsg'), 'アルバム名をコピーしました：' + name, true); }
  catch(e) { setMsg($('oMsg'), 'コピーできませんでした。下の「アルバム名：」の字を長押ししてコピーしてください。', false); }
}
const csvCell = v => { const s = String(v === undefined || v === null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
async function makeOffice(){
  const list = officeList(); if (!list.length) return;
  const koji = st.koji.trim(), kinds = kindsFor(koji);
  // 大きさで分ける
  const groups = []; let cur = [], curSize = 0;
  list.forEach(p => { const s = p.blob ? p.blob.size : 0; if (cur.length && curSize + s > OFFICE_MAX) { groups.push(cur); cur = []; curSize = 0; } cur.push(p); curSize += s; });
  if (cur.length) groups.push(cur);
  busy(true, 'ファイルを作っています…');
  try {
    const zips = [], day = today().replace(/\./g, ''), made = new Date();
    for (let g = 0; g < groups.length; g++) {
      const ps = groups[g], used = new Set(), items = [];
      ps.forEach((p, i) => {
        const ki = kindIndex(p.kc, koji);
        const kindDir = (ki < 999 ? pad(ki + 1) : '99') + '_' + (safe(p.kind) || 'その他');
        const stepTag = pad((p.stepIdx || 0) + 1) + '.' + safe(p.step);
        const base = [p.sokuten, p.num, p.repair].filter(Boolean).map(safe).concat(stepTag, (p.date || '').replace(/\./g, '') + '-' + (p.time || '').replace(/:/g, '')).filter(Boolean).join('_');
        let file = '写真/' + kindDir + '/' + base + '.jpg', n = 2;
        while (used.has(file)) file = '写真/' + kindDir + '/' + base + '_' + (n++) + '.jpg';
        used.add(file);
        items.push({p, file, kindDir, no: i + 1});
      });
      const head = ['No', '工事名', '工種', '測点', '番号', '補修', '工程', '撮影日', '時刻', '備考', '黒板の備考', '書き込み', 'ファイル'];
      const csv = '﻿' + [head].concat(items.map(({p, file, no}) => [no, p.koji, p.kind, p.sokuten, p.num, p.repair, p.step, p.date, p.time, p.note, p.bnote, (p.marks && p.marks.length) ? 'あり' : '', file.replace(/\//g, '\\')]))
        .map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
      const meta = {app: '黒板カメラ', format: 1, ver: APP_VER, koji, made: made.toISOString(), part: g + 1, parts: groups.length,
        kinds: kinds.map((k, i) => ({c: k.c, n: k.n, order: i + 1, steps: k.steps, repSteps: itemsOf(k).length ? Object.fromEntries(itemsOf(k).map(r => [r, stepsOf(k, r)])) : undefined})),
        photos: items.map(({p, file, kindDir}) => ({id: p.id, rev: p.rev || 1, file, kindDir, kc: p.kc, kind: p.kind, sokuten: p.sokuten || '', num: p.num || '', repair: p.repair || '',
          step: p.step || '', stepIdx: p.stepIdx || 0, date: p.date, time: p.time, ts: p.ts, note: p.note || '', bnote: p.bnote || '', marks: (p.marks || []).length}))};
      const entries = items.map(({p, file}) => ({name: file, data: p.blob, ts: p.ts}));
      entries.push({name: '一覧.csv', data: csv, ts: made.getTime()}, {name: '黒板カメラ.json', data: JSON.stringify(meta, null, 1), ts: made.getTime()});
      const blob = await makeZip(entries, (i, n) => { $('busy').textContent = 'ファイルを作っています… ' + (groups.length > 1 ? 'その' + (g + 1) + '　' : '') + i + ' / ' + n; });
      const name = ['黒板カメラ', safe(koji), day, ps.length + '枚'].join('_') + (groups.length > 1 ? '_その' + (g + 1) : '') + '.zip';
      zips.push({file: new File([blob], name, {type: 'application/zip'}), ids: ps.map(p => p.id), sent: false, saved: false});
    }
    office.zips = zips;
    setMsg($('oMsg'), 'できました。' + (zips.length > 1 ? zips.length + 'つに分かれたので、全部「送る」を押してください。' : isAndroid ? '「送る」を押すと「ダウンロード」に保存されるので、LINE WORKS の ＋ →「ファイル」から送ってください。' : '「送る」→ LINE → 送り先を選んで送信してください。'), true);
  } catch(e) { setMsg($('oMsg'), (e && e.message) || 'ファイルを作れませんでした。', false); }
  finally { busy(false); renderOffice(); }
}
async function markZip(i, text){
  const z = office.zips && office.zips[i]; if (!z) return;
  z.sent = true;
  for (const id of z.ids) { const p = photos.find(x => x.id === id); if (p && !p.sent) { p.sent = true; await idbPut(p); } }
  const left = office.zips.filter(x => !x.sent).length;
  setMsg($('oMsg'), text + (left ? '　あと ' + left + 'つ送ってください。' : ''), true);
  renderOffice();
}
async function sendZip(i){
  const z = office.zips && office.zips[i]; if (!z) return;
  const files = [z.file];
  try {
    if (navigator.canShare && navigator.share && navigator.canShare({files})) { await navigator.share({files}); await markZip(i, '渡しました。'); }
    else { download(files); z.saved = true; setMsg($('oMsg'), (isAndroid ? '' : 'この機械では共有の画面に出せないので、') + ZIP_SAVED_HOW, true); renderOffice(); }
  } catch(e) { setMsg($('oMsg'), e && e.name === 'AbortError' ? 'やめました。' : '共有の画面を出せませんでした。「ファイルに保存」を押して、LINE の ＋ → ファイル から送ってください。', false); }
}
function saveZip(i){
  const z = office.zips && office.zips[i]; if (!z) return;
  download([z.file]); z.saved = true;
  setMsg($('oMsg'), ZIP_SAVED_HOW, true);
  renderOffice();
}

/* ---------- 丸・矢印・字を書く ---------- */
const mk = {rec: null, bg: null, marks: [], draft: null, textAt: null, scale: 1};
const MK_TOOLS = [['circle', '◯ 丸'], ['arrow', '↗ 矢印'], ['rect', '▭ 四角'], ['text', '字']];
const MK_COLORS = [['#e53935', '赤'], ['#ffd600', '黄'], ['#ffffff', '白'], ['#1e88e5', '青']];
async function openMark(rec){
  busy(true);
  try {
    const base = await blobToCanvas(rec.base);
    const cv = document.createElement('canvas'); cv.width = base.width; cv.height = base.height;
    const c = cv.getContext('2d'); c.drawImage(base, 0, 0); drawBoard(c, cv.width, cv.height, recMeta(rec), recBoard(rec));
    mk.rec = rec; mk.bg = cv; mk.marks = clone(rec.marks || []); mk.draft = null; mk.textAt = null;
    $('mkTextRow').hidden = true;
    show($('mark'));
    renderMkTools();
    layoutMark();
  } catch(e) { toast(e.message || '開けませんでした'); }
  finally { busy(false); }
}
function renderMkTools(){
  const undoBtn = h('button', {type:'button', class:'tl', text:'1つ戻す', disabled: !mk.marks.length, on:{click: () => { mk.marks.pop(); drawMarkCanvas(); renderMkTools(); }}});
  const clearBtn = h('button', {type:'button', class:'tl', text:'全部消す', disabled: !mk.marks.length, on:{click: () => { mk.marks = []; drawMarkCanvas(); renderMkTools(); }}});
  put($('mkShapes'), ...MK_TOOLS.map(([v, t]) => h('button', {type:'button', class:'tl', 'aria-pressed': st.mkTool === v, text: t, on:{click: () => { st.mkTool = v; save(); renderMkTools(); }}})));
  put($('mkColors'), ...MK_COLORS.map(([v, t]) => h('button', {type:'button', class:'sw', 'aria-pressed': st.mkColor === v, 'aria-label': t, style: 'background:' + v, on:{click: () => { st.mkColor = v; save(); renderMkTools(); }}})), undoBtn, clearBtn);
}
function layoutMark(){
  if (!mk.bg) return;
  const area = $('mkArea'), cv = $('mkCanvas');
  const k = Math.min(area.clientWidth / mk.bg.width, area.clientHeight / mk.bg.height);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = mk.bg.width * k, ch = mk.bg.height * k;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  Object.assign(cv.style, {width: cw + 'px', height: ch + 'px', left: (area.clientWidth - cw) / 2 + 'px', top: (area.clientHeight - ch) / 2 + 'px'});
  drawMarkCanvas();
}
function drawMarkCanvas(){
  const cv = $('mkCanvas'), c = cv.getContext('2d');
  c.drawImage(mk.bg, 0, 0, cv.width, cv.height);
  drawMarks(c, cv.width, cv.height, mk.marks);
  if (mk.draft) drawMark(c, cv.width, cv.height, mk.draft);
  if (mk.textAt) { c.save(); c.fillStyle = st.mkColor; c.beginPath(); c.arc(mk.textAt.x * cv.width, mk.textAt.y * cv.height, 6, 0, Math.PI * 2); c.fill(); c.restore(); }
}
(function(){
  const cv = $('mkCanvas'); let start = null;
  const norm01 = e => { const r = cv.getBoundingClientRect(); return {x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height)}; };
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch(err) {}
    const p = norm01(e);
    if (st.mkTool === 'text') { mk.textAt = p; $('mkTextRow').hidden = false; drawMarkCanvas(); setTimeout(() => $('mkText').focus(), 50); return; }
    start = p; mk.draft = {t: st.mkTool, color: st.mkColor, x1: p.x, y1: p.y, x2: p.x, y2: p.y};
  });
  cv.addEventListener('pointermove', e => { if (!start || !mk.draft) return; const p = norm01(e); mk.draft.x2 = p.x; mk.draft.y2 = p.y; drawMarkCanvas(); });
  const up = () => {
    if (!start || !mk.draft) return;
    const d = mk.draft; start = null; mk.draft = null;
    if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 0.015) mk.marks.push(d);
    else if (d.t === 'circle') { mk.marks.push(Object.assign(d, {x1: d.x1 - 0.05, y1: d.y1 - 0.05 * cv.width / cv.height, x2: d.x1 + 0.05, y2: d.y1 + 0.05 * cv.width / cv.height})); }   // 押しただけなら小さい丸
    drawMarkCanvas(); renderMkTools();
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
})();
function addText(){
  const t = $('mkText').value.trim();
  if (t && mk.textAt) mk.marks.push({t: 'text', color: st.mkColor, x1: mk.textAt.x, y1: mk.textAt.y, text: t});
  mk.textAt = null; $('mkText').value = ''; $('mkTextRow').hidden = true;
  drawMarkCanvas(); renderMkTools();
}
async function saveMark(){
  const rec = mk.rec; if (!rec) return;
  busy(true);
  try {
    const base = await blobToCanvas(rec.base);
    const {blob, thumb} = await composeBlobs(base, recMeta(rec), recBoard(rec), mk.marks);
    const nr = Object.assign({}, rec, {marks: clone(mk.marks), blob, thumb, sent: false, saved: false, rev: (rec.rev || 0) + 1});
    await putPhoto(nr);
    closeMark();
    drawPhoto();
    toast('書き込みを保存しました');
  } catch(e) { toast(e.message || '保存できませんでした'); }
  finally { busy(false); }
}
function closeMark(){ hide($('mark')); mk.rec = null; mk.bg = null; }

/* ---------- 工種・工程・部位の設定（工事ごと） ---------- */
let kOpen = null;
function ensureProject(){
  const koji = st.koji.trim();
  if (!st.projects[koji] || !Array.isArray(st.projects[koji].kinds)) st.projects[koji] = {kinds: clone(kindsNow())};
  return st.projects[koji].kinds;
}
function openKinds(){
  if (!st.koji.trim()) { openKojiSel('先に工事名を選んでください。工種・部位は工事ごとに直せます。'); return; }
  kOpen = null; show($('kinds')); renderKinds();
}
function move(arr, i, d){ const j = i + d; if (j < 0 || j >= arr.length) return; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
function itemList(title, arr, onChange, minOne){
  const inp = h('input', {type:'text', autocomplete:'off', placeholder: title + 'を足す'});
  const add = () => { const v = inp.value.trim(); if (!v) return; if (!arr.includes(v)) arr.push(v); inp.value = ''; onChange(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  return [secth(title),
    h('div', {class:'ilist'}, arr.map((v, i) => h('div', {class:'krow'},
      h('button', {type:'button', class:'mini', 'aria-label':'上へ', text:'▲', disabled: i === 0, on:{click: () => { move(arr, i, -1); onChange(); }}}),
      h('button', {type:'button', class:'mini', 'aria-label':'下へ', text:'▼', disabled: i === arr.length - 1, on:{click: () => { move(arr, i, 1); onChange(); }}}),
      h('span', {class:'kn', text: v}),
      h('button', {type:'button', class:'mini x', 'aria-label': v + 'を消す', text:'✕', disabled: !!minOne && arr.length <= 1, on:{click: () => { arr.splice(i, 1); onChange(); }}})))),
    h('div', {class:'inrow'}, inp, h('button', {type:'button', class:'btn slim primary', text:'足す', on:{click: add}}))];
}
function renderKinds(){
  const koji = st.koji.trim(), custom = !!(st.projects[koji] && st.projects[koji].kinds);
  const list = kindsNow();
  const done = () => { ensureProject(); save(); fixSel(); renderKinds(); };
  const body = $('kBody');
  const sc = $('kBody').parentElement.scrollTop;
  const newIn = h('input', {type:'text', autocomplete:'off', placeholder:'例：長尺シート工事'});
  const addKind = () => { const n = newIn.value.trim(); if (!n) return; const arr = ensureProject(); const c = 'U' + Date.now().toString(36); arr.push({c, n, steps: ['施工前', '施工中', '施工後'], parts: []}); kOpen = c; save(); renderKinds(); };
  put(body, 
    h('p', {class:'note'}, '「', h('b', {text: koji}), '」の工種・工程・部位です。ここで直しても、ほかの工事は変わりません。', custom ? '（この工事用に直してあります）' : '（いまは最初の一覧のままです）'),
    h('div', {}, list.map((k, i) => {
      const arr = () => ensureProject()[i];
      const row = h('div', {class:'krow'},
        h('button', {type:'button', class:'mini', 'aria-label':'上へ', text:'▲', disabled: i === 0, on:{click: () => { move(ensureProject(), i, -1); done(); }}}),
        h('button', {type:'button', class:'mini', 'aria-label':'下へ', text:'▼', disabled: i === list.length - 1, on:{click: () => { move(ensureProject(), i, 1); done(); }}}),
        h('button', {type:'button', class:'kn', on:{click: () => { kOpen = kOpen === k.c ? null : k.c; renderKinds(); }}}, k.n, h('small', {text: '工程 ' + k.steps.length + '・部位 ' + k.parts.length + (k.num ? '・番号あり' : '') + '　押して直す'})),
        h('button', {type:'button', class:'mini x', 'aria-label': k.n + 'を消す', text:'✕', disabled: list.length <= 1, on:{click: () => {
          if (!confirm('「' + k.n + '」を一覧から消しますか？（撮った写真は消えません）')) return; ensureProject().splice(i, 1); done(); }}}));
      if (kOpen !== k.c) return row;
      const nameIn = h('input', {type:'text', autocomplete:'off', value: k.n, on:{change: e => { const v = e.target.value.trim(); if (v) { arr().n = v; done(); } }}});
      return h('div', {}, row, h('div', {class:'kdetail'},
        h('label', {class:'f'}, '工種の名前（黒板に出ます）', nameIn),
        ...itemList(itemsOf(k).length ? '工程（' + itemLabel(k) + 'を選んでいない時）' : '工程', arr().steps, done, true),
        ...itemList('部位', arr().parts, done),
        h('div', {class:'chips'}, chip('番号を使う（下地補修のように）', !!k.num, () => { arr().num = !k.num; done(); }, 'small')),
        ...itemList(itemLabel(k), arr().repairs || (arr().repairs = itemsOf(k).slice()), done)));
    })),
    secth('工種を足す'),
    h('div', {class:'inrow'}, newIn, h('button', {type:'button', class:'btn slim primary', text:'足す', on:{click: addKind}})),
    custom ? h('button', {type:'button', class:'btn warn', text:'最初の一覧に戻す', on:{click: () => { if (!confirm('この工事の工種・工程・部位を、最初の一覧に戻しますか？')) return; delete st.projects[koji]; save(); fixSel(); renderKinds(); }}}) : null,
    h('p', {class:'note', text:'同じ設定を職人さんに渡すには、はじめの画面の「職人さんに渡す」を押してください。'})
  );
  $('kBody').parentElement.scrollTop = sc;
}

/* ---------- 職人さんに渡す・もらった設定を入れる ---------- */
const b64e = s => { const bytes = new TextEncoder().encode(s); let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b)); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const b64d = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); };
const baseUrl = () => location.href.split('#')[0].split('?')[0];
function shareLink(){
  const cfg = {v: 1, koji: st.koji.trim(), kinds: kindsNow().map(k => ({c: k.c, n: k.n, steps: k.steps, parts: k.parts, num: k.num ? 1 : undefined, repairs: itemsOf(k).length ? itemsOf(k) : undefined}))};
  if (st.shareSites && st.sites.length) cfg.sites = st.sites;
  return baseUrl() + '#cfg=' + b64e(JSON.stringify(cfg));
}
function openShare(){
  if (!st.koji.trim()) { openKojiSel('先に工事名を選んでください。'); return; }
  setMsg($('sMsg'), ''); setMsg($('sMsg2'), ''); $('sPaste').value = '';
  show($('share')); renderShare();
}
function renderShare(){
  $('sSites').setAttribute('aria-pressed', st.shareSites ? 'true' : 'false');
  $('sSites').hidden = !st.sites.length;
  $('sLink').textContent = shareLink();
}
const strs = (a, max) => Array.isArray(a) ? a.map(x => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, max || 60) : [];
function cleanKinds(arr){
  if (!Array.isArray(arr)) return null;
  const out = arr.slice(0, 40).map((k, i) => k && typeof k === 'object' && String(k.n || '').trim() ? {c: String(k.c || 'U' + i).slice(0, 20), n: String(k.n).trim().slice(0, 40), steps: strs(k.steps, 30), parts: strs(k.parts, 80), num: !!k.num || undefined, repairs: Array.isArray(k.repairs) ? strs(k.repairs, 40) : undefined} : null).filter(Boolean);
  out.forEach(k => { if (!k.steps.length) k.steps = ['施工前', '施工後']; });
  return out.length ? out : null;
}
// もらったリンク（#cfg= / #k= / #ks=）や、現場の名前の一覧を入れる。入れた物を言葉で返す
function applyText(text){
  const said = [];
  const cfgM = /[#&]cfg=([A-Za-z0-9_-]+)/.exec(text);
  if (cfgM) {
    let cfg = null; try { cfg = JSON.parse(b64d(cfgM[1])); } catch(e) {}
    if (!cfg || typeof cfg !== 'object') return null;
    const koji = String(cfg.koji || '').trim().slice(0, 80);
    const kinds = cleanKinds(cfg.kinds);
    if (koji) { st.koji = koji; remember(koji); said.push('工事名「' + koji + '」'); if (kinds) { st.projects[koji] = {kinds}; said.push('工種 ' + kinds.length + 'つ'); } }
    const sites = strs(cfg.sites, 60);
    if (sites.length) { st.sites = [...new Set([...sites, ...st.sites])].slice(0, 60); said.push('現場の名前 ' + sites.length + '件'); }
  } else if (/[#&](k|ks)=/.test(text)) {
    const k = /[#&]k=([^&\s]*)/.exec(text), ks = /[#&]ks=([^&\s]*)/.exec(text);
    try { if (k) { const v = decodeURIComponent(k[1]).trim(); if (v) { st.koji = v; remember(v); said.push('工事名「' + v + '」'); } } } catch(e) {}
    try { if (ks) { const list = decodeURIComponent(ks[1]).split('|').map(s => s.trim()).filter(Boolean); if (list.length) { st.sites = [...new Set([...list, ...st.sites])].slice(0, 60); said.push('現場の名前 ' + list.length + '件'); } } } catch(e) {}
  } else {
    const list = [...new Set(text.split(/\r?\n|\|/).map(s => s.replace(/^[\s・\-－*●○]+/, '').trim()).filter(s => s && !/^https?:/.test(s)))].slice(0, 60);
    if (list.length) { st.sites = [...new Set([...list, ...st.sites])].slice(0, 60); said.push('現場の名前 ' + list.length + '件'); }
  }
  if (!said.length) return null;
  fixSel(); save();
  return said.join('・');
}

/* ---------- 工事を選ぶ ---------- */
function openKojiSel(msg){
  setMsg($('jMsg'), msg || '', false);
  $('jIn').value = '';
  show($('kojiSel')); renderKojiSel();
}
function renderKojiSel(){
  const cnt = k => photos.filter(p => p.koji === k).length;
  const names = [...new Set([st.koji.trim(), ...st.recent, ...photos.map(p => p.koji), ...st.sites, ...Object.keys(st.projects)].filter(Boolean))];
  $('jListHead').hidden = !names.length;
  put($('jList'), ...names.map(n => h('button', {type:'button', class:'kojiitem', 'aria-pressed': n === st.koji.trim(), on:{click: () => { setKoji(n); hide($('kojiSel')); }}},
    h('span', {text: n}), h('small', {text: (cnt(n) ? cnt(n) + '枚' : '') + (n === st.koji.trim() ? '　いま選んでいる' : '')}))));
}
function setKoji(name){
  st.koji = (name || '').trim(); remember(st.koji); fixSel(); save();
  selected.clear(); renderHome();
}

/* ---------- 閉じる（スマホの「戻る」でも使う） ---------- */
const CLOSERS = {
  mark: closeMark, photo: closePhoto, editor: () => { decidedRun = 0; if (pend.length && pend[0].editOf) pend.shift(); closeEditor(); },
  office: () => { hide($('office')); renderHome(); },
  kinds: () => { hide($('kinds')); renderHome(); }, share: () => hide($('share')),
  kojiSel: () => hide($('kojiSel')), help: () => hide($('help')), camScreen: closeCamera
};

/* ---------- つなぐ ---------- */
function wire(){
  $('kojiBtn').addEventListener('click', () => openKojiSel());
  $('jOk').addEventListener('click', () => { const v = $('jIn').value.trim(); if (!v) { setMsg($('jMsg'), '工事名を入れてください。', false); return; } setKoji(v); hide($('kojiSel')); });
  $('jIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('jOk').click(); });
  $('jClose').addEventListener('click', CLOSERS.kojiSel);
  $('helpBtn').addEventListener('click', () => show($('help')));
  $('hClose').addEventListener('click', CLOSERS.help);
  $('officeBtn').addEventListener('click', () => openOffice());
  $('oClose').addEventListener('click', CLOSERS.office);
  $('oMake').addEventListener('click', makeOffice);
  $('oAlbumSave').addEventListener('click', async () => { await savePhotos(officeList(), $('oMsg')); renderOffice(); });
  $('oAlbumName').addEventListener('click', copyAlbumName);
  $('kindsBtn').addEventListener('click', openKinds);
  $('shareBtn').addEventListener('click', openShare);
  $('kClose').addEventListener('click', CLOSERS.kinds);
  $('sClose').addEventListener('click', CLOSERS.share);
  $('camOpen').addEventListener('click', openCamera);
  $('pick').addEventListener('change', onFiles);
  $('camFile').addEventListener('change', onFiles);
  $('openPend').addEventListener('click', openEditor);
  // 撮った写真
  $('selMode').addEventListener('click', () => { if (selecting) endSelect(); else { selecting = true; selected.clear(); renderHome(); } });
  $('selEnd').addEventListener('click', endSelect);
  $('selAll').addEventListener('click', () => { albumList().forEach(p => selected.add(p.id)); renderHome(); });
  const selList = () => photos.filter(p => selected.has(p.id)).sort(sortKey);
  $('selSend').addEventListener('click', async () => { await sendPhotos(selList(), $('albumMsg')); renderHome(); });
  $('selSave').addEventListener('click', async () => { await savePhotos(selList(), $('albumMsg')); renderHome(); });
  $('selOffice').addEventListener('click', () => { const ids = [...selected]; endSelect(); openOffice(ids); });
  $('selDel').addEventListener('click', () => { $('selDelText').textContent = selected.size + '枚を消しますか？消すと元に戻せません。'; $('selDelConfirm').hidden = false; });
  $('selDelNo').addEventListener('click', () => { $('selDelConfirm').hidden = true; });
  $('selDelYes').addEventListener('click', async () => { const n = selected.size; await deletePhotos([...selected]); endSelect(); toast(n + '枚を消しました'); });
  // カメラ
  $('camClose').addEventListener('click', closeCamera);
  $('shutter').addEventListener('click', shoot);
  $('zoomBtn').addEventListener('click', nextZoom);
  $('lastShot').addEventListener('click', () => { if (cam.last) openPhoto(cam.last); });
  $('rowKind').addEventListener('click', () => openSheet('kind'));
  $('rowPos').addEventListener('click', () => openSheet('pos'));
  $('kindPrev').addEventListener('click', () => kindMove(-1));
  $('kindNext').addEventListener('click', () => kindMove(1));
  $('posPrev').addEventListener('click', () => posMove(-1));
  $('posNext').addEventListener('click', () => posMove(1));
  $('rowStep').addEventListener('click', () => openSheet('step'));
  $('boardBtn').addEventListener('click', () => openSheet('board'));
  $('sheetDone').addEventListener('click', closeSheet);
  $('stepPrev').addEventListener('click', () => { st.sel.step = Math.max(0, st.sel.step - 1); changed(); });
  $('stepNext').addEventListener('click', () => { st.sel.step = Math.min(curSteps().length - 1, st.sel.step + 1); changed(); });
  $('rotBtn').addEventListener('click', () => { st.rotMode = {auto: 'land', land: 'portrait', portrait: 'auto'}[st.rotMode] || 'auto'; save(); boardSig = ''; });
  $('torchBtn').addEventListener('click', () => {
    if (!cam.track) return; cam.torchOn = !cam.torchOn;
    cam.track.applyConstraints({advanced: [{torch: cam.torchOn}]}).catch(() => { cam.torchOn = false; toast('ライトを点けられませんでした'); }).finally(() => $('torchBtn').setAttribute('aria-pressed', cam.torchOn ? 'true' : 'false'));
  });
  // 黒板を入れる
  $('edDecide').addEventListener('click', decide);
  $('edDiscard').addEventListener('click', discard);
  $('edLater').addEventListener('click', () => { decidedRun = 0; if (pend.length && pend[0].editOf) pend.shift(); closeEditor(); });
  // 写真1枚
  $('phClose').addEventListener('click', closePhoto);
  $('phPrev').addEventListener('click', () => navPhoto(-1));
  $('phNext').addEventListener('click', () => navPhoto(1));
  $('phSend').addEventListener('click', async () => { const r = curPhoto(); if (r) { await sendPhotos([r], $('phMsg')); const m = $('phMsg').textContent, c = $('phMsg').className; drawPhoto(); $('phMsg').textContent = m; $('phMsg').className = c; } });
  $('phSave').addEventListener('click', async () => { const r = curPhoto(); if (r) { await savePhotos([r], $('phMsg')); const m = $('phMsg').textContent, c = $('phMsg').className; drawPhoto(); $('phMsg').textContent = m; $('phMsg').className = c; } });
  $('phMark').addEventListener('click', () => { const r = curPhoto(); if (r) openMark(r); });
  $('phFix').addEventListener('click', () => { const r = curPhoto(); if (r) fixPhoto(r); });
  let noteTimer = 0;
  const saveNote = async () => { clearTimeout(noteTimer); const r = curPhoto(); if (!r) return; const v = $('phNote').value.trim(); if ((r.note || '') === v) return; r.note = v; await idbPut(r); setMsg($('phMsg'), '備考を残しました。', true); };
  $('phNote').addEventListener('input', () => { clearTimeout(noteTimer); noteTimer = setTimeout(saveNote, 700); });
  $('phNote').addEventListener('change', saveNote);
  $('phDel').addEventListener('click', () => { $('phDelConfirm').hidden = false; });
  $('phDelNo').addEventListener('click', () => { $('phDelConfirm').hidden = true; });
  $('phDelYes').addEventListener('click', async () => {
    const r = curPhoto(); if (!r) return;
    await deletePhotos([r.id]);
    if (cam.last && cam.last.id === r.id) { cam.last = null; cam.shots = Math.max(0, cam.shots - 1); $('camCount').textContent = String(cam.shots); $('lastShot').style.backgroundImage = ''; }
    ph.list.splice(ph.i, 1);
    if (!ph.list.length) closePhoto(); else { ph.i = Math.min(ph.i, ph.list.length - 1); drawPhoto(); }
    toast('消しました');
  });
  // 書き込み
  $('mkCancel').addEventListener('click', closeMark);
  $('mkSave').addEventListener('click', saveMark);
  $('mkTextOk').addEventListener('click', addText);
  $('mkText').addEventListener('keydown', e => { if (e.key === 'Enter') addText(); });
  // 渡す
  $('sSites').addEventListener('click', () => { st.shareSites = !st.shareSites; save(); renderShare(); });
  $('sCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareLink()); setMsg($('sMsg'), 'コピーしました。LINE に貼って送ってください。', true); }
    catch(e) { const r = document.createRange(); r.selectNodeContents($('sLink')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); setMsg($('sMsg'), 'コピーできませんでした。上の字を長押ししてコピーしてください。', false); }
  });
  $('sSend').addEventListener('click', async () => {
    const text = '黒板カメラの設定（' + st.koji.trim() + '）\n押すと同じ黒板になります。\n' + shareLink();
    try { if (navigator.share) { await navigator.share({text}); setMsg($('sMsg'), '渡しました。', true); } else { await navigator.clipboard.writeText(text); setMsg($('sMsg'), 'コピーしました。LINE に貼って送ってください。', true); } }
    catch(e) { if (!(e && e.name === 'AbortError')) setMsg($('sMsg'), '送れませんでした。「コピー」を押して LINE に貼ってください。', false); }
  });
  $('sApply').addEventListener('click', () => {
    const r = applyText($('sPaste').value);
    if (!r) { setMsg($('sMsg2'), '読み取れませんでした。もらったリンクを全部貼り付けてください。', false); return; }
    $('sPaste').value = ''; setMsg($('sMsg2'), r + ' を入れました。', true); renderShare(); renderHome();
  });
  // 画面の大きさ・向き
  const relayout = () => { if (cam.on) { layoutOverlay(); boardSig = ''; } if (!$('editor').hidden) layoutViewer(); if (!$('mark').hidden) layoutMark(); };
  window.addEventListener('resize', relayout);
  $('video').addEventListener('resize', relayout);
  window.addEventListener('orientationchange', () => [100, 350, 800].forEach(ms => setTimeout(relayout, ms)));
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => [100, 350, 800].forEach(ms => setTimeout(relayout, ms)));
  if (window.ResizeObserver) new ResizeObserver(relayout).observe($('vf'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (cam.on) stopStream(); }
    else { if (cam.on && !cam.stream) startStream(true); checkUpdate(); }
  });
  window.addEventListener('beforeunload', e => { if (pend.length) { e.preventDefault(); e.returnValue = ''; } });
}

/* ---------- 版の番号。新しい版が上がっていたら、撮っている途中でなければ自分で読み直す ---------- */
async function checkUpdate(){
  try {
    const t = (await fetch('version.txt?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.text() : '')).trim();
    if (!t || t === APP_VER || cam.on || pend.length || anyOpen()) return;
    let done = ''; try { done = sessionStorage.getItem('kokuban-reloaded') || ''; } catch(e) {}
    if (done === t) return;
    try { sessionStorage.setItem('kokuban-reloaded', t); } catch(e) {}
    location.reload();
  } catch(e) {}
}

(async function start(){
  // 画面を触った時にページごと大きくならないようにする（iPhone の Safari の2回たたく・2本指の拡大）。写真の拡大・カメラの拡大はこのページの中の仕組みなので、そのまま使える
  ['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault(), {passive: false}));
  // Android の Chrome は、ホーム画面に置ける時に知らせてくれる → 上に「ホーム画面に置く」を出す
  let installEv = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; $('installBtn').hidden = false; });
  window.addEventListener('appinstalled', () => { installEv = null; $('installBtn').hidden = true; toast('ホーム画面に置きました'); });
  $('installBtn').addEventListener('click', async () => {
    if (!installEv) return;
    installEv.prompt();
    try { await installEv.userChoice; } catch(e) {}
    installEv = null; $('installBtn').hidden = true;
  });
  loadState();
  // リンクで来た設定（#cfg= ／ 前の #k= ・ #ks=）を入れて、リンクの後ろは消しておく（開き直すたびに入れ直さない）
  if (/[#&](cfg|k|ks)=/.test(location.hash)) {
    const r = applyText(location.hash);
    try { history.replaceState(null, '', baseUrl()); } catch(e) {}
    if (r) setTimeout(() => toast(r + ' を入れました', 4000), 300);
  }
  fixSel(); save();
  $('ver').textContent = '版' + APP_VER;
  wire();
  renderHome();
  idb = await idbOpen();
  photos = await idbAll();
  if (idb && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  renderHome();
  checkUpdate();
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('700 30px "BIZ UDPGothic"'), document.fonts.load('400 30px "BIZ UDPGothic"')]).then(() => { boardSig = ''; if (!$('editor').hidden) drawEditor(); }, () => {});
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__kokuban = {st: () => st, photos: () => photos, ver: APP_VER};   // 点検用
})();
})();
