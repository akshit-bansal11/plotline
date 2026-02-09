"use client";

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchModal } from "@/components/search/search-modal";

vi.mock("next/image", () => ({
  default: (props: {
    src: string;
    alt: string;
  }) => {
    const { src, alt } = props;
    return <div aria-label={alt} data-next-image-src={src} />;
  },
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
  };
});

describe("SearchModal", () => {
  it("shows only content-type selectors (no source selectors)", () => {
    render(<SearchModal isOpen onClose={() => {}} />);

    expect(screen.getByPlaceholderText("Search movies, series, anime, manga, games...")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Movies" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Series" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anime" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manga" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Game" })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "TMDB" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "OMDb" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "MyAnimeList" })).not.toBeInTheDocument();
  });

  it("dispatches searches with the selected content type", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], errors: [] }),
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<SearchModal isOpen onClose={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Manga" }));
    const input = screen.getByPlaceholderText("Search movies, series, anime, manga, games...");
    await user.type(input, "berserk");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const [url] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1) || [];
    expect(String(url)).toContain("/api/search?q=berserk&type=manga");
  });
});
