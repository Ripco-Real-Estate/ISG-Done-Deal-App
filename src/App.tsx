import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconExternalLink,
  IconLock,
  IconMoon,
  IconSun,
  IconAlertCircle,
  IconCircleCheck,
  IconX,
} from '@tabler/icons-react';
import { monday, apiReady, api } from '@/lib/monday/sdk';
import { BOARDS, ISG, DEAL_STAGE } from '@/lib/donedeal/columns';
import {
  readListing,
  readActiveProfiles,
  prefillFromItem,
  readSellerContacts,
  readListingLeads,
  getContext,
  findDoneDealForListing,
  type LeadOption,
} from '@/lib/donedeal/read';
import { saveDraft, loadDraft, clearDraft } from '@/lib/donedeal/storage';
import { STEP_VALIDATORS } from '@/lib/donedeal/compute';
import {
  runSubmission,
  INITIAL_SUBMIT_STATE,
  type SubmitState,
  type StepStatus,
} from '@/lib/donedeal/submit';
import type { FormData, ListingItem, Profile } from '@/lib/donedeal/types';
import { INITIAL_FORM_DATA } from '@/lib/donedeal/types';
import { MOCK_ITEM_ID, MOCK_PROFILES, mockForm } from '@/lib/donedeal/mock';
import { Button, Pill } from '@/components/ui/primitives';
import { DealContextStrip } from '@/components/ui/DealContextStrip';
import { StepNav, STEP_NAMES } from '@/components/ui/StepNav';
import { DocumentUpload } from '@/components/steps/DocumentUpload';
import { DealMetrics } from '@/components/steps/DealMetrics';
import { DealDetails } from '@/components/steps/DealDetails';
import { DealParties } from '@/components/steps/DealParties';
import { Deductions } from '@/components/steps/Deductions';
import { CommissionSplits } from '@/components/steps/CommissionSplits';
import { ReviewSubmit, type ReviewController } from '@/components/steps/ReviewSubmit';
import type { StepProps } from '@/components/steps/types';

type Phase = 'loading' | 'error' | 'gate' | 'already-submitted' | 'wizard' | 'success';

/** Resolve the ISG Listings item id from monday context (or ?itemId= for dev). */
async function resolveItemId(): Promise<string | null> {
  const url = new URLSearchParams(window.location.search).get('itemId');
  if (url) return url;
  try {
    const ctx = (await monday.get('context')) as { data?: { itemId?: number | string } };
    const id = ctx?.data?.itemId;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

/** Dark mode is a .dark class on <html>, persisted (RIPCO-UI §17.9). */
function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem('ddw.dark', next ? '1' : '0');
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);
  return { dark, toggle };
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [item, setItem] = useState<ListingItem | null>(null);
  const [itemId, setItemId] = useState<string>('');
  const [form, setForm] = useState<FormData>(INITIAL_FORM_DATA);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [resumedDraft, setResumedDraft] = useState(false);
  const { dark, toggle: toggleDark } = useDarkMode();

  // Submit orchestration
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ step: number; status: StepStatus }[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const submitStateRef = useRef<SubmitState>({ ...INITIAL_SUBMIT_STATE });
  const [doneDealId, setDoneDealId] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const isMock = useMemo(() => new URLSearchParams(window.location.search).get('mock') === '1', []);

  // ── Init: context → item → draft/prefill → profiles (non-blocking) ──────────
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Local preview: seed everything, skip all monday calls.
    if (isMock) {
      setItemId(MOCK_ITEM_ID);
      setItem({ id: MOCK_ITEM_ID, name: '250 Bedford Ave (preview)', dealStage: DEAL_STAGE.closingReview, raw: {} });
      setForm(mockForm());
      setProfiles(MOCK_PROFILES);
      setUserId(1);
      setPhase('wizard');
      return;
    }

    (async () => {
      // Wait briefly for monday.api to become callable (Vibe gotcha #2).
      for (let i = 0; i < 20 && !apiReady(); i++) await new Promise((r) => setTimeout(r, 100));

      const id = await resolveItemId();
      if (!id) {
        setErrorMsg('Open this app from an ISG Listing item to begin.');
        setPhase('error');
        return;
      }
      setItemId(id);

      const [{ userId: uid }, listing] = await Promise.all([getContext(), readListing(id)]);
      setUserId(uid);
      setItem(listing);

      // Gatekeeper (source spec §6)
      if (listing.dealStage === DEAL_STAGE.doneDeal) {
        setPhase('already-submitted');
        // Resolve the Done Deal record in the background — spec §6.2 deep link.
        void findDoneDealForListing(id).then(setDoneDealId);
        return;
      }
      if (listing.dealStage !== DEAL_STAGE.closingReview) {
        setPhase('gate');
        return;
      }

      // Draft wins; else prefill from the listing. Sellers are read as separate
      // clean rows from the linked contacts (multi-owner deals); fall back to the
      // mirror-based single seller when there's no property/contacts link.
      const draft = await loadDraft(id);
      if (draft) {
        setForm(draft);
        setResumedDraft(true);
      } else {
        const base = prefillFromItem(listing);
        const sellers = await readSellerContacts(id);
        if (sellers.length) base.dealParties.sellers = sellers;
        setForm(base);
        setResumedDraft(false);
      }
      setPhase('wizard');

      // Profiles + linked leads load in the background — never block the UI.
      void readActiveProfiles().then(setProfiles);
      void readListingLeads(id).then(setLeads);
    })().catch((e) => {
      setErrorMsg(e instanceof Error ? e.message : "Couldn't load the listing.");
      setPhase('error');
    });
  }, [isMock]);

  // ── Debounced draft autosave ────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (phase !== 'wizard' || !itemId || isMock) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () =>
        void saveDraft(itemId, form).then((ok) => {
          if (ok) setLastSavedAt(new Date());
        }),
      2000,
    );
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, phase, itemId, isMock]);

  // Start over: discard the draft and re-prefill from the listing (§8 honest way out).
  function startOver() {
    if (item) setForm(isMock ? mockForm() : prefillFromItem(item));
    setResumedDraft(false);
    setCurrentStep(1);
    setCompleted(new Set());
    setLastSavedAt(null);
    if (!isMock && itemId) void clearDraft(itemId);
  }

  const update = useCallback((mutator: (draft: FormData) => void) => {
    setForm((prev) => {
      const next = structuredClone(prev);
      mutator(next);
      return next;
    });
  }, []);

  // ── Navigation with validation gating ────────────────────────────────────────
  const stepErrors = useMemo(() => {
    const validator = STEP_VALIDATORS[currentStep - 1];
    return validator ? validator(form) : [];
  }, [currentStep, form]);

  function goNext() {
    if (currentStep >= 7) return;
    if (stepErrors.length > 0) return;
    setCompleted((c) => {
      const next = new Set(c).add(currentStep);
      // Reaching Review marks it visited, so Edit-jumps back can return to it
      // (the review checklist + missing-docs links stay reachable; submit is
      // still gated by allValid).
      if (currentStep === 6) next.add(7);
      return next;
    });
    setCurrentStep((s) => s + 1);
  }
  function goBack() {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }
  function jump(step: number) {
    setCurrentStep(step);
  }

  // ── Move to Closing Review (gate action; value-only write) ───────────────────
  async function moveToClosingReview() {
    if (!itemId) return;
    setPhase('loading');
    try {
      const cols = JSON.stringify({ [ISG.dealStage]: { label: DEAL_STAGE.closingReview } });
      await api(
        `mutation($b: ID!, $i: ID!, $c: JSON!){ change_multiple_column_values(board_id:$b,item_id:$i,column_values:$c){id} }`,
        { b: BOARDS.isgListings, i: itemId, c: cols },
      );
      const listing = await readListing(itemId);
      setItem(listing);
      const draft = await loadDraft(itemId);
      setForm(draft ?? prefillFromItem(listing));
      setResumedDraft(draft !== null);
      setPhase('wizard');
      void readActiveProfiles().then(setProfiles);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Couldn't update the deal stage.");
      setPhase('error');
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    setFailedStep(null);

    // Local preview: simulate the 5-step progress then land on the success screen.
    if (isMock) {
      for (let step = 1; step <= 5; step++) {
        const set = (status: StepStatus) =>
          setProgress((prev) => [...prev.filter((p) => p.step !== step), { step, status }].sort((a, b) => a.step - b.step));
        set('running');
        await new Promise((r) => setTimeout(r, 350));
        set('done');
      }
      setSubmitting(false);
      setDoneDealId('PREVIEW-000');
      setPhase('success');
      return;
    }

    const onProgress = (step: number, _label: string, status: StepStatus) =>
      setProgress((prev) => {
        const rest = prev.filter((p) => p.step !== step);
        return [...rest, { step, status }].sort((a, b) => a.step - b.step);
      });

    const result = await runSubmission(
      { itemId, userId, profiles },
      form,
      submitStateRef.current,
      onProgress,
      new Date(),
      () => clearDraft(itemId),
    );
    submitStateRef.current = result.state;
    setSubmitting(false);

    if (result.ok) {
      setDoneDealId(result.state.doneDealId);
      setPhase('success');
    } else {
      setSubmitError(result.error ?? 'Submission failed.');
      setFailedStep(result.failedStep ?? null);
    }
  }

  const controller: ReviewController = {
    submitting,
    progress,
    error: submitError,
    failedStep,
    onSubmit: handleSubmit,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  // Only the item load blocks first paint — never profiles, never uploads.
  if (phase === 'loading' && !isUploadingFile) return <WizardSkeleton />;
  if (phase === 'error')
    return (
      <FullScreen>
        <div className="max-w-md text-center">
          <IconAlertCircle size={26} className="mx-auto text-brand-red" aria-hidden />
          <h2 className="mt-2 text-[15px] font-semibold text-ink">Couldn't open the wizard</h2>
          <p className="mt-1 text-[13px] text-muted">{errorMsg}</p>
          <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </FullScreen>
    );
  if (phase === 'already-submitted')
    return (
      <FullScreen>
        <div className="max-w-md text-center">
          <IconCircleCheck size={28} className="mx-auto text-brand-green" aria-hidden />
          <h2 className="mt-2 text-[15px] font-semibold text-ink">Already submitted</h2>
          <p className="mt-1 text-[13px] text-muted">This deal has been submitted as a Done Deal.</p>
          {doneDealId && (
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => monday.execute('openItemCard', { itemId: Number(doneDealId) })}
            >
              Open Done Deal record <IconExternalLink size={14} aria-hidden />
            </Button>
          )}
        </div>
      </FullScreen>
    );
  if (phase === 'gate')
    return (
      <FullScreen>
        <div className="max-w-md text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg text-muted">
            <IconLock size={22} aria-hidden />
          </div>
          <h2 className="text-[15px] font-semibold text-ink">Not in closing review</h2>
          <p className="mt-1 text-[13px] text-muted">
            This listing must be in the "{DEAL_STAGE.closingReview}" stage to submit a Done Deal.
          </p>
          <div className="mt-2">
            <Pill tone="gray" dot>{item?.dealStage || 'Unknown stage'}</Pill>
          </div>
          <Button className="mt-5" onClick={moveToClosingReview}>
            Move to closing review
          </Button>
        </div>
      </FullScreen>
    );
  if (phase === 'success') return <SuccessScreen doneDealId={doneDealId} />;

  const stepProps: StepProps = { form, update, itemId, profiles, leads, onUploadingChange: setIsUploadingFile };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Page header (§12): sticky, h-12 title bar + step-nav sub-header */}
      <div className="sticky top-0 z-20 flex-none border-b border-border bg-white">
        <div className="flex h-12 items-center justify-between px-5">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-[16px] font-semibold leading-none text-ink">Done Deal wizard</h1>
            <span className="truncate text-[12px] text-muted">{item?.name}</span>
            {item?.dealStage && <Pill tone="green" dot>{item.dealStage}</Pill>}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {lastSavedAt && (
              <span className="text-[12px] text-muted">
                Draft saved {lastSavedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            <button
              type="button"
              onClick={toggleDark}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-button text-muted transition-colors hover:bg-bg-subtle"
            >
              {dark ? <IconSun size={15} /> : <IconMoon size={15} />}
            </button>
          </div>
        </div>
        <DealContextStrip form={form} />
        <div className="border-t border-border px-5 py-2">
          <StepNav current={currentStep} completed={completed} onJump={jump} />
        </div>
        {resumedDraft && (
          <div className="flex items-center justify-between gap-3 border-t border-border bg-brand-blue-light px-5 py-1.5">
            <span className="text-[12px] text-[#1d4ed8]">
              Resuming your draft —{' '}
              <button type="button" onClick={startOver} className="font-medium underline underline-offset-2">
                Start over
              </button>{' '}
              to clear it and refill from the listing.
            </span>
            <button
              type="button"
              onClick={() => setResumedDraft(false)}
              aria-label="Dismiss draft notice"
              className="text-[#1d4ed8] transition-opacity hover:opacity-70"
            >
              <IconX size={14} aria-hidden />
            </button>
          </div>
        )}
      </div>

      <main className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-6 py-5">
          {currentStep === 1 && <DocumentUpload {...stepProps} />}
          {currentStep === 2 && <DealMetrics {...stepProps} />}
          {currentStep === 3 && <DealDetails {...stepProps} />}
          {currentStep === 4 && <DealParties {...stepProps} />}
          {currentStep === 5 && <Deductions {...stepProps} />}
          {currentStep === 6 && <CommissionSplits {...stepProps} />}
          {currentStep === 7 && <ReviewSubmit {...stepProps} onEdit={jump} controller={controller} />}
        </div>
      </main>

      {currentStep < 7 && (
        <footer className="sticky bottom-0 flex-none border-t border-border bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-2.5">
            <Button variant="ghost" onClick={goBack} disabled={currentStep === 1}>
              <IconArrowLeft size={14} aria-hidden /> Back
            </Button>
            <div className="flex items-center gap-3">
              {stepErrors.length > 0 && (
                <ul className="max-w-[420px] space-y-0.5 text-right text-[12px] leading-4 text-[#b71f37]">
                  {stepErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
              <Button
                onClick={goNext}
                disabled={stepErrors.length > 0}
                title={stepErrors.length > 0 ? stepErrors[0] : undefined}
              >
                Next: {STEP_NAMES[currentStep]} <IconArrowRight size={14} aria-hidden />
              </Button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

// ── Presentational helpers ───────────────────────────────────────────────────
function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full items-center justify-center p-6">{children}</div>;
}

/** Loading = skeleton mirroring the wizard layout — never a spinner (§9.14). */
function WizardSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none border-b border-border bg-white">
        <div className="flex h-12 items-center px-5">
          <div className="h-4 w-44 animate-pulse rounded bg-[#ecedf0]" />
        </div>
        <div className="flex items-center gap-6 border-t border-border px-5 py-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-7 w-7 animate-pulse rounded-full bg-[#ecedf0]" />
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-6 py-5">
        <div className="space-y-3 rounded-card border border-border bg-white p-[16px]">
          <div className="h-4 w-36 animate-pulse rounded bg-[#ecedf0]" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-[#ecedf0]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function SuccessScreen({ doneDealId }: { doneDealId: string | null }) {
  const openRecord = () => {
    if (doneDealId) monday.execute('openItemCard', { itemId: Number(doneDealId) });
  };
  const close = () => monday.execute('closeAppFeatureModal' as never).catch(() => {});
  return (
    <FullScreen>
      <div className="max-w-sm text-center">
        <div className="ddw-pop mx-auto mb-3 text-brand-green">
          <IconCircleCheck size={44} aria-hidden />
        </div>
        <h2 className="text-[16px] font-semibold text-ink">Done Deal submitted</h2>
        <p className="mt-1 text-[13px] text-muted">
          Finance reviews new submissions on the Done Deals board — no further action needed.
        </p>
        {doneDealId && (
          <button
            onClick={openRecord}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-blue hover:underline"
          >
            Done Deal ID: {doneDealId} <IconExternalLink size={14} aria-hidden />
          </button>
        )}
        <div className="mt-6">
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    </FullScreen>
  );
}
