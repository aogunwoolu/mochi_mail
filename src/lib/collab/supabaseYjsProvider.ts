"use client";

import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

function uint8ToBase64(data: Uint8Array): string {
  let binary = "";
  for (const value of data) {
    binary += String.fromCodePoint(value);
  }
  return btoa(binary);
}

function base64ToUint8(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.codePointAt(i) ?? 0;
  }
  return bytes;
}

type SyncEnvelope = {
  senderId: string;
  update: string;
};

export type SupabaseYjsProviderOptions = {
  supabase: SupabaseClient;
  roomName: string;
  doc: Doc;
  awareness?: Awareness;
  senderId: string;
};

export class SupabaseYjsProvider {
  private readonly supabase: SupabaseClient;
  private readonly roomName: string;
  private readonly doc: Doc;
  private readonly awareness: Awareness;
  private readonly senderId: string;
  private channel: RealtimeChannel | null = null;
  private subscribed = false;

  constructor(options: SupabaseYjsProviderOptions) {
    this.supabase = options.supabase;
    this.roomName = options.roomName;
    this.doc = options.doc;
    this.awareness = options.awareness ?? new Awareness(options.doc);
    this.senderId = options.senderId;

    this.handleDocUpdate = this.handleDocUpdate.bind(this);
    this.handleAwarenessUpdate = this.handleAwarenessUpdate.bind(this);

    this.doc.on("update", this.handleDocUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);
  }

  getAwareness(): Awareness {
    return this.awareness;
  }

  connect() {
    if (this.channel) return;

    const channel = this.supabase
      .channel(this.roomName, { config: { private: true, broadcast: { self: false } } })
      .on("broadcast", { event: "y-update" }, ({ payload }) => {
        const data = payload as SyncEnvelope;
        if (!data?.update || data.senderId === this.senderId) return;
        const update = base64ToUint8(data.update);
        applyUpdate(this.doc, update, this);
      })
      .on("broadcast", { event: "y-awareness" }, ({ payload }) => {
        const data = payload as SyncEnvelope;
        if (!data?.update || data.senderId === this.senderId) return;
        const update = base64ToUint8(data.update);
        applyAwarenessUpdate(this.awareness, update, this);
      })
      .on("broadcast", { event: "y-sync-request" }, ({ payload }) => {
        const data = payload as { senderId: string };
        if (!data?.senderId || data.senderId === this.senderId) return;
        const fullUpdate = encodeStateAsUpdate(this.doc);
        void channel.send({
          type: "broadcast",
          event: "y-sync-response",
          payload: {
            senderId: this.senderId,
            targetId: data.senderId,
            update: uint8ToBase64(fullUpdate),
          },
        });
      })
      .on("broadcast", { event: "y-sync-response" }, ({ payload }) => {
        const data = payload as { senderId: string; targetId: string; update: string };
        if (!data?.update || data.senderId === this.senderId || data.targetId !== this.senderId) return;
        const update = base64ToUint8(data.update);
        applyUpdate(this.doc, update, this);
      });

    this.channel = channel;
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      this.subscribed = true;
      void channel.send({
        type: "broadcast",
        event: "y-sync-request",
        payload: { senderId: this.senderId },
      });
      const awarenessUpdate = encodeAwarenessUpdate(this.awareness, [this.awareness.clientID]);
      void channel.send({
        type: "broadcast",
        event: "y-awareness",
        payload: { senderId: this.senderId, update: uint8ToBase64(awarenessUpdate) },
      });
    });
  }

  async destroy() {
    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);

    const channel = this.channel;
    this.channel = null;
    this.subscribed = false;

    if (channel) {
      await this.supabase.removeChannel(channel);
    }
  }

  private handleDocUpdate(update: Uint8Array, origin: unknown) {
    if (!this.channel || !this.subscribed || origin === this) return;
    void this.channel.send({
      type: "broadcast",
      event: "y-update",
      payload: {
        senderId: this.senderId,
        update: uint8ToBase64(update),
      },
    });
  }

  private handleAwarenessUpdate(
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) {
    if (!this.channel || !this.subscribed || origin === this) return;
    const changedClients = [...changes.added, ...changes.updated, ...changes.removed];
    if (changedClients.length === 0) return;

    const update = encodeAwarenessUpdate(this.awareness, changedClients);
    void this.channel.send({
      type: "broadcast",
      event: "y-awareness",
      payload: {
        senderId: this.senderId,
        update: uint8ToBase64(update),
      },
    });
  }
}
