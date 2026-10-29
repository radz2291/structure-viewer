import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/);
const text = z.string().min(1).max(20000);
const evidence = z.enum(["observed", "inference", "proposal"]);
const ref = z
  .object({
    file: text,
    symbol: z.string().max(300).optional(),
    line: z.number().int().positive().optional(),
    note: z.string().max(2000).optional(),
  })
  .strict();
export const nodeSchema = z
  .object({
    id,
    title: z.string().min(1).max(180),
    kind: z.string().min(1).max(60),
    summary: z.string().min(1).max(400),
    body: text,
    evidence,
    sources: z.array(ref).max(30).default([]),
  })
  .strict();
export const edgeSchema = z
  .object({
    id,
    source: id,
    target: id,
    label: z.string().min(1).max(80),
    body: text,
    evidence,
    role: z
      .enum([
        "hierarchy",
        "read",
        "write",
        "action",
        "definition",
        "navigation",
        "reference",
      ])
      .optional(),
  })
  .strict();
export const documentSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    project: z.string().min(1).max(120),
    title: z.string().min(1).max(180),
    description: text,
    provenance: z
      .object({
        repository: text,
        revision: text,
        inspectedAt: z.string().datetime(),
        method: text,
        limitations: text,
      })
      .strict(),
    nodes: z.array(nodeSchema).min(1).max(500),
    edges: z.array(edgeSchema).max(1500),
    views: z
      .array(
        z
          .object({
            id,
            title: z.string().min(1).max(120),
            description: text,
            nodes: z.array(id).min(1).max(500),
            positions: z
              .record(
                id,
                z
                  .object({
                    x: z.number().finite().min(-100000).max(100000),
                    y: z.number().finite().min(-100000).max(100000),
                  })
                  .strict(),
              )
              .default({}),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    notes: z
      .array(
        z
          .object({
            id,
            nodeId: id.optional(),
            text,
            author: z.string().min(1).max(120),
            createdAt: z.string().datetime(),
            atRevision: z.number().int().positive(),
          })
          .strict(),
      )
      .max(1000)
      .default([]),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const unique = (items, name) => {
      if (new Set(items.map((n) => n.id)).size !== items.length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${name} IDs` });
    };
    unique(doc.nodes, "node");
    unique(doc.edges, "edge");
    unique(doc.views, "view");
    unique(doc.notes, "note");
    const ids = new Set(doc.nodes.map((n) => n.id));
    for (const edge of doc.edges)
      if (!ids.has(edge.source) || !ids.has(edge.target))
        ctx.addIssue({ code: "custom", message: `Dangling edge ${edge.id}` });
    for (const view of doc.views) {
      if (new Set(view.nodes).size !== view.nodes.length)
        ctx.addIssue({
          code: "custom",
          message: `Duplicate nodes in ${view.id}`,
        });
      for (const node of [...view.nodes, ...Object.keys(view.positions)])
        if (!ids.has(node) || !view.nodes.includes(node))
          ctx.addIssue({
            code: "custom",
            message: `Unknown view node ${node}`,
          });
    }
    // Notes retain stable IDs of removed nodes as historical context.
  });
export class StoreError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function validate(value) {
  const r = documentSchema.safeParse(value);
  if (!r.success)
    throw new StoreError(
      r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("\n"),
    );
  return r.data;
}
const metadata = z.object({
  expectedRevision: z.number().int().nonnegative(),
  author: z.string().min(1).max(120),
  summary: z.string().min(1).max(1000),
});

export class Store {
  constructor(root) {
    this.root = path.resolve(root);
    fs.mkdirSync(this.root, { recursive: true });
  }
  dir(key) {
    if (!id.safeParse(key).success) throw new StoreError("Invalid map ID");
    return path.join(this.root, key);
  }
  history(key) {
    const dir = this.dir(key);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => /^\d{8}\.json$/.test(f))
      .sort()
      .map((f) => {
        const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        return {
          revision: r.revision,
          author: r.author,
          summary: r.summary,
          createdAt: r.createdAt,
          deleted: r.deleted,
        };
      });
  }
  get(key, revision) {
    const versions = this.history(key);
    const n = revision ?? versions.at(-1)?.revision;
    if (!Number.isInteger(n) || !versions.some((v) => v.revision === n))
      throw new StoreError("Map revision not found", 404);
    return JSON.parse(
      fs.readFileSync(
        path.join(this.dir(key), String(n).padStart(8, "0") + ".json"),
        "utf8",
      ),
    );
  }
  list() {
    return fs
      .readdirSync(this.root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && id.safeParse(d.name).success)
      .flatMap((d) => {
        const h = this.history(d.name);
        if (!h.length) return [];
        const r = this.get(d.name);
        return [
          {
            id: d.name,
            project: r.document.project,
            title: r.document.title,
            revision: r.revision,
            deleted: r.deleted,
            createdAt: r.createdAt,
          },
        ];
      });
  }
  commit(key, document, meta, deleted = false) {
    const parsed = metadata.safeParse(meta);
    if (!parsed.success)
      throw new StoreError("expectedRevision, author and summary are required");
    const doc = validate(document);
    if (doc.id !== key) throw new StoreError("Map ID does not match document");
    const history = this.history(key),
      current = history.at(-1)?.revision ?? 0;
    if (current !== meta.expectedRevision)
      throw new StoreError(
        `Revision conflict: expected ${meta.expectedRevision}, current ${current}. Reload before editing.`,
        409,
      );
    const r = {
      revision: current + 1,
      author: meta.author,
      summary: meta.summary,
      createdAt: new Date().toISOString(),
      deleted,
      document: doc,
    };
    if (r.revision > 99999999) throw new StoreError("Revision limit reached");
    const dir = this.dir(key);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, String(r.revision).padStart(8, "0") + ".json");
    const tmp = path.join(dir, crypto.randomUUID() + ".tmp");
    // Flush first, then atomically publish without overwriting an existing revision.
    const fd = fs.openSync(tmp, "wx");
    try {
      fs.writeFileSync(fd, JSON.stringify(r, null, 2));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    try {
      fs.linkSync(tmp, dest);
    } catch (e) {
      if (e.code === "EEXIST")
        throw new StoreError("Revision conflict; reload before editing.", 409);
      throw e;
    } finally {
      fs.unlinkSync(tmp);
    }
    return r;
  }
  patch(key, operations, meta) {
    const current = this.get(key);
    if (current.deleted)
      throw new StoreError("Map is archived; restore with put first");
    const doc = structuredClone(current.document);
    if (
      !Array.isArray(operations) ||
      operations.length < 1 ||
      operations.length > 100
    )
      throw new StoreError("Supply 1–100 operations");
    for (const op of operations) {
      if (op.op === "upsertNode") {
        const n = nodeSchema.parse(op.value);
        const i = doc.nodes.findIndex((x) => x.id === n.id);
        if (i < 0) doc.nodes.push(n);
        else doc.nodes[i] = n;
      } else if (op.op === "deleteNode") {
        doc.nodes = doc.nodes.filter((n) => n.id !== op.id);
        doc.edges = doc.edges.filter(
          (e) => e.source !== op.id && e.target !== op.id,
        );
        for (const v of doc.views) {
          v.nodes = v.nodes.filter((n) => n !== op.id);
          delete v.positions[op.id];
        }
      } else if (op.op === "upsertEdge") {
        const e = edgeSchema.parse(op.value);
        const i = doc.edges.findIndex((x) => x.id === e.id);
        if (i < 0) doc.edges.push(e);
        else doc.edges[i] = e;
      } else if (op.op === "deleteEdge")
        doc.edges = doc.edges.filter((e) => e.id !== op.id);
      else if (op.op === "addNote")
        doc.notes.push({
          id: crypto.randomUUID(),
          nodeId: op.nodeId,
          text: op.text,
          author: meta.author,
          createdAt: new Date().toISOString(),
          atRevision: meta.expectedRevision,
        });
      else throw new StoreError(`Unknown operation ${op.op}`);
    }
    return this.commit(key, doc, meta);
  }
}
