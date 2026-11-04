import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

let search = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("framer-motion", () => ({
  useReducedMotion: () => true,
  motion: { div: (props: React.ComponentProps<"div">) => <div {...props} /> },
}));
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const dom = { ...props };
    for (const k of ["fill", "unoptimized", "priority"]) delete dom[k];
    return React.createElement("img", dom);
  },
}));
vi.mock("../runway/Confetti", () => ({
  Confetti: ({ fire }: { fire: boolean }) => <div data-testid="confetti" data-fire={String(fire)} />,
}));
vi.mock("../runway/CountdownRing", () => ({ CountdownRing: () => <div data-testid="ring" /> }));
vi.mock("../../lib/utils/runway-sound", () => ({
  playReveal: vi.fn(), playWin: vi.fn(), playRoast: vi.fn(),
  startTension: vi.fn(), stopTension: vi.fn(),
  setSoundEnabled: vi.fn(), soundEnabled: () => true,
}));
vi.mock("../../lib/utils/runway", async (orig) => ({
  ...(await orig<typeof import("../../lib/utils/runway")>()),
  imageFileToJpegDataUrl: vi.fn(async () => "data:image/jpeg;base64,AAAA"),
  runwayPlayerId: () => "00000000-0000-4000-8000-000000000000",
}));

import { RunwayPlay } from "../runway/RunwayPlay";
import { useRunwayHistory } from "../../lib/stores/runway-history-store";
import { RUNWAY_SAMPLES } from "../../lib/runway-samples";

const ROUND = {
  roundId: "aaaaaaaaaaaa",
  deadline: Date.now() + 180_000,
  theme: { id: "quiet-luxury", name: "Quiet Luxury", brief: "Understated." },
  persona: { key: "miranda", name: "Miranda" },
  messages: ["Welcome to the runway."],
};
const OK_RESULT = (total: number) => ({
  status: "ok",
  result: { scores: { theme: 8, cohesion: 8, styling: 8 }, total, verdict: "Rather good.", fixHint: "Add a belt.", late: false },
  fix: { kind: "inspiration", title: "Camel coat", imageUrl: null, url: "/style-board?pick=x" },
});

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let calls: Array<{ url: string; body: any }> = [];
const installFetch = (overrides: Partial<Record<string, Handler>> = {}) => {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    for (const [prefix, h] of Object.entries(overrides)) if (url.startsWith(prefix)) return h!(url, init);
    if (url === "/api/runway/rounds") return json(ROUND);
    if (url.endsWith("/photo")) return json(OK_RESULT(8.4));
    if (url.endsWith("/share")) return json({ ok: true });
    if (url.startsWith("/runway/card/")) return new Response(new Blob(["png"]), { status: 200 });
    return new Response(new Blob(["img"], { type: "image/jpeg" }), { status: 200 });
  }));
};

const startAs = async (name: string) => {
  fireEvent.click(screen.getByRole("button", { name }));
  await screen.findByText("The theme");
};
const sendSample = async () => {
  fireEvent.click(screen.getAllByTitle(RUNWAY_SAMPLES[0]!.label)[0]!);
  fireEvent.click(await screen.findByRole("button", { name: /Send to the judges/ }));
};

beforeEach(() => {
  search = new URLSearchParams();
  act(() => useRunwayHistory.setState({ entries: [] }));
  window.localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("RunwayPlay flow (characterization)", () => {
  it("intro → round → sample preview → judged result, recording history", async () => {
    installFetch();
    render(<RunwayPlay />);
    await startAs("Miranda");

    const create = calls.find((c) => c.url === "/api/runway/rounds")!;
    expect(create.body).toMatchObject({ judge: "miranda", playerId: "00000000-0000-4000-8000-000000000000" });
    expect(screen.getByText("Quiet Luxury")).toBeTruthy();
    expect(screen.getByText(/judged and discarded/)).toBeTruthy();

    await sendSample();
    await screen.findByText("Challenge a friend", {}, { timeout: 6000 });

    const photo = calls.find((c) => c.url === "/api/runway/rounds/aaaaaaaaaaaa/photo")!;
    expect(photo.body).toMatchObject({ photoData: "data:image/jpeg;base64,AAAA", sample: true });
    expect(screen.getByText("The fix")).toBeTruthy();
    expect(screen.getByText("Camel coat")).toBeTruthy();
    expect(screen.getByText("Get the look")).toBeTruthy();
    expect(screen.getByText("Judges' favourite")).toBeTruthy();
    expect(screen.getByText("Try your own photo")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(/reacts/).length).toBe(2), { timeout: 3000 });

    const [entry] = useRunwayHistory.getState().entries;
    expect(entry).toMatchObject({ roundId: "aaaaaaaaaaaa", themeName: "Quiet Luxury", judge: "miranda", total: 8.4 });
    expect(screen.getByTestId("confetti").getAttribute("data-fire")).toBe("true");
  }, 15000);

  it("shows the judge's note and returns to preview when the photo is refused", async () => {
    installFetch({
      "/api/runway/rounds/aaaaaaaaaaaa/photo": () => json({ status: "refused", messages: ["No outfit in sight."] }),
    });
    render(<RunwayPlay />);
    await startAs("Edina");
    await sendSample();
    await screen.findByText("No outfit in sight.", {}, { timeout: 6000 });
    expect(screen.getByRole("button", { name: /Retake/ })).toBeTruthy();
    expect(screen.queryByText("Challenge a friend")).toBeNull();
  }, 15000);

  it("handles the daily cap and server errors", async () => {
    installFetch({ "/api/runway/rounds": () => json({ status: "capped", messages: ["Enough for today."] }, 429) });
    const first = render(<RunwayPlay />);
    fireEvent.click(screen.getByRole("button", { name: "Shaft" }));
    await screen.findByText("Enough for today.");
    expect(screen.getByText("Back to Runway")).toBeTruthy();
    first.unmount();

    installFetch({ "/api/runway/rounds": () => json({ error: "boom" }, 500) });
    render(<RunwayPlay />);
    fireEvent.click(screen.getByRole("button", { name: "Miranda" }));
    await screen.findByText(/The line went quiet/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("auto-starts when arriving with ?judge= and skips the intro", async () => {
    search = new URLSearchParams("judge=edina");
    installFetch();
    render(<RunwayPlay />);
    await screen.findByText("The theme");
    expect(screen.queryByText("Pick your judge")).toBeNull();
    expect(calls.filter((c) => c.url === "/api/runway/rounds")).toHaveLength(1);
    expect(calls.find((c) => c.url === "/api/runway/rounds")!.body.judge).toBe("edina");
  });

  it("duel: loads the opponent, plays their theme, sends ref, and shows the outcome", async () => {
    search = new URLSearchParams("ref=abcdefabcdef");
    installFetch({
      "/api/runway/results/abcdefabcdef": () =>
        json({ roundId: "abcdefabcdef", total: 9.1, themeId: "gorpcore", themeName: "Gorpcore", persona: "miranda", verdict: "Theirs was sharp." }),
    });
    render(<RunwayPlay />);
    await act(async () => {});
    await startAs("Miranda");

    const create = calls.find((c) => c.url === "/api/runway/rounds")!;
    expect(create.body).toMatchObject({ themeId: "gorpcore", ref: "abcdefabcdef" });
    expect(screen.getByText(/Duel — beat 9.1/)).toBeTruthy();

    await sendSample();
    await screen.findByText("The duel", {}, { timeout: 6000 });
    expect(screen.getByText("They keep the crown.")).toBeTruthy();
    expect(screen.getByText(/Theirs: .*Theirs was sharp/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Run it back/ })).toBeTruthy();
  }, 15000);

  it("ignores a malformed ref and never calls the results endpoint", async () => {
    search = new URLSearchParams("ref=not-a-ref");
    installFetch();
    render(<RunwayPlay />);
    await act(async () => {});
    expect(calls.some((c) => c.url.startsWith("/api/runway/results"))).toBe(false);
    expect(screen.getByText("Pick your judge")).toBeTruthy();
  });

  it("share falls back to copying the challenge link and records the share", async () => {
    installFetch();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<RunwayPlay />);
    await startAs("Miranda");
    await sendSample();
    fireEvent.click(await screen.findByRole("button", { name: /Challenge a friend/ }, { timeout: 6000 }));
    await screen.findByText("Challenge link copied");
    expect(writeText.mock.calls[0]![0]).toContain("/runway/r/aaaaaaaaaaaa");
    expect(writeText.mock.calls[0]![0]).toContain("I got 8.4 on Quiet Luxury");
    const share = calls.find((c) => c.url.endsWith("/share"))!;
    expect(share.body).toMatchObject({ channel: "copy" });
  }, 15000);

  it("Play again starts a fresh round with the same judge; Switch judge returns to intro", async () => {
    installFetch();
    render(<RunwayPlay />);
    await startAs("Shaft");
    await sendSample();
    fireEvent.click(await screen.findByText("Play again", {}, { timeout: 6000 }));
    await screen.findByText("The theme");
    expect(calls.filter((c) => c.url === "/api/runway/rounds")).toHaveLength(2);
    expect(calls.filter((c) => c.url === "/api/runway/rounds")[1]!.body.judge).toBe("shaft");

    await sendSample();
    fireEvent.click(await screen.findByText("Switch judge", {}, { timeout: 6000 }));
    expect(screen.getByText("Pick your judge")).toBeTruthy();
  }, 20000);

  it("intro shows streak/best/last verdict from on-device history", async () => {
    act(() =>
      useRunwayHistory.setState({
        entries: [{ roundId: "bbbbbbbbbbbb", themeId: "gorpcore", themeName: "Gorpcore", judge: "edina", total: 7.2, scores: { theme: 7, cohesion: 7, styling: 7 }, verdict: "ok", at: Date.now() }],
      }),
    );
    installFetch();
    render(<RunwayPlay />);
    expect(screen.getByText("Last verdict")).toBeTruthy();
    expect(screen.getByText("Gorpcore")).toBeTruthy();
    expect(screen.getByText(/Best 7.2 · 1 round$/)).toBeTruthy();
  });
});
