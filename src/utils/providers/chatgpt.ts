import { encode } from 'gpt-tokenizer';

import type {
  ProviderAdapter,
  ProviderContext,
} from './types';

const ASSISTANT_MESSAGE_SELECTOR =
  '[data-message-author-role="assistant"]';

const STOP_BUTTON_SELECTOR =
  '[data-testid="stop-button"]';

const ECOLOGITS_CHATGPT_MODEL =
  'chat-latest';

const POLL_INTERVAL_MS = 500;
const RESPONSE_QUIET_MS = 2000;
const GENERATION_TIMEOUT_MS =
  5 * 60 * 1000;

interface PendingGeneration {
  startedAt: number;

  assistantAtStart:
    | HTMLElement
    | null;

  assistantTextAtStart: string;

  lastResponseText: string;

  lastTextChangedAt: number;

  sawResponseActivity: boolean;

  sawRunningSignal: boolean;

  completionObservedAt:
    | number
    | null;
}

export function createChatGptProvider(
  context: ProviderContext,
): ProviderAdapter {
  let pendingGeneration:
    | PendingGeneration
    | null = null;

  let pollTimerId:
    | number
    | null = null;

  function getAssistantMessages():
    HTMLElement[] {
    return [
      ...document.querySelectorAll<HTMLElement>(
        ASSISTANT_MESSAGE_SELECTOR,
      ),
    ];
  }

  function getLatestAssistant():
    HTMLElement | null {
    return (
      getAssistantMessages().at(-1) ??
      null
    );
  }

  function estimateOutputTokens(
    text: string,
  ): number {
    return encode(text).length;
  }

  function stopPolling(): void {
    if (pollTimerId === null) {
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
    if (!pendingGeneration) {
      return;
    }

    console.log(
      '[🍾💧 Bottle It Back] ChatGPT generation discarded',
      {
        reason,
      },
    );

    pendingGeneration = null;

    stopPolling();
  }

  function isGenerationStillRunning():
    boolean {
    return Boolean(
      document.querySelector(
        STOP_BUTTON_SELECTOR,
      ),
    );
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
      now - generation.startedAt >
      GENERATION_TIMEOUT_MS
    ) {
      clearPendingGeneration(
        'timeout',
      );

      return;
    }

    const generationStillRunning =
      isGenerationStillRunning();

    /*
     * ChatGPT currently exposes a stop button
     * while a generation is actively running.
     *
     * We require seeing this state before we
     * accept the response as completed.
     */
    if (
      generationStillRunning
    ) {
      generation.sawRunningSignal =
        true;

      /*
       * If ChatGPT becomes active again after
       * we thought completion had occurred,
       * invalidate that completion timestamp.
       */
      generation.completionObservedAt =
        null;
    }

    const assistant =
      getLatestAssistant();

    if (!assistant) {
      return;
    }

    const responseText =
      assistant.innerText.trim();

    if (!responseText) {
      return;
    }

    /*
     * ChatGPT may recycle or virtualize
     * assistant DOM elements.
     *
     * We therefore detect the new response
     * by comparing both:
     *
     * - the latest assistant element
     * - its text before and after generation
     */
    const assistantChanged =
      assistant !==
      generation.assistantAtStart;

    const textChangedFromStart =
      responseText !==
      generation.assistantTextAtStart;

    /*
     * First evidence that a response belonging
     * to this prompt has appeared.
     */
    if (
      !generation.sawResponseActivity &&
      (
        assistantChanged ||
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
        '[🍾💧 Bottle It Back] ChatGPT response detected',
        {
          assistantChanged,

          responseCharacters:
            responseText.length,
        },
      );

      return;
    }

    /*
     * Nothing belonging to this generation
     * has appeared yet.
     */
    if (
      !generation.sawResponseActivity
    ) {
      return;
    }

    /*
     * The response is still streaming or
     * otherwise changing.
     */
    if (
      responseText !==
      generation.lastResponseText
    ) {
      generation.lastResponseText =
        responseText;

      generation.lastTextChangedAt =
        now;

      /*
       * More text appeared after a possible
       * completion signal.
       */
      generation.completionObservedAt =
        null;

      return;
    }

    /*
     * Once we have:
     *
     * - seen ChatGPT actively generating
     * - seen assistant response activity
     * - and the stop button disappears
     *
     * record the actual completion time.
     *
     * This timestamp is captured before the
     * artificial 2-second stability buffer.
     */
    if (
      generation.sawRunningSignal &&
      !generationStillRunning &&
      generation.completionObservedAt ===
        null
    ) {
      generation.completionObservedAt =
        now;

      console.log(
        '[🍾💧 Bottle It Back] ChatGPT completion observed',
        {
          elapsedSeconds:
            (
              generation.completionObservedAt -
              generation.startedAt
            ) / 1000,
        },
      );
    }

    const quietFor =
      now -
      generation.lastTextChangedAt;

    /*
     * Wait for ChatGPT's response DOM to remain
     * unchanged for two seconds.
     *
     * This is only a confirmation buffer.
     * It is intentionally excluded from
     * requestLatency.
     */
    if (
      quietFor <
      RESPONSE_QUIET_MS
    ) {
      return;
    }

    /*
     * Still actively generating.
     */
    if (
      generationStillRunning
    ) {
      return;
    }

    /*
     * We require a positive transition from
     * running to completed.
     */
    if (
      generation.completionObservedAt ===
      null
    ) {
      return;
    }

    /*
     * Measure latency only until ChatGPT
     * actually stopped generating.
     */
    const requestLatency =
      (
        generation.completionObservedAt -
        generation.startedAt
      ) / 1000;

    /*
     * Consumer ChatGPT does not give our
     * content script the same official usage
     * object that the OpenAI API would.
     *
     * Tokenize the final rendered assistant
     * response locally instead.
     */
    const outputTokenCount =
      estimateOutputTokens(
        responseText,
      );

    /*
     * EcoLogits currently references the
     * ChatGPT 5.6 / Sol model through:
     *
     * chat-latest
     */
    const modelName =
      ECOLOGITS_CHATGPT_MODEL;

    console.log(
      '[🍾💧 Bottle It Back] ChatGPT generation completed',
      {
        provider:
          'openai',

        modelName,

        requestLatency,

        outputTokenCount,

        tokenSource:
          'estimated',

        responseCharacters:
          responseText.length,

        responseText,

        siteKey:
          context.siteKey,
      },
    );

    /*
     * Successful completed generations are
     * forwarded to content.ts.
     *
     * content.ts then emits:
     *
     * AI_RESPONSE_COMPLETE
     *
     * which background.ts receives before
     * calling EcoLogits.
     */
    context.onComplete({
      provider:
        'openai',

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
    if (!pendingGeneration) {
      return;
    }

    if (
      !(event.target instanceof Element)
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

    /*
     * User manually cancelled the response.
     *
     * The partial output must NOT be sent to
     * EcoLogits.
     */
    clearPendingGeneration(
      'user-stop',
    );
  }

  function startGeneration(): void {
    /*
     * A newer prompt supersedes any previous
     * generation that somehow remained pending.
     */
    if (pendingGeneration) {
      clearPendingGeneration(
        'new-prompt',
      );
    }

    const now =
      performance.now();

    const assistantAtStart =
      getLatestAssistant();

    const assistantTextAtStart =
      assistantAtStart
        ?.innerText
        .trim() ?? '';

    pendingGeneration = {
      startedAt:
        now,

      assistantAtStart,

      assistantTextAtStart,

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
      '[🍾💧 Bottle It Back] ChatGPT generation started',
      {
        siteKey:
          context.siteKey,

        assistantTextAtStartLength:
          assistantTextAtStart.length,
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