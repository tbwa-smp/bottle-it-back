import type {
  ProviderAdapter,
  ProviderContext,
} from './types';

const RESPONSE_SELECTOR =
  '.font-claude-response';

const ASSISTANT_STREAMING_SELECTOR =
  '[data-is-streaming]';

const STOP_BUTTON_SELECTOR =
  'button[aria-label="Stop response"]';

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

export function createClaudeProvider(
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
    return [
      ...document.querySelectorAll<HTMLElement>(
        RESPONSE_SELECTOR,
      ),
    ];
  }

  function getLatestResponse():
    HTMLElement | null {
    const responses =
      getResponseElements();

    return (
      responses.at(-1) ??
      null
    );
  }

  function getStreamingContainer(
    response: HTMLElement,
  ): HTMLElement | null {
    return response.closest<HTMLElement>(
      ASSISTANT_STREAMING_SELECTOR,
    );
  }

  function getStreamingState(
    response: HTMLElement,
  ): string | null {
    const container =
      getStreamingContainer(
        response,
      );

    return (
      container?.getAttribute(
        'data-is-streaming',
      ) ??
      null
    );
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
      '[🍾💧 Bottle It Back] Claude generation discarded',
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
          '[🍾💧 Bottle It Back] Claude running signal detected',
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

    const streamingState =
      getStreamingState(
        response,
      );

    /*
     * Claude also exposes
     * data-is-streaming="true"
     * while the response is
     * being generated.
     *
     * This gives us another
     * running signal in case
     * the Stop button appears
     * between polling intervals.
     */
    if (
      streamingState === 'true'
    ) {
      generation.sawRunningSignal =
        true;

      generation.completionObservedAt =
        null;
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
        '[🍾💧 Bottle It Back] Claude response detected',
        {
          responseChanged,

          responseCharacters:
            Array.from(
              responseText,
            ).length,

          streamingState,

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
      streamingState !== 'true' &&
      generation
        .completionObservedAt ===
        null
    ) {
      generation.completionObservedAt =
        now;

      console.log(
        '[🍾💧 Bottle It Back] Claude completion observed',
        {
          elapsedSeconds:
            (
              generation
                .completionObservedAt -
              generation.startedAt
            ) / 1000,

          streamingState,
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
      streamingState === 'true'
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

    /*
     * Claude may either leave:
     *
     * data-is-streaming="false"
     *
     * or remove the attribute
     * entirely after the final
     * render.
     *
     * Both states are valid.
     */
    if (
      streamingState !== null &&
      streamingState !== 'false'
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

    console.log(
      '[🍾💧 Bottle It Back] Claude generation completed',
      {
        provider:
          'anthropic',

        requestLatency,

        responseCharacters,

        streamingState,

        responseText,

        siteKey:
          context.siteKey,
      },
    );

    /*
     * Do NOT call
     * context.onComplete()
     * yet.
     *
     * Claude completion and
     * cancellation are working.
     *
     * Next step:
     * - output token estimate
     * - model detection
     * - EcoLogits model mapping
     */

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
      '[🍾💧 Bottle It Back] Claude generation started',
      {
        siteKey:
          context.siteKey,

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