const ECOLOGITS_API_URL = "https://api.ecologits.ai/v1beta/estimations";

type EcoLogitsRangeValue = {
  min: number;
  max: number;
};

type EcoLogitsWcfValue =
  | number
  | EcoLogitsRangeValue;

interface EcoLogitsResponse {
  impacts?: {
    wcf?: {
      type?: string;
      name?: string;
      value?: EcoLogitsWcfValue;
      unit?: string;
    };
    warnings?: unknown[];
    errors?: unknown[];
  };
}

interface EcoLogitsRequest {
  provider: string;
  model_name: string;
  output_token_count: number;
  request_latency: number;
}

export interface WaterConsumptionFootprint {
  minMl: number;
  maxMl: number;
  averageMl: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRangeValue(value: unknown): value is EcoLogitsRangeValue {
  if (!value || typeof value !== "object") return false;

  const range = value as Partial<EcoLogitsRangeValue>;

  return (
    isFiniteNumber(range.min) &&
    isFiniteNumber(range.max)
  );
}

export async function getWaterConsumptionFootprint(
  input: EcoLogitsRequest,
): Promise<WaterConsumptionFootprint> {
  const response = await fetch(ECOLOGITS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      electricity_mix_zone: "WOR",
    }),
  });

  const data = (await response.json()) as EcoLogitsResponse;

  console.log("[🍾💧 Bottle It Back] EcoLogits raw response", {
    status: response.status,
    ok: response.ok,
    request: {
      provider: input.provider,
      model_name: input.model_name,
      output_token_count: input.output_token_count,
      request_latency: input.request_latency,
    },
    data,
  });

  if (!response.ok) {
    throw new Error(`EcoLogits request failed with HTTP ${response.status}`);
  }

  if (data.impacts?.errors?.length) {
    console.error(
      "[🍾💧 Bottle It Back] EcoLogits returned impact errors",
      data.impacts.errors,
    );
  }

  const value = data.impacts?.wcf?.value;

  if (isFiniteNumber(value)) {
    const ml = value * 1000;

    return {
      minMl: ml,
      maxMl: ml,
      averageMl: ml,
    };
  }

  if (isRangeValue(value)) {
    const minMl = value.min * 1000;
    const maxMl = value.max * 1000;

    return {
      minMl,
      maxMl,
      averageMl: (minMl + maxMl) / 2,
    };
  }

  console.error(
    "[🍾💧 Bottle It Back] Invalid EcoLogits WCF response",
    {
      wcf: data.impacts?.wcf,
      impacts: data.impacts,
    },
  );

  throw new Error(
    "EcoLogits response did not contain a valid WCF value",
  );
}