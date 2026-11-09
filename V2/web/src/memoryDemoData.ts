export type AboutKey = "who" | "work" | "follow" | "howWork" | "communicate";

export type AboutMemory = Record<AboutKey, string>;

export type MemoryKind = "person" | "project" | "knowledge";

export type MemoryFact = { label: string; value: string };

export type MemoryEvent = { date: string; text: string };

export type MemoryNode = { id: string; label: string; note: string };

export type MemoryItem = {
  id: string;
  kind: MemoryKind;
  title: string;
  subtitle: string;
  symbol: string;
  intro: string;
  facts: MemoryFact[];
  history: MemoryEvent[];
  nodes: MemoryNode[];
  nextAction: string;
  updated: string;
};

export const aboutFields: Array<{ key: AboutKey; title: string }> = [
  { key: "who", title: "Who I Am" },
  { key: "work", title: "Work" },
  { key: "follow", title: "What I Follow" },
  { key: "howWork", title: "How I Work" },
  { key: "communicate", title: "How I Communicate" },
];

export const initialAbout: AboutMemory = {
  who: "A technology founder working on tools that keep a person’s intentions, then turn the ones they choose into work an agent can carry forward.",
  work: "Building Spur, an AI Ring paired with a Personal Agent. The current product thread is capture on the ring, a daily Idea page, and Memory that stays useful across days.",
  follow: "AI hardware, personal agents, embodied intelligence, and the way creators actually use them over months rather than in a single chat.",
  howWork: "Capture a thought when it appears, review it later with its date and source, then decide what becomes a task. An idea stays an idea until it is explicitly handed over.",
  communicate: "Prefers direct language: the next step, the source, and what is still uncertain. A draft is a draft. A message is not described as sent unless it was sent.",
};

export const seedHistory: MemoryEvent[] = [
  { date: "Nov 8", text: "Grouped example notes about AI hardware and how a personal agent should keep context." },
  { date: "Nov 6", text: "Attached the fictional Paris Travel Film to photographer Jack. The follow-up email remains a draft." },
  { date: "Nov 4", text: "Connected an example filming conversation to the same project." },
];

export const memoryItems: MemoryItem[] = [
  {
    id: "jack",
    kind: "person",
    title: "Jack",
    subtitle: "Photographer · Studio Lumière · Paris Travel Film",
    symbol: "◉",
    intro: "A fictional collaborator remembered across a sample email thread, a project plan, and an Agent draft that was never sent.",
    facts: [
      { label: "Name", value: "Jack" },
      { label: "Role", value: "Photographer" },
      { label: "Company", value: "Studio Lumière (fictional)" },
      { label: "Email", value: "jack@example.com (fictional)" },
      { label: "Project", value: "Paris Travel Film" },
      { label: "Source", value: "Example email thread and Agent task" },
    ],
    history: [
      { date: "Nov 6", text: "Agent prepared a follow-up email. The draft is still waiting. It was not sent." },
      { date: "Nov 4", text: "Discussed a filming plan for the Paris travel days." },
      { date: "Nov 2", text: "First contact about a possible shoot." },
    ],
    nodes: [
      { id: "jack", label: "Jack", note: "The person at the center of this example. Spur remembers the role, not a live contact book." },
      { id: "studio", label: "Studio Lumière", note: "Fictional studio named in the sample thread. No real company record is connected." },
      { id: "paris", label: "Paris Travel Film", note: "The project Jack is linked to. Ideas from Nov 6 stay on that day." },
      { id: "email", label: "Email discussion", note: "A sample thread used to show where a relationship could come from." },
      { id: "task", label: "Follow-up task", note: "The Agent drafted a follow-up. The example does not mark it as sent." },
    ],
    nextAction: "Review the draft and ask Jack to confirm dates and a rough shoot cost. Nothing is sent from this page.",
    updated: "Nov 6, 2026",
  },
  {
    id: "sarah",
    kind: "person",
    title: "Sarah",
    subtitle: "Brand Manager · Nova Tech · Partnership discussion",
    symbol: "◉",
    intro: "A fictional brand contact. The conversation is remembered as an open discussion, not a closed deal.",
    facts: [
      { label: "Name", value: "Sarah" },
      { label: "Role", value: "Brand Manager" },
      { label: "Company", value: "Nova Tech (fictional)" },
      { label: "Relationship", value: "Potential sponsorship, still open" },
      { label: "Source", value: "Example partnership conversation" },
    ],
    history: [
      { date: "Nov 5", text: "Talked through possible sponsorship deliverables. No agreement was recorded." },
    ],
    nodes: [
      { id: "sarah", label: "Sarah", note: "Example brand contact. This is not a synced address book." },
      { id: "nova", label: "Nova Tech", note: "Fictional company used only in the demo." },
      { id: "partners", label: "Creator Partnerships", note: "The longer project this conversation belongs to." },
      { id: "email", label: "Partnership note", note: "Sample notes about scope. No mailbox was read." },
    ],
    nextAction: "Review the partnership scope before any reply. This page will not send one.",
    updated: "Nov 5, 2026",
  },
  {
    id: "alex",
    kind: "person",
    title: "Alex",
    subtitle: "Producer · Independent · Travel video",
    symbol: "◉",
    intro: "A fictional producer who helps turn travel notes into a cut. The schedule is a memory, not a confirmed booking.",
    facts: [
      { label: "Name", value: "Alex" },
      { label: "Role", value: "Video producer" },
      { label: "Project", value: "Paris Travel Film" },
      { label: "Source", value: "Example collaboration note" },
    ],
    history: [
      { date: "Nov 3", text: "Discussed an editing window after the Paris days." },
    ],
    nodes: [
      { id: "alex", label: "Alex", note: "Example producer. No real calendar was checked." },
      { id: "paris", label: "Paris Travel Film", note: "Alex is remembered as part of the edit, after the shoot." },
      { id: "jack", label: "Jack", note: "The photographer on the same fictional project." },
      { id: "note", label: "Production note", note: "A sample note about milestones, kept separate from a live task." },
    ],
    nextAction: "Confirm edit milestones with Alex when the shoot dates are real. Nothing here is scheduled.",
    updated: "Nov 3, 2026",
  },
  {
    id: "paris",
    kind: "project",
    title: "Paris Travel Film",
    subtitle: "Travel film · People, routes, and a shoot that is still being planned",
    symbol: "▣",
    intro: "A project memory built from several days of travel notes, two collaborators, and one unsent follow-up. It is not a task list.",
    facts: [
      { label: "Background", value: "A short travel film shaped by walking routes, cafés, and what is actually worth filming." },
      { label: "People", value: "Jack, photographer · Alex, producer" },
      { label: "Knowledge", value: "Travel filming, budgets, and how a day of notes becomes a cut" },
      { label: "Source", value: "Example Idea records from Nov 6 and a sample task note" },
      { label: "Updated", value: "Nov 6, 2026" },
    ],
    history: [
      { date: "Nov 6", text: "Travel notes and a route were kept with the day they were captured." },
      { date: "Nov 4", text: "Filming windows were discussed with Jack." },
      { date: "Nov 2", text: "The project started as a possible collaboration, not a booked shoot." },
    ],
    nodes: [
      { id: "paris", label: "Paris Travel Film", note: "The project itself. Spur keeps the context across days." },
      { id: "jack", label: "Jack", note: "Photographer linked through the sample email and the draft follow-up." },
      { id: "ideas", label: "Travel ideas", note: "Nov 6 example ideas. They are not copied onto other dates." },
      { id: "email", label: "Messages", note: "Sample discussion only. No mailbox was opened." },
      { id: "plan", label: "Shoot plan", note: "A plan under review. Dates are not confirmed." },
    ],
    nextAction: "Settle the filming window before promising a delivery date.",
    updated: "Nov 6, 2026",
  },
  {
    id: "ring",
    kind: "project",
    title: "Spur AI Ring",
    subtitle: "Product · Capture, memory, and the action a person chooses",
    symbol: "▣",
    intro: "Example project memory for the product being shown. It collects how the ring, Idea, and Memory are meant to stay distinct.",
    facts: [
      { label: "Background", value: "A wearable that keeps a moment, a page that organizes the day, and a memory the agent can use later." },
      { label: "Focus", value: "Capture, then memory, then an action the user confirms" },
      { label: "Knowledge", value: "AI Hardware · Personal Agent" },
      { label: "Source", value: "Example product discussion on Nov 8" },
      { label: "Updated", value: "Nov 8, 2026" },
    ],
    history: [
      { date: "Nov 8", text: "The Memory page was discussed as a place for people, projects, and knowledge, not a file cabinet." },
      { date: "Nov 7", text: "A blank day was kept blank, so the product can show a real rhythm." },
    ],
    nodes: [
      { id: "ring", label: "Spur AI Ring", note: "The product project in this demo." },
      { id: "hardware", label: "AI Hardware", note: "Knowledge about form, privacy, and always-on versus a press." },
      { id: "agent", label: "Personal Agent", note: "Knowledge about intent, execution, and context that lasts." },
      { id: "ideas", label: "Daily ideas", note: "Example ideas from the Idea page. They are not live ring transcripts." },
    ],
    nextAction: "Keep reviewing the Memory experience against a real day of use. No product setting is changed here.",
    updated: "Nov 8, 2026",
  },
  {
    id: "partners",
    kind: "project",
    title: "Creator Partnerships",
    subtitle: "Commercial conversations that stay open until there is a decision",
    symbol: "▣",
    intro: "A project memory for brand conversations. It holds who was involved and what is still undecided.",
    facts: [
      { label: "Background", value: "Outreach and sponsorship talks that should not be flattened into a single completed task." },
      { label: "People", value: "Sarah at Nova Tech" },
      { label: "Knowledge", value: "What a partnership needs before a reply is worth sending" },
      { label: "Source", value: "Example business notes" },
      { label: "Updated", value: "Nov 5, 2026" },
    ],
    history: [
      { date: "Nov 5", text: "Sarah’s conversation was filed as an open discussion." },
    ],
    nodes: [
      { id: "partners", label: "Partnerships", note: "The ongoing commercial context." },
      { id: "sarah", label: "Sarah", note: "Brand manager in the fictional Nova Tech thread." },
      { id: "nova", label: "Nova Tech", note: "Fictional company. Not a connected CRM." },
      { id: "email", label: "Open note", note: "Sample scope notes. No message was sent." },
    ],
    nextAction: "Read the open scope before drafting a reply.",
    updated: "Nov 5, 2026",
  },
  {
    id: "hardware",
    kind: "knowledge",
    title: "AI Hardware",
    subtitle: "What a personal device should remember, and what it should leave alone",
    symbol: "◇",
    intro: "Knowledge gathered from repeated hardware notes: form, privacy, and the difference between always listening and a deliberate press.",
    facts: [
      { label: "Overview", value: "A ring is closer to jewelry than to a small recorder. The useful promise is a kept moment, not a day of surveillance." },
      { label: "Important memory", value: "Always-on and press-to-capture feel different. Cloud text should be what the person confirmed." },
      { label: "Source", value: "Example daily ideas from Nov 8" },
      { label: "Related", value: "Spur AI Ring" },
      { label: "Updated", value: "Nov 8, 2026" },
    ],
    history: [
      { date: "Nov 8", text: "Hardware notes were grouped into one topic instead of thirty separate lines." },
    ],
    nodes: [
      { id: "hardware", label: "AI Hardware", note: "The topic, built from several example ideas." },
      { id: "ring", label: "Spur AI Ring", note: "The project these observations belong to." },
      { id: "privacy", label: "Privacy", note: "A repeated concern: raw audio stays on the phone until the person confirms the text." },
      { id: "ideas", label: "Nov 8 ideas", note: "Source notes. They are demo copy, not a live transcript." },
    ],
    nextAction: "Revisit the open questions about charging, sync, and what the ring is allowed to keep.",
    updated: "Nov 8, 2026",
  },
  {
    id: "agent-knowledge",
    kind: "knowledge",
    title: "Personal Agent",
    subtitle: "Intent, execution, and context that outlives one chat",
    symbol: "◇",
    intro: "A topic about how an agent should use memory: it can prepare work, and the person still decides what happens.",
    facts: [
      { label: "Overview", value: "The agent is useful when it can see the people, projects, and unfinished ideas around a request." },
      { label: "Important memory", value: "A task is created only when the person hands an idea over. Status stays specific: running, finished, or waiting." },
      { label: "Source", value: "Example Idea notes and Agent tasks" },
      { label: "Related", value: "Spur AI Ring · Jack’s unsent follow-up" },
      { label: "Updated", value: "Nov 8, 2026" },
    ],
    history: [
      { date: "Nov 8", text: "Agent observations were grouped with the rule that a draft is not a completed action." },
      { date: "Nov 6", text: "A follow-up for Jack was remembered as prepared, not delivered." },
    ],
    nodes: [
      { id: "agent", label: "Personal Agent", note: "The topic of intent, tools, and memory." },
      { id: "ring", label: "Spur AI Ring", note: "The product project this topic supports." },
      { id: "jack", label: "Jack", note: "A person whose follow-up shows the boundary: drafted, not sent." },
      { id: "tasks", label: "Agent tasks", note: "Example tasks. They are not the live task history." },
    ],
    nextAction: "Use this topic when deciding which future requests may read Memory, and which must ask again.",
    updated: "Nov 8, 2026",
  },
  {
    id: "embodied",
    kind: "knowledge",
    title: "Embodied Intelligence",
    subtitle: "Robots and learning systems that act through a body",
    symbol: "◇",
    intro: "A longer-running interest, kept as knowledge rather than as a file dropped into a folder.",
    facts: [
      { label: "Overview", value: "Interest sits in robot learning, vision-language-action models, and the gap between a simulation and a real body." },
      { label: "Important memory", value: "The useful question is what a system can do with a body and a memory, not a longer chat transcript." },
      { label: "Source", value: "Example research note from Nov 7" },
      { label: "Related", value: "AI Hardware" },
      { label: "Updated", value: "Nov 7, 2026" },
    ],
    history: [
      { date: "Nov 7", text: "A research observation was saved on a day that otherwise stayed empty of tasks." },
    ],
    nodes: [
      { id: "embodied", label: "Embodied Intelligence", note: "The research topic in this demo." },
      { id: "hardware", label: "AI Hardware", note: "Nearby knowledge about devices a person actually wears." },
      { id: "vla", label: "Robot learning", note: "Sample interest in VLA and sim-to-real. No paper library is connected." },
      { id: "note", label: "Research note", note: "One example note from Nov 7." },
    ],
    nextAction: "Keep collecting notes that change the question. Do not turn the topic into a reading list yet.",
    updated: "Nov 7, 2026",
  },
];

export const recentMemoryIds = ["jack", "paris", "hardware"];

export type MemoryHit =
  | { kind: "item"; id: string }
  | { kind: "about"; field: AboutKey };

function matchesMemory(text: string, needle: string) {
  const haystack = text.toLowerCase();
  if (needle.length >= 4) return haystack.includes(needle);
  return haystack.split(/[^a-z0-9]+/).some((word) => word.startsWith(needle));
}

export function searchMemories(query: string, items: MemoryItem[], about: AboutMemory): MemoryHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: MemoryHit[] = [];
  for (const field of aboutFields) {
    if (matchesMemory(`${field.title} ${about[field.key]}`, needle)) {
      hits.push({ kind: "about", field: field.key });
    }
  }
  for (const item of items) {
    const text = [
      item.title,
      item.subtitle,
      item.intro,
      item.nextAction,
      item.updated,
      ...item.facts.map((fact) => `${fact.label} ${fact.value}`),
      ...item.history.map((event) => `${event.date} ${event.text}`),
      ...item.nodes.map((node) => `${node.label} ${node.note}`),
    ].join(" ");
    if (matchesMemory(text, needle)) hits.push({ kind: "item", id: item.id });
  }
  return hits;
}
