import type { ProviderAdapter, ProviderContext } from './types';

const RESPONSE_SELECTOR = '.font-claude-response';
const ASSISTANT_STREAMING_SELECTOR = '[data-is-streaming]';
const STOP_BUTTON_SELECTOR = 'button[aria-label="Stop response"]';
const MODEL_SELECTOR = 'button[data-testid="model-selector-dropdown"]';

const FALLBACK_MODEL = 'claude-sonnet-4-6';
const POLL_INTERVAL_MS = 500;
const RESPONSE_QUIET_MS = 2000;
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;

interface PendingGeneration {
  startedAt: number;
  responseAtStart: HTMLElement | null;
  responseTextAtStart: string;
  lastResponseText: string;
  lastTextChangedAt: number;
  sawResponseActivity: boolean;
  sawRunningSignal: boolean;
  completionObservedAt: number | null;
}

interface ModelResolution {
  modelName: string;
  usedFallback: boolean;
}

export function createClaudeProvider(context: ProviderContext): ProviderAdapter {
  let pendingGeneration: PendingGeneration | null = null;
  let pollTimerId: number | null = null;

  function getResponseElements(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(RESPONSE_SELECTOR)];
  }

  function getLatestResponse(): HTMLElement | null {
    return getResponseElements().at(-1) ?? null;
  }

  function getStreamingContainer(response: HTMLElement): HTMLElement | null {
    return response.closest<HTMLElement>(ASSISTANT_STREAMING_SELECTOR);
  }

  function getStreamingState(response: HTMLElement): string | null {
    return getStreamingContainer(response)?.getAttribute('data-is-streaming') ?? null;
  }

  function estimateOutputTokens(text: string): number {
    return Math.max(1, Math.ceil(Array.from(text).length / 4));
  }

  function getSelectedModelLabel(): string | null {
    const button = document.querySelector<HTMLElement>(MODEL_SELECTOR);
    if (!button) return null;

    const ariaLabel = button.getAttribute('aria-label');

    if (ariaLabel) {
      const match = ariaLabel.match(/^Model:\s*(.+)$/i);
      if (match?.[1]) return match[1].trim();
    }

    const text = button.innerText.replace(/\s+/g, ' ').trim();
    return text || null;
  }

  function resolveEcoLogitsModel(modelLabel: string | null): ModelResolution {
    if (!modelLabel) return { modelName: FALLBACK_MODEL, usedFallback: true };

    const normalized = modelLabel.toLowerCase().replace(/\s+/g, ' ').trim();

    if (normalized.includes('opus 4.8')) return { modelName: 'claude-opus-4-8', usedFallback: false };
    if (normalized.includes('opus 4.7')) return { modelName: 'claude-opus-4-7', usedFallback: false };
    if (normalized.includes('opus 4.6')) return { modelName: 'claude-opus-4-6', usedFallback: false };
    if (normalized.includes('opus 4.5')) return { modelName: 'claude-opus-4-5', usedFallback: false };
    if (normalized.includes('opus 4.1')) return { modelName: 'claude-opus-4-1', usedFallback: false };
    if (normalized.includes('opus 4')) return { modelName: 'claude-opus-4-0', usedFallback: false };

    if (normalized.includes('sonnet 4.6')) return { modelName: 'claude-sonnet-4-6', usedFallback: false };
    if (normalized.includes('sonnet 4.5')) return { modelName: 'claude-sonnet-4-5', usedFallback: false };
    if (normalized.includes('sonnet 4')) return { modelName: 'claude-sonnet-4-0', usedFallback: false };

    if (normalized.includes('haiku 4.5')) return { modelName: 'claude-haiku-4-5', usedFallback: false };

    return { modelName: FALLBACK_MODEL, usedFallback: true };
  }

  function isGenerationStillRunning(): boolean {
    return Boolean(document.querySelector(STOP_BUTTON_SELECTOR));
  }

  function stopPolling(): void {
    if (pollTimerId === null) return;
    window.clearInterval(pollTimerId);
    pollTimerId = null;
  }

  function clearPendingGeneration(reason: string): void {
    if (!pendingGeneration) return;

    console.log('[🍾💧 Bottle It Back] Claude generation discarded', { reason });

    pendingGeneration = null;
    stopPolling();
  }

  function pollGeneration(): void {
    const generation = pendingGeneration;

    if (!generation) {
      stopPolling();
      return;
    }

    const now = performance.now();

    if (now - generation.startedAt > GENERATION_TIMEOUT_MS) {
      clearPendingGeneration('timeout');
      return;
    }

    const generationStillRunning = isGenerationStillRunning();

    if (generationStillRunning) {
      if (!generation.sawRunningSignal) {
        console.log('[🍾💧 Bottle It Back] Claude running signal detected');
      }

      generation.sawRunningSignal = true;
      generation.completionObservedAt = null;
    }

    const response = getLatestResponse();
    if (!response) return;

    const responseText = response.innerText.trim();
    if (!responseText) return;

    const streamingState = getStreamingState(response);

    if (streamingState === 'true') {
      generation.sawRunningSignal = true;
      generation.completionObservedAt = null;
    }

    const responseChanged = response !== generation.responseAtStart;
    const textChangedFromStart = responseText !== generation.responseTextAtStart;

    if (!generation.sawResponseActivity && (responseChanged || textChangedFromStart)) {
      generation.sawResponseActivity = true;
      generation.lastResponseText = responseText;
      generation.lastTextChangedAt = now;

      console.log('[🍾💧 Bottle It Back] Claude response detected', {
        responseChanged,
        responseCharacters: Array.from(responseText).length,
        streamingState,
        element: response.tagName.toLowerCase(),
        className: response.className,
      });

      return;
    }

    if (!generation.sawResponseActivity) return;

    if (responseText !== generation.lastResponseText) {
      generation.lastResponseText = responseText;
      generation.lastTextChangedAt = now;
      generation.completionObservedAt = null;
      return;
    }

    if (
      generation.sawRunningSignal &&
      !generationStillRunning &&
      streamingState !== 'true' &&
      generation.completionObservedAt === null
    ) {
      generation.completionObservedAt = now;

      console.log('[🍾💧 Bottle It Back] Claude completion observed', {
        elapsedSeconds: (generation.completionObservedAt - generation.startedAt) / 1000,
        streamingState,
      });
    }

    const quietFor = now - generation.lastTextChangedAt;

    if (quietFor < RESPONSE_QUIET_MS) return;
    if (generationStillRunning) return;
    if (streamingState === 'true') return;
    if (generation.completionObservedAt === null) return;
    if (streamingState !== null && streamingState !== 'false') return;

    const requestLatency = (generation.completionObservedAt - generation.startedAt) / 1000;
    const responseCharacters = Array.from(responseText).length;
    const outputTokenCount = estimateOutputTokens(responseText);
    const selectedModel = getSelectedModelLabel();
    const { modelName, usedFallback } = resolveEcoLogitsModel(selectedModel);

    if (usedFallback) {
      console.warn('[🍾💧 Bottle It Back] Claude model not supported by EcoLogits; using fallback', {
        selectedModel: selectedModel ?? 'unknown',
        fallbackModel: modelName,
      });
    }

    console.log('[🍾💧 Bottle It Back] Claude generation completed', {
      provider: 'anthropic',
      selectedModel: selectedModel ?? 'unknown',
      modelName,
      usedFallback,
      requestLatency,
      outputTokenCount,
      tokenSource: 'estimated',
      responseCharacters,
      streamingState,
      responseText,
      siteKey: context.siteKey,
    });

    context.onComplete({
      provider: 'anthropic',
      modelName,
      outputTokenCount,
      requestLatency,
      tokenSource: 'estimated',
    });

    pendingGeneration = null;
    stopPolling();
  }

  function handleDocumentClick(event: MouseEvent): void {
    if (!pendingGeneration || !(event.target instanceof Element)) return;

    const stopButton = event.target.closest(STOP_BUTTON_SELECTOR);
    if (!stopButton) return;

    clearPendingGeneration('user-stop');
  }

  function startGeneration(): void {
    if (pendingGeneration) clearPendingGeneration('new-prompt');

    const now = performance.now();
    const responseAtStart = getLatestResponse();
    const responseTextAtStart = responseAtStart?.innerText.trim() ?? '';

    pendingGeneration = {
      startedAt: now,
      responseAtStart,
      responseTextAtStart,
      lastResponseText: '',
      lastTextChangedAt: now,
      sawResponseActivity: false,
      sawRunningSignal: false,
      completionObservedAt: null,
    };

    const selectedModel = getSelectedModelLabel();
    const modelResolution = resolveEcoLogitsModel(selectedModel);

    console.log('[🍾💧 Bottle It Back] Claude generation started', {
      siteKey: context.siteKey,
      selectedModel: selectedModel ?? 'unknown',
      ecoLogitsModel: modelResolution.modelName,
      usedFallback: modelResolution.usedFallback,
      responseTextAtStartLength: Array.from(responseTextAtStart).length,
    });

    stopPolling();
    pollTimerId = window.setInterval(pollGeneration, POLL_INTERVAL_MS);
  }

  function destroy(): void {
    pendingGeneration = null;
    stopPolling();
    document.removeEventListener('click', handleDocumentClick, true);
  }

  document.addEventListener('click', handleDocumentClick, true);

  return {
    startGeneration,
    destroy,
  };
}