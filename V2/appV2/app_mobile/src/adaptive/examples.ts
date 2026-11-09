import type { AdaptiveEntry } from './model';
// Fictional Creator account. Never write these entries to real capture/task stores.
export const workspaceExamples: AdaptiveEntry[] = [
  {
    id: 'example-script-update',
    kind: 'notification',
    title: 'Your travel video script from yesterday is ready.',
    text: 'View script',
    meta: '10 min ago',
    detail:
      'OPENING · Everyone visits the Eiffel Tower. Today, we follow the people who call Paris home.\n\nStart at a neighbourhood bakery, follow a local market route, and close with the real cost of a day in the city.',
  },
  {
    id: 'example-evening',
    kind: 'question',
    title: 'A quick question before I continue.',
    text: 'Should I keep working on your Paris travel video tonight?',
    options: [
      { title: 'Continue', subtitle: 'Tonight' },
      { title: 'Tomorrow', subtitle: 'Pick it up later' },
    ],
  },
  {
    id: 'example-todos',
    kind: 'todo',
    title: 'A few things for you',
    text: '',
    options: [
      { title: 'Confirm Paris video cover', subtitle: 'Today' },
      { title: 'Reply to photographer Jack', subtitle: 'Tomorrow' },
      { title: 'Review Santorini video script', subtitle: 'Friday' },
    ],
  },
  {
    id: 'example-research',
    kind: 'agent_execution',
    title: 'Researching travel video trends',
    text: 'Searching recent travel videos and reference content…',
    meta: 'Paris Travel',
  },
  {
    id: 'example-report',
    kind: 'research_report',
    title: 'Travel beyond the postcard',
    text: '12 reference videos. Three directions for a more personal travel story.',
    meta: 'CONTENT RESEARCH · READY',
    detail:
      '01 · The real cost of a day\nFollow an honest daily budget: transport, food and the small costs most videos leave out.\n\n02 · Where locals actually go\nBuild the story around neighbourhood routines rather than landmark checklists.\n\n03 · A 24-hour city challenge\nChoose a clear constraint and let small discoveries carry the narrative.\n\nChoose one direction before developing the script.',
  },
  {
    id: 'example-analytics',
    kind: 'analytics',
    title: 'Paris Video Performance',
    text: 'Weekend viewership was noticeably higher than weekday performance.',
    meta: 'Last 7 days',
  },
  {
    id: 'example-email',
    kind: 'approval',
    title: 'Follow-up with Jack',
    text: 'Hi Jack, just following up on the footage from our Paris shoot. Could you share the latest files when you have a moment?',
    meta: 'Jack · Photographer',
  },
  {
    id: 'example-capture',
    kind: 'recording',
    title: 'A new direction, captured.',
    text: 'For the next Paris video, I want to focus more on how locals actually live. Research similar popular videos first, then help me choose a direction.',
    meta: 'Today · 11:42 AM · 00:38',
    options: [
      {
        title: 'New content direction extracted',
        subtitle: 'Local life, beyond the tourist route.',
      },
      {
        title: 'Linked to Paris Travel',
        subtitle: 'This example belongs to the same fictional creator project.',
      },
      {
        title: 'Research task prepared',
        subtitle:
          'Compare stories about neighbourhood routines and real travel costs.',
      },
    ],
  },
  {
    id: 'example-titles',
    kind: 'choice',
    title: 'Which title feels more like you?',
    text: 'Three directions for your Paris story.',
    options: [
      { title: '48 Hours in Paris', subtitle: 'Travel diary' },
      {
        title: 'The Paris You Never See',
        subtitle: 'Storytelling & curiosity',
      },
      { title: 'A Local’s Guide to Paris', subtitle: 'A practical guide' },
    ],
  },
  {
    id: 'example-schedule',
    kind: 'schedule',
    title: 'A little structure for today',
    text: '',
    options: [
      {
        title: 'Review video script',
        subtitle: '10:30 · Paris Travel · Draft ready',
      },
      {
        title: 'Creator partnership call',
        subtitle: '14:00 · Calendar example · Not synced',
      },
      { title: 'Publish video', subtitle: '18:00 · Waiting for approval' },
    ],
  },
  {
    id: 'example-preference',
    kind: 'memory_update',
    title: 'Something I noticed about your style.',
    text: 'You prefer authentic, restrained travel titles over exaggerated marketing language.',
    meta: 'Suggested preference · Not confirmed',
  },
  {
    id: 'example-completed',
    kind: 'completion',
    title: 'Your research summary is ready.',
    text: 'Saved to Paris Travel · 2:34 PM',
    detail:
      'The strongest direction is everyday local life: one neighbourhood, three encounters, and a transparent daily budget. This is sample content, not a completed cloud task.',
  },
  {
    id: 'example-authorize',
    kind: 'action_approval',
    title: 'Ready to send',
    text: 'Spur wants to send a follow-up email to Jack.',
    meta: 'Spur · Creator collaboration',
    detail:
      'Recipient: Jack · Photographer\nAction: Send email\n\nHi Jack, could you confirm when the Paris footage will be ready? We would love to plan the edit around your delivery date.',
  },
  {
    id: 'example-artifact',
    kind: 'completion_artifact',
    title: 'Script completed',
    text: 'Your Paris travel script is ready.',
    meta: 'PARIS TRAVEL · SCRIPT V2',
    detail:
      'SCENE 01 · Morning, before the crowds\nA bakery shutter opens. Street sounds replace music.\n\nVOICEOVER\nEveryone visits the Eiffel Tower. But what does Paris look like when you follow the locals?\n\nSCENE 02 · The neighbourhood market\nMeet a stallholder, compare seasonal produce, and show the price of breakfast.\n\nCLOSING\nOne neighbourhood. Three conversations. A different way to see Paris.',
  },
  {
    id: 'example-thumbnails',
    kind: 'visual_decision',
    title: 'Which visual direction should we use?',
    text: 'Two covers for your next travel story.',
    options: [
      { title: 'City stories', subtitle: 'Paris · Cinematic and intimate' },
      { title: 'Coastal light', subtitle: 'Santorini · Quiet and expansive' },
    ],
  },
  {
    id: 'example-file',
    kind: 'generated_deliverable',
    title: 'November Creator Strategy',
    text: 'Video performance, audience insights, content opportunities and next-month priorities.',
    meta: 'Presentation · 12 slides',
    detail:
      '01 · A clearer channel direction\nFocus on authentic travel stories and practical budgets.\n\n02 · What the audience responds to\nCompare narrative hooks, pacing and repeat viewing.\n\n03 · Next month’s priorities\nParis local life, transparent costs and one city challenge.\n\n04–12 · References, publishing cadence, production plan and review checklist.',
  },
  {
    id: 'example-revision',
    kind: 'comparison',
    title: 'A stronger opening.',
    text: 'Everyone visits the Eiffel Tower. But what does Paris look like when you follow the locals?',
    detail: 'Today I’m going to show you some interesting places in Paris.',
    meta: 'Rewritten to introduce a stronger narrative hook.',
  },
  {
    id: 'example-next',
    kind: 'next_action',
    title: 'What’s next?',
    text: 'Your travel research is ready. Shall we turn the strongest direction into a script outline?',
  },
  {
    id: 'example-recovery',
    kind: 'recovery',
    title: 'Unable to send the email.',
    text: 'The connection was interrupted. Your approved draft is safe.',
  },
  {
    id: 'example-transformation',
    kind: 'task_transformation',
    title: 'One task, from capture to outcome.',
    text: 'Contact Jack about video footage delivery.',
  },
];
export const sampleDailyViews = [
  60000, 110000, 155000, 145000, 190000, 240000, 300000,
];

export const patternDescriptions: Record<
  string,
  { name: string; use: string }
> = {
  notification: {
    name: 'Minimal Notification：轻量通知',
    use: '一句话能说明的更新，不需要卡片容器。',
  },
  question: {
    name: 'Inline Question：行内确认',
    use: '简单决策，当场回答，不打开详情页。',
  },
  todo: {
    name: 'Compact Checklist：紧凑待办',
    use: '个人待办，用清单行表达，不为每件小事制作卡片。',
  },
  agent_execution: {
    name: 'Execution Status：执行阶段',
    use: '有意义的工作阶段，代替虚假百分比。',
  },
  research_report: {
    name: 'Research Report：研究报告',
    use: '复杂成果先显示封面与摘要，点击后阅读正文。',
  },
  analytics: {
    name: 'Embedded Analytics：内嵌分析',
    use: '数据型结果，用图表表达变化；以下为示意指标。',
  },
  approval: {
    name: 'Email Draft：草稿审阅',
    use: '先查看和修改内容，批准草稿不等于发送。',
  },
  recording: {
    name: 'Capture Timeline：录音转化为行动',
    use: '展示原话如何变成方向、项目关联和任务。',
  },
  choice: {
    name: 'Choice Selector：标题选项',
    use: '快速比较多个文字方向，选择后原位反馈。',
  },
  schedule: {
    name: 'Schedule Timeline：时间安排',
    use: '按时间组织信息，不重复堆叠事件卡片。',
  },
  memory_update: {
    name: 'Learning Feedback：偏好确认',
    use: '看见并纠正 Agent 的推断，不静默变成永久记忆。',
  },
  completion: {
    name: 'Completion Event：轻量完成事件',
    use: '无需立即处理的成果，用一行成功更新。',
  },
  action_approval: {
    name: 'Action Approval：行动授权卡',
    use: '邮件发送、视频发布、日程修改、购买服务。',
  },
  completion_artifact: {
    name: 'Completion Artifact：成果凭证',
    use: '完成后有辨识度的结果，而不只是 Completed。',
  },
  visual_decision: {
    name: 'Visual Decision：视觉选项',
    use: '封面、风格、图片方案，用图像辅助决定。',
  },
  generated_deliverable: {
    name: 'Generated Deliverable：文件交付',
    use: 'PPT、PDF、文稿、表格等可预览、可修改的成果。',
  },
  comparison: {
    name: 'Before / After：修改对比',
    use: '脚本、标题、邮件优化，明确看到改了什么。',
  },
  next_action: {
    name: 'Contextual Next Action：下一步建议',
    use: '完成后自然提出与成果相关的后续动作。',
  },
  recovery: {
    name: 'Recovery State：失败与恢复',
    use: '保留上下文，给出明确恢复路径。',
  },
  task_transformation: {
    name: 'Task Transformation：同一任务原位变化',
    use: '从录音到执行、授权和结果，不追加重复任务卡片。',
  },
};
