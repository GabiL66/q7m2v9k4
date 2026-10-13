// 大类（界面上叫 Project，计划的上一层）：名字、颜色、几样设置。存在 Settings 的 groups 里，有顺序，可以改名、加减。
//   labor    这个大类的时间算进季度表的 progress
//   grow     "all" 全部时间算成长 / "deep" 只有标了 ◆ Deep 的算成长，没标的算 Relax / "" 都不算
//   friends  这个大类的任务可以选「和谁」
//   track    Projects 页上看它什么（进度 / 每周够不够钟点 / Relax 在不在范围里 / 多久没联系 / 不看），见最下面的 trackOf；min = 够不够的那个钟点（分钟）
// 任务可以直接挂在大类上（task.group），不一定要挂在哪个计划下面。只算数，不碰页面和存储。

// 色板（Projects 页和大类里能选的颜色，顺序就是色块的顺序；新建的大类 / 计划也按这个顺序轮着取色）：红 橙 黄绿 浅绿 浅青 钢蓝 克莱因蓝 深紫 淡紫 淡粉
export const PALETTE = ["#CB1B45", "#F05E1C", "#C2E55C", "#86C166", "#81C7D4", "#4F8FA8", "#002FA7", "#6A4C9C", "#C8B2F5", "#FEDFE1"];
const [CRIMSON, ORANGE, LIME, LEAF, CYAN, STEEL, KLEIN, PURPLE, LAVENDER, BLUSH] = PALETTE;

export const DEFAULTS = [
  { name: "Work", color: KLEIN, labor: true, grow: "all" },
  { name: "Fitness", color: ORANGE, labor: false, grow: "all" },
  { name: "Chores", color: STEEL, labor: true, grow: "" },
  { name: "Build", color: LEAF, labor: true, grow: "all" },
  { name: "Leisure", color: LIME, labor: false, grow: "deep" },
  { name: "Friends", color: PURPLE, labor: true, grow: "", friends: true }
];

// 圆盘上用的霓虹版：色块压在金属上，要比色板里的颜色亮得多。十个颜色一个对一个；
// 自己另选的颜色没有对应的，返回空（圆盘那边会把它调亮）
const NEON = {
  [CRIMSON]: "#FF2D4A", [ORANGE]: "#FF6A00", [LIME]: "#C6FF00", [LEAF]: "#7CFF4D", [CYAN]: "#00E5FF",
  [STEEL]: "#29B6FF", [KLEIN]: "#2F5BFF", [PURPLE]: "#9B4DFF", [LAVENDER]: "#D0A8FF", [BLUSH]: "#FF9EC0"
};
export const neon = (c) => NEON[String(c || "").toUpperCase()] || "";

// 以前换默认颜色时用的一次性迁移，色板换新以后不再需要：保留这个函数是因为 store.js 还在调用它，永远返回空
export const recolor = () => [];

// 以前那套亮色 → 现在的颜色（没归进大类的计划换一次）
const OLD_COLORS = { "#B8F000": LIME, "#C6FF00": LIME, "#2F5BFF": KLEIN, "#FF3EA5": CRIMSON, "#FF7A1A": ORANGE, "#9B5CFF": PURPLE, "#00C2A8": LEAF, "#FFC400": ORANGE, "#FF4D4D": CRIMSON };
export const newColor = (c) => OLD_COLORS[String(c || "").toUpperCase()] || c || "";

// 旧名字归到哪个大类：「Main - English」→ Build，「Work 1」→ Work，「Fun」→ Leisure……认不出的返回空
const RULES = [
  [/work|job|office/i, "Work"],
  [/gym|fit|sport|workout/i, "Fitness"],
  [/chore|house|errand|admin/i, "Chores"],
  [/english|french|ielts|study|learn|course|exam|language|side|build/i, "Build"],
  [/fun|leisure|play|game|relax/i, "Leisure"],
  [/friend/i, "Friends"]
];
export function match(name) {
  const s = String(name || "").trim();
  if (!s) return "";
  const same = DEFAULTS.find((g) => g.name.toLowerCase() === s.toLowerCase());
  return same ? same.name : (RULES.find(([re]) => re.test(s)) || [])[1] || "";
}

const blank = (name, color) => ({ name, color, labor: false, grow: "" });

// 还没存过大类清单时先这样用：默认的六个，加上计划里出现过、不在清单里的名字（什么都不改）
export function withPlans(list, projects) {
  const out = list.map((g) => ({ ...g }));
  for (const p of projects) {
    const name = String(p.group || "").trim();
    if (name && !out.some((g) => g.name === name)) out.push(blank(name, p.color || PALETTE[out.length % PALETTE.length]));
  }
  return out;
}

// 第一次：现有的计划按名字归进六个大类（计划自己的名字不动），颜色跟着大类；认不出的大类原样排在后面、换成新颜色。
// → { groups, moves: [{ id, group, color }] }（只列要改的计划）
export function adopt(projects) {
  const groups = DEFAULTS.map((g) => ({ ...g }));
  const moves = [];
  for (const p of projects) {
    const old = String(p.group || "").trim();
    const to = match(old) || (old ? "" : match(p.name));
    let group = old, color = newColor(p.color);
    if (to) { group = to; color = groups.find((g) => g.name === to).color; }
    else if (old) {
      let g = groups.find((x) => x.name === old);
      if (!g) groups.push((g = blank(old, color || PALETTE[groups.length % PALETTE.length])));
      color = g.color;
    }
    if (group !== old || color !== p.color) moves.push({ id: p.id, group, color });
  }
  return { groups, moves };
}

export const byName = (list, name) => (list || []).find((g) => g.name === name) || null;

// 这个大类在 Projects 页上看什么（g.track，Settings 里能改）：
//   "progress" 计划的进度（进度条、健康度）        "min"     最近 7 天至少做够 g.min 分钟（默认 3 小时）
//   "range"    最近 7 天的 Relax 在每周的门槛之间    "contact" 最近两周里至少联系过一次        ""  不看
// 没设过就猜：能选人的 = contact；没标 Deep 算 Relax 的那种 = range；名字像 Work / Chores 的不看（进度不由自己定），
// 像 Fitness 的看够不够钟点，像 Build 的看进度；认不出的照旧看进度。
export const TRACKS = ["progress", "min", "range", "contact", ""];
export const TRACK_MIN = 180;
const TRACK_BY_NAME = { Work: "", Chores: "", Build: "progress", Fitness: "min", Leisure: "range", Friends: "contact" };
export function trackOf(g) {
  if (!g) return "progress";
  if (TRACKS.includes(g.track)) return g.track;
  if (g.friends) return "contact";
  if (g.grow === "deep") return "range";
  const known = match(g.name);
  return known in TRACK_BY_NAME ? TRACK_BY_NAME[known] : "progress";
}
