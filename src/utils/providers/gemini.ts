import type {
  ProviderAdapter,
  ProviderContext,
} from './types';

const RESPONSE_SELECTORS = [
  '.model-response-text',
  'structured-content-container',
  'model-response',
  'message-content',
];

const STOP_BUTTON_SELECTOR =
  'button[aria-label="Stop response"]';

const MODEL_PICKER_SELECTOR =
  'button[aria-label^="Open mode picker"]';

const POLL_INTERVAL_MS = 500;

const RESPONSE_QUIET_MS = 2000;

const GENERATION_TIMEOUT_MS =
  5 * 60 * 1000;

interface PendingGeneration {
  startedAt: number;

  responseAtStart:
    | HTMLElement
    | null;

  responseTextAtStart: string;

  lastResponseText: string;

  lastTextChangedAt: number;

  sawResponseActivity: boolean;

  sawRunningSignal: boolean;

  completionObservedAt:
    | number
    | null;
}

export function createGeminiProvider(
  context: ProviderContext,
): ProviderAdapter {
  let pendingGeneration:
    | PendingGeneration
    | null = null;

  let pollTimerId:
    | number
    | null = null;

  function getResponseElements():
    HTMLElement[] {
    const elements =
      new Set<HTMLElement>();

    for (
      const selector
      of RESPONSE_SELECTORS
    ) {
      const matches =
        document.querySelectorAll<HTMLElement>(
          selector,
        );

      for (const element of matches) {
        elements.add(element);
      }
    }

    return [...elements];
  }

  function getLatestResponse():
    HTMLElement | null {
    const responses =
      getResponseElements();

    for (
      let index =
        responses.length - 1;
      index >= 0;
      index -= 1
    ) {
      const element =
        responses[index];

      const text =
        element.innerText.trim();

      if (text) {
        return element;
      }
    }

    return null;
  }

  function estimateOutputTokens(
    text: string,
  ): number {
    const characterCount =
      Array.from(text).length;

    return Math.max(
      1,
      Math.ceil(
        characterCount / 4,
      ),
    );
  }

  function getSelectedMode():
    string | null {
    const picker =
      document.querySelector<HTMLElement>(
        MODEL_PICKER_SELECTOR,
      );

    if (!picker) {
      return null;
    }

    const ariaLabel =
      picker.getAttribute(
        'aria-label',
      );

    if (ariaLabel) {
      const match =
        ariaLabel.match(
          /currently\s+(.+)$/i,
        );

      if (
        match?.[1]
      ) {
        return match[1].trim();
      }
    }

    const text =
      picker.innerText.trim();

    return text || null;
  }

  function getEcoLogitsModelName():
    string | null {
    const mode =
      getSelectedMode();

    if (!mode) {
      return null;
    }

    const normalized =
      mode
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    /*
     * Current Gemini web app:
     *
     * Flash
     * → Gemini 3.6 Flash
     * → EcoLogits gemini-pro-latest
     */
    if (
      normalized === 'flash'
    ) {
      return 'gemini-pro-latest';
    }

    /*
     * Future-proofing for accounts
     * where Google exposes the
     * Flash-Lite tier explicitly.
     */
    if (
      normalized.includes(
        'flash-lite',
      ) ||
      normalized.includes(
        'flash lite',
      )
    ) {
      return 'gemini-flash-lite-latest';
    }

    /*
     * Pro / Thinking-style Gemini
     * modes can use EcoLogits'
     * moving Pro alias.
     */
    if (
      normalized.includes(
        'pro',
      ) ||
      normalized.includes(
        'thinking',
      )
    ) {
      return 'gemini-pro-latest';
    }

    return null;
  }

  function isGenerationStillRunning():
    boolean {
    return Boolean(
      document.querySelector(
        STOP_BUTTON_SELECTOR,
      ),
    );
  }

  function stopPolling(): void {
    if (
      pollTimerId === null
    ) {
      return;
    }

    window.clearInterval(
      pollTimerId,
    );

    pollTimerId = null;
  }

  function clearPendingGeneration(
    reason: string,
  ): void {
    if (
      !pendingGeneration
    ) {
      return;
    }

    console.log(
      '[🍾💧 Bottle It Back] Gemini generation discarded',
      {
        reason,
      },
    );

    pendingGeneration = null;

    stopPolling();
  }

  function pollGeneration(): void {
    const generation =
      pendingGeneration;

    if (!generation) {
      stopPolling();

      return;
    }

    const now =
      performance.now();

    if (
      now -
        generation.startedAt >
      GENERATION_TIMEOUT_MS
    ) {
      clearPendingGeneration(
        'timeout',
      );

      return;
    }

    const generationStillRunning =
      isGenerationStillRunning();

    if (
      generationStillRunning
    ) {
      if (
        !generation
          .sawRunningSignal
      ) {
        console.log(
          '[🍾💧 Bottle It Back] Gemini running signal detected',
        );
      }

      generation.sawRunningSignal =
        true;

      generation.completionObservedAt =
        null;
    }

    const response =
      getLatestResponse();

    if (!response) {
      return;
    }

    const responseText =
      response.innerText.trim();

    if (!responseText) {
      return;
    }

    const responseChanged =
      response !==
      generation.responseAtStart;

    const textChangedFromStart =
      responseText !==
      generation
        .responseTextAtStart;

    if (
      !generation
        .sawResponseActivity &&
      (
        responseChanged ||
        textChangedFromStart
      )
    ) {
      generation.sawResponseActivity =
        true;

      generation.lastResponseText =
        responseText;

      generation.lastTextChangedAt =
        now;

      console.log(
        '[🍾💧 Bottle It Back] Gemini response detected',
        {
          responseChanged,

          responseCharacters:
            Array.from(
              responseText,
            ).length,

          element:
            response.tagName
              .toLowerCase(),

          className:
            response.className,
        },
      );

      return;
    }

    if (
      !generation
        .sawResponseActivity
    ) {
      return;
    }

    if (
      responseText !==
      generation.lastResponseText
    ) {
      generation.lastResponseText =
        responseText;

      generation.lastTextChangedAt =
        now;

      generation.completionObservedAt =
        null;

      return;
    }

    if (
      generation.sawRunningSignal &&
      !generationStillRunning &&
      generation
        .completionObservedAt ===
        null
    ) {
      generation.completionObservedAt =
        now;

      console.log(
        '[🍾💧 Bottle It Back] Gemini completion observed',
        {
          elapsedSeconds:
            (
              generation
                .completionObservedAt -
              generation.startedAt
            ) / 1000,
        },
      );
    }

    const quietFor =
      now -
      generation.lastTextChangedAt;

    if (
      quietFor <
      RESPONSE_QUIET_MS
    ) {
      return;
    }

    if (
      generationStillRunning
    ) {
      return;
    }

    if (
      generation
        .completionObservedAt ===
      null
    ) {
      return;
    }

    const requestLatency =
      (
        generation
          .completionObservedAt -
        generation.startedAt
      ) / 1000;

    const responseCharacters =
      Array.from(
        responseText,
      ).length;

    const outputTokenCount =
      estimateOutputTokens(
        responseText,
      );

    const selectedMode =
      getSelectedMode();

    const modelName =
      getEcoLogitsModelName();

    if (!modelName) {
      console.warn(
        '[🍾💧 Bottle It Back] Gemini model could not be mapped',
        {
          selectedMode,
          requestLatency,
          outputTokenCount,
        },
      );

      pendingGeneration = null;

      stopPolling();

      return;
    }

    console.log(
      '[🍾💧 Bottle It Back] Gemini generation completed',
      {
        provider:
          'google_genai',

        selectedMode,

        modelName,

        requestLatency,

        outputTokenCount,

        tokenSource:
          'estimated',

        responseCharacters,

        responseText,

        siteKey:
          context.siteKey,
      },
    );

    context.onComplete({
      provider:
        'google_genai',

      modelName,

      outputTokenCount,

      requestLatency,

      tokenSource:
        'estimated',
    });

    pendingGeneration = null;

    stopPolling();
  }

  function handleDocumentClick(
    event: MouseEvent,
  ): void {
    if (
      !pendingGeneration
    ) {
      return;
    }

    if (
      !(
        event.target instanceof
        Element
      )
    ) {
      return;
    }

    const stopButton =
      event.target.closest(
        STOP_BUTTON_SELECTOR,
      );

    if (!stopButton) {
      return;
    }

    clearPendingGeneration(
      'user-stop',
    );
  }

  function startGeneration(): void {
    if (
      pendingGeneration
    ) {
      clearPendingGeneration(
        'new-prompt',
      );
    }

    const now =
      performance.now();

    const responseAtStart =
      getLatestResponse();

    const responseTextAtStart =
      responseAtStart
        ?.innerText
        .trim() ?? '';

    pendingGeneration = {
      startedAt:
        now,

      responseAtStart,

      responseTextAtStart,

      lastResponseText:
        '',

      lastTextChangedAt:
        now,

      sawResponseActivity:
        false,

      sawRunningSignal:
        false,

      completionObservedAt:
        null,
    };

    console.log(
      '[🍾💧 Bottle It Back] Gemini generation started',
      {
        siteKey:
          context.siteKey,

        selectedMode:
          getSelectedMode(),

        responseTextAtStartLength:
          Array.from(
            responseTextAtStart,
          ).length,
      },
    );

    stopPolling();

    pollTimerId =
      window.setInterval(
        pollGeneration,
        POLL_INTERVAL_MS,
      );
  }

  function destroy(): void {
    pendingGeneration = null;

    stopPolling();

    document.removeEventListener(
      'click',
      handleDocumentClick,
      true,
    );
  }

  document.addEventListener(
    'click',
    handleDocumentClick,
    true,
  );

  return {
    startGeneration,
    destroy,
  };
}