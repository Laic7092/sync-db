import type { Plugin, HookContext, PluginClient } from "./types.ts";

type ErrorEmitter = (err: Error) => void;

export class PluginRegistry {
  private plugins: Plugin[] = [];

  register(plugin: Plugin, client: PluginClient, emitError: ErrorEmitter): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins.push(plugin);
    if (plugin.onRegister) {
      Promise.resolve(plugin.onRegister(client)).catch((err) => emitError(err));
    }
  }

  unregister(name: string): void {
    const idx = this.plugins.findIndex((p) => p.name === name);
    if (idx === -1) return;
    const [plugin] = this.plugins.splice(idx, 1);
    if (plugin.onUnregister) {
      Promise.resolve(plugin.onUnregister()).catch(() => {});
    }
  }

  // --- before hooks: chain-transform ---

  async runBeforeInsert(
    col: string,
    doc: Parameters<NonNullable<Plugin["beforeInsert"]>>[1],
    ctx: HookContext,
  ): Promise<typeof doc> {
    let acc = doc;
    for (const p of this.plugins) {
      if (!p.beforeInsert) continue;
      acc = await p.beforeInsert(col, acc, ctx);
    }
    return acc;
  }

  async runBeforeUpdate(
    col: string,
    id: string,
    changes: Record<string, unknown>,
    ctx: HookContext,
  ): Promise<Record<string, unknown>> {
    let acc = changes;
    for (const p of this.plugins) {
      if (!p.beforeUpdate) continue;
      acc = await p.beforeUpdate(col, id, acc, ctx);
    }
    return acc;
  }

  async runBeforeRemove(col: string, id: string, ctx: HookContext): Promise<void> {
    for (const p of this.plugins) {
      if (!p.beforeRemove) continue;
      await p.beforeRemove(col, id, ctx);
    }
  }

  async runBeforeFind(
    col: string,
    query: Parameters<NonNullable<Plugin["beforeFind"]>>[1],
    ctx: HookContext,
  ): Promise<typeof query> {
    let acc = query;
    for (const p of this.plugins) {
      if (!p.beforeFind) continue;
      acc = await p.beforeFind(col, acc, ctx);
    }
    return acc;
  }

  // --- after hooks: fire and forget (errors emitted) ---

  private fireAfter(fn: (() => void | Promise<void>) | undefined, emitError: ErrorEmitter): void {
    if (!fn) return;
    Promise.resolve(fn()).catch((err) => emitError(err));
  }

  runAfterInsert(
    col: string,
    doc: Parameters<NonNullable<Plugin["afterInsert"]>>[1],
    ctx: HookContext,
    emitError: ErrorEmitter,
  ): void {
    for (const p of this.plugins) {
      if (p.afterInsert) this.fireAfter(() => p.afterInsert!(col, doc, ctx), emitError);
    }
  }

  runAfterUpdate(
    col: string,
    doc: Parameters<NonNullable<Plugin["afterUpdate"]>>[1],
    ctx: HookContext,
    emitError: ErrorEmitter,
  ): void {
    for (const p of this.plugins) {
      if (p.afterUpdate) this.fireAfter(() => p.afterUpdate!(col, doc, ctx), emitError);
    }
  }

  runAfterRemove(col: string, id: string, ctx: HookContext, emitError: ErrorEmitter): void {
    for (const p of this.plugins) {
      if (p.afterRemove) this.fireAfter(() => p.afterRemove!(col, id, ctx), emitError);
    }
  }

  runAfterFind(
    col: string,
    docs: Parameters<NonNullable<Plugin["afterFind"]>>[1],
    ctx: HookContext,
    emitError: ErrorEmitter,
  ): void {
    for (const p of this.plugins) {
      if (!p.afterFind) continue;
      // afterFind returns InternalDocument[], not void — ignore the result
      void Promise.resolve(p.afterFind(col, docs, ctx)).catch((err) => emitError(err));
    }
  }
}
