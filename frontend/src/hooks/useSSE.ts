"use client";

import { useEffect, useRef } from "react";

export type SSEEventType =
  | "incident_created"
  | "incident_updated"
  | "stats_update"
  | "heartbeat";

export type SSEListener<T = unknown> = (data: T) => void;

type ListenerMap = {
  [K in SSEEventType]?: SSEListener[];
};

const SSE_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/stream`
  : "http://localhost:8080/api/stream";

/**
 * Singleton EventSource shared across all hook instances on a page.
 * Recreated if it closes unexpectedly.
 */
let globalSource: EventSource | null = null;
const listeners: ListenerMap = {};

function getOrCreateSource(): EventSource {
  if (
    globalSource &&
    globalSource.readyState !== EventSource.CLOSED
  ) {
    return globalSource;
  }

  globalSource = new EventSource(SSE_URL);

  const eventTypes: SSEEventType[] = [
    "incident_created",
    "incident_updated",
    "stats_update",
    "heartbeat",
  ];

  for (const type of eventTypes) {
    globalSource.addEventListener(type, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        listeners[type]?.forEach((fn) => fn(data));
      } catch {
        // malformed event — skip
      }
    });
  }

  globalSource.onerror = () => {
    // EventSource reconnects automatically; reset reference so next call
    // picks up the new instance.
    globalSource = null;
  };

  return globalSource;
}

/**
 * Subscribe to one or more named SSE events. Automatically unsubscribes
 * when the calling component unmounts.
 *
 * @example
 * useSSE({ incident_created: (data) => console.log(data) })
 */
export function useSSE(handlers: Partial<Record<SSEEventType, SSEListener>>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    getOrCreateSource();

    const added: [SSEEventType, SSEListener][] = [];

    for (const [type, fn] of Object.entries(handlersRef.current) as [
      SSEEventType,
      SSEListener,
    ][]) {
      if (!fn) continue;
      if (!listeners[type]) listeners[type] = [];

      // Stable wrapper keeps the current handler ref without re-subscribing
      const wrapper: SSEListener = (data) => handlersRef.current[type]?.(data);
      listeners[type]!.push(wrapper);
      added.push([type, wrapper]);
    }

    return () => {
      for (const [type, wrapper] of added) {
        listeners[type] = listeners[type]?.filter((fn) => fn !== wrapper);
      }
    };
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
