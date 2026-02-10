"use client";

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <div aria-label={props.alt} />,
}));

vi.mock("motion/react", async () => {
  const ReactModule = await import("react");
  const passthrough = ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
    <div ref={ref} {...props} />
  ));
  const motion = new Proxy(
    {},
    {
      get: () => passthrough,
    }
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useInView: () => true,
  };
});

vi.mock("@/components/content/hero", () => ({
  Hero: () => <div data-testid="hero" />,
}));

vi.mock("@/components/ui/glass-card", () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/content/media-grid", () => ({
  MediaGrid: ({ items }: { items: Array<unknown> }) => <div data-testid="grid">{items.length}</div>,
}));

vi.mock("@/components/content/media-section", () => ({
  MediaSection: ({
    items,
    children,
  }: {
    items: unknown[];
    children: (filteredItems: unknown[]) => React.ReactNode;
  }) => <div data-testid="section">{children(items)}</div>,
}));

vi.mock("@/lib/firebase", () => ({
  db: {},
}));

const authState = { uid: "user-1" as string | null };
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: authState.uid ? { uid: authState.uid } : null }),
}));

const unsubscribe = vi.fn();
const onSnapshotMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => "collection"),
  orderBy: vi.fn(() => "orderBy"),
  limit: vi.fn(() => "limit"),
  query: vi.fn(() => "query"),
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
}));

import Home from "@/app/page";
import { SectionProvider } from "@/context/section-context";

beforeEach(() => {
  window.location.hash = "";
  unsubscribe.mockClear();
  onSnapshotMock.mockReset();
  authState.uid = "user-1";
});

describe("SPA section switching", () => {
  it("keeps a single Firestore subscription when switching sections", () => {
    onSnapshotMock.mockReturnValue(unsubscribe);

    render(
      <SectionProvider>
        <Home />
      </SectionProvider>
    );
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    act(() => {
      window.location.hash = "#movies";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("shows retry on sync error and re-subscribes on retry", async () => {
    onSnapshotMock.mockImplementation((_q: unknown, _next: unknown, error: (err: unknown) => void) => {
      error(new Error("Network down"));
      return unsubscribe;
    });

    render(
      <SectionProvider>
        <Home />
      </SectionProvider>
    );
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);

    const retry = await screen.findByRole("button", { name: "Retry" });
    await userEvent.click(retry);

    expect(onSnapshotMock).toHaveBeenCalledTimes(2);
  });

  it("renders cached entries instantly when switching sections", () => {
    let nextCb: ((snap: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) | null = null;

    onSnapshotMock.mockImplementation((_q: unknown, next: typeof nextCb) => {
      nextCb = next;
      return unsubscribe;
    });

    render(
      <SectionProvider>
        <Home />
      </SectionProvider>
    );

    act(() => {
      nextCb?.({
        docs: [
          {
            id: "1",
            data: () => ({ title: "Movie A", mediaType: "movie", status: "completed", genresThemes: [] }),
          },
          {
            id: "2",
            data: () => ({ title: "Manga B", mediaType: "manga", status: "completed", genresThemes: [] }),
          },
        ],
      });
    });

    act(() => {
      window.location.hash = "#movies";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(screen.getByTestId("grid")).toHaveTextContent("1");
  });
});

