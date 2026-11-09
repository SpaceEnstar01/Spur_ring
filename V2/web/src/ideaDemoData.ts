import {
  chaptersForDay,
  ideaCounts,
  localDateKey,
  type DatedChapterInput,
  type IdeaCapture,
} from "./ideaModel";

type Seed = {
  text: string;
  theme?: string;
  task?: {
    title: string;
    goal: string;
    summary: string;
    status: string;
  };
};

const themes = new Map<string, string>();

function localIso(key: string, index: number) {
  const [year, month, date] = key.split("-").map(Number);
  const minutes = 7 * 60 + 20 + index * 12;
  return new Date(year, month - 1, date, Math.floor(minutes / 60), minutes % 60).toISOString();
}

function build(key: string, source: string, seeds: Seed[]) {
  const captures: IdeaCapture[] = [];
  const chapters: DatedChapterInput[] = [];
  seeds.forEach((seed, index) => {
    const at = localIso(key, index);
    const id = `demo-${key}-${index + 1}`;
    const taskId = seed.task ? `demo-task-${key}-${index + 1}` : "";
    if (seed.theme) themes.set(id, seed.theme);
    captures.push({
      id,
      at,
      text: seed.text,
      status: seed.task ? "已关联任务" : "未执行想法",
      chapterIds: taskId ? [taskId] : [],
    });
    if (seed.task) {
      chapters.push({
        id: taskId,
        source,
        at,
        title: seed.task.title,
        goal: seed.task.goal,
        summary: seed.task.summary,
        status: seed.task.status,
      });
    }
  });
  return { captures, chapters };
}

const paris = build("2026-11-06", "ring", [
  { text: "帮我按真实步行节奏排一个三天巴黎路线，不要罗列景点。", task: { title: "三天巴黎路线规划", goal: "按真实步行节奏安排三天路线。", summary: "先确认住宿位置和每天能走的距离，再排顺序。", status: "finished" } },
  { text: "把这几天想去的餐厅和咖啡馆整理成一份可核实的名单。", task: { title: "餐厅与咖啡馆候选", goal: "整理还能核实营业时间的餐饮名单。", summary: "只保留用户当天提到的店，不补充没去过的网红店。", status: "finished" } },
  { text: "按交通、住宿、吃饭和门票拆开这次旅行预算。", task: { title: "旅行预算拆解", goal: "把预算拆成可核对的四类花费。", summary: "实际票据缺失的项目要标成待核实。", status: "finished" } },
  { text: "比较机场到市区的几种走法，标出费用和耗时。", task: { title: "机场交通比较", goal: "比较机场进城的费用和耗时。", summary: "需要把行李和换乘电梯算进去。", status: "running" } },
  { text: "埃菲尔铁塔什么时间光线适合拍，给我一个可执行的时段。", task: { title: "铁塔拍摄时段", goal: "给出一个能避开人群的拍摄时段。", summary: "以桥上的侧面机位为主，不承诺塔下一定能拍到。", status: "finished" } },
  { text: "从这次路上的观察里挑出能做的 YouTube 选题。", task: { title: "旅行视频选题", goal: "从当天观察里选出可以单独成片的选题。", summary: "每个选题都要能回到一条原始记录。", status: "finished" } },
  { text: "给旅行视频想几个标题，并说明每个标题的角度。", task: { title: "标题与封面方向", goal: "提供几个标题，并说明各自的承诺。", summary: "不用“全攻略”这种说不满的说法。", status: "running" } },
  { text: "把明天的步行路线和拍摄机位放在同一张顺序里。", task: { title: "步行与机位顺序", goal: "让移动路线和机位使用同一个顺序。", summary: "机位太多时删到能手持完成的数量。", status: "finished" } },
  { text: "比较我住的这片和塞纳河边住宿，哪个更适合晚上回来。", task: { title: "住宿区域比较", goal: "比较夜间回程是否方便。", summary: "风景好不是唯一标准，末班交通要写明。", status: "finished" } },
  { text: "挑出最值得单独做成一条视频的那一天。", task: { title: "单独成片的一天", goal: "从三天里选出最适合单独成片的一天。", summary: "选择理由来自用户自己的感受，不按热门景点投票。", status: "finished" } },
  { text: "今天从玛黑走到河边，比地图上看起来更适合慢慢拍。", theme: "路线与街巷" },
  { text: "拉丁区的小巷上午很安静，下午就被团队游客占满。", theme: "路线与街巷" },
  { text: "蒙马特的台阶比景点本身更值得讲上坡的累。", theme: "路线与街巷" },
  { text: "圣路易岛适合作为三天里最慢的一段，不要排太满。", theme: "路线与街巷" },
  { text: "塞纳河边晚上风大，拍摄要留一件外套的时间。", theme: "路线与街巷" },
  { text: "卢森堡公园适合做开场，不要一上来就进博物馆。", theme: "路线与街巷" },
  { text: "玛黑的拐角书店比主街上的店更有停留感。", theme: "路线与街巷" },
  { text: "如果只留一个黄昏，我想留在桥上看河，而不是排队上塔。", theme: "路线与街巷" },
  { text: "街角咖啡馆的靠窗位比招牌更重要，光线够就能拍。", theme: "餐厅与咖啡馆" },
  { text: "午餐如果排长队，就会吃掉下午的拍摄时间。", theme: "餐厅与咖啡馆" },
  { text: "这家面包店的黄油味很重，适合作为一个很短的切镜。", theme: "餐厅与咖啡馆" },
  { text: "晚餐不要订太晚，回去的地铁间隔会变长。", theme: "餐厅与咖啡馆" },
  { text: "咖啡价格比我预想的高，值得在视频里说清楚。", theme: "餐厅与咖啡馆" },
  { text: "市场里的熟食可以当午餐，不必每天坐下来吃。", theme: "餐厅与咖啡馆" },
  { text: "靠河的餐厅风景好，但说话要大声，不适合采访。", theme: "餐厅与咖啡馆" },
  { text: "我想把一顿普通早餐拍进去，而不是只拍精致晚餐。", theme: "餐厅与咖啡馆" },
  { text: "机场快线看起来省事，换成地铁后行李并不轻松。", theme: "交通与预算" },
  { text: "一张日票能不能覆盖今晚回酒店，我还没算完。", theme: "交通与预算" },
  { text: "换乘站的电梯很少，拖箱子会打乱路线。", theme: "交通与预算" },
  { text: "雨天出租车比票价本身更影响行程。", theme: "交通与预算" },
  { text: "早上第一条地铁人不多，适合移动拍摄。", theme: "交通与预算" },
  { text: "晚上过了十二点，有些线会变成另一种运营方式。", theme: "交通与预算" },
  { text: "铁塔侧面的桥比塔下的人行道更容易避开人群。", theme: "拍摄灵感" },
  { text: "阴天的石墙颜色发灰，标题不要承诺金色阳光。", theme: "拍摄灵感" },
  { text: "手持走拍十分钟就累，机位要少而固定。", theme: "拍摄灵感" },
  { text: "橱窗反射能拍到街对面，不必进店。", theme: "拍摄灵感" },
  { text: "傍晚路灯亮起的两分钟最适合当转场。", theme: "拍摄灵感" },
  { text: "雨后地面会反光，鞋和箱子都会入画。", theme: "拍摄灵感" },
  { text: "我更记得迷路的那二十分钟，而不是按计划走完的路。", theme: "路上的观察" },
  { text: "同行的人停下买水的时候，往往就是一个可用的镜头。", theme: "路上的观察" },
  { text: "不要把每天都讲成顺利，累和饿也是这次旅行的一部分。", theme: "路上的观察" },
  { text: "我想保留自己的口头禅，不要改成通用攻略腔。", theme: "路上的观察" },
  { text: "有一家店没开门，这个落空比打卡成功更真实。", theme: "路上的观察" },
  { text: "回酒店后只想把鞋子脱掉，这个感觉可以当结尾。", theme: "路上的观察" },
  { text: "一条视频只讲一天的真实花费，不要混进整个行程。", theme: "可以做成的视频" },
  { text: "开头三秒先说今天走了多少路，再出景点。", theme: "可以做成的视频" },
  { text: "可以把预期预算和实际花费做成同一个封面。", theme: "可以做成的视频" },
  { text: "避坑内容只讲我自己遇到的，不讲听说的。", theme: "可以做成的视频" },
  { text: "标题里用“三天”而不是“巴黎全攻略”。", theme: "可以做成的视频" },
  { text: "结尾留一张还能继续查的清单，而不是口号。", theme: "可以做成的视频" },
]);

const hardware = build("2026-11-08", "ring", [
  { text: "把 AI Ring 到底戴在手上做什么，整理成一个说得清的产品形态。", task: { title: "AI Ring 产品形态梳理", goal: "说清戒指在个人工作流里的位置。", summary: "从捕捉想法开始，不把戒指写成健康设备。", status: "finished" } },
  { text: "比较 Always-on 和用户主动触发，哪一种更适合 Spur。", task: { title: "Always-on 与主动触发对比", goal: "比较两种触发方式的边界。", summary: "主动触发优先，持续监听要单独说明隐私代价。", status: "running" } },
  { text: "个人记忆应该留在用户这边，帮我划出不能上传的部分。", task: { title: "个人记忆与隐私边界", goal: "列出可以进入记忆和必须留在设备上的内容。", summary: "原始录音和整理稿要分开存放。", status: "finished" } },
  { text: "看一下现在的 AI 硬件市场，哪些说法已经过度承诺。", task: { title: "AI 硬件市场趋势", goal: "整理公开市场里可以核对的趋势。", summary: "没有来源的出货量不要写进结论。", status: "finished" } },
  { text: "智能戒指怎么收费才站得住，先别写死订阅价格。", task: { title: "智能戒指商业化路径", goal: "整理可能的收费方式，不预设价格。", summary: "先区分硬件和持续服务，再谈收费。", status: "pending" } },
  { text: "Agent 连接外部应用时，哪些动作必须再问我一次。", task: { title: "Agent 与外部应用连接", goal: "列出连接之后仍需确认的动作。", summary: "发送、发布和删除都不能自动执行。", status: "running" } },
  { text: "如果个人计算从手机挪到身上，下一步会先改变什么。", task: { title: "下一代个人计算设备", goal: "描述可穿戴入口会先改变的交互。", summary: "先改变捕捉，不先改变完整办公。", status: "finished" } },
  { text: "Personal Agent 不应该变成另一个聊天框，交互方式再想一版。", task: { title: "Personal Agent 交互方式", goal: "提出不同于聊天框的日常交互。", summary: "以一天的记录和任务为主，而不是无限对话。", status: "finished" } },
  { text: "戒指上只需要一个明确的按下动作，不要做一排猜不中的手势。", theme: "产品形态" },
  { text: "摘下来充电的时候，用户要知道哪一段记忆还没同步。", theme: "产品形态" },
  { text: "外观应该像首饰，而不是一个缩小的录音笔。", theme: "产品形态" },
  { text: "我想先说话，再决定这条要不要变成任务。", theme: "交互方式" },
  { text: "Agent 回复太长时，戒指侧只能留一句下一步。", theme: "交互方式" },
  { text: "同一句话里可能又有想法又有指令，不能只取一个标签。", theme: "交互方式" },
  { text: "持续听和按一下再听，隐私感受完全不同。", theme: "触发方式" },
  { text: "误触发比漏记更伤信任，确认动作要轻但不能没有。", theme: "触发方式" },
  { text: "夜里的录音不应该第二天早上突然变成一堆任务。", theme: "触发方式" },
  { text: "市面上很多硬件先讲参数，用户其实想知道它记住了什么。", theme: "市场趋势" },
  { text: "可穿戴如果只能做通知，就还不是 Personal Agent。", theme: "市场趋势" },
  { text: "竞品演示喜欢用一天的完美剧本，真实使用会有空白天。", theme: "市场趋势" },
  { text: "原始录音可以留在手机，云端只拿我点过确认的文字。", theme: "隐私与记忆" },
  { text: "整理稿改错了，必须还能回到当时的原话。", theme: "隐私与记忆" },
  { text: "不同日子的记忆不能串到同一篇文档里冒充连续发生。", theme: "隐私与记忆" },
  { text: "硬件可以一次买断，持续整理才像一项服务。", theme: "商业化" },
  { text: "不要用健康数据订阅来解释一个创作者的戒指。", theme: "商业化" },
  { text: "连接 YouTube 和连接笔记是两件授权，不能一次同意全部。", theme: "外部连接" },
  { text: "同步失败就说明失败，不要在演示里显示已保存。", theme: "外部连接" },
  { text: "下一代设备先替我记住片段，而不是替我做完全部决定。", theme: "下一代设备" },
  { text: "手机仍然负责看详情，戒指负责把那一刻留住。", theme: "下一代设备" },
  { text: "空白的一天也要能打开，这样才像真实生活，不像脚本。", theme: "下一代设备" },
]);

const execution = build("2026-11-09", "app", [
  { text: "分析最近科技频道为什么这些选题更容易被点开。", task: { title: "YouTube 科技频道趋势分析", goal: "从公开科技频道里整理可核对的选题趋势。", summary: "只使用公开视频信息，不编造播放量。", status: "finished" } },
  { text: "给我一份 AI Ring 的竞品报告，分开已经做到的和只是宣称的。", task: { title: "AI Ring 竞品研究报告", goal: "比较竞品已经提供的能力和宣传口径。", summary: "每条结论都要能回到公开页面。", status: "finished" } },
  { text: "按今天的合作意向写一封邮件草稿，先不要发送。", task: { title: "合作邮件草稿生成", goal: "起草一封尚未发送的合作邮件。", summary: "草稿停在可编辑状态，发送前必须再确认。", status: "finished" } },
  { text: "看看 Instagram 上适合 Spur 的内容节奏，不要直接排期。", task: { title: "Instagram 内容策略研究", goal: "研究适合的内容节奏，不创建发布排期。", summary: "账号尚未连接，只能讨论公开内容的做法。", status: "running" } },
  { text: "把 Google Drive 里这周的素材按主题归类，先给我清单。", task: { title: "Google Drive 文件整理", goal: "按主题列出本周素材清单。", summary: "Drive 还未授权，任务停在准备清单。", status: "running" } },
  { text: "把下周要见的人和要准备的材料排成一个会议清单。", task: { title: "下周会议安排", goal: "整理下周会议需要准备的材料。", summary: "只形成清单，不向日历写入邀请。", status: "running" } },
  { text: "帮我规划本周剩下的科技内容选题，先不要开写脚本。", task: { title: "本周科技内容选题规划", goal: "列出本周剩余选题，不生成脚本。", summary: "等待用户确认哪一条先做。", status: "pending" } },
]);

export const demoCaptures: IdeaCapture[] = [...paris.captures, ...hardware.captures, ...execution.captures];
export const demoChapters: DatedChapterInput[] = [...paris.chapters, ...hardware.chapters, ...execution.chapters];
export const demoAnchor = new Date(2026, 10, 8, 12);

const documents: Record<string, { title: string; intro: string }> = {
  "2026-11-06": {
    title: "Paris Travel — Daily Ideas",
    intro: "这 40 条还没有交给 Agent。主题是整理出来的，原话和时间仍在。",
  },
  "2026-11-08": {
    title: "AI Hardware & Personal Agent — Daily Ideas",
    intro: "这 22 条还没有交给 Agent。每条都保留记录时的说法。",
  },
};

export function demoDocument(key: string) {
  const spec = documents[key];
  if (!spec) return null;
  const items = demoCaptures.filter(
    (item) => localDateKey(new Date(item.at)) === key && item.chapterIds.length === 0
  );
  const groups = new Map<string, IdeaCapture[]>();
  for (const item of items) {
    const theme = themes.get(item.id) || "其他";
    const list = groups.get(theme) || [];
    list.push(item);
    groups.set(theme, list);
  }
  const body = [...groups].flatMap(([theme, list]) => [
    `## ${theme}`,
    "",
    ...list.flatMap((item) => {
      const time = new Date(item.at);
      const clock = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
      return [`### ${clock}`, item.text, ""];
    }),
  ]);
  return [`# ${spec.title}`, "", `> ${key} · Example`, "", spec.intro, "", ...body].join("\n");
}

export function demoTitle(key: string) {
  return documents[key]?.title || "";
}

export function demoOnDay(day: Date) {
  const key = localDateKey(day);
  const captures = demoCaptures.filter((item) => localDateKey(new Date(item.at)) === key);
  const chapters = chaptersForDay(demoChapters, day);
  return {
    key,
    captures,
    chapters,
    counts: ideaCounts(captures, chapters),
    document: demoDocument(key),
    title: demoTitle(key),
  };
}
