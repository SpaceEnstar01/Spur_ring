import { useState } from "react";
import { DetailDrawer } from "./DetailDrawer";
import {
  aboutFields,
  initialAbout,
  memoryItems,
  recentMemoryIds,
  searchMemories,
  seedHistory,
  type AboutKey,
  type AboutMemory,
  type MemoryItem,
  type MemoryNode,
} from "./memoryDemoData";

type Tab = "about" | "people" | "projects" | "knowledge";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "about", label: "About Me" },
  { id: "people", label: "People" },
  { id: "projects", label: "Projects" },
  { id: "knowledge", label: "Knowledge" },
];

const kindOf: Record<Exclude<Tab, "about">, MemoryItem["kind"]> = {
  people: "person",
  projects: "project",
  knowledge: "knowledge",
};

export function MemoryPage() {
  const [about, setAbout] = useState<AboutMemory>(initialAbout);
  const [updated, setUpdated] = useState("Nov 8, 2026");
  const [history, setHistory] = useState(seedHistory);
  const [tab, setTab] = useState<Tab>("about");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<null | "edit" | "history">(null);
  const [draft, setDraft] = useState<AboutMemory>(initialAbout);
  const [notice, setNotice] = useState("");
  const selected = memoryItems.find((item) => item.id === selectedId) ?? null;
  const hits = query.trim() ? searchMemories(query, memoryItems, about) : null;

  function chooseTab(next: Tab) {
    setTab(next);
    setQuery("");
    setSelectedId(null);
    setNotice("");
  }

  function openEdit() {
    setDraft(about);
    setDrawer("edit");
  }

  function saveEdit() {
    setAbout(draft);
    setUpdated("Updated just now");
    setHistory((items) => [
      { date: "Now", text: "Edited the example profile in this browser session." },
      ...items,
    ]);
    setDrawer(null);
    setNotice("Demo profile updated. Nothing was written to a real memory store.");
  }

  return (
    <section className="memory-page">
      <p className="memory-crumb">PERSONAL KNOWLEDGE</p>
      <div className="memory-top">
        <div>
          <h1>Memory</h1>
          <p>What Spur remembers about you, your people, and your work.</p>
        </div>
        <span className="memory-example">Example</span>
      </div>
      <input
        className="memory-search"
        value={query}
        placeholder="Search memories…"
        aria-label="搜索记忆"
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId(null);
        }}
      />
      <div className="memory-tabs" role="tablist" aria-label="Memory">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id && !hits && !selected}
            className={tab === item.id && !hits && !selected ? "active" : ""}
            onClick={() => chooseTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {selected ? (
        <MemoryDetail item={selected} onBack={() => setSelectedId(null)} />
      ) : hits ? (
        <SearchResults
          query={query}
          hits={hits}
          about={about}
          onAbout={() => chooseTab("about")}
          onOpen={setSelectedId}
        />
      ) : tab === "about" ? (
        <AboutView
          about={about}
          updated={updated}
          notice={notice}
          onEdit={openEdit}
          onHistory={() => setDrawer("history")}
          onOpen={setSelectedId}
        />
      ) : (
        <CardSection
          title={tabs.find((item) => item.id === tab)?.label || ""}
          items={memoryItems.filter((item) => item.kind === kindOf[tab])}
          onOpen={setSelectedId}
        />
      )}
      <p className="memory-footnote">
        Example memories only. People, companies, emails, and records on this page are fictional and are not read from a real account.
      </p>
      {drawer && (
        <DetailDrawer
          title={drawer === "edit" ? "Edit About Me" : "Memory history"}
          onClose={() => setDrawer(null)}
        >
          {drawer === "edit" ? (
            <div className="memory-editor">
              <p>Update the example profile. This stays in the current session and is not saved to the cloud.</p>
              {aboutFields.map((field) => (
                <label key={field.key}>
                  {field.title}
                  <textarea
                    value={draft[field.key]}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                  />
                </label>
              ))}
              <div className="memory-editor-actions">
                <button type="button" onClick={() => setDrawer(null)}>
                  Cancel
                </button>
                <button type="button" className="primary" onClick={saveEdit}>
                  Save changes
                </button>
              </div>
            </div>
          ) : (
            <div className="memory-history">
              <p>Example change history. It is not connected to a real account.</p>
              <ol>
                {history.map((event, index) => (
                  <li key={event.date + index}>
                    <small>{event.date}</small>
                    {event.text}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </DetailDrawer>
      )}
    </section>
  );
}

function AboutView({
  about,
  updated,
  notice,
  onEdit,
  onHistory,
  onOpen,
}: {
  about: AboutMemory;
  updated: string;
  notice: string;
  onEdit: () => void;
  onHistory: () => void;
  onOpen: (id: string) => void;
}) {
  const recent = recentMemoryIds
    .map((id) => memoryItems.find((item) => item.id === id))
    .filter((item): item is MemoryItem => Boolean(item));
  return (
    <>
      <section className="memory-surface memory-profile">
        <div className="memory-profile-top">
          <div>
            <h2>About Me</h2>
            <p>A living profile, shaped by what you capture and what the Agent is allowed to learn.</p>
            <small>Last updated {updated}</small>
          </div>
          <div>
            <button type="button" onClick={onHistory}>
              History
            </button>
            <button type="button" onClick={onEdit}>
              Edit
            </button>
          </div>
        </div>
        <div className="memory-fields">
          {aboutFields.map((field) => (
            <article key={field.key}>
              <h3>{field.title}</h3>
              <p>{about[field.key]}</p>
            </article>
          ))}
        </div>
        {notice && <p className="memory-notice" role="status">{notice}</p>}
      </section>
      <CardSection title="Recently remembered" note="From example ideas, tasks, and conversations" items={recent} onOpen={onOpen} />
    </>
  );
}

function CardSection({
  title,
  note,
  items,
  onOpen,
}: {
  title: string;
  note?: string;
  items: MemoryItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <div className="memory-section-head">
        <h2>{title}</h2>
        <span>{note || `${items.length} examples`}</span>
      </div>
      <div className="memory-cards">
        {items.map((item) => (
          <MemoryCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function MemoryCard({ item, onOpen }: { item: MemoryItem; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="memory-card" onClick={() => onOpen(item.id)}>
      <span>{item.symbol}</span>
      <strong>{item.title}</strong>
      <small>{item.subtitle}</small>
      {item.history[0] && <em>{item.history[0].date} · {item.history[0].text}</em>}
    </button>
  );
}

function SearchResults({
  query,
  hits,
  about,
  onAbout,
  onOpen,
}: {
  query: string;
  hits: ReturnType<typeof searchMemories>;
  about: AboutMemory;
  onAbout: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <div className="memory-section-head">
        <h2>Search results</h2>
        <span>{hits.length} for “{query.trim()}”</span>
      </div>
      {hits.length === 0 ? (
        <div className="memory-empty">
          <strong>No matching memories</strong>
          <p>Try a person, company, project, or topic from the examples.</p>
        </div>
      ) : (
        <div className="memory-cards">
          {hits.map((hit) => {
            if (hit.kind === "about") {
              const field = aboutFields.find((item) => item.key === hit.field) as { key: AboutKey; title: string };
              return (
                <button key={hit.field} type="button" className="memory-card" onClick={onAbout}>
                  <span>✎</span>
                  <strong>About Me</strong>
                  <small>{field.title}</small>
                  <em>{about[hit.field]}</em>
                </button>
              );
            }
            const item = memoryItems.find((entry) => entry.id === hit.id);
            return item ? <MemoryCard key={item.id} item={item} onOpen={onOpen} /> : null;
          })}
        </div>
      )}
    </section>
  );
}

function MemoryDetail({ item, onBack }: { item: MemoryItem; onBack: () => void }) {
  return (
    <article className="memory-detail">
      <button type="button" className="memory-back" onClick={onBack}>
        ← Back to Memory
      </button>
      <h2>{item.title}</h2>
      <p className="memory-intro">{item.intro}</p>
      <div className="memory-detail-grid">
        <div>
          <section className="memory-surface">
            <h3>What Spur remembers</h3>
            <dl>
              {item.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
            <p className="memory-hint">Illustrative memory with the source named on each example.</p>
          </section>
          <section className="memory-surface">
            <h3>Interaction history</h3>
            <ol className="memory-timeline">
              {item.history.map((event) => (
                <li key={event.date + event.text}>
                  <small>{event.date}</small>
                  {event.text}
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div>
          <section className="memory-surface">
            <h3>Related connections</h3>
            <MemoryGraph key={item.id} nodes={item.nodes} />
          </section>
          <section className="memory-surface">
            <h3>Next action</h3>
            <p>{item.nextAction}</p>
            <p className="memory-hint">No email is sent and no Agent task is started from this page.</p>
          </section>
        </div>
      </div>
    </article>
  );
}

const nodeSpots = [
  { left: "50%", top: "46%" },
  { left: "18%", top: "22%" },
  { left: "78%", top: "22%" },
  { left: "20%", top: "78%" },
  { left: "80%", top: "78%" },
  { left: "50%", top: "16%" },
];

function MemoryGraph({ nodes }: { nodes: MemoryNode[] }) {
  const shown = nodes.slice(0, 6);
  const [active, setActive] = useState(shown[0]?.id || "");
  const note = shown.find((node) => node.id === active)?.note || "Select a node to see why it is linked.";
  return (
    <>
      <div className="memory-graph">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {shown.slice(1).map((node, index) => {
            const spot = nodeSpots[index + 1];
            return (
              <line
                key={node.id}
                x1="50"
                y1="46"
                x2={Number.parseFloat(spot.left)}
                y2={Number.parseFloat(spot.top)}
                stroke="#e1e2e6"
                strokeWidth="0.6"
              />
            );
          })}
        </svg>
        {shown.map((node, index) => (
          <button
            key={node.id}
            type="button"
            className={`${index === 0 ? "core" : ""} ${node.id === active ? "active" : ""}`}
            style={nodeSpots[index]}
            onClick={() => setActive(node.id)}
          >
            {node.label}
          </button>
        ))}
      </div>
      <p className="memory-graph-note">{note}</p>
    </>
  );
}
