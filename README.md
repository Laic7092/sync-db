# sync-db

同步式数据库，多平台多后端、自动选择通信方式、插件可扩展。

## 安装

```bash
pnpm add sync-db
```

## 快速开始

```ts
import { createClient, LoggerPlugin } from "sync-db";

const db = createClient();

// 可选：安装日志插件
db.use(new LoggerPlugin());

// 打开数据库（自动检测最优后端）
await db.open("my-app");

// 获取集合（不存在则自动创建）
const users = db.collection("users");

// 插入文档
const alice = await users.insert({ name: "Alice", age: 30, email: "alice@example.com" });
console.log(alice._id); // "550e8400-e29b-..."

// 查询
const adults = await users.find({ age: { $gte: 18 } });

// 更新
await users.update({ name: "Alice" }, { age: 31 });

// 按 ID 更新
await users.updateById(alice._id, { email: "alice@new.com" });

// 删除
await users.remove({ name: "Alice" });

// 按 ID 删除
await users.removeById(alice._id);

// 计数
const count = await users.count({ age: { $gte: 18 } });

await db.close();
```

---

## API 参考

### 创建客户端

#### `createClient(): SyncDBClient`

创建一个 sync-db 客户端实例。客户端是轻量对象，需调用 `open()` 后才真正建立连接。

```ts
const db = createClient();
```

---

### SyncDBClient

#### `open(name: string, config?: SyncDBConfig): Promise<void>`

打开数据库连接。`config` 可选：

| 字段             | 类型                                      | 默认值   | 说明                 |
| ---------------- | ----------------------------------------- | -------- | -------------------- |
| `adapter`        | `"auto" \| "memory" \| "idb" \| "sqlite"` | `"auto"` | 数据库后端           |
| `adapterOptions` | `Record<string, unknown>`                 | —        | 传给适配器的额外选项 |

```ts
// 自动选择
await db.open("my-app");

// 强制使用 SQLite
await db.open("my-app", { adapter: "sqlite" });

// 强制使用内存
await db.open("my-app", { adapter: "memory" });
```

#### `close(): Promise<void>`

关闭数据库连接，释放资源。若有活跃同步会自动停止。

```ts
await db.close();
```

#### `isOpen: boolean`

数据库是否已打开。

#### `databaseName: string | null`

当前数据库名称，未打开时为 `null`。

---

### 集合操作

#### `collection<T>(name: string): Collection<T>`

获取一个集合。集合不存在时会自动创建。

```ts
const posts = db.collection<{ title: string; body: string; tags: string[] }>("posts");
```

#### `listCollections(): Promise<string[]>`

列出所有集合名称。

```ts
const names = await db.listCollections(); // ["users", "posts"]
```

---

### Collection

#### `insert(doc: T): Promise<T & InternalDocument>`

插入一个文档。自动生成 `_id`、`_createdAt`、`_updatedAt`。

返回带上内部字段的完整文档。

```ts
const doc = await users.insert({ name: "Bob", age: 25 });
// {
//   _id: "uuid...",
//   _createdAt: 1714764800000,
//   _updatedAt: 1714764800000,
//   name: "Bob",
//   age: 25
// }
```

#### `findById(id: string): Promise<(T & InternalDocument) | null>`

按 `_id` 查找文档。O(1) 查询。

```ts
const user = await users.findById("550e8400-e29b-...");
```

#### `find(filter?: Filter<T>): Promise<(T & InternalDocument)[]>`

按条件查询。支持完整的过滤、排序、分页语法（通过 Query 对象）。

```ts
// 简单匹配
const all = await users.find({ name: "Alice" });

// 操作符
const adults = await users.find({ age: { $gte: 18 } });

// 组合条件
const result = await users.find({
  $and: [{ age: { $gte: 18 } }, { age: { $lt: 65 } }],
});

// $or
const special = await users.find({
  $or: [{ name: "Alice" }, { name: "Bob" }],
});
```

#### `findOne(filter: Filter<T>): Promise<(T & InternalDocument) | null>`

返回匹配的第一条文档。

```ts
const first = await users.findOne({ name: "Alice" });
```

#### `update(filter: Filter<T>, changes: Partial<T>): Promise<number>`

按条件批量更新，返回受影响的文档数。

```ts
const n = await users.update({ age: { $lt: 18 } }, { verified: false });
// n = 3  （更新了 3 条）
```

#### `updateById(id: string, changes: Partial<T>): Promise<T & InternalDocument>`

按 `_id` 更新单条文档，返回更新后的文档。

```ts
const updated = await users.updateById("uuid...", { name: "NewName" });
```

#### `remove(filter: Filter<T>): Promise<number>`

按条件批量删除，返回删除的文档数。

```ts
const n = await users.remove({ active: false });
```

#### `removeById(id: string): Promise<void>`

按 `_id` 删除单条文档。

```ts
await users.removeById("uuid...");
```

#### `count(filter?: Filter<T>): Promise<number>`

统计匹配文档数量。

```ts
const total = await users.count();
const adultCount = await users.count({ age: { $gte: 18 } });
```

---

### 过滤器语法

| 操作符    | 说明                     | 示例                                        |
| --------- | ------------------------ | ------------------------------------------- |
| `$eq`     | 等于（可省略，直接传值） | `{ age: 25 }` 等价于 `{ age: { $eq: 25 } }` |
| `$ne`     | 不等于                   | `{ status: { $ne: "deleted" } }`            |
| `$gt`     | 大于                     | `{ score: { $gt: 80 } }`                    |
| `$gte`    | 大于等于                 | `{ score: { $gte: 60 } }`                   |
| `$lt`     | 小于                     | `{ price: { $lt: 100 } }`                   |
| `$lte`    | 小于等于                 | `{ price: { $lte: 200 } }`                  |
| `$in`     | 在数组中                 | `{ role: { $in: ["admin", "mod"] } }`       |
| `$nin`    | 不在数组中               | `{ role: { $nin: ["banned"] } }`            |
| `$regex`  | 正则匹配（字符串）       | `{ email: { $regex: /@gmail\.com$/ } }`     |
| `$exists` | 字段存在与否             | `{ deletedAt: { $exists: false } }`         |
| `$and`    | 逻辑与                   | `{ $and: [{ a: 1 }, { b: 2 }] }`            |
| `$or`     | 逻辑或                   | `{ $or: [{ a: 1 }, { b: 2 }] }`             |

---

### 内部文档字段

每个插入的文档会自动带上以下字段：

| 字段         | 类型       | 说明                     |
| ------------ | ---------- | ------------------------ |
| `_id`        | `string`   | UUID 主键                |
| `_createdAt` | `number`   | 创建时间戳 (ms)          |
| `_updatedAt` | `number`   | 最后更新时间戳 (ms)      |
| `_deleted`   | `boolean?` | 软删除标记（供同步使用） |

---

### 数据库后端

#### 自动选择逻辑

| 环境    | 检测条件                  | 选择              |
| ------- | ------------------------- | ----------------- |
| 浏览器  | `indexedDB` 可用          | `idb` (IndexedDB) |
| 浏览器  | `indexedDB` 不可用        | `memory`          |
| Node.js | `better-sqlite3` 可加载   | `sqlite`          |
| Node.js | `better-sqlite3` 不可加载 | `memory`          |
| 其他    | —                         | `memory`          |

#### 显式指定

```ts
// IndexedDB（浏览器）
const db = createClient();
await db.open("app", { adapter: "idb" });

// SQLite（Node.js）
const db = createClient();
await db.open("app.db", { adapter: "sqlite" });

// 内存（测试 / 临时）
const db = createClient();
await db.open("app", { adapter: "memory" });
```

#### InMemoryAdapter

零依赖的 Map 实现。数据仅存在于内存中，`close()` 后丢失。适用于测试和快速原型。

#### IndexedDBAdapter

浏览器端的持久化存储。每个 Collection 对应一个 ObjectStore。数据库按需升级版本以创建新 ObjectStore。

依赖：`idb`（纯 JS，约 2KB gzip）。

#### SQLiteAdapter

Node.js 端持久化存储。每个 Collection 对应一张表，文档以 JSON 文本存储在 `doc` 列中。启用 WAL 模式以获得更好的并发性能。

依赖：`better-sqlite3`（native 模块）。

---

### 同步

#### `sync(url: string, transportKind?: TransportKind): Promise<void>`

启动与远程端的同步。`transportKind` 默认 `"auto"`。

```ts
// WebSocket（实时双向）
await db.sync("wss://example.com", "ws");

// HTTP 轮询
await db.sync("https://example.com", "http");

// 自动选择（优先 WebSocket）
await db.sync("https://example.com");
```

#### `stopSync(): void`

停止同步。

```ts
db.stopSync();
```

#### `push(collection: string): Promise<void>`

手动推送一个集合中自上次同步以来变更的所有文档。

```ts
await db.push("users");
```

#### `pull(collection: string): Promise<void>`

手动从远程拉取一个集合中自上次同步以来的变更。

```ts
await db.pull("users");
```

#### 传输方式

| 传输                 | 特点               | 适用场景               |
| -------------------- | ------------------ | ---------------------- |
| `WebSocketTransport` | 双向实时、自动重连 | 实时协作、在线游戏     |
| `HTTPTransport`      | 请求/响应、长轮询  | 防火墙友好、无状态后端 |

#### 同步协议

消息格式 (JSON)：

```ts
// 客户端 → 服务端：推送本地变更
{ "type": "push", "collection": "users", "documents": [...] }

// 客户端 → 服务端：拉取远程变更
{ "type": "pull", "collection": "users", "since": 1714764800000 }

// 服务端 → 客户端：返回变更
{ "type": "pull-response", "collection": "users", "documents": [...] }

// 服务端 → 客户端：确认收到（服务端可直接写入）
{ "type": "ack", "collection": "users", "ids": ["uuid1", "uuid2"] }
```

##### 服务端示例（最小实现）

```ts
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
const store = new Map<string, any[]>();

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());

    switch (msg.type) {
      case "push": {
        // 存储文档
        const col = store.get(msg.collection) ?? [];
        for (const doc of msg.documents) {
          const idx = col.findIndex((d: any) => d._id === doc._id);
          if (idx >= 0) col[idx] = doc;
          else col.push(doc);
        }
        store.set(msg.collection, col);
        break;
      }
      case "pull": {
        // 返回 since 之后变更的文档
        const col = store.get(msg.collection) ?? [];
        const docs = col.filter((d: any) => d._updatedAt > msg.since);
        ws.send(
          JSON.stringify({
            type: "pull-response",
            collection: msg.collection,
            documents: docs,
          }),
        );
        break;
      }
    }
  });
});
```

#### 冲突解决

目前采用 **Last-Write-Wins (LWW)** 策略。根据 `_updatedAt` 时间戳比较，保留更新时间较新的版本。后续版本将通过插件系统支持 CRDT。

---

### 插件系统

#### 内置插件

**LoggerPlugin** — 记录所有数据库操作的日志。

```ts
import { createClient, LoggerPlugin } from "sync-db";

const db = createClient();
db.use(new LoggerPlugin({ level: "debug" }));
// 可选 level: "debug" | "info" | "warn"，默认 "info"
```

#### 自定义插件

实现 `Plugin` 接口即可：

```ts
import type { Plugin, HookContext } from "sync-db";
import type { InternalDocument, Query } from "sync-db";

class ValidationPlugin implements Plugin {
  name = "validation";

  beforeInsert(collection: string, doc: InternalDocument, ctx: HookContext) {
    if (collection === "users") {
      if (!doc.email) throw new Error("email is required");
      if (typeof doc.email !== "string") throw new Error("email must be string");
    }
    return doc;
  }

  beforeUpdate(collection: string, id: string, changes: Record<string, unknown>, ctx: HookContext) {
    if (collection === "users" && changes.age !== undefined) {
      if (typeof changes.age !== "number" || changes.age < 0) {
        throw new Error("age must be a non-negative number");
      }
    }
    return changes;
  }
}

// 使用
db.use(new ValidationPlugin());
```

#### 可用的生命周期钩子

| 钩子           | 签名                                 | 说明                   |
| -------------- | ------------------------------------ | ---------------------- |
| `onRegister`   | `(client: PluginClient) => void`     | 注册时调用             |
| `onUnregister` | `() => void`                         | 卸载时调用             |
| `beforeInsert` | `(col, doc, ctx) => doc`             | 插入前；可修改文档     |
| `afterInsert`  | `(col, doc, ctx) => void`            | 插入后；不可撤销       |
| `beforeUpdate` | `(col, id, changes, ctx) => changes` | 更新前；可修改变更     |
| `afterUpdate`  | `(col, doc, ctx) => void`            | 更新后                 |
| `beforeRemove` | `(col, id, ctx) => void`             | 删除前；可阻止         |
| `afterRemove`  | `(col, id, ctx) => void`             | 删除后                 |
| `beforeFind`   | `(col, query, ctx) => query`         | 查询前；可修改查询条件 |
| `afterFind`    | `(col, docs, ctx) => docs`           | 查询后；可修改结果     |

`before*` 钩子采用链式变换模式：每个插件的返回值作为下一个插件的输入。任意钩子抛出异常都会中止操作。钩子可以是同步或 async。

#### HookContext

```ts
interface HookContext {
  client: PluginClient; // 插件可见的客户端引用
  timestamp: number; // 当前时间戳
}
```

#### PluginClient

插件通过 `HookContext.client` 可以访问受限的客户端 API：

```ts
interface PluginClient {
  collection<T>(name: string): Collection<T>;
  listCollections(): Promise<string[]>;
}
```

#### 注册和卸载

```ts
// use() 返回一个卸载函数
const eject = db.use(new LoggerPlugin());

// 手动卸载
eject();

// 或按名称卸载
db.eject("logger");
```

---

### 事件

#### `on("error", handler): () => void`

监听错误事件。返回取消监听的函数。

```ts
const off = db.on("error", (err) => {
  console.error("sync-db error:", err);
});

// 取消监听
off();
```

---

### 错误类型

```ts
import { SyncDBError, CollectionNotFoundError } from "sync-db";

try {
  await db.collection("nonexistent");
} catch (err) {
  if (err instanceof CollectionNotFoundError) {
    // 集合不存在
  }
  if (err instanceof SyncDBError) {
    console.log("code:", err.code); // "COLLECTION_NOT_FOUND"
  }
}
```

---

## 进阶用法

### 自定义适配器

实现 `DatabaseAdapter` 接口即可接入任意存储引擎：

```ts
import type { DatabaseAdapter, InternalDocument } from "sync-db";

class MyAdapter implements DatabaseAdapter {
  name = "my-adapter";

  async connect(name: string) {
    /* 初始化连接 */
  }
  async disconnect() {
    /* 清理 */
  }
  async createCollection(name: string) {
    /* 创建集合 */
  }
  async dropCollection(name: string) {
    /* 删除集合 */
  }
  async listCollections() {
    return [];
  }
  async insert(col: string, doc: InternalDocument) {
    return doc;
  }
  async findById(col: string, id: string) {
    return null;
  }
  async find(col: string, query: any) {
    return [];
  }
  async update(col: string, id: string, changes: any) {
    return {} as any;
  }
  async remove(col: string, id: string) {
    /* ... */
  }
  async removeMany(col: string, ids: string[]) {
    return 0;
  }
  async count(col: string, filter: any) {
    return 0;
  }
}
```

### 自定义传输

实现 `Transport` 接口即可接入任意通信协议：

```ts
import type { Transport, SyncMessage } from "sync-db";

class MyTransport implements Transport {
  name = "my-transport";
  connected = false;

  async connect(url: string) {
    this.connected = true;
  }
  async disconnect() {
    this.connected = false;
  }
  async send(msg: SyncMessage) {
    /* 发送 */
  }

  onMessage(h: (msg: SyncMessage) => void) {
    return () => {};
  }
  onConnect(h: () => void) {
    return () => {};
  }
  onDisconnect(h: () => void) {
    return () => {};
  }
}
```

### TypeScript 泛型

Collection 支持泛型以获取完整的类型推导：

```ts
interface User {
  name: string;
  age: number;
  email: string;
}

const users = db.collection<User>("users");

// 类型安全
const alice = await users.insert({ name: "Alice", age: 30, email: "a@b.com" });
const found = await users.findOne({ age: { $gte: 18 } });
// found.name  — 类型安全，string
// found._id   — 类型安全，string
```

---

## 架构概览

```
src/
  client.ts                SyncDBClient — 入口 + 配置
  types.ts                 类型：Document, Filter, Query
  errors.ts                错误类
  env.ts                   环境检测（浏览器 / Node.js / 能力检测）
  helpers.ts               ID 生成 + 时间戳

  adapters/
    types.ts               DatabaseAdapter 接口
    memory.ts              InMemoryAdapter — Map 实现，零依赖
    idb.ts                 IndexedDBAdapter — 浏览器持久化
    sqlite.ts              SQLiteAdapter — Node.js 持久化
    index.ts               resolveAdapter — 自动选择

  store/
    collection.ts          Collection — 文档 CRUD + 插件钩子
    query.ts               查询引擎 — 过滤 / 排序 / 分页

  plugin/
    types.ts               Plugin 接口 + HookContext
    registry.ts            PluginRegistry — 注册 / 钩子调度

  plugins/
    logger.ts              LoggerPlugin

  transports/
    types.ts               Transport 接口
    http.ts                HTTPTransport — fetch + 轮询
    ws.ts                  WebSocketTransport — 实时 + 自动重连
    index.ts               resolveTransport — 自动选择

  sync/
    protocol.ts            同步协议消息类型
    engine.ts              SyncEngine — push/pull + LWW 冲突解决
```

---

## 许可

MIT
