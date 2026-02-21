"use client";

import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";
import { SectionProvider } from "@/context/section-context";

const authState = { uid: "user-1" as string | null };

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <div aria-label={props.alt} />,
}));

vi.mock("@/lib/firebase", () => ({
  db: {},
  auth: {},
  storage: {},
  googleProvider: {},
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

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: authState.uid ? { uid: authState.uid } : null }),
}));

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(() => Promise.resolve({})),
  deleteDoc: vi.fn(() => Promise.resolve({})),
  updateDoc: vi.fn(() => Promise.resolve({})),
  serverTimestamp: vi.fn(() => "ts"),
  snapshotCallIndex: 0,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  onSnapshot: (_query: unknown, next: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) => {
    firestoreMocks.snapshotCallIndex += 1;
    if (firestoreMocks.snapshotCallIndex === 1) {
      next({
        docs: [
          {
            id: "list-1",
            data: () => ({ name: "Watch soon", description: "", type: "movie", types: ["movie"] }),
          },
        ],
      });
    } else {
      next({
        docs: [
          {
            id: "item-1",
            data: () => ({
              title: "List item movie",
              mediaType: "movie",
              externalId: "entry-1",
              image: null,
              year: "2024",
            }),
          },
        ],
      });
    }
    return () => {};
  },
  addDoc: firestoreMocks.addDoc,
  deleteDoc: firestoreMocks.deleteDoc,
  updateDoc: firestoreMocks.updateDoc,
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ segments })),
  serverTimestamp: firestoreMocks.serverTimestamp,
}));

vi.mock("@/context/data-context", () => {
  const entries = [
    {
      id: "entry-1",
      title: "List item movie",
      mediaType: "movie",
      status: "completed",
      genresThemes: [],
      image: null,
      releaseYear: "2024",
      userRating: null,
      imdbRating: null,
      lengthMinutes: null,
      episodeCount: null,
      chapterCount: null,
      description: "",
      completedAtMs: null,
      completionDateUnknown: false,
      createdAtMs: Date.now(),
    },
    {
      id: "entry-2",
      title: "Other bucket movie",
      mediaType: "movie",
      status: "completed",
      genresThemes: [],
      image: null,
      releaseYear: "2023",
      userRating: null,
      imdbRating: null,
      lengthMinutes: null,
      episodeCount: null,
      chapterCount: null,
      description: "",
      completedAtMs: null,
      completionDateUnknown: false,
      createdAtMs: Date.now(),
    },
  ];

  return {
    useData: () => ({
      entries,
      status: "idle",
      error: null,
      refresh: vi.fn(),
      selectedEntry: null,
      setSelectedEntry: vi.fn(),
    }),
  };
});

beforeEach(() => {
  authState.uid = "user-1";
  firestoreMocks.snapshotCallIndex = 0;
  firestoreMocks.addDoc.mockClear();
  firestoreMocks.deleteDoc.mockClear();
  firestoreMocks.updateDoc.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Library drag and drop", () => {
  it("initiates drag and moves item from Other into a list", async () => {
    window.location.hash = "#movies";

    render(
      <SectionProvider>
        <Home />
      </SectionProvider>
    );

    const otherItemTitle = await screen.findByText("Other bucket movie");
    const otherItem = otherItemTitle.closest('[draggable="true"]') as HTMLElement | null;
    expect(otherItem).not.toBeNull();
    if (!otherItem) return;

    const user = userEvent.setup();
    await user.pointer([{ keys: "[MouseLeft]", target: otherItem }]);

    fireEvent.dragStart(otherItem, {
      dataTransfer: {
        effectAllowed: "move",
        setData: vi.fn(),
        getData: vi.fn(),
      },
    });

    const listHeaderLabel = await screen.findByText("Watch soon");
    const listHeaderContainer = listHeaderLabel.closest("div");
    expect(listHeaderContainer).not.toBeNull();

    if (!listHeaderContainer) return;

    fireEvent.dragEnter(listHeaderContainer);
    fireEvent.drop(listHeaderContainer);

    await waitFor(() => {
      expect(firestoreMocks.addDoc).toHaveBeenCalled();
    });
    expect(firestoreMocks.deleteDoc).not.toHaveBeenCalled();
    expect(firestoreMocks.updateDoc).toHaveBeenCalled();
  });

  it("cancels drag without performing writes", async () => {
    window.location.hash = "#movies";

    render(
      <SectionProvider>
        <Home />
      </SectionProvider>
    );

    const otherItemTitle = await screen.findByText("Other bucket movie");
    const otherItem = otherItemTitle.closest('[draggable="true"]') as HTMLElement | null;
    expect(otherItem).not.toBeNull();
    if (!otherItem) return;

    fireEvent.dragStart(otherItem, {
      dataTransfer: {
        effectAllowed: "move",
        setData: vi.fn(),
        getData: vi.fn(),
      },
    });
    fireEvent.dragEnd(otherItem);

    await waitFor(() => {
      expect(firestoreMocks.addDoc).not.toHaveBeenCalled();
      expect(firestoreMocks.deleteDoc).not.toHaveBeenCalled();
    });
  });

  it("expands a collapsed list when dragged over its header", async () => {
    window.location.hash = "#movies";

    render(
      <SectionProvider>
        <Home />
      </SectionProvider>
    );

    const otherItemTitle = await screen.findByText("Other bucket movie");
    const otherItem = otherItemTitle.closest('[draggable="true"]') as HTMLElement | null;
    expect(otherItem).not.toBeNull();
    if (!otherItem) return;
    fireEvent.dragStart(otherItem, {
      dataTransfer: {
        effectAllowed: "move",
        setData: vi.fn(),
        getData: vi.fn(),
      },
    });

    const listHeaderLabel = await screen.findByText("Watch soon");
    const listHeaderContainer = listHeaderLabel.closest("div");
    expect(listHeaderContainer).not.toBeNull();
    if (!listHeaderContainer) return;

    fireEvent.dragEnter(listHeaderContainer);

    await waitFor(() => {
      expect(screen.getByText("List item movie")).toBeInTheDocument();
    });
  });
});
