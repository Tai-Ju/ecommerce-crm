import { useState, useEffect, useCallback, useRef } from "react";

// ─── Storage：MongoDB 後端（設 VITE_CRM_API_URL + VITE_CRM_API_TOKEN）或本機 window.storage ──
const KEYS = {
  partners: "crm3:partners",
  partnersTrash: "crm3:partnersTrash",
  interactions: "crm3:interactions",
  todos: "crm3:todos",
  quotes: "crm3:quotes",
  goals: "crm3:goals",
  playbook: "crm3:playbook",
  manifest: "crm3:manifest",
  incomes: "crm3:incomes",
  selfCosts: "crm3:selfCosts",
};

function getCrmApi() {
  const base = import.meta.env.VITE_CRM_API_URL?.replace(/\/$/, "");
  const token = import.meta.env.VITE_CRM_API_TOKEN;
  if (base && token) return { base, token };
  return null;
}

async function load(key) {
  const api = getCrmApi();
  if (api) {
    try {
      const res = await fetch(`${api.base}/api/kv/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${api.token}` },
      });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    const r = await window.storage.get(key, true);
    return r ? JSON.parse(r.value) : null;
  } catch {
    return null;
  }
}

async function save(key, val) {
  const api = getCrmApi();
  if (api) {
    try {
      await fetch(`${api.base}/api/kv/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api.token}`,
        },
        body: JSON.stringify(val),
      });
    } catch { /* ignore (non-blocking save) */ }
    return;
  }
  try {
    await window.storage.set(key, JSON.stringify(val), true);
  } catch { /* ignore (non-blocking save) */ }
}

// ─── Constants ────────────────────────────────────────────────────
const RECRUIT_ROLES = ["邀約拒絕", "談後拒絕", "未加入", "暖身中", "確定談場", "談場延期", "跟進中", "已付訂金", "已加入"];
// 非上線狀態只保留招募漏斗角色（把「夥伴」視為已加入移除重疊）
const NON_UPLINE_ROLES = [...RECRUIT_ROLES];
const COST_TYPES = ["訂金", "買貨", "加盟"];
const TYPE_COLOR = { 訂金: "#4a90d9", 買貨: "#b8860b", 加盟: "#c0392b" };
const RECRUIT_COLOR = { 未加入: "#aaa", 暖身中: "#4a90d9", 確定談場: "#b8860b", 談場延期: "#e67e22", 跟進中: "#8b5cf6", 已付訂金: "#f59e0b", 邀約拒絕: "#c0392b", 談後拒絕: "#e74c3c", 已加入: "#27ae60" };

const ABC_TEMPLATE = `C角：
B角：
A角：
BC角關係：
認識多久：
談場日期：
談場時間：
談場地點：

--- C角資料 ---
性別：
年齡：
星座：
婚姻：
職業：
月收入：
個性特質：
經濟狀況：
邀約方式：
需求動機：
短期目標：
未來夢想：
同業經驗：
禁忌話題：
溝通重點：
特別備註：`;

// ─── Seeds ────────────────────────────────────────────────────────
const SEED_PARTNERS = [
  { id: "p2", name: "陳威宇", role: "夥伴", avatar: "陳", phone: "0923-456-789", ig: "@weiyuchen88", birthday: "1988-07-22", tags: ["健身", "科技"], notes: "對數據很敏感，喜歡看成效報告。", costs: [{ id: "c3", date: "2024-03-05", type: "訂金", amount: 2000, note: "訂金預繳" }], abcNote: "", joined: "2024-03-05" },
  { id: "p3", name: "王思涵", role: "暖身中", avatar: "王", phone: "0934-567-890", ig: "@sihan_w", birthday: "1995-11-08", tags: ["美妝", "旅遊"], notes: "IG 粉絲約 1.2 萬，風格乾淨。", costs: [], abcNote: "", joined: "2024-05-20" },
  { id: "p4", name: "張育豪", role: "確定談場", avatar: "張", phone: "0945-678-901", ig: "@yu_hao88", birthday: "1992-06-14", tags: ["創業", "健康"], notes: "下週五約好了，準備資料。", costs: [], abcNote: ABC_TEMPLATE, joined: "2025-03-01" },
  { id: "p5", name: "李美玲", role: "邀約拒絕", avatar: "李", phone: "0956-789-012", ig: "@meiling_li", birthday: "1988-09-03", tags: ["家庭"], notes: "目前說不考慮，半年後再聯繫。", costs: [], abcNote: "", joined: "2025-01-15" },
];
const SEED_INTERACTIONS = [
  { id: "i1", date: "2025-03-24", time: "10:30:00", partnerId: "p2", type: "暖身", title: "Q2 業績規劃", content: "討論了四月份的推廣策略。", status: "已完成", tags: ["業績"] },
  { id: "i2", date: "2025-03-27", time: "14:10:00", partnerId: "p2", type: "追蹤", title: "新人教學跟進", content: "陳威宇詢問產品數據整理方式，分享了追蹤表格模板。", status: "已完成", tags: ["教學"] },
  { id: "i3", date: "2025-04-02", time: "09:00:00", partnerId: "p3", type: "規劃", title: "邀約 IG 合作聊聊", content: "計劃傳訊問她對健康產品的看法。", status: "待執行", tags: ["招募"] },
  { id: "i4", date: "2025-04-05", time: "18:20:00", partnerId: "p2", type: "規劃", title: "月底對帳確認", content: "確認三月獎金計算是否正確。", status: "待執行", tags: ["財務"] },
  { id: "i5", date: "2025-03-30", time: "16:45:00", partnerId: "p4", type: "暖身", title: "談場前資料準備", content: "確認見面時間地點，準備產品介紹資料。", status: "待執行", tags: ["招募"] },
];
const SEED_TODOS = [
  { id: "t1", title: "準備四月開團文案", done: false, priority: "高", dueDate: "2025-04-03" },
  { id: "t2", title: "傳送產品資料給王思涵", done: false, priority: "中", dueDate: "2025-04-02" },
  { id: "t3", title: "更新三月業績表", done: true, priority: "高", dueDate: "2025-03-31" },
];
const SEED_QUOTES = [
  { id: "q1", text: "成功不是終點，失敗也不是末日，重要的是繼續前行的勇氣。", author: "邱吉爾", date: "2025-03-20" },
  { id: "q2", text: "你現在的選擇，決定了五年後的你是誰。", author: "上線林佳蓉", date: "2025-03-15" },
];
const SEED_GOALS = { monthlyIncome: 15000, monthlyPartners: 5 };
const SEED_PLAYBOOK = [
  { id: "pb1", category: "開口邀約", situation: "對方說「我沒有時間」", response: "「我完全理解！這個其實不需要很多時間，很多夥伴都是利用零碎時間在做。你平常什麼時候最有空？我們約 15 分鐘聊一下就好。」", tags: ["拒絕處理"], star: true },
  { id: "pb2", category: "產品說明", situation: "對方問「這個有沒有副作用？」", response: "「好問題！這系列產品都是天然成分，通過認證。但每個人體質不同，建議先從基礎款開始試。我可以把成分表傳給你看看。」", tags: ["產品"], star: true },
  { id: "pb3", category: "跟進追蹤", situation: "傳訊之後對方已讀不回", response: "「等 2-3 天後再傳一則輕鬆的訊息，不提之前的事，可以分享一個使用心得。不要追問『你考慮得怎麼樣了』，讓對方感覺被關心而非被推銷。」", tags: ["跟進"], star: false },
];
const SEED_MANIFEST = {
  declaration: "2025年底，我要擁有穩定的被動收入，讓家人過上更自由的生活。",
  conditions: ["每天至少聯繫 2 位潛在夥伴", "每週至少完成 1 次談場", "保持正向心態，即使被拒絕也繼續前進"],
};

// ─── Utils ────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (d) => { try { return new Date(d + "T00:00:00").toLocaleDateString("zh-TW", { month: "short", day: "numeric" }); } catch { return d; } };
const fmtFullDate = (d) => { try { return new Date(d + "T00:00:00").toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }); } catch { return d; } };
const dk = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const normalizeTime = (t) => {
  const s = String(t || "").trim();
  if (!s) return "00:00:00";
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return "00:00:00";
};
const nowHms = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
};
const toMsDT = (date, time) => new Date(`${date}T${normalizeTime(time)}`).getTime();
const SCHEDULE_TYPES = ["談場","團隊活動","實體暖身","產品課程"];
const scheduleFieldForType = (t) => ({ 談場: "dateTalkVenue", 團隊活動: "dateTeamActivity", 實體暖身: "dateWarmupPhysical", 產品課程: "dateProductCourse" }[t] || "");

/** 人脈 CSV：第一列標題對應（Excel 另存 UTF-8 CSV，逗號或 TAB 皆可） */
const PARTNER_CSV_COLUMNS_DOC = [
  "姓名",
  "身份/狀態",
  "屬性",
  "痛點需求（長標題含「痛點」「需求」亦可）",
  "地區",
  "休假",
  "性別",
  "關係",
  "年齡",
  "職業",
  "薪資",
  "談場（日期）",
  "備註",
];

function parseCsvDelimitedLine(line, delimiter) {
  const row = [];
  if (delimiter === "\t") {
    return line.split("\t").map((c) => c.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
  }
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      row.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  row.push(cur.trim());
  return row.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"'));
}

function detectPartnerCsvDelimiter(headerLine) {
  const tabs = (headerLine.match(/\t/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function mapPartnerCsvHeader(cell) {
  const hn = String(cell).replace(/^\uFEFF/, "").trim();
  const compact = hn.replace(/\s/g, "");
  const exact = {
    姓名: "name",
    "身份/狀態": "role",
    屬性: "attribute",
    痛點需求: "painPoint",
    地區: "region",
    休假: "vacation",
    性別: "gender",
    關係: "relation",
    年齡: "age",
    職業: "occupation",
    薪資: "salary",
    "談場（日期）": "dateTalkVenue",
    談場: "dateTalkVenue",
    備註: "memo",
  };
  if (exact[hn]) return exact[hn];
  for (const [k, v] of Object.entries(exact)) {
    if (k.replace(/\s/g, "") === compact) return v;
  }
  if (hn.includes("痛點") && (hn.includes("需求") || hn.includes("困擾"))) return "painPoint";
  if (/談場/.test(hn) && hn.includes("日期")) return "dateTalkVenue";
  return null;
}

function parsePartnerDateCell(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) {
    const [y, mo, d] = t.split("-").map((x) => parseInt(x, 10));
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const m = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const n = Number(t);
  if (!Number.isNaN(n) && n > 20000 && n < 60000) {
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + n * 86400000);
    if (!Number.isNaN(d.getTime())) return dk(d);
  }
  return "";
}

function normalizeImportedRole(r) {
  let x = String(r ?? "").trim();
  if (x === "夥伴") x = "已加入";
  if (NON_UPLINE_ROLES.includes(x)) return x;
  return "暖身中";
}

/** @returns {{ rows: object[], skippedEmpty: number, errors: string[] }} */
function parsePartnerCsvText(text) {
  const raw = String(text).replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((ln) => ln.trim() !== "");
  if (!lines.length) return { rows: [], skippedEmpty: 0, errors: ["檔案沒有內容"] };
  const delim = detectPartnerCsvDelimiter(lines[0]);
  const headers = parseCsvDelimitedLine(lines[0], delim);
  const fieldIx = headers.map(mapPartnerCsvHeader);
  if (!fieldIx.includes("name")) {
    return { rows: [], skippedEmpty: 0, errors: ["找不到「姓名」欄：請確認第一列標題與範本一致（需含「姓名」）"] };
  }
  const rows = [];
  const errors = [];
  let skippedEmpty = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvDelimitedLine(lines[i], delim);
    const row = {};
    fieldIx.forEach((key, j) => {
      if (!key) return;
      row[key] = cells[j] !== undefined ? cells[j] : "";
    });
    const name = String(row.name ?? "").trim();
    if (!name) {
      skippedEmpty++;
      continue;
    }
    let age = "";
    if (row.age !== undefined && String(row.age).trim() !== "") {
      const num = Number(String(row.age).replace(/,/g, "").trim());
      age = Number.isNaN(num) ? "" : num;
    }
    rows.push({
      id: uid(),
      name,
      role: normalizeImportedRole(row.role),
      avatar: name[0] || "?",
      photo: "",
      attribute: String(row.attribute ?? "").trim(),
      painPoint: String(row.painPoint ?? "").trim(),
      region: String(row.region ?? "").trim(),
      vacation: String(row.vacation ?? "").trim(),
      memo: String(row.memo ?? "").trim(),
      gender: String(row.gender ?? "").trim(),
      relation: String(row.relation ?? "").trim(),
      age,
      occupation: String(row.occupation ?? "").trim(),
      salary: String(row.salary ?? "").trim(),
      dateTalkVenue: parsePartnerDateCell(row.dateTalkVenue),
      dateTeamActivity: "",
      dateWarmupPhysical: "",
      costs: [],
      abcNote: ABC_TEMPLATE,
      joined: new Date().toISOString().slice(0, 10),
    });
  }
  if (!rows.length && !errors.length) {
    errors.push(skippedEmpty > 0 ? "沒有可匯入的資料列（是否皆缺少姓名？）" : "沒有資料列");
  }
  return { rows, skippedEmpty, errors };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 上線教學手冊迷你排版（安全）：
 * - **粗體**、_斜體_、__底線__、~~刪除線~~、==螢光標記==
 * - [color=#hex]文字[/color]、[bg=#hex]文字[/bg]
 * - [size=sm|md|lg]文字[/size]
 * - 逐行：以 "> " 開頭 = 引用；以 "- " / "* " 開頭 = 清單；以 "1. " 開頭 = 編號
 */
function playbookMiniRichToHtml(text) {
  const raw = String(text ?? "");
  const lines = raw.split(/\r?\n/);

  const sizeMap = { sm: 12, md: 13, lg: 15 };
  const safeColor = (c) => {
    const s = String(c || "").trim();
    if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(s)) return s;
    return null;
  };

  const inline = (t) => {
    let h = escapeHtml(t);

    // bbcode-like tags
    h = h.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/g, (_m, c, inner) => {
      const col = safeColor(c) || "#b8860b";
      return `<span style="color:${col};font-weight:600">${inner}</span>`;
    });
    h = h.replace(/\[bg=([^\]]+)\]([\s\S]*?)\[\/bg\]/g, (_m, c, inner) => {
      const col = safeColor(c) || "#fde68a";
      return `<span style="background:${col};padding:0 3px;border-radius:4px">${inner}</span>`;
    });
    h = h.replace(/\[size=(sm|md|lg)\]([\s\S]*?)\[\/size\]/g, (_m, s, inner) => {
      const px = sizeMap[s] || 13;
      return `<span style="font-size:${px}px">${inner}</span>`;
    });

    // markdown-ish emphasis
    h = h.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/__([\s\S]+?)__/g, "<u>$1</u>");
    h = h.replace(/~~([\s\S]+?)~~/g, "<s>$1</s>");
    h = h.replace(/==([\s\S]+?)==/g, "<mark>$1</mark>");
    h = h.replace(/_([\s\S]+?)_/g, "<em>$1</em>");

    return h;
  };

  const blocks = [];
  let ul = null;
  let ol = null;
  const flushLists = () => {
    if (ul) { blocks.push(`<ul>${ul.join("")}</ul>`); ul = null; }
    if (ol) { blocks.push(`<ol>${ol.join("")}</ol>`); ol = null; }
  };

  for (const ln of lines) {
    const line = String(ln ?? "");
    const mOl = line.match(/^\s*\d+\.\s+(.*)$/);
    const mUl = line.match(/^\s*[-*]\s+(.*)$/);
    const mQt = line.match(/^\s*>\s+(.*)$/);

    if (mOl) {
      if (ul) flushLists();
      if (!ol) ol = [];
      ol.push(`<li>${inline(mOl[1])}</li>`);
      continue;
    }
    if (mUl) {
      if (ol) flushLists();
      if (!ul) ul = [];
      ul.push(`<li>${inline(mUl[1])}</li>`);
      continue;
    }

    flushLists();
    if (mQt) {
      blocks.push(`<blockquote>${inline(mQt[1])}</blockquote>`);
      continue;
    }
    if (line.trim() === "") {
      blocks.push("<br/>");
      continue;
    }
    blocks.push(`<div>${inline(line)}</div>`);
  }
  flushLists();

  return blocks.join("");
}

function removeInteractionsSyncedFromMeeting(interactions, meetingId) {
  return interactions.filter(i => i.fromMeetingId !== meetingId);
}

/** 舊資料可能 split 在 partnerPlan / actionItems；編輯時合併為單一欄位顯示 */
function mergeMeetingPlanFields(partnerPlan, actionItems) {
  const a = String(partnerPlan || "").trim();
  const b = String(actionItems || "").trim();
  if (a && b) return `${a}\n${b}`;
  return a || b;
}

function meetingPlanLinesForActions(planText) {
  return String(planText || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}

function getUnmatchedMeetingPlanLines(planText, partners) {
  const lines = meetingPlanLinesForActions(planText);
  if (lines.length === 0) return [];
  const pool = partners.filter(p => p.role !== "上線" && p.name);
  if (pool.length === 0) return lines;
  const ordered = [...pool].sort((a, b) => b.name.length - a.name.length);
  return lines.filter(line => !ordered.some(p => line.includes(p.name)));
}

function isValidYmdParts(y, m, d) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function partsToYmd(y, m, d) {
  if (!isValidYmdParts(y, m, d)) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 從待辦行解析日期：支援 YYYY-MM-DD、M/D、M月初；解析不到則用會議日 */
function parsePlanLineDate(line, meetingDateYmd) {
  const fallback = meetingDateYmd;
  if (!line || !/^\d{4}-\d{2}-\d{2}$/.test(String(meetingDateYmd || ""))) return fallback;
  const y = +meetingDateYmd.slice(0, 4);
  const meetingM = +meetingDateYmd.slice(5, 7);
  const s = String(line);

  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const out = partsToYmd(+iso[1], +iso[2], +iso[3]);
    if (out) return out;
  }

  const chu = s.match(/(\d{1,2})月\s*初/);
  if (chu) {
    let mm = +chu[1];
    let yy = y;
    if (mm < meetingM) yy += 1;
    const out = partsToYmd(yy, mm, 1);
    if (out) return out;
  }

  const md = s.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (md) {
    let mm = +md[1];
    let dd = +md[2];
    let yy = y;
    if (mm < meetingM) yy += 1;
    const out = partsToYmd(yy, mm, dd);
    if (out) return out;
  }

  return fallback;
}

/** 依行內關鍵字推斷互動類型（月曆分類／篩選用） */
function inferPlanLineInteractionType(line) {
  const s = String(line || "");
  if (s.includes("團隊活動")) return "團隊活動";
  if (s.includes("談場")) return "談場";
  if (s.includes("實體暖身")) return "實體暖身";
  if (s.includes("產品課程")) return "產品課程";
  if (s.includes("新人啟動")) return "新人啟動";
  if (/約暖身|暖身/.test(s)) return "暖身";
  if (s.includes("追蹤")) return "追蹤";
  return "規劃";
}

/** 上線會議：具體規劃與待辦「一行一項」各建立一筆互動；日期由行內解析；行內含人脈姓名則掛該夥伴 */
function buildMeetingPlanLineEntries(meeting, partners) {
  if (meeting.type !== "上線會議") return [];
  const plan = String(mergeMeetingPlanFields(meeting.partnerPlan, meeting.actionItems)).trim();
  if (!plan) return [];
  const lines = plan.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const pool = partners.filter(p => p.role !== "上線" && p.name);
  const ordered = [...pool].sort((a, b) => b.name.length - a.name.length);
  const titleBase = meeting.title || "上線會議";
  const prefix = `來自上線會議「${titleBase}」的行動項目`;
  return lines.map(line => {
    let partnerId = "";
    for (const p of ordered) {
      if (line.includes(p.name)) { partnerId = p.id; break; }
    }
    const lineDate = parsePlanLineDate(line, meeting.date);
    const lineType = inferPlanLineInteractionType(line);
    return {
      id: uid(),
      date: lineDate,
      time: "00:00:00",
      partnerId,
      type: lineType,
      title: line,
      content: prefix,
      status: meeting.status === "已完成" ? "已完成" : "待執行",
      tags: ["上線會議"],
      partnerPlan: "",
      actionItems: "",
      quote: "",
      fromMeetingId: meeting.id,
    };
  });
}

// ─── CSS (Light: white + gold) ────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Noto+Serif+TC:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#faf9f6;
    --bg2:#ffffff;
    --bg3:#f4f2ed;
    --gold:#b8860b;
    --gold2:#d4a017;
    --gold-light:#fef3c7;
    --gold-border:#e8c84a;
    --text:#1a1611;
    --text2:#6b5e44;
    --text3:#a89878;
    --red:#c0392b;
    --green:#27ae60;
    --blue:#2563eb;
    --purple:#7c3aed;
    --border:#e8e0d0;
    --border2:#d4c9b0;
    --shadow:0 1px 4px rgba(0,0,0,.08);
    --shadow-md:0 4px 16px rgba(0,0,0,.10);
    --radius:12px;
  }
  body{background:var(--bg);color:var(--text);font-family:'Noto Serif TC',serif;min-height:100vh}
  .app{display:flex;flex-direction:column;min-height:100vh;max-width:1280px;margin:0 auto}

  /* ── Header ── */
  .header{
    padding:0 24px;height:56px;display:flex;align-items:stretch;justify-content:space-between;
    border-bottom:2px solid var(--gold-border);background:#fff;
    position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(184,134,11,.08);
  }
  .logo{font-family:'Playfair Display',serif;font-size:18px;color:var(--gold);letter-spacing:1px;display:flex;align-items:center;gap:10px;white-space:nowrap}
  .logo-dot{width:8px;height:8px;border-radius:50%;background:var(--gold-border)}
  .nav{display:flex;gap:0;overflow-x:auto;align-items:stretch}
  .nav-btn{
    background:none;border:none;color:var(--text2);cursor:pointer;
    padding:0 14px;font-family:'Noto Serif TC',serif;font-size:12.5px;
    border-bottom:3px solid transparent;transition:all .18s;white-space:nowrap;
    display:flex;align-items:center;
  }
  .nav-btn.active{color:var(--gold);border-bottom-color:var(--gold);font-weight:700}
  .nav-btn:hover:not(.active){color:var(--text);background:var(--bg3)}

  /* ── Main ── */
  .main{flex:1;padding:22px 24px;overflow-y:auto}

  /* ── Cards ── */
  .card{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:18px;box-shadow:var(--shadow)}
  .card-sm{background:var(--bg3);border:1px solid var(--border);border-radius:9px;padding:13px}
  /* 上線會議「具體規劃與待辦」：靠左、保留換行 */
  .meeting-plan-read{text-align:left;white-space:pre-wrap;word-break:break-word;line-height:1.8}
  .card-gold{background:var(--gold-light);border:1px solid var(--gold-border);border-radius:var(--radius);padding:18px}

  /* ── Grid ── */
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .info-kv{display:flex;flex-direction:column;gap:0}
  .info-row{display:grid;grid-template-columns:minmax(100px,32%) 1fr;column-gap:20px;row-gap:4px;align-items:start;padding:11px 0;border-bottom:1px solid var(--border)}
  .info-row:last-child{border-bottom:none}
  .info-label{color:var(--text3);font-size:12px;font-weight:500;line-height:1.5}
  .info-value{font-size:14px;line-height:1.5;color:var(--text);word-break:break-word}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .grid-6{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
  @media(max-width:860px){.grid-3,.grid-4,.grid-6{grid-template-columns:1fr 1fr}}
  @media(max-width:520px){.grid-2,.grid-3,.grid-4,.grid-6{grid-template-columns:1fr}.nav-btn{padding:0 9px;font-size:11px}.info-row{grid-template-columns:1fr;gap:6px}}

  /* ── Typography ── */
  .heading{font-family:'Playfair Display',serif;color:var(--gold);font-size:19px;margin-bottom:14px}
  .subheading{font-size:10px;color:var(--text3);letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;font-family:'DM Mono',monospace}
  .label{font-size:11px;color:var(--text3);letter-spacing:.5px;margin-bottom:3px;font-family:'DM Mono',monospace}

  /* ── Buttons ── */
  .btn{padding:7px 15px;border-radius:8px;border:none;cursor:pointer;font-family:'Noto Serif TC',serif;font-size:13px;transition:all .18s;font-weight:500}
  .btn-gold{background:var(--gold);color:#fff}.btn-gold:hover{background:var(--gold2)}
  .btn-ghost{background:#fff;border:1.5px solid var(--border2);color:var(--text2)}.btn-ghost:hover{border-color:var(--gold);color:var(--gold)}
  .btn-danger{background:#fff;border:1.5px solid var(--red);color:var(--red)}.btn-danger:hover{background:#fef2f2}
  .btn-sm{padding:4px 10px;font-size:12px;border-radius:6px}
  .btn-copy{background:var(--gold-light);border:1.5px solid var(--gold-border);color:var(--gold);font-size:12px;padding:5px 12px;border-radius:6px;cursor:pointer;font-family:'Noto Serif TC',serif;transition:all .18s}.btn-copy:hover{background:var(--gold);color:#fff}

  /* ── Inputs ── */
  .input{background:#fff;border:1.5px solid var(--border);border-radius:8px;color:var(--text);padding:8px 11px;font-size:13px;font-family:'Noto Serif TC',serif;width:100%;transition:border .18s;outline:none;}
  .input:focus{border-color:var(--gold)}
  textarea.input{resize:vertical;min-height:70px}
  select.input option{background:#fff}
  .input-compact{padding:6px 10px;font-size:12px;border-radius:7px}
  .partner-filters-row{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;overflow-x:auto;min-width:0}
  .partner-filters-row .input{width:110px;min-width:110px}
  .playbook-text{white-space:pre-wrap;word-break:break-word}
  .playbook-text mark{background:#fde68a;padding:0 3px;border-radius:4px}
  .playbook-text blockquote{margin:8px 0;padding:8px 12px;border-left:3px solid var(--gold-border);background:rgba(184,134,11,.06);border-radius:0 10px 10px 0}
  .playbook-text ul,.playbook-text ol{margin:8px 0 8px 18px}

  /* ── Tags ── */
  .tag{display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;background:var(--bg3);border:1px solid var(--border);color:var(--text2);margin:2px;font-family:'DM Mono',monospace}
  .tag-gold{background:var(--gold-light);border-color:var(--gold-border);color:var(--gold)}
  .tag-blue{background:#eff6ff;border-color:#bfdbfe;color:var(--blue)}

  /* ── Stat cards ── */
  .stat-card{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow);position:relative;overflow:hidden}
  .stat-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--gold),var(--gold-border),transparent)}
  .stat-num{font-family:'Playfair Display',serif;font-size:28px;color:var(--gold);line-height:1}
  .stat-label{font-size:10px;color:var(--text3);letter-spacing:2px;margin-top:5px;font-family:'DM Mono',monospace}
  .stat-sub{font-size:11px;color:var(--text2);margin-top:5px}
  .progress-bar{height:4px;background:var(--bg3);border-radius:2px;margin-top:8px;overflow:hidden}
  .progress-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-border));border-radius:2px;transition:width .6s ease}

  /* ── Partner cards ── */
  .partner-card{background:#fff;border:1.5px solid var(--border);border-radius:var(--radius);padding:16px;transition:all .18s;cursor:pointer}
  .partner-card:hover{border-color:var(--gold-border);box-shadow:0 4px 16px rgba(184,134,11,.12)}
  .avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--gold-light),#fff);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:17px;color:var(--gold);border:2px solid var(--gold-border);flex-shrink:0}
  .avatar-lg{width:62px;height:62px;font-size:23px}
  .role-badge{display:inline-block;padding:2px 7px;border-radius:5px;font-size:10px;font-family:'DM Mono',monospace;letter-spacing:.5px}
  .role-夥伴{background:#eff6ff;border:1px solid #bfdbfe;color:var(--blue)}

  /* ── Timeline ── */
  .timeline-item{display:flex;gap:12px;padding:11px 10px;cursor:pointer;transition:background .15s;border-radius:9px;border-bottom:1px solid var(--border)}
  .timeline-item:last-child{border-bottom:none}
  .timeline-item:hover{background:var(--bg3)}
  .tl-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-top:5px}
  .type-暖身{color:var(--blue)}.type-追蹤{color:var(--gold)}.type-規劃{color:var(--green)}.type-上線會議{color:var(--purple)}.type-新人啟動{color:#0f766e}
  .tl-dot.type-暖身{background:var(--blue)}.tl-dot.type-追蹤{background:var(--gold)}.tl-dot.type-規劃{background:var(--green)}.tl-dot.type-上線會議{background:var(--purple)}.tl-dot.type-談場{background:#c2410c}.tl-dot.type-團隊活動{background:#047857}.tl-dot.type-實體暖身{background:#4338ca}.tl-dot.type-產品課程{background:#6d28d9}.tl-dot.type-新人啟動{background:#0f766e}
  .status-badge{font-size:10px;padding:2px 6px;border-radius:4px;font-family:'DM Mono',monospace}
  .status-已完成{background:#d1fae5;color:#065f46}.status-待執行{background:var(--gold-light);color:var(--gold)}

  /* ── Quotes ── */
  .quote-card{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:22px 20px;position:relative;box-shadow:var(--shadow)}
  .quote-card::before{content:'"';font-family:'Playfair Display',serif;font-size:64px;color:var(--gold-border);position:absolute;top:-6px;left:13px;opacity:.5;line-height:1}
  .quote-text{font-size:14px;line-height:1.9;color:var(--text);padding-top:12px}
  .quote-author{font-size:11px;color:var(--gold);margin-top:8px;font-family:'DM Mono',monospace}

  /* ── Modal ── */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(3px);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}
  .modal{background:#fff;border:1.5px solid var(--border2);border-radius:16px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,.14);text-align:left}
  .modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
  .close-btn{background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;padding:4px;border-radius:4px}.close-btn:hover{background:var(--bg3)}

  /* ── Forms ── */
  .form-group{margin-bottom:13px}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}

  /* ── Manifest ── */
  .manifest-banner{background:linear-gradient(135deg,var(--gold-light),#fffbeb);border:1.5px solid var(--gold-border);border-radius:var(--radius);padding:20px 22px;margin-bottom:20px;box-shadow:0 2px 8px rgba(184,134,11,.1)}

  /* ── Calendar ── */
  .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
  .cal-cell{min-height:80px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:5px;overflow:hidden}
  .cal-cell.today{border-color:var(--gold);border-width:2px}
  .cal-cell.other-month{background:var(--bg3);opacity:.5}
  .cal-event{font-size:9.5px;line-height:1.35;padding:2px 4px;border-radius:3px;margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer}
  .cal-event.type-暖身{background:#eff6ff;color:var(--blue)}
  .cal-event.type-追蹤{background:var(--gold-light);color:var(--gold)}
  .cal-event.type-規劃{background:#f0fdf4;color:var(--green)}
  .cal-event.type-上線會議{background:#f5f3ff;color:var(--purple)}
  .cal-event.type-談場{background:#fff7ed;color:#c2410c}
  .cal-event.type-團隊活動{background:#ecfdf5;color:#047857}
  .cal-event.type-實體暖身{background:#eef2ff;color:#4338ca}
  .cal-event.type-產品課程{background:#faf5ff;color:#6d28d9}
  .cal-event.type-新人啟動{background:#f0fdfa;color:#0f766e}

  /* ── Partner detail tabs ── */
  .detail-tab{background:none;border:none;cursor:pointer;padding:8px 14px;font-family:'Noto Serif TC',serif;font-size:13px;color:var(--text2);border-bottom:2px solid transparent;transition:all .18s}
  .detail-tab.active{color:var(--gold);border-bottom-color:var(--gold);font-weight:700}

  /* ── ABC Note ── */
  .abc-note{font-family:'DM Mono',monospace;font-size:12px;line-height:1.9;white-space:pre-wrap;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:14px;color:var(--text)}

  /* ── Misc ── */
  .flex{display:flex}.items-center{align-items:center}.justify-between{justify-content:space-between}
  .gap-6{gap:6px}.gap-8{gap:8px}.gap-12{gap:12px}
  .mt-6{margin-top:6px}.mt-8{margin-top:8px}.mt-10{margin-top:10px}.mt-12{margin-top:12px}.mt-16{margin-top:16px}.mt-20{margin-top:20px}
  .mb-8{margin-bottom:8px}.mb-12{margin-bottom:12px}.mb-16{margin-bottom:16px}
  .text-gold{color:var(--gold)}.text-muted{color:var(--text2)}.text-sm{font-size:13px}.text-xs{font-size:11px}
  .mono{font-family:'DM Mono',monospace}
  .divider{height:1px;background:var(--border);margin:14px 0}
  .empty{text-align:center;color:var(--text3);padding:32px 0;font-size:13px}
`;

// ─── Theme constants ──────────────────────────────────────────────
const var_gold = "#b8860b";

// ─── App ──────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [partners, setPartners] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [todos, setTodos] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [goals, setGoals] = useState(SEED_GOALS);
  const [playbook, setPlaybook] = useState([]);
  const [manifest, setManifest] = useState(SEED_MANIFEST);
  const [incomes, setIncomes] = useState([]);
  const [selfCosts, setSelfCosts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const loadedPartners = (await load(KEYS.partners)) || SEED_PARTNERS;
      // 兼容舊資料欄位：角色「夥伴」轉已加入、舊「拒絕」轉邀約拒絕，並補齊新版人脈欄位
      const migratedPartners = loadedPartners.map(p => ({
        ...p,
        role: p.role === "夥伴" ? "已加入" : (p.role === "拒絕" ? "邀約拒絕" : p.role),
        attribute: p.attribute || "",
        painPoint: p.painPoint || "",
        region: p.region || "",
        vacation: p.vacation || "",
        memo: p.memo || p.notes || "",
        gender: p.gender || "",
        relation: p.relation || "",
        age: p.age ?? "",
        occupation: p.occupation || "",
        salary: p.salary ?? "",
        dateTalkVenue: p.dateTalkVenue || "",
        dateTeamActivity: p.dateTeamActivity || "",
        dateWarmupPhysical: p.dateWarmupPhysical || "",
        dateProductCourse: p.dateProductCourse || "",
        warmupStalled: Boolean(p.warmupStalled),
      }));
      setPartners(migratedPartners);
      if (loadedPartners.some(p => p.role === "夥伴" || p.role === "拒絕")) save(KEYS.partners, migratedPartners);
      const rawIx = (await load(KEYS.interactions)) || SEED_INTERACTIONS;
      const migratedIx = rawIx.map(i => {
        const nextType = i.type === "討論" ? "暖身" : i.type;
        const nextTime = i.time != null && String(i.time).trim() !== "" ? normalizeTime(i.time) : "00:00:00";
        return (nextType !== i.type || nextTime !== (i.time || "")) ? { ...i, type: nextType, time: nextTime } : i;
      });
      setInteractions(migratedIx);
      if (rawIx.some(i => i.type === "討論" || !(i.time != null && String(i.time).trim() !== ""))) save(KEYS.interactions, migratedIx);
      setTodos((await load(KEYS.todos)) || SEED_TODOS);
      setQuotes((await load(KEYS.quotes)) || SEED_QUOTES);
      setGoals((await load(KEYS.goals)) || SEED_GOALS);
      setPlaybook((await load(KEYS.playbook)) || SEED_PLAYBOOK);
      setManifest((await load(KEYS.manifest)) || SEED_MANIFEST);
      setIncomes((await load(KEYS.incomes)) || []);
      setSelfCosts((await load(KEYS.selfCosts)) || []);
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback((key, val, setter) => { setter(val); save(key, val); }, []);

  if (!loaded) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:var_gold, fontFamily:"'Playfair Display',serif", fontSize:20 }}><style>{css}</style>載入中…</div>;

  const TABS = [
    { id: "dashboard", label: "📊 總覽" },
    { id: "partners",  label: "👥 人脈" },
    { id: "timeline",  label: "🗓 時間軸" },
    { id: "playbook",  label: "📖 教學" },
    { id: "coach",     label: "🤖 AI教練" },
    { id: "quotes",    label: "✨ 金句" },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <header className="header">
          <div className="logo"><div className="logo-dot"/>Network CRM</div>
          <nav className="nav">
            {TABS.map(t => <button key={t.id} className={`nav-btn${tab===t.id?" active":""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </nav>
        </header>
        <main className="main">
          {tab==="dashboard" && <Dashboard partners={partners} interactions={interactions} setInteractions={i=>persist(KEYS.interactions,i,setInteractions)} todos={todos} goals={goals} setGoals={g=>persist(KEYS.goals,g,setGoals)} setTodos={t=>persist(KEYS.todos,t,setTodos)} manifest={manifest} setManifest={m=>persist(KEYS.manifest,m,setManifest)} incomes={incomes} persistIncomes={v=>persist(KEYS.incomes,v,setIncomes)} selfCosts={selfCosts} persistSelfCosts={v=>persist(KEYS.selfCosts,v,setSelfCosts)}/>}
          {tab==="partners"  && <Partners
            partners={partners}
            setPartners={p=>persist(KEYS.partners,p,setPartners)}
            interactions={interactions}
            setInteractions={i=>persist(KEYS.interactions,i,setInteractions)}
            rawSave={p=>save(KEYS.partners,p)}
          />}
          {tab==="timeline"  && <Timeline  interactions={interactions} setInteractions={i=>persist(KEYS.interactions,i,setInteractions)} partners={partners} setPartners={p=>persist(KEYS.partners,p,setPartners)}/>}
          {tab==="playbook"  && <Playbook  playbook={playbook} setPlaybook={pb=>persist(KEYS.playbook,pb,setPlaybook)}/>}
          {tab==="coach"     && <AICoach   partners={partners} interactions={interactions} todos={todos}/>}
          {tab==="quotes"    && <QuotesTab quotes={quotes} setQuotes={q=>persist(KEYS.quotes,q,setQuotes)}/>}
        </main>
      </div>
    </>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────
function Dashboard({ partners, interactions, setInteractions, goals, setGoals, manifest, setManifest, incomes, persistIncomes, selfCosts, persistSelfCosts }) {
  const [editGoals, setEditGoals] = useState(false);
  const [editManifest, setEditManifest] = useState(false);
  const [gd, setGd] = useState(goals);
  const [md, setMd] = useState(manifest);
  const [newCond, setNewCond] = useState("");
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState("");
  const [incomeDraft, setIncomeDraft] = useState({ date: new Date().toISOString().slice(0,10), amount: "", note: "" });
  const [showCostForm, setShowCostForm] = useState(false);
  const [editingCostId, setEditingCostId] = useState("");
  const [costDraft, setCostDraft] = useState({ date: new Date().toISOString().slice(0,10), type: "買貨", amount: "", note: "" });

  const saveIncomes = (next) => {
    persistIncomes(next);
  };

  const recruitStats = ["邀約拒絕","談後拒絕","未加入","暖身中","確定談場","談場延期","跟進中","已付訂金","已加入"].map(r=>({ role:r, count:partners.filter(p=>p.role===r).length }));
  const rcol = { 未加入:"#aaa", 暖身中:"#2563eb", 確定談場:"#b8860b", 談場延期:"#e67e22", 跟進中:"#7c3aed", 已付訂金:"#f59e0b", 邀約拒絕:"#c0392b", 談後拒絕:"#e74c3c", 已加入:"#27ae60" };
  const partnerTotal = partners.filter(p=>p.role!=="上線").length;
  const interactionScheduleSet = new Set(
    interactions
      .filter(i => SCHEDULE_TYPES.includes(i.type) && i.partnerId && i.date)
      .map(i => `${i.partnerId}|${i.type}|${i.date}`)
  );
  const partnerScheduleEvents = partners
    .filter(p => p.role !== "上線")
    .flatMap((p) => ([
      p.dateTalkVenue ? { partnerId: p.id, type: "談場", date: p.dateTalkVenue } : null,
      p.dateTeamActivity ? { partnerId: p.id, type: "團隊活動", date: p.dateTeamActivity } : null,
      p.dateWarmupPhysical ? { partnerId: p.id, type: "實體暖身", date: p.dateWarmupPhysical } : null,
      p.dateProductCourse ? { partnerId: p.id, type: "產品課程", date: p.dateProductCourse } : null,
    ])).filter(Boolean)
    .filter(e => !interactionScheduleSet.has(`${e.partnerId}|${e.type}|${e.date}`));
  const mergedTimelineForStats = [...interactions, ...partnerScheduleEvents];
  const timelineCounts = {
    talk: mergedTimelineForStats.filter(i => i.type === "談場").length,
    warmupPhysical: mergedTimelineForStats.filter(i => i.type === "實體暖身").length,
    teamActivity: mergedTimelineForStats.filter(i => i.type === "團隊活動").length,
    meeting: mergedTimelineForStats.filter(i => i.type === "上線會議").length,
  };

  const totalIncome = incomes.reduce((s,i)=>s+i.amount,0);
  const totalCost = selfCosts.reduce((s,c)=>s+(+c.amount||0),0);
  const pct = (v,m) => Math.min(100, Math.round((v/(m||1))*100));

  // Pending items from time axis (interactions with status 待執行)
  const pendingInteractions = interactions
    .filter(i=>i.status==="待執行")
    .sort((a,b)=>toMsDT(a.date,a.time) - toMsDT(b.date,b.time));
  const toggleInteraction = (id) => setInteractions(interactions.map(i=>i.id===id?{...i,status:"已完成"}:i));

  const openIncomeNew = () => {
    setEditingIncomeId("");
    setIncomeDraft({ date: new Date().toISOString().slice(0,10), amount: "", note: "" });
    setShowIncomeForm(true);
  };
  const openIncomeEdit = (income) => {
    setEditingIncomeId(income.id);
    setIncomeDraft({ date: income.date || new Date().toISOString().slice(0,10), amount: String(income.amount ?? ""), note: income.note || "" });
    setShowIncomeForm(true);
  };
  const saveIncome = () => {
    if (!incomeDraft.amount) return;
    const payload = { id: editingIncomeId || uid(), ...incomeDraft, amount: +incomeDraft.amount };
    const next = editingIncomeId ? incomes.map(i => i.id===editingIncomeId ? payload : i) : [...incomes, payload];
    saveIncomes(next);
    setIncomeDraft({ date: new Date().toISOString().slice(0,10), amount: "", note: "" });
    setEditingIncomeId("");
    setShowIncomeForm(false);
  };

  const allCosts = [...selfCosts].sort((a,b)=>b.date.localeCompare(a.date));

  const openCostNew = () => {
    setEditingCostId("");
    setCostDraft({
      date: new Date().toISOString().slice(0,10),
      type: "買貨",
      amount: "",
      note: "",
    });
    setShowCostForm(true);
  };
  const openCostEdit = (cost) => {
    setEditingCostId(cost.id);
    setCostDraft({
      date: cost.date || new Date().toISOString().slice(0,10),
      type: cost.type || "買貨",
      amount: String(cost.amount ?? ""),
      note: cost.note || "",
    });
    setShowCostForm(true);
  };
  const saveCost = () => {
    if (!costDraft.amount) return;
    const payload = { id: editingCostId || uid(), date: costDraft.date, type: costDraft.type, amount: +costDraft.amount, note: costDraft.note };
    const nextCosts = editingCostId ? selfCosts.map(c => c.id===editingCostId ? payload : c) : [...selfCosts, payload];
    persistSelfCosts(nextCosts);
    setShowCostForm(false);
    setEditingCostId("");
  };
  const deleteCost = (cost) => {
    persistSelfCosts(selfCosts.filter(c=>c.id!==cost.id));
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>

      {/* ① 目標宣言 & 顯化條件 */}
      <div className="manifest-banner">
        <div className="subheading">✦ 目標宣言 & 顯化條件</div>
        <div style={{fontSize:15,fontFamily:"'Playfair Display',serif",color:var_gold,lineHeight:1.9,marginTop:6}}>{manifest.declaration}</div>
        <div className="flex" style={{flexWrap:"wrap",gap:6,marginTop:10}}>
          {manifest.conditions.map((c,i)=><span key={i} className="tag tag-gold">✓ {c}</span>)}
        </div>
        <button className="btn btn-ghost btn-sm" style={{marginTop:12}} onClick={()=>{setMd(manifest);setEditManifest(true);}}>✏️ 編輯</button>
      </div>

      {/* ② 我的收入 & 支出 */}
      <div className="card">
        <div className="flex justify-between items-center mb-14">
          <div className="subheading" style={{margin:0}}>💰 我的收入 & 支出</div>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setGd(goals);setEditGoals(true);}}>⚙ 設定目標</button>
        </div>

        {/* 收入 & 支出 並排 */}
        <div className="grid-2" style={{gap:12,marginBottom:16}}>
          {/* 收入欄 */}
          <div style={{background:"var(--gold-light)",border:"1.5px solid var(--gold-border)",borderRadius:10,padding:"14px 16px"}}>
            <div className="flex justify-between items-center mb-10">
              <div>
                <div className="stat-label" style={{marginBottom:4}}>💰 累積收入</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:var_gold}}>NT${totalIncome.toLocaleString()}</div>
                <div style={{fontSize:11,color:"var(--text2)",marginTop:3}}>目標 NT${(goals.monthlyIncome||0).toLocaleString()}</div>
                <div className="progress-bar"><div className="progress-fill" style={{width:`${pct(totalIncome,goals.monthlyIncome||1)}%`}}/></div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={openIncomeNew}>＋</button>
            </div>
            {incomes.length===0&&<div style={{fontSize:11,color:"var(--text3)"}}>尚無收入紀錄</div>}
            {[...incomes].sort((a,b)=>b.date.localeCompare(a.date)).map(i=>(
              <div key={i.id} className="flex items-center justify-between" style={{padding:"5px 0",borderTop:"1px solid var(--gold-border)"}}>
                <div><div className="text-sm">{i.note||"收入"}</div><div className="text-xs mono" style={{color:var_gold,opacity:.7}}>{i.date}</div></div>
                <div className="flex items-center gap-8">
                  <span className="mono" style={{color:"var(--green)",fontSize:12}}>+NT${i.amount.toLocaleString()}</span>
                  <button style={{background:"none",border:"none",color:"var(--gold)",cursor:"pointer",fontSize:11}} onClick={()=>openIncomeEdit(i)}>✏</button>
                  <button style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:11}} onClick={()=>saveIncomes(incomes.filter(x=>x.id!==i.id))}>✕</button>
                </div>
              </div>
            ))}
          </div>

          {/* 支出欄 */}
          <div style={{background:"#fff5f5",border:"1.5px solid #fca5a5",borderRadius:10,padding:"14px 16px"}}>
            <div className="flex justify-between items-center" style={{marginBottom:4}}>
              <div className="stat-label">💸 已投入成本</div>
              <button className="btn btn-ghost btn-sm" style={{padding:"2px 8px"}} onClick={openCostNew}>＋</button>
            </div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"var(--red)",marginBottom:10}}>NT${totalCost.toLocaleString()}</div>
            {(() => {
              if(allCosts.length===0) return <div style={{fontSize:11,color:"var(--text3)"}}>尚無支出紀錄</div>;
              return allCosts.map(c=>(
                <div key={c.id} className="flex justify-between items-center" style={{padding:"5px 0",borderTop:"1px solid #fecdd3"}}>
                  <div className="flex items-center gap-5">
                    <span style={{fontSize:9,padding:"1px 4px",borderRadius:3,border:`1px solid ${TYPE_COLOR[c.type]||"#ccc"}`,color:TYPE_COLOR[c.type]||"#888",fontFamily:"'DM Mono',monospace"}}>{c.type}</span>
                    <div>
                      <div style={{fontSize:11,color:"var(--text2)"}}>{c.note||"支出"}</div>
                      <div style={{fontSize:10,color:"var(--text3)",fontFamily:"'DM Mono',monospace"}}>{c.date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <span className="mono" style={{fontSize:12,color:"var(--red)"}}>NT${c.amount.toLocaleString()}</span>
                    <button style={{background:"none",border:"none",color:"var(--gold)",cursor:"pointer",fontSize:11}} onClick={()=>openCostEdit(c)}>✏</button>
                    <button style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:11}} onClick={()=>deleteCost(c)}>✕</button>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* ③ 夥伴名單 — 一排，文字在上數字在下，不換行 */}
      <div className="card" style={{padding:"14px 18px"}}>
        <div className="flex items-center justify-between mb-10">
          <div className="subheading" style={{margin:0}}>👥 夥伴名單</div>
          <span style={{fontSize:11,color:"var(--text3)",fontFamily:"'DM Mono',monospace"}}>總數 {partnerTotal}</span>
        </div>
        <div style={{display:"flex",gap:8,overflowX:"auto"}}>
          {recruitStats.map(s=>(
            <div key={s.role} style={{
              display:"flex",flexDirection:"column",alignItems:"center",gap:4,
              background:rcol[s.role]+"14",border:`1.5px solid ${rcol[s.role]}44`,
              borderRadius:8,padding:"10px 14px",flex:"1 1 0",minWidth:72,
            }}>
              <span style={{fontSize:10,color:rcol[s.role],fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{s.role}</span>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:rcol[s.role],lineHeight:1,fontWeight:700}}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ④ 時間軸次數統計 */}
      <div className="card" style={{padding:"14px 18px"}}>
        <div className="subheading mb-10">🗓 時間軸次數統計</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
          {[
            { label: "談場次數", value: timelineCounts.talk, color: "#c2410c" },
            { label: "實體暖身次數", value: timelineCounts.warmupPhysical, color: "#4338ca" },
            { label: "團隊活動次數", value: timelineCounts.teamActivity, color: "#047857" },
            { label: "上線會議次數", value: timelineCounts.meeting, color: "var(--purple)" },
          ].map((s) => (
            <div key={s.label} style={{background:"#fff",border:`1.5px solid ${s.color}44`,borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:10,color:s.color,fontFamily:"'DM Mono',monospace",marginBottom:4}}>{s.label}</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:s.color,lineHeight:1,fontWeight:700}}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ⑤ 待執行清單（來自時間軸） */}
      <div className="card">
        <div className="flex justify-between items-center mb-12">
          <div className="subheading" style={{margin:0}}>📋 待執行清單
            <span style={{marginLeft:8,fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--text3)"}}>（來自時間軸）</span>
          </div>
          <span style={{fontSize:11,color:"var(--text3)",fontFamily:"'DM Mono',monospace"}}>{pendingInteractions.length} 項</span>
        </div>
        {pendingInteractions.length===0&&<div className="empty" style={{padding:"10px 0"}}>🎉 全部完成！</div>}
        {pendingInteractions.map(item=>{
          const p = partners.find(x=>x.id===item.partnerId);
          return (
            <div key={item.id} className="flex items-center gap-10" style={{padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <input
                type="checkbox"
                style={{accentColor:var_gold,cursor:"pointer",width:16,height:16,flexShrink:0}}
                onChange={()=>toggleInteraction(item.id)}
              />
              <div style={{flex:1,minWidth:0}}>
                <div className="text-sm" style={{fontWeight:500}}>{item.title}</div>
                <div style={{display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
                  <span className="text-xs mono text-muted">{item.date}</span>
                  {p&&<span className="text-xs text-muted">· {p.name}</span>}
                  <span className="tag" style={{padding:"0 5px",fontSize:10}}>{item.type}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ⑥ 各夥伴投入金費 */}
      <div className="card">
        <div className="subheading mb-12">💸 各夥伴投入金費</div>
        {partners.filter(p=>(p.costs||[]).length>0).length===0&&<div className="empty" style={{padding:"8px 0"}}>尚無成本紀錄</div>}
        {partners.filter(p=>(p.costs||[]).length>0).map(p=>{
          const total=(p.costs||[]).reduce((a,c)=>a+c.amount,0);
          return (
            <div key={p.id} className="mt-10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-8">
                  <div className="avatar" style={{width:26,height:26,fontSize:11}}>{p.avatar||p.name[0]}</div>
                  <span className="text-sm" style={{fontWeight:600}}>{p.name}</span>
                </div>
                <span className="mono" style={{color:"var(--red)",fontSize:13}}>NT${total.toLocaleString()}</span>
              </div>
              {(p.costs||[]).map(c=>(
                <div key={c.id} className="flex justify-between items-center mt-5" style={{paddingLeft:34}}>
                  <div className="flex items-center gap-6">
                    <span style={{fontSize:9,padding:"1px 5px",borderRadius:3,border:`1px solid ${TYPE_COLOR[c.type]||"#ccc"}`,color:TYPE_COLOR[c.type]||"#888",fontFamily:"'DM Mono',monospace"}}>{c.type}</span>
                    <span className="text-xs mono text-muted">{c.date}</span>
                    {c.note&&<span className="text-xs text-muted">· {c.note}</span>}
                  </div>
                  <span className="mono" style={{fontSize:11,color:"var(--text2)"}}>NT${c.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {editGoals&&(
        <Modal title="設定目標" onClose={()=>setEditGoals(false)}>
          {[["monthlyIncome","月收入目標 (NT$)"],["monthlyPartners","夥伴人數目標"]].map(([k,l])=>(
            <div className="form-group" key={k}><label className="label">{l}</label><input type="number" className="input" value={gd[k]||""} onChange={e=>setGd({...gd,[k]:+e.target.value})}/></div>
          ))}
          <div className="flex gap-8 mt-12"><button className="btn btn-gold" onClick={()=>{setGoals(gd);setEditGoals(false);}}>儲存</button><button className="btn btn-ghost" onClick={()=>setEditGoals(false)}>取消</button></div>
        </Modal>
      )}
      {editManifest&&(
        <Modal title="目標宣言 & 顯化條件" onClose={()=>setEditManifest(false)}>
          <div className="form-group"><label className="label">目標宣言（一句話）</label><textarea className="input" style={{minHeight:72}} value={md.declaration} onChange={e=>setMd({...md,declaration:e.target.value})}/></div>
          <div className="subheading mt-12">顯化條件</div>
          {md.conditions.map((c,i)=>(
            <div key={i} className="flex items-center gap-8 mt-6">
              <input className="input" style={{flex:1}} value={c} onChange={e=>setMd({...md,conditions:md.conditions.map((x,j)=>j===i?e.target.value:x)})}/>
              <button className="btn btn-danger btn-sm" onClick={()=>setMd({...md,conditions:md.conditions.filter((_,j)=>j!==i)})}>✕</button>
            </div>
          ))}
          <div className="flex gap-8 mt-8">
            <input className="input" style={{flex:1}} placeholder="新增條件…" value={newCond} onChange={e=>setNewCond(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newCond.trim()){setMd({...md,conditions:[...md.conditions,newCond.trim()]});setNewCond("");}}}/>
            <button className="btn btn-ghost btn-sm" onClick={()=>{if(newCond.trim()){setMd({...md,conditions:[...md.conditions,newCond.trim()]});setNewCond("");}}}>＋</button>
          </div>
          <div className="flex gap-8 mt-14"><button className="btn btn-gold" onClick={()=>{setManifest(md);setEditManifest(false);}}>儲存</button><button className="btn btn-ghost" onClick={()=>setEditManifest(false)}>取消</button></div>
        </Modal>
      )}
      {showIncomeForm&&(
        <Modal title={editingIncomeId?"編輯收入紀錄":"新增收入紀錄"} onClose={()=>setShowIncomeForm(false)}>
          <div className="form-row">
            <div className="form-group"><label className="label">日期</label><input type="date" className="input" value={incomeDraft.date} onChange={e=>setIncomeDraft({...incomeDraft,date:e.target.value})}/></div>
            <div className="form-group"><label className="label">金額 (NT$)</label><input type="number" className="input" value={incomeDraft.amount} onChange={e=>setIncomeDraft({...incomeDraft,amount:e.target.value})}/></div>
          </div>
          <div className="form-group"><label className="label">備注</label><input className="input" value={incomeDraft.note} onChange={e=>setIncomeDraft({...incomeDraft,note:e.target.value})} placeholder="三月獎金、業績分潤…"/></div>
          <div className="flex gap-8 mt-12"><button className="btn btn-gold" onClick={saveIncome}>{editingIncomeId?"儲存":"新增"}</button><button className="btn btn-ghost" onClick={()=>setShowIncomeForm(false)}>取消</button></div>
        </Modal>
      )}
      {showCostForm&&(
        <Modal title={editingCostId?"編輯支出紀錄":"新增支出紀錄"} onClose={()=>setShowCostForm(false)}>
          <div className="form-group"><label className="label">種類</label><select className="input" value={costDraft.type} onChange={e=>setCostDraft({...costDraft,type:e.target.value})}>{COST_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div className="form-row">
            <div className="form-group"><label className="label">日期</label><input type="date" className="input" value={costDraft.date} onChange={e=>setCostDraft({...costDraft,date:e.target.value})}/></div>
            <div className="form-group"><label className="label">金額 (NT$)</label><input type="number" className="input" value={costDraft.amount} onChange={e=>setCostDraft({...costDraft,amount:e.target.value})}/></div>
          </div>
          <div className="form-group"><label className="label">備注</label><input className="input" value={costDraft.note} onChange={e=>setCostDraft({...costDraft,note:e.target.value})} placeholder="訂金、買貨、加盟…"/></div>
          <div className="flex gap-8 mt-12"><button className="btn btn-gold" onClick={saveCost}>{editingCostId?"儲存":"新增"}</button><button className="btn btn-ghost" onClick={()=>setShowCostForm(false)}>取消</button></div>
        </Modal>
      )}
    </div>
  );
}

// ─── Partners ─────────────────────────────────────────────────────
function Partners({ partners, setPartners, interactions, setInteractions, rawSave }) {
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState("info");
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [filter, setFilter] = useState("全部");
  const [sortBy, setSortBy] = useState("default");
  const [nameQuery, setNameQuery] = useState("");
  const [fieldFilters, setFieldFilters] = useState({
    gender: "全部",
    region: "全部",
    attribute: "全部",
    teamActivityFilled: "全部",
    warmupPhysicalFilled: "全部",
  });
  const [copied, setCopied] = useState(false);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [interactionDraft, setInteractionDraft] = useState(null);
  const [interactionEditMode, setInteractionEditMode] = useState("new"); // new | edit

  const csvInputRef = useRef(null);
  const [importModal, setImportModal] = useState(null); // { rows, skippedEmpty, errors, fileLabel }
  const [trashItems, setTrashItems] = useState([]);
  const [showTrash, setShowTrash] = useState(false);

  const nonUplines = partners.filter(p=>p.role!=="上線");
  const filterGroups = ["全部",...RECRUIT_ROLES];
  const filterableFields = [
    { key: "gender", label: "性別" },
    { key: "region", label: "地區" },
    { key: "attribute", label: "屬性" },
  ];
  const getFieldValue = (p, key) => String(p?.[key] ?? "").trim() || "—";
  const fieldOptions = filterableFields.reduce((acc, f) => {
    const vals = Array.from(new Set(nonUplines.map(p => getFieldValue(p, f.key)).filter(v => v !== "—")));
    acc[f.key] = ["全部", ...vals.sort((a,b)=>a.localeCompare(b,"zh-Hant"))];
    return acc;
  }, {});
  const filtered = nonUplines
    .filter(p => filter==="全部" ? true : p.role===filter)
    .filter(p => String(p.name || "").toLowerCase().includes(nameQuery.trim().toLowerCase()))
    .filter(p => filterableFields.every(f => {
      const fv = fieldFilters[f.key];
      return fv === "全部" ? true : getFieldValue(p, f.key) === fv;
    }))
    .filter(p => {
      const hasTeamActivity = String(p?.dateTeamActivity || "").trim() !== "";
      if (fieldFilters.teamActivityFilled === "有填寫") return hasTeamActivity;
      if (fieldFilters.teamActivityFilled === "空白") return !hasTeamActivity;
      return true;
    })
    .filter(p => {
      const hasWarmupPhysical = String(p?.dateWarmupPhysical || "").trim() !== "";
      if (fieldFilters.warmupPhysicalFilled === "有填寫") return hasWarmupPhysical;
      if (fieldFilters.warmupPhysicalFilled === "空白") return !hasWarmupPhysical;
      return true;
    })
    .sort((a, b) => {
      const aStalled = Boolean(a.warmupStalled);
      const bStalled = Boolean(b.warmupStalled);
      if (aStalled !== bStalled) return aStalled ? 1 : -1; // 暖身卡關者固定置底
      if (sortBy === "region-asc") return String(a.region||"").localeCompare(String(b.region||""), "zh-Hant");
      if (sortBy === "region-desc") return String(b.region||"").localeCompare(String(a.region||""), "zh-Hant");
      if (sortBy === "attribute-asc") return String(a.attribute||"").localeCompare(String(b.attribute||""), "zh-Hant");
      if (sortBy === "attribute-desc") return String(b.attribute||"").localeCompare(String(a.attribute||""), "zh-Hant");
      return 0;
    });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const rows = (await load(KEYS.partnersTrash)) || [];
      if (!mounted) return;
      setTrashItems(Array.isArray(rows) ? rows : []);
    })();
    return () => { mounted = false; };
  }, []);

  const resizeImageToAvatarDataUrl = async (file, { maxDim=256, quality=0.78 } = {}) => {
    const readAsDataUrl = (f) => new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(f);
    });

    const dataUrl = await readAsDataUrl(file);
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });

    const w = img.naturalWidth || img.width || 1;
    const h = img.naturalHeight || img.height || 1;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(img, 0, 0, cw, ch);
    // 圓形頭像，用 JPEG 壓縮可大幅降低體積
    return canvas.toDataURL("image/jpeg", quality);
  };

  const onPickPartnerPhoto = async (file) => {
    if (!file) return;
    setPhotoError("");
    const MAX_BYTES = 8 * 1024 * 1024; // 上限給「合理」處理，實際輸出會再壓縮
    if (file.size > MAX_BYTES) {
      setPhotoError("照片檔案太大，請選擇較小的圖片（建議 < 8MB）。");
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await resizeImageToAvatarDataUrl(file);
      setEditData((prev) => (prev ? { ...prev, photo: dataUrl } : prev));
    } catch {
      setPhotoError("照片處理失敗，請再試一次。");
    } finally {
      setPhotoBusy(false);
    }
  };

  const openNew = () => { setEditData({id:uid(),name:"",role:"暖身中",avatar:"",photo:"",attribute:"",painPoint:"",region:"",vacation:"",memo:"",gender:"",relation:"",age:"",occupation:"",salary:"",dateTalkVenue:"",dateTeamActivity:"",dateWarmupPhysical:"",dateProductCourse:"",warmupStalled:false,costs:[],abcNote:ABC_TEMPLATE,joined:new Date().toISOString().slice(0,10)}); setShowForm(true); };
  const openEdit = (p) => {
    const nextRole = p.role === "夥伴" ? "已加入" : p.role;
    setEditData({
      ...p,
      role: nextRole,
      attribute: p.attribute || "",
      painPoint: p.painPoint || "",
      region: p.region || "",
      vacation: p.vacation || "",
      memo: p.memo || p.notes || "",
      gender: p.gender || "",
      relation: p.relation || "",
      age: p.age ?? "",
      occupation: p.occupation || "",
      salary: p.salary == null || p.salary === "" ? "" : String(p.salary),
      dateTalkVenue: p.dateTalkVenue || "",
      dateTeamActivity: p.dateTeamActivity || "",
      dateWarmupPhysical: p.dateWarmupPhysical || "",
      dateProductCourse: p.dateProductCourse || "",
      warmupStalled: Boolean(p.warmupStalled),
      abcNote: p.abcNote || "",
    });
    setShowForm(true);
  };
  const saveP = () => {
    const entry={
      ...editData,
      avatar:editData.avatar||editData.name[0]||"?",
      photo:editData.photo||"",
      age: editData.age === "" ? "" : +editData.age,
      salary: String(editData.salary ?? "").trim(),
      dateTalkVenue: String(editData.dateTalkVenue ?? "").trim(),
      dateTeamActivity: String(editData.dateTeamActivity ?? "").trim(),
      dateWarmupPhysical: String(editData.dateWarmupPhysical ?? "").trim(),
      dateProductCourse: String(editData.dateProductCourse ?? "").trim(),
      warmupStalled: Boolean(editData.warmupStalled),
    };
    const next=partners.find(p=>p.id===entry.id)?partners.map(p=>p.id===entry.id?entry:p):[...partners,entry];
    setPartners(next); setShowForm(false);
  };
  const del = (id) => {
    const target = partners.find(p => p.id === id);
    if (!target) return;
    if (!window.confirm(`確定要刪除「${target.name}」嗎？`)) return;
    if (!window.confirm("最後確認：刪除後會先移到回收桶，可還原。是否繼續？")) return;
    const nextTrash = [{ ...target, deletedAt: new Date().toISOString() }, ...trashItems].slice(0, 300);
    setTrashItems(nextTrash);
    save(KEYS.partnersTrash, nextTrash);
    const next=partners.filter(p=>p.id!==id);
    setPartners(next);
    setSelected(null);
  };
  const restoreFromTrash = (id) => {
    const row = trashItems.find(x => x.id === id);
    if (!row) return;
    const exists = partners.some(p => p.id === row.id);
    const restored = { ...row };
    delete restored.deletedAt;
    if (exists) restored.id = uid();
    const nextPartners = [...partners, restored];
    const nextTrash = trashItems.filter(x => x.id !== id);
    setPartners(nextPartners);
    setTrashItems(nextTrash);
    save(KEYS.partnersTrash, nextTrash);
    setShowTrash(false);
  };
  const removeTrashItem = (id) => {
    const nextTrash = trashItems.filter(x => x.id !== id);
    setTrashItems(nextTrash);
    save(KEYS.partnersTrash, nextTrash);
  };
  const updateCosts = (updated) => {
    const next=partners.map(p=>p.id===updated.id?updated:p);
    setPartners(next); setSelected(updated); rawSave(next);
  };
  const updateAbcNote = (txt) => {
    const updated={...selected,abcNote:txt};
    const next=partners.map(p=>p.id===updated.id?updated:p);
    setPartners(next); setSelected(updated); rawSave(next);
  };
  const partnerInteractions = selected
    ? interactions
        .filter(i => {
          if (i.partnerId === selected.id) return true;
          if (i.type === "上線會議" && !i.partnerId) {
            const plan = mergeMeetingPlanFields(i.partnerPlan, i.actionItems);
            return selected.name && plan.includes(selected.name);
          }
          return false;
        })
        .sort((a, b) => {
          const todayMs = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
          const toMs = (s) => new Date(s + "T00:00:00").getTime();
          const da = Math.abs(toMs(a.date) - todayMs);
          const db = Math.abs(toMs(b.date) - todayMs);
          if (da !== db) return da - db; // 越接近今天越靠前
          return b.date.localeCompare(a.date); // 同距離再用較新的
        })
    : [];

  const normalizeTags = (t) => (t ? String(t).split(/[、,，]/).map(x=>x.trim()).filter(Boolean) : []);

  const openInteractionNew = () => {
    if (!selected) return;
    setInteractionEditMode("new");
    setInteractionDraft({
      id: uid(),
      date: new Date().toISOString().slice(0,10),
      time: nowHms(),
      partnerId: selected.id,
      type: "暖身",
      title: "",
      content: "",
      status: "待執行",
      tags: "",
      partnerPlan: "",
      actionItems: "",
      quote: "",
    });
    setShowInteractionForm(true);
  };

  const openInteractionEdit = (it) => {
    setInteractionEditMode("edit");
    setInteractionDraft({
      ...it,
      partnerId: it.type === "上線會議" ? (it.partnerId || "") : (selected?.id || it.partnerId),
      time: it.time ? normalizeTime(it.time) : "00:00:00",
      tags: Array.isArray(it.tags) ? it.tags.join("、") : (it.tags || ""),
      partnerPlan: it.type === "上線會議" ? mergeMeetingPlanFields(it.partnerPlan, it.actionItems) : (it.partnerPlan || ""),
      actionItems: it.type === "上線會議" ? "" : (it.actionItems || ""),
      quote: it.quote || "",
    });
    setShowInteractionForm(true);
  };

  const deleteInteraction = (id) => {
    if (!selected) return;
    const target = interactions.find(i=>i.id===id);
    let next = interactions.filter(i=>i.id!==id);
    // 若刪除上線會議，連帶刪除它自動產生的 規劃 行動項目（避免殘留）
    if (target?.type === "上線會議") {
      next = removeInteractionsSyncedFromMeeting(next, id);
      const prefix = `來自上線會議「${target.title}」的行動項目`;
      next = next.filter(i => !(i.type === "規劃" && i.content === prefix && (i.fromMeetingId === id || (!i.fromMeetingId && i.partnerId === selected.id))));
    }
    setInteractions(next);
    setShowInteractionForm(false);
  };

  const saveInteraction = () => {
    if (!selected || !interactionDraft) return;
    const tagsArr = normalizeTags(interactionDraft.tags);
    const entry = { ...interactionDraft, time: normalizeTime(interactionDraft.time), tags: tagsArr, partnerId: interactionDraft.type === "上線會議" ? "" : selected.id };
    if (entry.type === "上線會議") entry.actionItems = "";
    if (entry.type === "上線會議") {
      const unmatched = getUnmatchedMeetingPlanLines(entry.partnerPlan, partners);
      if (unmatched.length > 0) {
        const ok = window.confirm(`以下 ${unmatched.length} 行未匹配到夥伴姓名，將不會同步到特定夥伴，但仍會保留在行程紀錄：\n\n- ${unmatched.join("\n- ")}\n\n是否仍要儲存？`);
        if (!ok) return;
      }
    }

    // 新增/編輯互動主紀錄
    const hasId = interactions.some(i=>i.id===entry.id);
    let next = hasId ? interactions.map(i=>i.id===entry.id?entry:i) : [...interactions, entry];

    if (entry.type === "上線會議") {
      next = removeInteractionsSyncedFromMeeting(next, entry.id);
      next = [...next, ...buildMeetingPlanLineEntries(entry, partners)];
    }

    setInteractions(next);
    const field = scheduleFieldForType(entry.type);
    if (field && selected?.id) {
      const nextPartners = partners.map(p => (p.id === selected.id ? { ...p, [field]: entry.date } : p));
      setPartners(nextPartners);
      rawSave(nextPartners);
    }
    setShowInteractionForm(false);
  };

  const roleBadge = (role) => {
    if(role==="夥伴") role="已加入"; // 兼容舊資料
    const col=RECRUIT_COLOR[role]||"#aaa";
    return <span style={{display:"inline-block",padding:"2px 7px",borderRadius:5,fontSize:10,fontFamily:"'DM Mono',monospace",background:col+"18",border:`1px solid ${col}55`,color:col}}>{role}</span>;
  };

  const copyAbc = () => {
    navigator.clipboard.writeText(selected?.abcNote||"").then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  const onPickPartnerCsv = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parsePartnerCsvText(String(reader.result || ""));
      setImportModal({ ...parsed, fileLabel: f.name });
    };
    reader.onerror = () => setImportModal({ rows: [], skippedEmpty: 0, errors: ["無法讀取檔案"], fileLabel: f.name });
    reader.readAsText(f, "UTF-8");
  };

  const confirmPartnerImport = () => {
    if (!importModal?.rows?.length) {
      setImportModal(null);
      return;
    }
    setPartners([...partners, ...importModal.rows]);
    setImportModal(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-16" style={{ flexWrap: "wrap", gap: 12 }}>
        <h2 className="heading" style={{margin:0}}>人脈網絡 <span className="text-muted mono" style={{fontSize:12}}>({filtered.length})</span></h2>
        <div className="flex items-center gap-8" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={onPickPartnerCsv} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => csvInputRef.current?.click()}>📥 匯入 CSV</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowTrash(true)}>🗑 回收桶 {trashItems.length > 0 ? `(${trashItems.length})` : ""}</button>
          <button className="btn btn-gold btn-sm" onClick={openNew}>＋ 新增</button>
        </div>
      </div>
      <div className="flex items-center justify-between mb-14" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="flex items-center" style={{ flexWrap: "wrap", gap: 8 }}>
          {filterGroups.map(r=><button key={r} className={`btn btn-sm ${filter===r?"btn-gold":"btn-ghost"}`} onClick={()=>setFilter(r)}>{r}</button>)}
        </div>
        <div className="partner-filters-row" style={{ justifyContent: "flex-end" }}>
          <input className="input input-compact" style={{width:140,minWidth:140}} value={nameQuery} onChange={e=>setNameQuery(e.target.value)} placeholder="姓名搜尋"/>
          <select className="input input-compact" value={fieldFilters.gender} onChange={e=>setFieldFilters({...fieldFilters,gender:e.target.value})}>
            {(fieldOptions.gender || ["全部"]).map(v=><option key={v} value={v}>性別：{v}</option>)}
          </select>
          <select className="input input-compact" value={fieldFilters.region} onChange={e=>setFieldFilters({...fieldFilters,region:e.target.value})}>
            {(fieldOptions.region || ["全部"]).map(v=><option key={v} value={v}>地區：{v}</option>)}
          </select>
          <select className="input input-compact" value={fieldFilters.attribute} onChange={e=>setFieldFilters({...fieldFilters,attribute:e.target.value})}>
            {(fieldOptions.attribute || ["全部"]).map(v=><option key={v} value={v}>屬性：{v}</option>)}
          </select>
          <select className="input input-compact" value={fieldFilters.teamActivityFilled} onChange={e=>setFieldFilters({...fieldFilters,teamActivityFilled:e.target.value})}>
            {["全部","有填寫","空白"].map(v=><option key={v} value={v}>團隊活動：{v}</option>)}
          </select>
          <select className="input input-compact" value={fieldFilters.warmupPhysicalFilled} onChange={e=>setFieldFilters({...fieldFilters,warmupPhysicalFilled:e.target.value})}>
            {["全部","有填寫","空白"].map(v=><option key={v} value={v}>實體暖身：{v}</option>)}
          </select>
          <select className="input input-compact" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
            <option value="default">排序：預設</option>
            <option value="region-asc">排序：地區 A→Z</option>
            <option value="region-desc">排序：地區 Z→A</option>
            <option value="attribute-asc">排序：屬性 A→Z</option>
            <option value="attribute-desc">排序：屬性 Z→A</option>
          </select>
        </div>
      </div>
      <div className="grid-3">
        {filtered.map(p=>(
          <div key={p.id} className="partner-card" onClick={()=>{setSelected(p);setDetailTab("info");}}>
            <div className="flex items-center gap-10 mb-8">
              <div className="avatar" style={p.photo ? {overflow:"hidden"} : undefined}>
                {p.photo ? <img src={p.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/> : (p.avatar||p.name[0])}
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{p.name}</div>
                <div style={{marginTop:4,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {roleBadge(p.role)}
                  {p.warmupStalled && <span className="tag">暖身卡關</span>}
                </div>
              </div>
            </div>
            <div className="mb-6" style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {p.gender&&<span className="tag">{p.gender}</span>}
              {p.relation&&<span className="tag">{p.relation}</span>}
              {p.region&&<span className="tag">{p.region}</span>}
              {p.occupation&&<span className="tag">{p.occupation}</span>}
            </div>
            <div className="text-xs text-muted mono mb-4">年齡 {p.age||"—"} · 薪資 {p.salary != null && String(p.salary).trim() !== "" ? String(p.salary) : "—"}</div>
            {(p.costs||[]).length>0&&<div className="mono mt-4" style={{fontSize:11,color:"var(--red)"}}>投入 NT${(p.costs||[]).reduce((a,c)=>a+c.amount,0).toLocaleString()}</div>}
            {p.abcNote&&p.abcNote!==ABC_TEMPLATE&&<div className="tag tag-gold" style={{marginTop:6,display:"inline-block"}}>📋 已有ABC單</div>}
            <div className="flex gap-6 mt-10" onClick={e=>e.stopPropagation()}>
              <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(p)}>✏️ 編輯</button>
              <button className="btn btn-danger btn-sm" onClick={()=>del(p.id)}>刪除</button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selected&&(
        <Modal title="" onClose={()=>setSelected(null)} wide>
          <div className="flex items-center gap-12 mb-14">
            <div className="avatar avatar-lg" style={selected.photo ? {overflow:"hidden"} : undefined}>
              {selected.photo ? <img src={selected.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/> : (selected.avatar||selected.name[0])}
            </div>
            <div>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:var_gold}}>{selected.name}</h3>
              <div style={{marginTop:6}}>{roleBadge(selected.role)}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex" style={{borderBottom:"1.5px solid var(--border)",marginBottom:16}}>
            {[["info","📋 基本資料"],["log","🗓 互動"],["abc","⭐ ABC單"],["cost","💸 金費"]].map(([id,label])=>(
              <button key={id} className={`detail-tab${detailTab===id?" active":""}`} onClick={()=>setDetailTab(id)}>{label}</button>
            ))}
          </div>

          {/* Info tab */}
          {detailTab==="info"&&(
            <div>
              <div className="info-kv mb-10">
                {[
                  ["屬性", selected.attribute],
                  ["痛點需求", selected.painPoint],
                  ["地區", selected.region],
                  ["休假", selected.vacation],
                  ["性別", selected.gender],
                  ["關係", selected.relation],
                  ["年齡", selected.age !== "" && selected.age != null ? String(selected.age) : ""],
                  ["職業", selected.occupation],
                  ["薪資", selected.salary != null && String(selected.salary).trim() !== "" ? String(selected.salary) : ""],
                  ["加入名單", selected.joined ? fmtFullDate(selected.joined) : ""],
                  ["暖身卡關註記", selected.warmupStalled ? "是" : ""],
                  ["談場", selected.dateTalkVenue ? fmtFullDate(selected.dateTalkVenue) : ""],
                  ["團隊活動", selected.dateTeamActivity ? fmtFullDate(selected.dateTeamActivity) : ""],
                  ["實體暖身", selected.dateWarmupPhysical ? fmtFullDate(selected.dateWarmupPhysical) : ""],
                  ["產品課程", selected.dateProductCourse ? fmtFullDate(selected.dateProductCourse) : ""],
                ].map(([l, v]) => (
                  <div key={l} className="info-row">
                    <div className="info-label">{l}</div>
                    <div className="info-value">{v && String(v).trim() !== "" ? v : "—"}</div>
                  </div>
                ))}
              </div>
              {selected.memo&&<div className="card-sm"><div className="label">備註</div><div className="text-sm mt-6" style={{lineHeight:1.8}}>{selected.memo}</div></div>}
              <div className="flex gap-8 mt-14">
                <button className="btn btn-gold btn-sm" onClick={()=>{setSelected(null);openEdit(selected);}}>✏️ 編輯資料</button>
                <button className="btn btn-danger btn-sm" onClick={()=>del(selected.id)}>刪除</button>
              </div>
            </div>
          )}

          {/* ABC tab */}
          {detailTab==="abc"&&(
            <div>
              <div className="flex justify-between items-center mb-10">
                <div>
                  <div className="subheading" style={{margin:0}}>⭐ 澤澤稱奇 ABC單</div>
                  <div className="text-xs text-muted mt-6">填寫完成後複製傳給上線（刪除括弧說明文字）</div>
                </div>
                <button className="btn-copy" onClick={copyAbc}>{copied?"✓ 已複製！":"📋 複製全文"}</button>
              </div>
              <textarea
                className="input abc-note"
                style={{minHeight:380,fontFamily:"'DM Mono',monospace",fontSize:12,lineHeight:1.9}}
                value={selected.abcNote||ABC_TEMPLATE}
                onChange={e=>updateAbcNote(e.target.value)}
              />
              <div className="text-xs text-muted mt-8">✦ 自動儲存 · 內容愈詳細成交率愈高</div>
            </div>
          )}

          {/* Cost tab */}
          {detailTab==="cost"&&<CostSection partner={selected} onUpdate={updateCosts}/>}

          {/* Log tab */}
          {detailTab==="log"&&(
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="subheading" style={{margin:0}}>互動紀錄 ({partnerInteractions.length})</div>
                <button className="btn btn-gold btn-sm" onClick={openInteractionNew}>＋ 新增互動</button>
              </div>
              {partnerInteractions.length===0&&<div className="empty" style={{padding:"12px 0"}}>尚無互動紀錄</div>}
              {partnerInteractions.map(i=>(
                <div key={i.id} className="flex gap-8 mt-10">
                  <div className={`tl-dot type-${i.type}`} style={{marginTop:5}}/>
                  <div style={{flex:1}}>
                    <div className="flex items-center gap-6"><span className="text-sm" style={{fontWeight:600}}>{i.title}</span><span className={`status-badge status-${i.status}`}>{i.status}</span></div>
                    <div className="text-xs mono text-muted mt-3">{i.date} {normalizeTime(i.time)} · {i.type}</div>
                    {i.content&&<div className="text-sm text-muted mt-4" style={{lineHeight:1.7}}>{i.content}</div>}
                    {i.type==="上線會議"&&mergeMeetingPlanFields(i.partnerPlan,i.actionItems)&&(
                      <div className="text-sm text-muted mt-4 meeting-plan-read"><span className="label" style={{display:"block",marginBottom:4}}>具體規劃與待辦</span>{mergeMeetingPlanFields(i.partnerPlan,i.actionItems)}</div>
                    )}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end",flexShrink:0}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openInteractionEdit(i)}>✏️ 編輯</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>deleteInteraction(i.id)}>刪除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Interaction form (within partner detail -> (4)互動) */}
      {selected && showInteractionForm && interactionDraft && (
        <Modal title={interactionEditMode==="new"?"新增互動":"編輯互動"} onClose={()=>setShowInteractionForm(false)} wide>
          <div className="form-row">
            <div className="form-group"><label className="label">日期</label><input type="date" className="input" value={interactionDraft.date} onChange={e=>setInteractionDraft({...interactionDraft,date:e.target.value})}/></div>
            <div className="form-group"><label className="label">時間（時:分:秒）</label><input type="time" step="1" className="input" value={normalizeTime(interactionDraft.time)} onChange={e=>setInteractionDraft({...interactionDraft,time:e.target.value})}/></div>
            <div className="form-group"><label className="label">類型</label>
              <select className="input" value={interactionDraft.type} onChange={e=>setInteractionDraft({...interactionDraft,type:e.target.value})}>
                {["暖身","追蹤","規劃","上線會議","談場","團隊活動","實體暖身","產品課程","新人啟動"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label className="label">標題 *</label><input className="input" value={interactionDraft.title} onChange={e=>setInteractionDraft({...interactionDraft,title:e.target.value})}/></div>
          {interactionDraft.type !== "上線會議" ? (
            <div className="form-group"><label className="label">內容</label><textarea className="input" style={{minHeight:80}} value={interactionDraft.content||""} onChange={e=>setInteractionDraft({...interactionDraft,content:e.target.value})}/></div>
          ) : (
            <>
              <div className="form-group"><label className="label">討論主題 / 結論</label><textarea className="input" style={{minHeight:80}} value={interactionDraft.content||""} onChange={e=>setInteractionDraft({...interactionDraft,content:e.target.value})}/></div>
              <div className="form-group"><label className="label">具體規劃與待辦（一行一項）</label><textarea className="input" style={{minHeight:120,fontFamily:"'DM Mono',monospace",fontSize:12}} value={interactionDraft.partnerPlan||""} onChange={e=>setInteractionDraft({...interactionDraft,partnerPlan:e.target.value})} placeholder={"王思涵：本週約談場\n幫陳威宇整理獎金說明"}/>
                <div className="text-xs text-muted mt-6" style={{lineHeight:1.6}}>上線會議主紀錄不綁定單一夥伴；每行會成為一筆互動（依內容自動分類）。行內日期可用「4/7」「YYYY-MM-DD」「5月初」等，子筆落在該日；含人脈「姓名」（須與人脈網絡相同）者掛該夥伴，否則為個人行程。計畫中有出現本夥伴姓名時，該筆會議也會列在夥伴頁。</div>
              </div>
              <div className="form-group"><label className="label">上線金句 / 激勵話語</label><input className="input" value={interactionDraft.quote||""} onChange={e=>setInteractionDraft({...interactionDraft,quote:e.target.value})}/></div>
            </>
          )}
          <div className="form-row">
            <div className="form-group"><label className="label">狀態</label>
              <select className="input" value={interactionDraft.status} onChange={e=>setInteractionDraft({...interactionDraft,status:e.target.value})}>
                {["待執行","已完成"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="label">標籤（逗號/頓號分隔）</label><input className="input" value={interactionDraft.tags} onChange={e=>setInteractionDraft({...interactionDraft,tags:e.target.value})}/></div>
          </div>
          <div className="flex gap-8 mt-12"><button className="btn btn-gold" onClick={saveInteraction}>儲存</button><button className="btn btn-ghost" onClick={()=>setShowInteractionForm(false)}>取消</button></div>
        </Modal>
      )}

      {importModal && (
        <Modal title="匯入人脈 CSV" onClose={() => setImportModal(null)}>
          <div className="text-xs text-muted mb-10" style={{ lineHeight: 1.7 }}>
            請在 Excel <strong>另存新檔 → CSV UTF-8（逗號分隔）</strong>；若欄位內容含逗號，Excel 會自動加引號，本工具可解析。
            第一列請使用下列標題（順序可調，<strong>姓名</strong> 必填）：
          </div>
          <ul className="text-sm mono mb-14" style={{ lineHeight: 1.8, paddingLeft: 18, color: "var(--text2)" }}>
            {PARTNER_CSV_COLUMNS_DOC.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {importModal.fileLabel && (
            <div className="text-sm mb-8">
              檔案：<span className="mono">{importModal.fileLabel}</span>
            </div>
          )}
          {importModal.errors?.length > 0 && (
            <div className="card-sm mb-10" style={{ borderColor: "var(--red)", background: "rgba(192,57,43,0.06)" }}>
              {importModal.errors.map((err) => (
                <div key={err} className="text-sm" style={{ color: "var(--red)" }}>
                  {err}
                </div>
              ))}
            </div>
          )}
          {importModal.rows?.length > 0 && (
            <div className="text-sm mb-10">
              可匯入 <strong>{importModal.rows.length}</strong> 筆（將附加到現有名單）
              {importModal.skippedEmpty > 0 && (
                <span className="text-muted"> · 已略過 {importModal.skippedEmpty} 列（無姓名）</span>
              )}
            </div>
          )}
          <div className="flex gap-8">
            <button
              type="button"
              className="btn btn-gold"
              disabled={!importModal.rows?.length}
              onClick={confirmPartnerImport}
            >
              確認匯入
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setImportModal(null)}>
              取消
            </button>
          </div>
        </Modal>
      )}

      {showTrash && (
        <Modal title="人脈回收桶" onClose={() => setShowTrash(false)}>
          {trashItems.length === 0 && <div className="empty">目前沒有可還原的夥伴</div>}
          {trashItems.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              {trashItems.map((p) => (
                <div key={p.id} className="timeline-item">
                  <div style={{flex:1}}>
                    <div className="flex items-center gap-6" style={{flexWrap:"wrap"}}>
                      <span style={{fontWeight:600,fontSize:14}}>{p.name || "未命名"}</span>
                      <span className="tag">{p.role || "未分類"}</span>
                    </div>
                    <div className="text-xs mono mt-4" style={{color:"var(--text3)"}}>
                      刪除時間：{p.deletedAt ? new Date(p.deletedAt).toLocaleString("zh-TW") : "—"}
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-gold btn-sm" onClick={() => restoreFromTrash(p.id)}>還原</button>
                    <button className="btn btn-danger btn-sm" onClick={() => removeTrashItem(p.id)}>永久刪除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Edit form */}
      {showForm&&editData&&(
        <Modal title={partners.find(p=>p.id===editData.id)?"編輯夥伴":"新增夥伴"} onClose={()=>setShowForm(false)}>
          <div className="form-row">
            <div className="form-group"><label className="label">姓名 *</label><input className="input" value={editData.name} onChange={e=>setEditData({...editData,name:e.target.value})}/></div>
            <div className="form-group"><label className="label">身份/狀態</label>
              <select className="input" value={editData.role} onChange={e=>setEditData({...editData,role:e.target.value})}>
                {NON_UPLINE_ROLES.map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="label">屬性</label><input className="input" value={editData.attribute} onChange={e=>setEditData({...editData,attribute:e.target.value})}/></div>
            <div className="form-group"><label className="label">痛點需求</label><input className="input" value={editData.painPoint} onChange={e=>setEditData({...editData,painPoint:e.target.value})}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="label">地區</label><input className="input" value={editData.region} onChange={e=>setEditData({...editData,region:e.target.value})}/></div>
            <div className="form-group"><label className="label">休假</label><input className="input" value={editData.vacation} onChange={e=>setEditData({...editData,vacation:e.target.value})}/></div>
          </div>
          <div className="form-group">
            <label className="label">暖身卡關註記（已聊天但尚未約出實體見面）</label>
            <label className="text-sm" style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" checked={Boolean(editData.warmupStalled)} onChange={e=>setEditData({...editData,warmupStalled:e.target.checked})}/>
              排序置底
            </label>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="label">性別</label><input className="input" value={editData.gender} onChange={e=>setEditData({...editData,gender:e.target.value})}/></div>
            <div className="form-group"><label className="label">關係</label><input className="input" value={editData.relation} onChange={e=>setEditData({...editData,relation:e.target.value})}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="label">年齡</label><input type="number" className="input" value={editData.age} onChange={e=>setEditData({...editData,age:e.target.value})}/></div>
            <div className="form-group"><label className="label">職業</label><input className="input" value={editData.occupation} onChange={e=>setEditData({...editData,occupation:e.target.value})}/></div>
          </div>
          <div className="form-group"><label className="label">薪資</label><input type="text" className="input" value={editData.salary} onChange={e=>setEditData({...editData,salary:e.target.value})} placeholder="例：NT$45,000、5萬/月、面議"/></div>
          <div className="form-row">
            <div className="form-group"><label className="label">談場（日期）</label><input type="date" className="input" value={editData.dateTalkVenue || ""} onChange={e=>setEditData({...editData,dateTalkVenue:e.target.value})}/></div>
            <div className="form-group"><label className="label">團隊活動</label><input type="date" className="input" value={editData.dateTeamActivity || ""} onChange={e=>setEditData({...editData,dateTeamActivity:e.target.value})}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="label">實體暖身</label><input type="date" className="input" value={editData.dateWarmupPhysical || ""} onChange={e=>setEditData({...editData,dateWarmupPhysical:e.target.value})}/></div>
            <div className="form-group"><label className="label">產品課程</label><input type="date" className="input" value={editData.dateProductCourse || ""} onChange={e=>setEditData({...editData,dateProductCourse:e.target.value})}/></div>
          </div>
          <div className="form-group">
            <label className="label">上傳照片（可選）</label>
            {editData.photo && (
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <div className="avatar" style={{width:54,height:54,overflow:"hidden"}}>
                  <img src={editData.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                </div>
                <button className="btn btn-danger btn-sm" onClick={()=>setEditData({...editData,photo:""})}>移除</button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="input"
              disabled={photoBusy}
              onChange={e=>onPickPartnerPhoto(e.target.files?.[0])}
            />
            {photoError && <div className="text-xs" style={{color:"var(--red)",marginTop:6}}>{photoError}</div>}
            <div className="text-xs text-muted mt-4">照片會存到資料庫；建議選擇小檔並以頭像用途為主。</div>
          </div>
          <div className="form-group"><label className="label">備註</label><textarea className="input" value={editData.memo} onChange={e=>setEditData({...editData,memo:e.target.value})}/></div>
          <div className="flex gap-8 mt-8"><button className="btn btn-gold" onClick={saveP}>儲存</button><button className="btn btn-ghost" onClick={()=>setShowForm(false)}>取消</button></div>
        </Modal>
      )}
    </div>
  );
}

// ─── CostSection ──────────────────────────────────────────────────
function CostSection({ partner, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({date:new Date().toISOString().slice(0,10),type:"買貨",amount:"",note:""});
  const costs = partner.costs||[];
  const total = costs.reduce((a,c)=>a+c.amount,0);
  const addCost = () => { if(!draft.amount)return; onUpdate({...partner,costs:[...costs,{...draft,id:uid(),amount:+draft.amount}]}); setDraft({date:new Date().toISOString().slice(0,10),type:"買貨",amount:"",note:""}); setShowAdd(false); };
  const delCost = (id) => onUpdate({...partner,costs:costs.filter(c=>c.id!==id)});
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div className="subheading" style={{margin:0}}>投入金費{total>0&&<span className="mono" style={{marginLeft:8,color:"var(--red)",fontSize:11}}>共 NT${total.toLocaleString()}</span>}</div>
        <button className="btn btn-ghost btn-sm" onClick={()=>setShowAdd(!showAdd)}>＋</button>
      </div>
      {showAdd&&(
        <div className="card-sm mb-8" style={{borderColor:"var(--gold-border)"}}>
          <div className="form-row"><div className="form-group"><label className="label">日期</label><input type="date" className="input" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></div><div className="form-group"><label className="label">種類</label><select className="input" value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value})}>{COST_TYPES.map(t=><option key={t}>{t}</option>)}</select></div></div>
          <div className="form-row"><div className="form-group"><label className="label">金額 (NT$)</label><input type="number" className="input" value={draft.amount} onChange={e=>setDraft({...draft,amount:e.target.value})}/></div><div className="form-group"><label className="label">備注</label><input className="input" value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></div></div>
          <div className="flex gap-8"><button className="btn btn-gold btn-sm" onClick={addCost}>新增</button><button className="btn btn-ghost btn-sm" onClick={()=>setShowAdd(false)}>取消</button></div>
        </div>
      )}
      {costs.length===0&&!showAdd&&<div className="text-sm text-muted">尚無投入紀錄</div>}
      {costs.length>0&&(
        <div style={{border:"1px solid var(--border)",borderRadius:8,overflow:"hidden"}}>
          <div className="flex" style={{background:"var(--bg3)",padding:"5px 10px",borderBottom:"1px solid var(--border)"}}>
            {["日期","種類","金額","備注",""].map((h,i)=><div key={i} className="mono" style={{fontSize:9,color:"var(--text3)",flex:i===3?2:1,minWidth:i===4?24:0}}>{h}</div>)}
          </div>
          {costs.map((c,i)=>(
            <div key={c.id} className="flex items-center" style={{padding:"7px 10px",borderBottom:i<costs.length-1?"1px solid var(--border)":"none"}}>
              <div className="mono text-xs text-muted" style={{flex:1}}>{c.date}</div>
              <div style={{flex:1}}><span style={{fontSize:9,padding:"1px 5px",borderRadius:3,border:`1px solid ${TYPE_COLOR[c.type]||"#ccc"}`,color:TYPE_COLOR[c.type]||"#888",fontFamily:"'DM Mono',monospace"}}>{c.type}</span></div>
              <div className="mono" style={{flex:1,color:"var(--red)",fontSize:11}}>NT${c.amount.toLocaleString()}</div>
              <div className="text-xs text-muted" style={{flex:2}}>{c.note||"—"}</div>
              <button style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",minWidth:24,fontSize:12}} onClick={()=>delCost(c.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────
function Timeline({ interactions, setInteractions, partners, setPartners }) {
  const [filter, setFilter] = useState("全部");
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState(null); // { partnerId, fromField, type, date }
  const [partnerSearch, setPartnerSearch] = useState("");
  const [calMonth, setCalMonth] = useState(()=>{ const n=new Date(); return {y:n.getFullYear(),m:n.getMonth()}; });

  const sortByNearToday = (a, b) => {
    const todayMs = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
    const da = Math.abs(toMsDT(a.date, a.time) - todayMs);
    const db = Math.abs(toMsDT(b.date, b.time) - todayMs);
    if (da !== db) return da - db; // 越接近今天越上面
    return toMsDT(b.date, b.time) - toMsDT(a.date, a.time); // 同距離：較新的在前
  };
  const getP = (id) => partners.find(p=>p.id===id);
  const nonUplinePartners = partners.filter(p=>p.role!=="上線");
  const filteredPartnerOptions = nonUplinePartners.filter(p => p.name.includes(partnerSearch.trim()));
  const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  const interactionScheduleSet = new Set(
    interactions
      .filter(i => SCHEDULE_TYPES.includes(i.type) && i.partnerId && i.date)
      .map(i => `${i.partnerId}|${i.type}|${i.date}`)
  );
  const partnerScheduleItems = partners
    .filter(p => p.role !== "上線")
    .flatMap((p) => ([
      p.dateTalkVenue && isYmd(p.dateTalkVenue) ? {
        id: `ps-talk-${p.id}`,
        date: p.dateTalkVenue,
        time: "00:00:00",
        partnerId: p.id,
        type: "談場",
        title: "談場",
        status: "",
        isPartnerSchedule: true,
        sourceField: "dateTalkVenue",
      } : null,
      p.dateTeamActivity && isYmd(p.dateTeamActivity) ? {
        id: `ps-team-${p.id}`,
        date: p.dateTeamActivity,
        time: "00:00:00",
        partnerId: p.id,
        type: "團隊活動",
        title: "團隊活動",
        status: "",
        isPartnerSchedule: true,
        sourceField: "dateTeamActivity",
      } : null,
      p.dateWarmupPhysical && isYmd(p.dateWarmupPhysical) ? {
        id: `ps-warm-${p.id}`,
        date: p.dateWarmupPhysical,
        time: "00:00:00",
        partnerId: p.id,
        type: "實體暖身",
        title: "實體暖身",
        status: "",
        isPartnerSchedule: true,
        sourceField: "dateWarmupPhysical",
      } : null,
      p.dateProductCourse && isYmd(p.dateProductCourse) ? {
        id: `ps-course-${p.id}`,
        date: p.dateProductCourse,
        time: "00:00:00",
        partnerId: p.id,
        type: "產品課程",
        title: "產品課程",
        status: "",
        isPartnerSchedule: true,
        sourceField: "dateProductCourse",
      } : null,
    ])).filter(Boolean)
    .filter(it => !interactionScheduleSet.has(`${it.partnerId}|${it.type}|${it.date}`));
  const calendarItems = [...interactions, ...partnerScheduleItems];
  const filteredItems = filter==="全部"?calendarItems:filter==="待執行"?calendarItems.filter(i=>i.status==="待執行"):calendarItems.filter(i=>i.type===filter);
  /** 由上線會議「具體規劃」拆出的子筆規劃：月曆格子仍顯示，本月紀錄不重複列出 */
  const isDerivedMeetingPlanLine = (i) => i.fromMeetingId != null && String(i.fromMeetingId).trim() !== "";
  const timelineListItems = filteredItems.filter(i => !isDerivedMeetingPlanLine(i));

  const TIMELINE_STAT_TYPES = ["上線會議", "暖身", "追蹤", "規劃", "談場", "團隊活動", "實體暖身", "產品課程", "新人啟動"];
  const monthStatsPrefix = `${calMonth.y}-${String(calMonth.m + 1).padStart(2, "0")}`;
  const monthStatsItems = calendarItems.filter(i => i.date && String(i.date).startsWith(monthStatsPrefix));
  const monthTypeCounts = monthStatsItems.reduce((acc, i) => {
    const t = i.type || "其他";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const monthStatsDisplay = [
    ...TIMELINE_STAT_TYPES.filter((t) => (monthTypeCounts[t] || 0) > 0).map((t) => ({ type: t, count: monthTypeCounts[t] })),
    ...Object.keys(monthTypeCounts)
      .filter((t) => !TIMELINE_STAT_TYPES.includes(t) && monthTypeCounts[t] > 0)
      .sort((a, b) => a.localeCompare(b, "zh-Hant"))
      .map((t) => ({ type: t, count: monthTypeCounts[t] })),
  ];

  const openNew = () => { setEditData({id:uid(),date:new Date().toISOString().slice(0,10),time:nowHms(),partnerId:"",type:"暖身",title:"暖身",content:"",status:"待執行",tags:"",partnerPlan:"",actionItems:"",quote:""}); setPartnerSearch(""); setShowForm(true); };
  const saveItem = () => {
    const entry = {
      ...editData,
      time: normalizeTime(editData.time),
      tags: editData.tags ? editData.tags.split(/[、,，]/).map(t => t.trim()).filter(Boolean) : [],
      partnerId: editData.type === "上線會議" ? "" : (editData.partnerId || ""),
    };
    if (entry.type === "上線會議") entry.actionItems = "";
    if (entry.type === "上線會議") {
      const unmatched = getUnmatchedMeetingPlanLines(entry.partnerPlan, partners);
      if (unmatched.length > 0) {
        const ok = window.confirm(`以下 ${unmatched.length} 行未匹配到夥伴姓名，將不會同步到特定夥伴，但仍會保留在行程紀錄：\n\n- ${unmatched.join("\n- ")}\n\n是否仍要儲存？`);
        if (!ok) return;
      }
    }
    let next = interactions.find(i => i.id === entry.id) ? interactions.map(i => i.id === entry.id ? entry : i) : [...interactions, entry];
    if (entry.type === "上線會議") {
      next = removeInteractionsSyncedFromMeeting(next, entry.id);
      next = [...next, ...buildMeetingPlanLineEntries(entry, partners)];
    }
    const field = scheduleFieldForType(entry.type);
    if (field && entry.partnerId) {
      const nextPartners = partners.map(p => (p.id === entry.partnerId ? { ...p, [field]: entry.date } : p));
      setPartners(nextPartners);
    }
    setInteractions(next); setShowForm(false);
  };
  const del = (id) => {
    const target = interactions.find(i=>i.id===id);
    let next = interactions.filter(i=>i.id!==id);
    if (target?.type === "上線會議") {
      next = removeInteractionsSyncedFromMeeting(next, id);
      const prefix = `來自上線會議「${target.title}」的行動項目`;
      next = next.filter(i => !(i.type === "規劃" && i.content === prefix));
    }
    setInteractions(next); setSelected(null);
  };
  const toggle = (id) => setInteractions(interactions.map(i=>i.id===id?{...i,status:i.status==="已完成"?"待執行":"已完成"}:i));
  const openScheduleEdit = (it) => {
    if (!it?.isPartnerSchedule) return;
    setScheduleDraft({ partnerId: it.partnerId, fromField: it.sourceField, type: it.type, date: it.date });
  };
  const saveSchedule = () => {
    if (!scheduleDraft?.partnerId) return;
    const toField = scheduleFieldForType(scheduleDraft.type);
    if (!toField) return;
    const next = partners.map(p => {
      if (p.id !== scheduleDraft.partnerId) return p;
      const updated = { ...p };
      if (scheduleDraft.fromField && scheduleDraft.fromField !== toField) updated[scheduleDraft.fromField] = "";
      updated[toField] = scheduleDraft.date || "";
      return updated;
    });
    setPartners(next);
    setScheduleDraft(null);
    setSelected(null);
  };
  const deleteSchedule = () => {
    if (!scheduleDraft?.partnerId || !scheduleDraft.fromField) return;
    const next = partners.map(p => (p.id === scheduleDraft.partnerId ? { ...p, [scheduleDraft.fromField]: "" } : p));
    setPartners(next);
    setScheduleDraft(null);
    setSelected(null);
  };

  // Calendar helpers
  const calDays = () => {
    const {y,m}=calMonth;
    const first=new Date(y,m,1).getDay();
    const days=new Date(y,m+1,0).getDate();
    const cells=[];
    for(let i=0;i<first;i++) cells.push({date:new Date(y,m,i-first+1),cur:false});
    for(let i=1;i<=days;i++) cells.push({date:new Date(y,m,i),cur:true});
    while(cells.length%7) cells.push({date:new Date(y,m+1,cells.length-days-first+1),cur:false});
    return cells;
  };
  const today=dk(new Date());
  const iMap=filteredItems.reduce((acc,i)=>{ (acc[i.date]=acc[i.date]||[]).push(i); return acc; },{});

  return (
    <div>
      <div className="flex items-start justify-between mb-14" style={{ gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="heading" style={{ margin: 0 }}>互動時間軸</h2>
          <div className="text-sm mt-8" style={{ color: "var(--text2)", lineHeight: 1.7 }}>
            <span className="text-muted" style={{ fontSize: 12, marginRight: 10 }}>{calMonth.y} 年 {calMonth.m + 1} 月 · 分類統計</span>
            {monthStatsDisplay.length === 0 ? (
              <span className="text-muted" style={{ fontSize: 12 }}>尚無紀錄</span>
            ) : (
              <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center" }}>
                {monthStatsDisplay.map(({ type, count }) => (
                  <span key={type} style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, whiteSpace: "nowrap" }}>
                    {type} <span style={{ color: "var(--gold)", fontWeight: 700 }}>{count}</span>
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-8" style={{ flexShrink: 0 }}>
          <button className="btn btn-gold btn-sm" onClick={openNew}>＋ 新增</button>
        </div>
      </div>

      {/* 月曆（唯一檢視）：分類篩選 + 格線 + 本月紀錄 */}
      <div>
          <div className="flex gap-8 mb-14" style={{flexWrap:"wrap"}}>
            {["全部","待執行","上線會議","暖身","追蹤","規劃","談場","團隊活動","實體暖身","產品課程","新人啟動"].map(f=><button key={f} className={`btn btn-sm ${filter===f?"btn-gold":"btn-ghost"}`} style={f==="上線會議"&&filter!==f?{borderColor:"#c4b5fd",color:"var(--purple)"}:{}} onClick={()=>setFilter(f)}>{f}</button>)}
          </div>
          <div className="flex items-center justify-between mb-12">
            <button className="btn btn-ghost btn-sm" onClick={()=>setCalMonth(p=>{const d=new Date(p.y,p.m-1);return{y:d.getFullYear(),m:d.getMonth()};})}>‹ 上月</button>
            <span style={{fontFamily:"'Playfair Display',serif",color:var_gold,fontSize:18}}>{calMonth.y} 年 {calMonth.m+1} 月</span>
            <button className="btn btn-ghost btn-sm" onClick={()=>setCalMonth(p=>{const d=new Date(p.y,p.m+1);return{y:d.getFullYear(),m:d.getMonth()};})}>下月 ›</button>
          </div>
          {/* Day headers */}
          <div className="cal-grid" style={{marginBottom:3}}>
            {["日","一","二","三","四","五","六"].map(d=><div key={d} className="mono" style={{textAlign:"center",fontSize:10,color:"var(--text3)",padding:"3px 0"}}>{d}</div>)}
          </div>
          {/* Calendar grid */}
          <div className="cal-grid" style={{marginBottom:20}}>
            {calDays().map((cell,i)=>{
              const k=dk(cell.date);
              const dayItems=iMap[k]||[];
              const todayMs = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
              const dayItemsSorted = [...dayItems].sort((a, b) => {
                const da = Math.abs(toMsDT(a.date, a.time) - todayMs);
                const db = Math.abs(toMsDT(b.date, b.time) - todayMs);
                if (da !== db) return da - db; // 越接近今天越靠上
                const d = b.date.localeCompare(a.date); // 距離相同：較新的在前
                if (d !== 0) return d;
                return normalizeTime(b.time).localeCompare(normalizeTime(a.time)); // 同日：較晚時間在前
              });
              return (
                <div key={i} className={`cal-cell${k===today?" today":""}${!cell.cur?" other-month":""}`}>
                  <div className="mono" style={{fontSize:10,color:k===today?var_gold:"var(--text3)",marginBottom:2,fontWeight:k===today?700:400}}>{cell.date.getDate()}</div>
                  {dayItemsSorted.slice(0,3).map(it=>{
                    const p=getP(it.partnerId);
                    return (
                      <div key={it.id} className={`cal-event type-${it.type}`} onClick={()=>setSelected(it)} title={`${it.title} ${p?`· ${p.name}`:""} ${it.date} ${normalizeTime(it.time)}`}>
                        {it.title}{p?` · ${p.name}`:""}
                      </div>
                    );
                  })}
                  {dayItemsSorted.length>3&&<div style={{fontSize:8,color:"var(--text3)"}}>+{dayItemsSorted.length-3}</div>}
                </div>
              );
            })}
          </div>
          {/* 本月紀錄：不列出上線會議拆出的子筆規劃，避免與主紀錄重複 */}
          <div className="subheading">本月紀錄</div>
          <div className="card" style={{padding:0}}>
            {(() => {
              const monthPrefix = `${calMonth.y}-${String(calMonth.m+1).padStart(2,"0")}`;
              const monthRows = [...timelineListItems].filter(i => i.date.startsWith(monthPrefix)).sort(sortByNearToday);
              if (monthRows.length === 0) return <div className="empty">本月尚無紀錄</div>;
              return monthRows.map(item=>{
                const p=getP(item.partnerId);
                return (
                  <div key={item.id} className="timeline-item" onClick={()=>setSelected(item)}>
                    <div className={`tl-dot type-${item.type}`}/>
                    <div style={{flex:1}}>
                      <div className="flex items-center gap-6" style={{flexWrap:"wrap"}}>
                        <span style={{fontWeight:600,fontSize:13}}>{item.title}</span>
                        {!item.isPartnerSchedule && <span className={`status-badge status-${item.status}`}>{item.status}</span>}
                        <span className="tag">{item.type}</span>
                      </div>
                      <div className="text-xs mono text-muted mt-3">{item.date} {normalizeTime(item.time)}{p&&<span> · {p.name}</span>}</div>
                    </div>
                    {!item.isPartnerSchedule && <button className={`btn btn-sm ${item.status==="已完成"?"btn-gold":"btn-ghost"}`} style={{flexShrink:0,alignSelf:"flex-start"}} onClick={e=>{e.stopPropagation();toggle(item.id);}}>{item.status==="已完成"?"✓":"○"}</button>}
                  </div>
                );
              });
            })()}
          </div>
      </div>

      {/* Detail modal */}
      {selected&&(
        <Modal title={selected.title} onClose={()=>setSelected(null)}>
          <div className="flex gap-8 mb-10">
            {!selected.isPartnerSchedule && <span className={`status-badge status-${selected.status}`}>{selected.status}</span>}
            <span className="tag" style={selected.type==="上線會議"?{background:"#f5f3ff",borderColor:"#c4b5fd",color:"var(--purple)"}:{}}>{selected.type}</span>
          </div>
          {selected.content&&<div className={`text-sm${selected.type==="上線會議"?" meeting-plan-read":""}`} style={selected.type==="上線會議"?undefined:{lineHeight:1.8}}>{selected.content}</div>}
          {selected.isPartnerSchedule&&(
            <div className="text-sm text-muted" style={{lineHeight:1.7}}>
              來源：人脈基本資料日期欄位
            </div>
          )}
          {selected.type==="上線會議"&&mergeMeetingPlanFields(selected.partnerPlan, selected.actionItems)&&(
            <div className="card-sm mt-10" style={{textAlign:"left"}}><div className="label">具體規劃與待辦</div><div className="text-sm mt-5 meeting-plan-read">{mergeMeetingPlanFields(selected.partnerPlan, selected.actionItems)}</div></div>
          )}
          {selected.type==="上線會議"&&selected.quote&&(
            <div style={{background:"#f5f3ff",border:"1px solid #c4b5fd",borderRadius:8,padding:"10px 14px",marginTop:10}}>
              <div className="label" style={{color:"var(--purple)",marginBottom:4}}>💬 上線金句</div>
              <div style={{fontSize:13,color:"var(--purple)",fontStyle:"italic",lineHeight:1.8}}>「{selected.quote}」</div>
            </div>
          )}
          {selected.type!=="上線會議"&&selected.partnerId&&<div className="mt-8 text-sm text-muted">夥伴：{getP(selected.partnerId)?.name}</div>}
          <div className="mono text-xs text-muted mt-8">{selected.date}</div>
          <div className="divider"/>
          {selected.isPartnerSchedule ? (
            <div className="flex gap-8">
              <button className="btn btn-gold btn-sm" onClick={()=>{ openScheduleEdit(selected); }}>編輯</button>
              <button className="btn btn-danger btn-sm" onClick={()=>{
                const field = selected.sourceField || scheduleFieldForType(selected.type);
                if (!field || !selected.partnerId) return;
                const next = partners.map(p => (p.id === selected.partnerId ? { ...p, [field]: "" } : p));
                setPartners(next);
                setSelected(null);
              }}>清除日期</button>
            </div>
          ) : (
            <div className="flex gap-8">
              <button className="btn btn-gold btn-sm" onClick={()=>{ setSelected(null); setEditData({...selected,tags:Array.isArray(selected.tags)?selected.tags.join("、"):selected.tags,partnerPlan:selected.type==="上線會議"?mergeMeetingPlanFields(selected.partnerPlan,selected.actionItems):(selected.partnerPlan||""),actionItems:selected.type==="上線會議"?"":(selected.actionItems||""),quote:selected.quote||""}); setPartnerSearch(getP(selected.partnerId)?.name || ""); setShowForm(true); }}>編輯</button>
              <button className="btn btn-danger btn-sm" onClick={()=>del(selected.id)}>刪除</button>
            </div>
          )}
        </Modal>
      )}

      {scheduleDraft && (
        <Modal title="編輯行程（來自人脈基本資料）" onClose={()=>setScheduleDraft(null)}>
          <div className="form-row">
            <div className="form-group">
              <label className="label">類型</label>
              <select className="input" value={scheduleDraft.type} onChange={e=>setScheduleDraft({...scheduleDraft,type:e.target.value})}>
                {SCHEDULE_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">日期</label>
              <input type="date" className="input" value={scheduleDraft.date || ""} onChange={e=>setScheduleDraft({...scheduleDraft,date:e.target.value})}/>
            </div>
          </div>
          <div className="flex gap-8 mt-12">
            <button className="btn btn-gold" onClick={saveSchedule}>儲存</button>
            <button className="btn btn-danger" onClick={deleteSchedule}>清除日期</button>
            <button className="btn btn-ghost" onClick={()=>setScheduleDraft(null)}>取消</button>
          </div>
        </Modal>
      )}

      {showForm&&editData&&(
        <Modal title={`${interactions.find(i=>i.id===editData.id)?"編輯":"新增"}紀錄`} onClose={()=>setShowForm(false)} wide>
          <div className="form-row">
            <div className="form-group"><label className="label">日期</label><input type="date" className="input" value={editData.date} onChange={e=>setEditData({...editData,date:e.target.value})}/></div>
            <div className="form-group"><label className="label">時間（時:分:秒）</label><input type="time" step="1" className="input" value={normalizeTime(editData.time)} onChange={e=>setEditData({...editData,time:e.target.value})}/></div>
            <div className="form-group"><label className="label">類型</label>
              <select
                className="input"
                value={editData.type}
                onChange={e=>setEditData(prev=>{
                  const nextType = e.target.value;
                  const isEditing = interactions.some(i => i.id === prev.id);
                  const currentTitle = String(prev.title || "").trim();
                  const shouldAutoFillTitle = !isEditing || !currentTitle || currentTitle === prev.type;
                  return {
                    ...prev,
                    type: nextType,
                    title: shouldAutoFillTitle ? nextType : prev.title,
                    partnerId: nextType === "上線會議" ? "" : prev.partnerId,
                  };
                })}
              >
                {["暖身","追蹤","規劃","上線會議","談場","團隊活動","實體暖身","產品課程","新人啟動"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label className="label">標題 *</label><input className="input" value={editData.title} onChange={e=>setEditData({...editData,title:e.target.value})} placeholder={editData.type==="上線會議"?"例：04/05 與林佳蓉討論四月計畫":""}/>
          </div>

          {editData.type !== "上線會議" && (
            <div className="form-group">
              <label className="label">關聯夥伴</label>
              <input className="input" value={partnerSearch} onChange={e=>setPartnerSearch(e.target.value)} placeholder="輸入姓名關鍵字篩選"/>
              <select className="input mt-6" value={editData.partnerId} onChange={e=>setEditData({...editData,partnerId:e.target.value})}>
                <option value="">（無）</option>
                {filteredPartnerOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* 上線會議專屬欄位 */}
          {editData.type==="上線會議"?(
            <div style={{background:"#f5f3ff",border:"1.5px solid #c4b5fd",borderRadius:10,padding:"14px 16px",marginBottom:12}}>
              <div className="subheading" style={{color:"var(--purple)",marginBottom:10}}>🟣 上線會議專屬紀錄</div>
              <div className="form-group"><label className="label">討論主題 / 結論</label><textarea className="input" style={{minHeight:80}} value={editData.content||""} onChange={e=>setEditData({...editData,content:e.target.value})} placeholder="今天討論了什麼？結論是什麼？"/></div>
              <div className="form-group"><label className="label">具體規劃與待辦（一行一項）</label><textarea className="input" style={{minHeight:120,fontFamily:"'DM Mono',monospace",fontSize:12}} value={editData.partnerPlan||""} onChange={e=>setEditData({...editData,partnerPlan:e.target.value})} placeholder={"王思涵：本週約談場\n幫陳威宇整理獎金說明"}/>
                <div className="text-xs text-muted mt-6" style={{lineHeight:1.6}}>上線會議不綁定關聯夥伴；每行會成為一筆互動（依內容自動分類，如暖身／談場／團隊活動等）。行內日期支援「4/7」「YYYY-MM-DD」「5月初」等，子筆會落在該日；含人脈姓名者掛該夥伴，否則為個人行程。</div>
              </div>
              <div className="form-group"><label className="label">上線給的金句 / 激勵話語</label><input className="input" value={editData.quote||""} onChange={e=>setEditData({...editData,quote:e.target.value})} placeholder="例：做不到不是能力問題，是還沒找到對的方式"/></div>
            </div>
          ):(
            <>
              <div className="form-group"><label className="label">內容</label><textarea className="input" value={editData.content||""} onChange={e=>setEditData({...editData,content:e.target.value})}/></div>
            </>
          )}

          <div className="form-row">
            <div className="form-group"><label className="label">狀態</label><select className="input" value={editData.status} onChange={e=>setEditData({...editData,status:e.target.value})}>{["待執行","已完成"].map(s=><option key={s}>{s}</option>)}</select></div>
            <div className="form-group"><label className="label">標籤</label><input className="input" value={editData.tags} onChange={e=>setEditData({...editData,tags:e.target.value})}/></div>
          </div>
          <div className="flex gap-8 mt-8"><button className="btn btn-gold" onClick={saveItem}>儲存</button><button className="btn btn-ghost" onClick={()=>setShowForm(false)}>取消</button></div>
        </Modal>
      )}
    </div>
  );
}

// ─── Playbook ─────────────────────────────────────────────────────
function Playbook({ playbook, setPlaybook }) {
  const [catFilter, setCatFilter] = useState("全部");
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [draft, setDraft] = useState({id:"",category:"",situation:"",response:"",tags:"",star:false});
  const situationRef = useRef(null);
  const responseRef = useRef(null);
  const [activeField, setActiveField] = useState("response"); // situation | response
  const autosaveTimerRef = useRef(null);
  const [lastAutosaveAt, setLastAutosaveAt] = useState(null);
  const cats = ["全部",...Array.from(new Set(playbook.map(p=>p.category).filter(Boolean)))];
  const fl = catFilter==="全部"?playbook:playbook.filter(p=>p.category===catFilter);
  const displayed = [...fl.filter(p=>p.star),...fl.filter(p=>!p.star)];
  const openNew = () => { setDraft({id:uid(),category:"",situation:"",response:"",tags:"",star:false}); setShowForm(true); };
  const save = () => {
    const entry={...draft,tags:draft.tags?draft.tags.split(/[、,，]/).map(t=>t.trim()).filter(Boolean):[]};
    const next=playbook.find(p=>p.id===entry.id)?playbook.map(p=>p.id===entry.id?entry:p):[...playbook,entry];
    setPlaybook(next); setShowForm(false);
  };

  const shouldAutosave = (d) => {
    const hasAny =
      String(d.category || "").trim() ||
      String(d.situation || "").trim() ||
      String(d.response || "").trim() ||
      String(d.tags || "").trim() ||
      !!d.star;
    return !!hasAny;
  };

  // 自動儲存：在新增/編輯視窗打字時，延遲寫回 playbook（避免誤點背景關閉而丟資料）
  useEffect(() => {
    if (!showForm) return;
    if (!draft?.id) return;

    // 新增情境：如果完全沒輸入內容，就不要產生空白項目
    const exists = playbook.some(p => p.id === draft.id);
    if (!exists && !shouldAutosave(draft)) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const entry = {
        ...draft,
        tags: draft.tags ? String(draft.tags).split(/[、,，]/).map(t => t.trim()).filter(Boolean) : [],
      };
      const next = playbook.find(p=>p.id===entry.id) ? playbook.map(p=>p.id===entry.id?entry:p) : [...playbook, entry];
      setPlaybook(next);
      setLastAutosaveAt(Date.now());
    }, 300);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [showForm, draft, playbook, setPlaybook]);

  const applyWrap = (field, before, after) => {
    const ref = field === "situation" ? situationRef : responseRef;
    const el = ref.current;
    const src = String(draft[field] ?? "");
    const s = el?.selectionStart ?? src.length;
    const e = el?.selectionEnd ?? src.length;
    const next = src.slice(0, s) + before + src.slice(s, e) + after + src.slice(e);
    const nextPos = s + before.length;
    setDraft({ ...draft, [field]: next });
    requestAnimationFrame(() => {
      const ta = ref.current;
      if (!ta) return;
      ta.focus();
      const selEnd = e + before.length;
      ta.setSelectionRange(nextPos, selEnd);
    });
  };

  const activeWrap = (before, after) => applyWrap(activeField, before, after);

  const applyPrefix = (field, prefix) => {
    const ref = field === "situation" ? situationRef : responseRef;
    const el = ref.current;
    const src = String(draft[field] ?? "");
    const s = el?.selectionStart ?? src.length;
    const e = el?.selectionEnd ?? src.length;
    const before = src.slice(0, s);
    const sel = src.slice(s, e);
    const after = src.slice(e);
    const lines = sel.length ? sel.split(/\r?\n/) : [""];
    const nextSel = lines.map((l) => `${prefix}${l}`).join("\n");
    const next = before + nextSel + after;
    setDraft({ ...draft, [field]: next });
    requestAnimationFrame(() => {
      const ta = ref.current;
      if (!ta) return;
      ta.focus();
      const ns = s;
      const ne = s + nextSel.length;
      ta.setSelectionRange(ns, ne);
    });
  };

  const activePrefix = (prefix) => applyPrefix(activeField, prefix);
  return (
    <div>
      <div className="flex items-center justify-between mb-14">
        <h2 className="heading" style={{margin:0}}>上線教學手冊</h2>
        <button className="btn btn-gold btn-sm" onClick={openNew}>＋ 新增情境</button>
      </div>
      <div className="flex gap-8 mb-16" style={{flexWrap:"wrap"}}>
        {cats.map(c=><button key={c} className={`btn btn-sm ${catFilter===c?"btn-gold":"btn-ghost"}`} onClick={()=>setCatFilter(c)}>{c}</button>)}
      </div>
      {displayed.length===0&&<div className="empty">尚無情境</div>}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {displayed.map(item=>(
          <div key={item.id} className="card" style={{cursor:"pointer",borderColor:item.star?"var(--gold-border)":"var(--border)"}} onClick={()=>setExpanded(expanded===item.id?null:item.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-10" style={{flex:1}}>
                <button style={{background:"none",border:"none",cursor:"pointer",fontSize:15,flexShrink:0}} onClick={e=>{e.stopPropagation();setPlaybook(playbook.map(p=>p.id===item.id?{...p,star:!p.star}:p));}}>{item.star?"⭐":"☆"}</button>
                <div>
                  <div className="flex items-center gap-5" style={{flexWrap:"wrap",marginBottom:3}}>
                    {item.category&&<span className="tag tag-gold">{item.category}</span>}
                    {(Array.isArray(item.tags)?item.tags:[]).map(t=><span key={t} className="tag">{t}</span>)}
                  </div>
                  <div
                    className="playbook-text"
                    style={{fontWeight:600,fontSize:13,textAlign:"left"}}
                    dangerouslySetInnerHTML={{ __html: playbookMiniRichToHtml(`💬 ${item.situation || ""}`) }}
                  />
                </div>
              </div>
              <span style={{color:"var(--text3)",flexShrink:0,fontSize:12}}>{expanded===item.id?"▲":"▼"}</span>
            </div>
            {expanded===item.id&&(
              <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--border)"}}>
                <div className="subheading mb-5">建議回應</div>
                <div className="card-sm" style={{borderLeft:"3px solid var(--gold)",borderRadius:"0 8px 8px 0",textAlign:"left"}}>
                  <div
                    className="playbook-text"
                    style={{fontSize:13,lineHeight:1.9,textAlign:"left"}}
                    dangerouslySetInnerHTML={{ __html: playbookMiniRichToHtml(item.response || "") }}
                  />
                </div>
                <div className="flex gap-8 mt-10">
                  <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setDraft({...item,tags:Array.isArray(item.tags)?item.tags.join("、"):item.tags});setShowForm(true);}}>編輯</button>
                  <button className="btn btn-danger btn-sm" onClick={e=>{e.stopPropagation();setPlaybook(playbook.filter(p=>p.id!==item.id));}}>刪除</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {showForm&&(
        <Modal title="新增 / 編輯情境" onClose={()=>setShowForm(false)} wide>
          <div className="form-row">
            <div className="form-group"><label className="label">分類</label><input className="input" value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})} placeholder="開口邀約"/></div>
            <div className="form-group"><label className="label">標籤</label><input className="input" value={draft.tags} onChange={e=>setDraft({...draft,tags:e.target.value})}/></div>
          </div>
          <div className="form-group"><label className="label">情境 *</label><textarea ref={situationRef} className="input" style={{minHeight:60,textAlign:"left"}} value={draft.situation} onChange={e=>setDraft({...draft,situation:e.target.value})} onFocus={()=>setActiveField("situation")}/></div>

          <div className="form-group">
            <div className="flex items-center justify-between" style={{gap:8,flexWrap:"wrap"}}>
              <label className="label" style={{margin:0}}>建議應對 *</label>
              <div className="flex items-center" style={{gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activeWrap("**","**")}><span className="mono" style={{fontWeight:800}}>B</span></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activeWrap("_","_")}><span className="mono" style={{fontStyle:"italic"}}>I</span></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activeWrap("__","__")}><span className="mono" style={{textDecoration:"underline"}}>U</span></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activeWrap("~~","~~")}><span className="mono" style={{textDecoration:"line-through"}}>S</span></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activeWrap("==","==")}><span className="mono">HL</span></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activePrefix("> ")}><span className="mono">❝</span></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activePrefix("- ")}><span className="mono">•</span></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activePrefix("1. ")}><span className="mono">1.</span></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activeWrap("[size=sm]","[/size]")}><span className="mono">A-</span></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activeWrap("[size=lg]","[/size]")}><span className="mono">A+</span></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activeWrap("[color=#b8860b]","[/color]")} style={{color:"var(--gold)"}}>字色</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>activeWrap("[bg=#fde68a]","[/bg]")}>底色</button>
              </div>
            </div>
            <textarea ref={responseRef} className="input" style={{minHeight:120,textAlign:"left"}} value={draft.response} onChange={e=>setDraft({...draft,response:e.target.value})} onFocus={()=>setActiveField("response")}/>
            <div className="text-xs text-muted mt-6" style={{lineHeight:1.6}}>
              支援：<span className="mono">**粗體**</span>、<span className="mono">_斜體_</span>、<span className="mono">__底線__</span>、<span className="mono">~~刪除線~~</span>、<span className="mono">==螢光==</span>、<span className="mono">&gt; 引用</span>、<span className="mono">- 清單</span>、<span className="mono">1. 編號</span>、<span className="mono">[color=#c0392b]字色[/color]</span>、<span className="mono">[bg=#fde68a]底色[/bg]</span>、<span className="mono">[size=lg]大字[/size]</span>
            </div>
          </div>
          <div className="flex items-center gap-8 mt-6"><input type="checkbox" id="star" checked={draft.star} onChange={e=>setDraft({...draft,star:e.target.checked})} style={{accentColor:var_gold}}/><label htmlFor="star" className="text-sm" style={{cursor:"pointer"}}>⭐ 置頂重點</label></div>
          {lastAutosaveAt && (
            <div className="text-xs text-muted mt-6" style={{lineHeight:1.6}}>
              已自動儲存：<span className="mono">{new Date(lastAutosaveAt).toLocaleTimeString("zh-TW")}</span>
            </div>
          )}
          <div className="flex gap-8 mt-12"><button className="btn btn-gold" onClick={save}>儲存</button><button className="btn btn-ghost" onClick={()=>setShowForm(false)}>取消</button></div>
        </Modal>
      )}
    </div>
  );
}

// ─── AI Coach ─────────────────────────────────────────────────────
function AICoach({ partners, interactions, todos }) {
  const [mode, setMode] = useState("advice");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selP, setSelP] = useState("");
  const [apiKey, setApiKey] = useState(()=>sessionStorage.getItem("crm_api_key")||"");
  const [showKey, setShowKey] = useState(false);
  const bottomRef = useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);

  const saveApiKey = (k) => { setApiKey(k); sessionStorage.setItem("crm_api_key", k); };

  const buildSystem = () => {
    const ps=partners.filter(p=>p.role!=="上線").map(p=>`- ${p.name}（${p.role}）：備註 ${p.memo||p.notes||"無"}，痛點 ${p.painPoint||"無"}，關係 ${p.relation||"無"}`).join("\n");
  const ri=[...interactions].sort((a,b)=>toMsDT(b.date,b.time) - toMsDT(a.date,a.time)).slice(0,8).map(i=>{const p=partners.find(x=>x.id===i.partnerId);return `- [${i.date} ${normalizeTime(i.time)}] ${i.type}｜${i.title}（${p?.name||"無"}）：${i.status}`;}).join("\n");
    const pt=todos.filter(t=>!t.done).map(t=>`- ${t.title}`).join("\n");
    const rp=selP?partners.find(p=>p.id===selP):null;
    if(mode==="advice") return `你是電商直銷人脈經營顧問，親切實際，使用繁體中文。\n【夥伴】\n${ps}\n【近期互動】\n${ri}\n【待辦】\n${pt}\n根據資料給具體行動建議，條列清楚。`;
    if(mode==="cheer") return `你是電商直銷心理支持教練，溫暖真誠有力量，使用繁體中文。不說廢話，真實有溫度地鼓勵對方，必要時分享一句激勵的話。`;
    if(mode==="roleplay") return `你是電商直銷對話模擬教練，使用繁體中文。\n用戶練習跟${rp?`「${rp.name}」（${rp.role}，備註：${rp.memo||rp.notes||"無"}）`:"潛在夥伴"}對話。\n先扮演對方說一句話，等用戶回應後給評分（0-10分）與改善建議。用【對方】和【教練點評】區分角色。`;
    return "";
  };

  const send = async () => {
    if(!input.trim()||loading) return;
    const userMsg={role:"user",content:input.trim()};
    const newMsgs=[...messages,userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(), 60000);
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key": apiKey,
          "anthropic-version":"2023-06-01",
          "anthropic-dangerous-direct-browser-access":"true",
        },
        signal: controller.signal,
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:buildSystem(),messages:newMsgs}),
      });
      clearTimeout(timeout);
      if(!res.ok) {
        const errBody = await res.text();
        throw new Error(`HTTP ${res.status}: ${errBody.slice(0,200)}`);
      }
      const data=await res.json();
      const reply=data.content?.find(b=>b.type==="text")?.text||"（無回應）";
      setMessages([...newMsgs,{role:"assistant",content:reply}]);
    } catch(e) {
      const msg = e.name==="AbortError" ? "請求逾時，請重試。" : `錯誤：${e.message}`;
      setMessages([...newMsgs,{role:"assistant",content:`⚠️ ${msg}`}]);
    }
    setLoading(false);
  };

  const MODES=[
    {id:"advice",label:"💡 給我建議",desc:"根據夥伴資料與互動紀錄"},
    {id:"cheer",label:"🔥 加油打氣",desc:"我需要動力與心理支持"},
    {id:"roleplay",label:"🎭 模擬對話",desc:"練習怎麼跟夥伴開口"},
  ];
  const starters={
    advice:"你好！我已讀取你的資料。有什麼想問的嗎？例如：「我應該優先跟哪位夥伴聯繫？」",
    cheer:"嘿，你今天還在這裡，這本身就很了不起。💪 跟我說說，最近怎麼了？",
    roleplay:`好！${selP?`模擬對象：${partners.find(p=>p.id===selP)?.name}。`:""}準備好了嗎？我來扮演對方，你來練習回應。`,
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 100px)",minHeight:500}}>
      <div className="flex items-center justify-between mb-12">
        <h2 className="heading" style={{margin:0}}>AI 教練</h2>
        {messages.length>0&&<button className="btn btn-ghost btn-sm" onClick={()=>setMessages([])}>清空</button>}
      </div>

      {/* API Key 設定 */}
      <div className="card-sm mb-12" style={{borderColor: apiKey ? "var(--green)" : "var(--gold-border)", background: apiKey ? "#f0fdf4" : "var(--gold-light)", flexShrink:0}}>
        <div className="flex items-center justify-between">
          <div>
            <div className="label" style={{color: apiKey ? "var(--green)" : var_gold}}>
              {apiKey ? "✓ API Key 已設定" : "⚠️ 需要 Anthropic API Key"}
            </div>
            {!apiKey && <div className="text-xs text-muted mt-4">請至 console.anthropic.com 取得你的 API key</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setShowKey(!showKey)}>
            {showKey ? "收起" : apiKey ? "更換" : "設定"}
          </button>
        </div>
        {showKey && (
          <div className="flex gap-8 mt-10">
            <input
              className="input"
              style={{flex:1, fontFamily:"'DM Mono',monospace", fontSize:12}}
              type="password"
              placeholder="sk-ant-api03-..."
              value={apiKey}
              onChange={e=>saveApiKey(e.target.value)}
            />
            <button className="btn btn-gold btn-sm" onClick={()=>setShowKey(false)}>確認</button>
          </div>
        )}
      </div>

      {/* Mode selector */}
      <div className="grid-3" style={{marginBottom:12,flexShrink:0}}>
        {MODES.map(m=>(
          <div key={m.id} className="card" style={{cursor:"pointer",borderColor:mode===m.id?"var(--gold-border)":"var(--border)",background:mode===m.id?"var(--gold-light)":"#fff",transition:"all .18s",padding:12}} onClick={()=>{setMode(m.id);setMessages([]);setInput("");setSelP("");}}>
            <div style={{fontWeight:700,fontSize:13}}>{m.label}</div>
            <div className="text-xs text-muted mt-5">{m.desc}</div>
          </div>
        ))}
      </div>

      {/* Roleplay partner selector */}
      {mode==="roleplay"&&messages.length===0&&(
        <div className="card-sm" style={{marginBottom:10,flexShrink:0}}>
          <label className="label">選擇模擬對象（選填）</label>
          <select className="input mt-5" value={selP} onChange={e=>setSelP(e.target.value)}>
            <option value="">通用情境</option>
            {partners.filter(p=>p.role!=="上線").map(p=><option key={p.id} value={p.id}>{p.name}（{p.role}）</option>)}
          </select>
        </div>
      )}

      {/* Chat window — flex:1 with overflow */}
      <div className="card" style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",padding:0,minHeight:0}}>
        {messages.length===0?(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:24}}>
            <div style={{fontSize:42}}>{mode==="advice"?"💡":mode==="cheer"?"🔥":"🎭"}</div>
            <div style={{color:"var(--text2)",fontSize:13,textAlign:"center",maxWidth:290,lineHeight:1.8}}>
              {mode==="advice"&&"根據你的夥伴資料和互動紀錄，給你具體的行動建議。"}
              {mode==="cheer"&&"不管今天遇到什麼，我都在。跟我說說你的狀況。"}
              {mode==="roleplay"&&"模擬真實對話情境，即時點評你的回應方式。"}
            </div>
            <button className="btn btn-gold btn-sm" disabled={!apiKey} style={{opacity:apiKey?1:.5}} onClick={()=>setMessages([{role:"assistant",content:starters[mode]}])}>
              {apiKey ? "開始對話" : "請先設定 API Key"}
            </button>
          </div>
        ):(
          <>
            {/* Message list — scrollable */}
            <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:12,minHeight:0}}>
              {messages.map((m,i)=>(
                <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-start",gap:8}}>
                  {m.role==="assistant"&&(
                    <div style={{width:28,height:28,borderRadius:"50%",background:"var(--gold-light)",border:"1.5px solid var(--gold-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>🤖</div>
                  )}
                  <div style={{
                    maxWidth:"76%",padding:"10px 14px",
                    borderRadius:m.role==="user"?"14px 14px 3px 14px":"14px 14px 14px 3px",
                    background:m.role==="user"?var_gold:"#fff",
                    color:m.role==="user"?"#fff":"var(--text)",
                    fontSize:13,lineHeight:1.85,
                    border:m.role==="assistant"?"1px solid var(--border)":"none",
                    boxShadow:m.role==="assistant"?"var(--shadow)":"none",
                    whiteSpace:"pre-wrap",wordBreak:"break-word",
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading&&(
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:"var(--gold-light)",border:"1.5px solid var(--gold-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🤖</div>
                  <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:"14px 14px 14px 3px",padding:"10px 16px",color:"var(--text3)",fontSize:13}}>思考中…</div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
            {/* Input bar — always at bottom */}
            <div style={{padding:"10px 14px",borderTop:"1.5px solid var(--border)",display:"flex",gap:8,flexShrink:0,background:"#fff"}}>
              <input className="input" style={{flex:1}} placeholder="輸入問題或回應… (Enter 送出)" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}/>
              <button className="btn btn-gold btn-sm" onClick={send} disabled={loading||!input.trim()||!apiKey}>送出</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Quotes ───────────────────────────────────────────────────────
function QuotesTab({ quotes, setQuotes }) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({id:"",text:"",author:"",date:new Date().toISOString().slice(0,10)});
  return (
    <div>
      <div className="flex items-center justify-between mb-14">
        <h2 className="heading" style={{margin:0}}>金句收藏 ✨</h2>
        <button className="btn btn-gold btn-sm" onClick={()=>{setDraft({id:uid(),text:"",author:"",date:new Date().toISOString().slice(0,10)});setShowForm(true);}}>＋ 新增</button>
      </div>
      <div className="grid-2">
        {quotes.map(q=>(
          <div key={q.id} className="quote-card">
            <div className="quote-text">{q.text}</div>
            {q.author&&<div className="quote-author">— {q.author}</div>}
            <div className="flex items-center justify-between mt-8"><span className="text-xs mono text-muted">{q.date}</span><button className="btn btn-danger btn-sm" onClick={()=>setQuotes(quotes.filter(x=>x.id!==q.id))}>刪除</button></div>
          </div>
        ))}
      </div>
      {showForm&&(
        <Modal title="新增金句" onClose={()=>setShowForm(false)}>
          <div className="form-group"><label className="label">金句內容 *</label><textarea className="input" style={{minHeight:80}} value={draft.text} onChange={e=>setDraft({...draft,text:e.target.value})}/></div>
          <div className="form-row">
            <div className="form-group"><label className="label">來源 / 作者</label><input className="input" value={draft.author} onChange={e=>setDraft({...draft,author:e.target.value})}/></div>
            <div className="form-group"><label className="label">日期</label><input type="date" className="input" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></div>
          </div>
          <div className="flex gap-8 mt-8"><button className="btn btn-gold" onClick={()=>{setQuotes([...quotes,draft]);setShowForm(false);}}>儲存</button><button className="btn btn-ghost" onClick={()=>setShowForm(false)}>取消</button></div>
        </Modal>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────
function Modal({ title, children, onClose, wide }) {
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:wide?640:500}}>
        <div className="modal-header">
          <h3 style={{fontFamily:"'Playfair Display',serif",color:var_gold,fontSize:17}}>{title}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
