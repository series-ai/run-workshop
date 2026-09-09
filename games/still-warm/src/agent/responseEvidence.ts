import { z } from "zod";

const responseTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (text) => !/[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text),
    "Use one plain text line.",
  )
  .refine(
    (text) => !/[<>`*_#\[\]{}]/.test(text),
    "Do not use markup.",
  )
  .refine((text) => !/["“”]/.test(text), "Do not quote speech.");

export const interpretationSchema = z.strictObject({
  evidenceId: z.number().int().positive(),
  text: responseTextSchema,
});

export type InterpretationInput = z.infer<typeof interpretationSchema>;

type InterpretationDecision =
  | { ok: true; text: string }
  | { ok: false; message: string };

export class ResponseEvidence {
  private nextEvidenceId = 0;
  private latestEvidenceId: number | null = null;
  private inputActive = false;
  private interpretations = 0;

  beginInput(): void {
    this.inputActive = true;
    this.latestEvidenceId = null;
    this.interpretations = 0;
  }

  issue(): number {
    if (!this.inputActive) throw new Error("No active input.");
    const evidenceId = ++this.nextEvidenceId;
    this.latestEvidenceId = evidenceId;
    return evidenceId;
  }

  accept(input: InterpretationInput): InterpretationDecision {
    if (
      !this.inputActive ||
      this.latestEvidenceId === null ||
      input.evidenceId !== this.latestEvidenceId
    ) {
      return {
        ok: false,
        message:
          "Use the evidenceId from the latest inspect_room or act outcome in this input.",
      };
    }
    if (this.interpretations >= 3) {
      return {
        ok: false,
        message: "Only three brief interpretations are allowed for each input.",
      };
    }
    this.interpretations += 1;
    this.latestEvidenceId = null;
    return { ok: true, text: input.text };
  }
}
