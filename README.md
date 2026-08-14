# Bottle It Back — AI Water Bottle

Bottle It Back is a Chrome/Chromium extension that estimates the **Water Consumption Footprint (WCF)** of text-generation conversations on supported consumer AI chat platforms.

The extension watches for a prompt submission, waits for the AI response to **successfully finish**, estimates the number of output tokens in the final rendered response, measures the observed generation duration, and sends those values to [EcoLogits](https://ecologits.ai/) to estimate water consumption.

It then keeps local daily, monthly, lifetime, and per-platform totals and provides an optional donation flow through Planet Water Foundation / Donorbox.

> Bottle It Back is an **estimation tool**, not a literal water meter. Environmental values depend on EcoLogits model data, hardware assumptions, data-center assumptions, electricity mix data, and the information exposed by consumer AI websites.

---

## What it does

Bottle It Back currently tracks text-generation activity on:

- **ChatGPT**
- **Google Gemini**
- **Claude**
- **Mistral / Vibe**

For supported sites, the extension can track:

- Page visits
- Prompt submissions
- Active time
- Successfully completed AI responses
- Estimated output tokens
- Observed request/generation latency
- EcoLogits water footprint per completed response
- Water used today
- Water used this month
- Lifetime water usage
- Per-platform water totals
- Donation totals and history

A response is only counted when Bottle It Back observes a successful completion.

If the user stops/cancels a response, the generation times out, or no completed response is detected, Bottle It Back does **not** send an `AI_RESPONSE_COMPLETE` event and does **not** add EcoLogits water to the statistics.

---

## How it works

The current flow is:

```text
User submits prompt
        ↓
content.ts detects the submission
        ↓
Provider adapter starts generation tracking
        ↓
AI website renders/streams the response
        ↓
Provider adapter detects successful completion
        ↓
Estimate output tokens from final rendered text
        ↓
Measure observed request/generation duration
        ↓
AI_RESPONSE_COMPLETE
        ↓
background.ts
        ↓
ecologits.ts
        ↓
POST EcoLogits /v1beta/estimations
        ↓
Normalize WCF result to milliliters
        ↓
Update Chrome local storage
        ↓
Popup UI displays updated usage
```

The provider-specific DOM logic lives separately from the main tracker so that ChatGPT, Gemini, Claude, and Mistral can each have their own selectors and completion rules.

---

## Project architecture

A simplified project layout looks like this:

```text
src/
├── App.tsx
├── utils/
│   ├── background.ts
│   ├── content.ts
│   ├── donationWatch.ts
│   ├── ecologits.ts
│   ├── sites.ts
│   ├── storage.ts
│   ├── types.ts
│   └── providers/
│       ├── index.ts
│       ├── types.ts
│       ├── chatgpt.ts
│       ├── gemini.ts
│       ├── claude.ts
│       └── mistral.ts
└── ...
```

### `content.ts`

Runs on supported AI websites.

Its responsibilities include:

- Detecting supported sites
- Detecting prompt submissions
- Sending `PAGE_VISIT`
- Sending `PROMPT_SUBMIT`
- Sending periodic `ACTIVE_PING` events
- Creating the appropriate provider adapter
- Forwarding completed provider responses as `AI_RESPONSE_COMPLETE`

`content.ts` does **not** calculate water directly.

### Provider adapters

Each supported AI site has its own adapter under:

```text
src/utils/providers/
```

A provider adapter is responsible for:

1. Detecting the beginning of a generation
2. Detecting response activity
3. Detecting successful completion
4. Detecting cancellation
5. Reading the final rendered response
6. Estimating output tokens
7. Resolving the EcoLogits provider/model
8. Reporting the completed generation back to `content.ts`

The adapters currently use DOM signals exposed by the consumer AI websites, so selectors may need maintenance when those websites change their interfaces.

### `background.ts`

The background/service-worker layer owns persistent extension state.

It:

- Reads and writes Chrome local storage
- Handles daily/monthly rollover
- Stores per-site statistics
- Stores lifetime statistics
- Receives `AI_RESPONSE_COMPLETE`
- Calls `getWaterConsumptionFootprint()`
- Adds the returned WCF value to usage totals
- Handles tracking settings
- Changes the extension icon when tracking is disabled
- Handles donation start/completion state

### `ecologits.ts`

This module is the EcoLogits integration layer.

The request is sent to:

```text
POST https://api.ecologits.ai/v1beta/estimations
```

with a payload shaped like:

```json
{
  "provider": "openai",
  "model_name": "chat-latest",
  "output_token_count": 250,
  "request_latency": 8.7,
  "electricity_mix_zone": "WOR"
}
```

Bottle It Back currently uses:

```text
electricity_mix_zone = WOR
```

which represents the world-average electricity mix.

The WCF result is normalized into:

```ts
{
  minMl: number;
  maxMl: number;
  averageMl: number;
}
```

EcoLogits may return either a range or a scalar depending on the model/impact data. When a scalar is returned, the same value can be used for `minMl`, `maxMl`, and `averageMl`.

---

# Output token estimation

EcoLogits' text-generation methodology requires the number of **generated/output tokens**.

Consumer AI websites do not consistently expose the same authoritative API usage object that developers receive from provider APIs. Bottle It Back therefore estimates the output-token count from the final rendered response.

The current estimator is:

```ts
function estimateOutputTokens(text: string): number {
  return Math.max(1, Math.ceil(Array.from(text).length / 4));
}
```

In plain English:

```text
estimated output tokens ≈ number of Unicode characters ÷ 4
```

For example:

```text
Rendered response length: 1,000 characters

1,000 ÷ 4 = 250

Estimated output tokens = 250
```

`Array.from(text).length` is used instead of only `text.length` so that Unicode code points such as emoji are handled more sensibly than raw UTF-16 code-unit counting.

## Why this is an estimate

Real LLM tokenizers do not simply use four characters per token.

Actual tokenization depends on things such as:

- Language
- Whitespace
- Punctuation
- Code
- URLs
- Emoji
- Repeated text
- The tokenizer/encoding used by the actual model

Bottle It Back previously considered/used local BPE tokenization for ChatGPT, but a full OpenAI-compatible tokenizer can add a large amount of vocabulary/encoding data to a browser content-script bundle.

Because Bottle It Back is already estimating the environmental footprint of consumer AI sessions—and exact provider usage metadata is usually unavailable on these websites—the current implementation favors the lightweight and consistent `characters / 4` method across provider adapters.

For that reason completed events are labeled:

```ts
tokenSource: "estimated"
```

The estimate should **not** be presented as an authoritative provider token count.

If a provider later exposes trustworthy output-token usage metadata to the browser, that value should be preferred over the heuristic.

---

# Request latency

Bottle It Back records the observed generation duration in seconds.

Conceptually:

```text
requestLatency =
  generation completion timestamp
  -
  generation start timestamp
```

The provider adapter begins timing when Bottle It Back recognizes the prompt submission/generation start.

Completion is only accepted after the adapter has observed evidence that:

- a response belonging to the current prompt appeared,
- the AI was actively generating, and
- the site's running/streaming signal ended.

A short stability/quiet period may be used to confirm that the response DOM has stopped changing, but the artificial confirmation buffer should not be added to the measured completion timestamp.

> The current `requestLatency` measurement is an observed browser-side generation/request duration. It is **not** an authoritative provider-side TTFT measurement.

EcoLogits can use request latency together with its own model metadata and deployment assumptions when estimating impacts.

---

# Provider model mapping

Consumer AI products do not always expose their exact underlying API model identifier.

Bottle It Back therefore maps detected product/model labels to EcoLogits model identifiers where possible.

Examples from the current implementation:

### ChatGPT

```text
EcoLogits provider: openai
EcoLogits model:    chat-latest
```

### Claude

```text
EcoLogits provider: anthropic
```

Known Claude model labels are mapped to their corresponding EcoLogits model names where supported.

If the selected Claude model is unknown or unsupported by the current EcoLogits catalog, Bottle It Back currently falls back to:

```text
claude-sonnet-4-6
```

This fallback is an approximation and should not be interpreted as proof that the consumer Claude session actually used Sonnet 4.6.

### Gemini

```text
EcoLogits provider: google_genai
```

Gemini's provider adapter maps supported consumer model labels to EcoLogits-compatible model identifiers.

### Mistral / Vibe

```text
EcoLogits provider: mistralai
EcoLogits model:    mistral-medium-2604
```

The consumer Vibe request does not reliably expose the actual underlying model to the content script, so Bottle It Back currently uses `mistral-medium-2604` as the EcoLogits comparison/model assumption.

---

# Water Consumption Footprint

Bottle It Back currently focuses its UI on EcoLogits' **Water Consumption Footprint (WCF)**.

EcoLogits estimates environmental impact using model and infrastructure information such as:

- Output token count
- Model architecture/parameter assumptions
- Generation/request latency
- Server/GPU assumptions
- Data-center PUE
- Data-center WUE
- Electricity mix
- Off-site electricity water intensity

A simplified mental model is:

```text
output tokens
     +
generation time
     +
model/server assumptions
     ↓
estimated IT energy
     ↓
data-center + electricity water factors
     ↓
Water Consumption Footprint
```

WCF is typically returned in liters by EcoLogits and converted by Bottle It Back to milliliters:

```text
milliliters = liters × 1000
```

When EcoLogits returns a range:

```ts
averageMl = (minMl + maxMl) / 2;
```

The average is what Bottle It Back currently adds to the user-facing running water total.

---

# Local statistics

Statistics are stored through:

```ts
chrome.storage.local
```

The tracker maintains values including:

```text
todayMl
monthlyMl
totalWaterMl

totalVisits
totalPrompts
totalActiveSeconds

totalDonatedUsd
totalDonatedBottles
totalDonationsCount
lastDonationAt

installedAt
onboardedAt
updatedAt

sites
```

Each site can also maintain its own:

```text
visits
prompts
activeSeconds
waterMl
lastSeenAt
```

## Daily and monthly rollover

Bottle It Back generates daily/monthly keys using the browser's current time zone.

When the local date changes:

```text
todayMl → 0
```

When the local month changes:

```text
monthlyMl → 0
```

Lifetime water is not reset by normal date rollover.

---

# Donation flow

Bottle It Back integrates with the Donorbox campaign:

```text
https://donorbox.org/bottle-it-back
```

The flow is intentionally conservative:

```text
DONATION_STARTED
        ↓
store pending donation
        ↓
user visits / completes Donorbox flow
        ↓
confirmed success marker appears
        ↓
DONATION_COMPLETED
        ↓
background.ts records donation
        ↓
todayMl = 0
monthlyMl = 0
```

## Important reset rules

Opening Donorbox does **not** reset usage.

Starting a donation does **not** reset usage.

Cancelling/abandoning a donation does **not** reset usage.

Only a **confirmed successful donation** can trigger the reset.

After a confirmed donation:

```text
todayMl   → 0
monthlyMl → 0
```

but:

```text
totalWaterMl
```

is never reset.

Lifetime water remains the historical total generated by the user.

Donation history is also updated only after confirmed completion.

---

# Development

## Requirements

Install:

- Node.js
- Yarn
- Google Chrome, Chromium, Brave, Edge, or another Chromium-based browser

Check your versions:

```bash
node --version
yarn --version
```

## Install dependencies

From the project root:

```bash
yarn install
```

## Run in development mode

Start the Vite development environment:

```bash
yarn dev
```

Then open Chrome:

```text
chrome://extensions
```

Enable:

```text
Developer mode
```

Choose:

```text
Load unpacked
```

and select the development extension output directory generated by the project's Vite/Chrome-extension setup.

In the current setup, development scripts should expose Vite HMR to the extension, so the browser console may show messages such as:

```text
[vite] connecting...
[vite] connected.
```

When changing manifest-level settings or content-script match patterns, Chrome may still require the extension to be reloaded from `chrome://extensions`.

### Recommended debugging workflow

Open both:

1. The AI website's DevTools console
2. The extension service worker DevTools

Useful Bottle It Back logs are prefixed with:

```text
[🍾💧 Bottle It Back]
```

For example:

```text
[🍾💧 Bottle It Back] ChatGPT generation started
[🍾💧 Bottle It Back] ChatGPT response detected
[🍾💧 Bottle It Back] ChatGPT completion observed
[🍾💧 Bottle It Back] ChatGPT generation completed
[🍾💧 Bottle It Back] AI response WCF
[🍾💧 Bottle It Back] EcoLogits water added to stats
```

---

# Production build

Create a production build with:

```bash
yarn build
```

The production extension is output to:

```text
dist/
```

Inspect the built size with:

```bash
du -ah dist | sort -h | tail -30
```

This is useful for finding unexpectedly large assets or JavaScript bundles.

For example, tokenizer libraries can become large because they bundle BPE vocabulary/encoding data. Bottle It Back's current lightweight output-token heuristic avoids requiring a multi-megabyte tokenizer inside the content script.

You can also inspect the total build size with:

```bash
du -sh dist
```

---

# Loading the production build locally

After:

```bash
yarn build
```

open:

```text
chrome://extensions
```

then:

1. Enable **Developer mode**
2. Click **Load unpacked**
3. Select the project's `dist/` directory
4. Open one of the supported AI sites
5. Submit a small test prompt
6. Inspect the site console and extension service-worker console

A successful response should eventually produce a flow similar to:

```text
PROMPT_SUBMIT
→ AI_RESPONSE_COMPLETE
→ EcoLogits request
→ AI response WCF
→ EcoLogits water added to stats
```

---

# Testing a provider

When adding or modifying a provider adapter, test all of these cases.

### Successful response

```text
Submit prompt
→ running signal detected
→ response detected
→ completion detected
→ AI_RESPONSE_COMPLETE sent
→ WCF added
```

### User cancellation

```text
Submit prompt
→ response starts
→ press Stop
→ pending generation discarded
→ no AI_RESPONSE_COMPLETE
→ no water added
```

### Timeout / failed response

```text
Submit prompt
→ completion never becomes valid
→ timeout
→ pending generation discarded
→ no water added
```

### Existing conversation

Make sure an older response already present in the DOM is not accidentally counted as the response to a newly submitted prompt.

Provider adapters therefore store the response element/text that existed at generation start and compare it against later DOM state.

---

# Adding another AI provider

Provider integrations live in:

```text
src/utils/providers/
```

A provider adapter implements:

```ts
interface ProviderAdapter {
  startGeneration(): void;
  destroy(): void;
}
```

A new adapter should:

1. Identify a stable response selector
2. Identify a reliable running/stop/streaming signal
3. Record the response present before generation starts
4. Detect new response activity
5. Reject cancelled generations
6. Reject timed-out generations
7. Wait for successful completion
8. Estimate or read output tokens
9. Map the provider/model to an EcoLogits-supported identifier
10. Call `context.onComplete(...)`

Example completion payload:

```ts
context.onComplete({
  provider: "anthropic",
  modelName: "claude-sonnet-4-6",
  outputTokenCount,
  requestLatency,
  tokenSource: "estimated",
});
```

The provider must then be registered in the provider factory and site configuration.

---

# Message flow

Common tracker messages include:

```text
PAGE_VISIT
PROMPT_SUBMIT
ACTIVE_PING
AI_RESPONSE_COMPLETE

GET_STATS
GET_SETTINGS
UPDATE_SETTINGS
RESET_STATS

DONATION_STARTED
DONATION_COMPLETED

MARK_ONBOARDED
```

The important distinction is:

```text
PROMPT_SUBMIT
```

means a prompt was submitted.

It does **not** mean water has been consumed/recorded yet.

Water is added only after:

```text
AI_RESPONSE_COMPLETE
```

and a valid EcoLogits WCF result.

---

# Tracking toggle

Users can disable tracking.

When tracking is disabled:

- Usage events are not applied to statistics
- The extension action icon switches to its disabled version
- Existing historical statistics remain in local storage

Tracking can later be re-enabled without losing previous history.

---

# Privacy and data handling

Bottle It Back reads the rendered AI response locally because it needs its character count to estimate output tokens.

The EcoLogits request itself only needs metadata such as:

```text
provider
model_name
output_token_count
request_latency
electricity_mix_zone
```

Prompt text and response text are not required in the EcoLogits estimation payload.

Provider adapters may log rendered response text to the browser console while debugging. Production builds should avoid unnecessary full-response logging if that data is not needed for diagnostics.

The extension currently stores usage statistics locally with:

```ts
chrome.storage.local
```

---

# Current methodology limitations

Bottle It Back should be described as an estimator for **text-generation inference**, not every possible AI workload.

The current methodology does not attempt to assign the same text-token calculation to:

- Image generation
- Video generation
- Audio generation
- Multimodal processing
- Embeddings

Those workloads have different compute patterns and should use separate methodologies when reliable data is available.

## Proprietary AI models

Consumer products may not reveal:

- Exact model architecture
- Exact model version
- Exact active parameter count
- Exact hardware
- Exact data-center location
- Exact batching/load
- Exact token usage

EcoLogits may therefore return ranges or rely on model assumptions.

Bottle It Back should communicate environmental values as **estimates**, not exact physical measurements.

---

# Why min/max values can exist

EcoLogits can represent uncertainty as a range:

```json
{
  "min": 0.0001,
  "max": 0.0002
}
```

Bottle It Back converts those values to milliliters and calculates:

```ts
averageMl = (minMl + maxMl) / 2;
```

Some models may instead return a scalar value:

```json
{
  "value": 0.00015
}
```

In that case Bottle It Back can normalize it as:

```ts
{
  minMl: 0.15,
  maxMl: 0.15,
  averageMl: 0.15
}
```

---

# Important implementation principle

The most important tracking rule in Bottle It Back is:

> **A submitted prompt is not automatically a completed AI request.**

The extension must wait until the provider adapter positively identifies a successful response completion.

This prevents:

- Cancelled responses
- Partial responses
- Failed responses
- Timeouts
- Old conversation DOM
- Duplicate events

from incorrectly increasing the user's environmental footprint.

---

# Build-size notes

The source size of files such as `background.ts` or `donationWatch.ts` is not a reliable indicator of the final extension size because Vite minifies the production output.

To find actual build weight, inspect `dist/`:

```bash
du -ah dist | sort -h | tail -30
```

Common sources of extension bundle size include:

- Tokenizer vocabularies
- React/runtime code
- Fonts
- Images
- Duplicate content-script dependencies
- Source maps
- Large third-party packages

For Chromium-only distribution, WOFF2 fonts are generally enough; retaining duplicate `.woff` copies can unnecessarily increase the packaged extension size.

---

# EcoLogits disclaimer

EcoLogits estimates environmental impacts from available model metadata and infrastructure assumptions.

Bottle It Back does not claim that:

```text
X mL displayed = X mL physically measured at the exact server
```

A better interpretation is:

> Based on the detected/assumed model, generated output, observed duration, and EcoLogits methodology, this request has an estimated Water Consumption Footprint of approximately X mL.

---

# Status

Bottle It Back is under active development.

Consumer AI websites can change their DOM, accessibility labels, model selectors, streaming behavior, and internal product names without notice. Provider adapters should therefore be treated as integrations that need regression testing whenever one of the supported websites changes.

---