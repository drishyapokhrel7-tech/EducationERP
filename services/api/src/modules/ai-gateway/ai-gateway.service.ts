import { Injectable, ServiceUnavailableException } from "@nestjs/common";

export interface DetectedFace {
  bbox: number[];
  detScore: number;
  embedding: number[];
}

export interface FaceEmbedResult {
  faces: DetectedFace[];
  modelName: string;
}

/**
 * Thin client for services/ai's face-detection/embedding endpoint
 * (slice 6b) — the first thing in this project to actually call it.
 * Deliberately dumb: no retry/circuit-breaker logic, no caching. This
 * service returns whatever services/ai returns; deciding what counts
 * as "a good photo" (face count, confidence) is the caller's job
 * (biometric-policy's enrollment-photo endpoint, camera-events'
 * ingestion endpoint), not this gateway's.
 */
@Injectable()
export class AiGatewayService {
  async embedFaces(buffer: Buffer, filename: string, mimetype: string): Promise<FaceEmbedResult> {
    const baseUrl = process.env.AI_SERVICE_URL ?? "http://localhost:8001";
    const apiKey = process.env.AI_SERVICE_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException("AI_SERVICE_API_KEY is not configured");
    }

    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(buffer)], { type: mimetype }), filename);

    const res = await fetch(`${baseUrl}/v1/face/embed`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(`AI service request failed with status ${res.status}`);
    }
    return (await res.json()) as FaceEmbedResult;
  }
}
