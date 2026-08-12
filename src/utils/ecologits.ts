export type EcoLogitsRequest = {
  provider: string;
  model_name: string;
  output_token_count: number;
  request_latency: number;
};

export type WaterConsumptionFootprint = {
  minMl: number;
  maxMl: number;
  averageMl: number;
};

const ECOLOGITS_API_URL =
  "https://api.ecologits.ai/v1beta/estimations";

const ELECTRICITY_MIX_ZONE = "WOR";

export async function getWaterConsumptionFootprint(
  request: EcoLogitsRequest,
): Promise<WaterConsumptionFootprint> {
  const response = await fetch(
    ECOLOGITS_API_URL,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        provider: request.provider,
        model_name: request.model_name,
        output_token_count:
          request.output_token_count,
        request_latency:
          request.request_latency,

        electricity_mix_zone:
          ELECTRICITY_MIX_ZONE,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `EcoLogits request failed with status ${response.status}`,
    );
  }

  const data = await response.json();

  const minLiters =
    data?.impacts?.wcf?.value?.min;

  const maxLiters =
    data?.impacts?.wcf?.value?.max;

  if (
    typeof minLiters !== "number" ||
    typeof maxLiters !== "number"
  ) {
    throw new Error(
      "EcoLogits response did not contain a valid WCF value",
    );
  }

  const minMl =
    minLiters * 1000;

  const maxMl =
    maxLiters * 1000;

  const averageMl =
    (minMl + maxMl) / 2;

  return {
    minMl,
    maxMl,
    averageMl,
  };
}