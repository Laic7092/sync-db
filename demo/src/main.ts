import "./style.css";
import { createClient, LoggerPlugin, detectEnv } from "sync-db";
import type { Collection, InternalDocument } from "sync-db";

interface Todo {
  text: string;
  done: boolean;
  [key: string]: unknown;
}

type TodoDoc = Todo & InternalDocument;

const form = document.getElementById("form-todo") as HTMLFormElement;
const input = document.getElementById("input-todo") as HTMLInputElement;
const listEl = document.getElementById("todo-list") as HTMLUListElement;
const countEl = document.getElementById("status-count") as HTMLSpanElement;
const badgeEl = document.getElementById("adapter-badge") as HTMLDivElement;
const logPanel = document.getElementById("log-panel") as HTMLDivElement;
const btnLog = document.getElementById("btn-log") as HTMLButtonElement;
const btnClear = document.getElementById("btn-clear") as HTMLButtonElement;
const filterBtns = document.querySelectorAll<HTMLButtonElement>(".filter-btn");

let filter: "all" | "active" | "completed" = "all";
let collection: Collection<Todo>;

const logLines: string[] = [];
const origConsole = console;
const levels = ["log", "info", "warn", "debug"] as const;

for (const level of levels) {
  const orig = origConsole[level];
  (console as unknown as Record<string, (...args: unknown[]) => void>)[level] = (
    ...args: unknown[]
  ) => {
    orig.call(origConsole, ...args);
    const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
    if (line.includes("[sync-db]") || line.startsWith("Adapter:") || line.startsWith("Client")) {
      logLines.push(line);
      if (logLines.length > 50) logLines.shift();
      renderLog();
    }
  };
}

function renderLog(): void {
  const el = document.createElement("span");
  logPanel.innerHTML = logLines
    .map((l) => {
      el.textContent = l;
      return `<div class="log-line">${el.innerHTML}</div>`;
    })
    .join("");
  logPanel.scrollTop = logPanel.scrollHeight;
}

async function render(): Promise<void> {
  let docs: TodoDoc[];
  switch (filter) {
    case "active":
      docs = await collection.find({ done: false });
      break;
    case "completed":
      docs = await collection.find({ done: true });
      break;
    default:
      docs = await collection.find();
  }
  const total = await collection.count();
  const doneCount = await collection.count({ done: true });
  countEl.textContent = `${doneCount}/${total} 已完成`;

  if (docs.length === 0) {
    listEl.innerHTML = `<li class="empty-state"><p>暂无任务</p></li>`;
    return;
  }
  listEl.innerHTML = docs
    .map((d) => {
      const span = document.createElement("span");
      span.textContent = d.text;
      return `<li class="todo-item ${d.done ? "completed" : ""}" data-id="${d._id}">
      <button class="todo-check" data-toggle="${d._id}"></button>
      <span class="todo-text">${span.innerHTML}</span>
      <button class="todo-delete" data-delete="${d._id}" title="删除">×</button>
    </li>`;
    })
    .join("");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await collection.insert({ text, done: false });
  await render();
});

listEl.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  if (target.dataset.toggle) {
    const doc = await collection.findById(target.dataset.toggle);
    if (doc) {
      await collection.updateById(doc._id, { done: !doc.done });
      await render();
    }
  }
  if (target.dataset.delete) {
    await collection.removeById(target.dataset.delete);
    await render();
  }
});

btnClear.addEventListener("click", async () => {
  await collection.remove({ done: true });
  await render();
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.filter as typeof filter;
    void render();
  });
});

btnLog.addEventListener("click", () => {
  logPanel.classList.toggle("hidden");
  if (!logPanel.classList.contains("hidden")) renderLog();
});

async function init(): Promise<void> {
  const env = detectEnv();
  const db = createClient();
  db.use(new LoggerPlugin({ level: "info" }));
  db.on("error", (err) => {
    logLines.push(`ERROR: ${err.message}`);
    renderLog();
  });
  await db.open("sync-db-demo");
  collection = db.collection<Todo>("todos");

  if ((await collection.count()) === 0) {
    await collection.insert({ text: "学习 sync-db 基础用法", done: true });
    await collection.insert({ text: "尝试插件系统", done: true });
    await collection.insert({ text: "探索同步功能", done: false });
    await collection.insert({ text: "构建一个酷炫的应用", done: false });
  }

  const name = env.runtime === "browser" ? (env.hasIndexedDB ? "IndexedDB" : "Memory") : "Memory";
  badgeEl.textContent = `${name} · ${env.runtime}`;
  logLines.push(`Client open: adapter=${name}, runtime=${env.runtime}`);
  renderLog();
  await render();
}

void init();
