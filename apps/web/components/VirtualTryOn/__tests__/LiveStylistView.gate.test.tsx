import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test for the start-screen gate.
//
// Twice now (commits 0189f03 and the follow-up that produced this test),
// returning visitors with `onpoint_preferred_provider` persisted in
// localStorage were dropped into the main session view with no live session
// running — black viewport, empty <video>, no way back. The gate at
// LiveStylistView.tsx:360 must stay anchored to runtime session state
// (`isConnected`, `isInitializing`, `queuedStart`) and NOT to the persisted
// provider preference alone.

// ── Mocks ──────────────────────────────────────────────────────────────
// wagmi's useAccount touches a provider tree we don't want to set up here.
vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: false, address: undefined }),
}));

// LiveStylistView pulls a lot of session state via useLiveSession. The
// regression we're pinning is in the *gate*, not the hook — so stub the
// hook with a session shape that mimics "persisted provider, no live
// session" and assert what the component does with it.
type SessionOverrides = {
  selectedProvider: string | null;
  isConnected: boolean;
  isInitializing: boolean;
};

let sessionOverrides: SessionOverrides = {
  selectedProvider: null,
  isConnected: false,
  isInitializing: false,
};

function makeSessionStub() {
  const noop = () => {};
  const asyncNoop = async () => {};
  return {
    selectedProvider: sessionOverrides.selectedProvider,
    setSelectedProvider: noop,
    selectedPersona: null,
    setSelectedPersona: noop,
    sessionGoal: null,
    setSessionGoal: noop,
    initStep: "connecting",
    setInitStep: noop,
    showSummary: false,
    setShowSummary: noop,
    finalAdvice: "",
    sessionEndedManually: false,
    isConnected: sessionOverrides.isConnected,
    isInitializing: sessionOverrides.isInitializing,
    isAnalyzing: false,
    error: null,
    cameraError: null,
    videoRef: { current: null },
    startSession: asyncNoop,
    stopSession: noop,
    handleFinish: noop,
    transcript: "",
    liveAiResponse: "",
    reasoning: [] as string[],
    agentEvents: [],
    sessionSummary: null,
    positionStatus: "analyzing",
    isCritique: false,
    captures: [],
    selectedCaptureIndex: null,
    setSelectedCaptureIndex: noop,
    isCapturing: false,
    showFlash: false,
    countdown: null,
    captureToast: null,
    handleCapture: noop,
    startTimerCapture: noop,
    hasCaptures: false,
    selectedCapture: null,
    uploadedData: null,
    setUploadedData: noop,
    capturesRemaining: 3,
    capturesExhausted: false,
    maxCaptures: 3,
    sessionTimeRemaining: null,
    sessionExpired: false,
    isVenice: sessionOverrides.selectedProvider === "venice",
    providerDisplayName: "Venice",
    isPremium: false,
    requiresPayment: false,
    supportsByok: false,
    latencyMs: 0,
    provider: sessionOverrides.selectedProvider,
    activities: [],
    coachingBadges: [],
    terminalExpanded: false,
    setTerminalExpanded: noop,
    isVoiceEnabled: false,
    setIsVoiceEnabled: noop,
    userApiKey: "",
    setUserApiKey: noop,
    showByokInput: false,
    setShowByokInput: noop,
    geminiPaymentToken: null,
    setGeminiPaymentToken: noop,
    showPaymentSuccess: false,
    setShowPaymentSuccess: noop,
    suggestions: [],
    currentSuggestion: null,
    handleAcceptSuggestion: noop,
    rejectSuggestion: noop,
    dismissSuggestion: noop,
    currentApproval: null,
    isApprovalModalOpen: false,
    setIsApprovalModalOpen: noop,
    approveRequest: noop,
    rejectRequest: noop,
  };
}

vi.mock("../hooks/useLiveSession", () => ({
  useLiveSession: () => makeSessionStub(),
}));

// Suggestion toast/approval/cart components are not needed for the gate
// branch — stub them as inert nodes so we don't pull their internals in.
vi.mock("../../Agent/TipModal", () => ({ TipSheet: () => null }));
vi.mock("../../Agent/AgentApprovalModal", () => ({
  AgentApprovalModal: () => null,
}));
vi.mock("../../Agent/AgentSuggestionToast", () => ({
  AgentSuggestionToast: () => null,
}));
vi.mock("../../Shop/CartDrawer", () => ({ CartDrawer: () => null }));
vi.mock("../../Shop/CheckoutModal", () => ({ CheckoutModal: () => null }));

// ── Import after mocks ────────────────────────────────────────────────
import { LiveStylistView } from "../LiveStylistView";

describe("LiveStylistView — start-screen gate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    sessionOverrides = {
      selectedProvider: null,
      isConnected: false,
      isInitializing: false,
    };
  });

  it("renders the start screen when no provider is persisted", () => {
    render(<LiveStylistView onBack={() => {}} />);
    expect(screen.getByText(/START STYLE CAMERA/i)).toBeTruthy();
  });

  it("renders the start screen even when a provider preference is persisted, as long as no session is in flight", () => {
    // Reproduce the bug scenario: a returning visitor with the persisted
    // venice preference. The hook would hydrate selectedProvider="venice"
    // on mount. Pre-fix, this skipped the start screen.
    window.localStorage.setItem("onpoint_preferred_provider", "venice");
    sessionOverrides = {
      selectedProvider: "venice",
      isConnected: false,
      isInitializing: false,
    };

    render(<LiveStylistView onBack={() => {}} />);

    // Start screen primary CTA is present.
    expect(screen.getByText(/START STYLE CAMERA/i)).toBeTruthy();
    // Main session ticker label (the Miranda fallback) must NOT be in the
    // tree — its presence would mean we slipped into the main view.
    expect(screen.queryByText(/Miranda Priestly/i)).toBeNull();
  });

  it("leaves the start screen when the session is actually initializing", () => {
    sessionOverrides = {
      selectedProvider: "venice",
      isConnected: false,
      isInitializing: true,
    };
    render(<LiveStylistView onBack={() => {}} />);
    expect(screen.queryByText(/START STYLE CAMERA/i)).toBeNull();
  });

  it("leaves the start screen once a session is connected", () => {
    sessionOverrides = {
      selectedProvider: "venice",
      isConnected: true,
      isInitializing: false,
    };
    render(<LiveStylistView onBack={() => {}} />);
    expect(screen.queryByText(/START STYLE CAMERA/i)).toBeNull();
  });
});
