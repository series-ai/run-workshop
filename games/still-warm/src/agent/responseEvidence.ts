import { z } from "zod";

export function sanitizeNarrativeVoice(text: string): string {
  return text
    .replace(/\bthe creature's\b/gi, "my boy's")
    .replace(/\bthe assistant's\b/gi, "my boy's")
    .replace(/\bthe monster's\b/gi, "my boy's")
    .replace(/\bthe beast's\b/gi, "my boy's")
    .replace(/\bThe creature\b/g, "My boy")
    .replace(/\bThe assistant\b/g, "My boy")
    .replace(/\bThe monster\b/g, "My boy")
    .replace(/\bThe beast\b/g, "My boy")
    .replace(/\bthe creature\b/g, "my boy")
    .replace(/\bthe assistant\b/g, "my boy")
    .replace(/\bthe monster\b/g, "my boy")
    .replace(/\bthe beast\b/g, "my boy")
    .replace(/\bsoothing its\b/gi, "soothing his")
    .replace(/\bcalming its\b/gi, "calming his")
    .replace(/\bupon itself\b/gi, "upon himself")
    .replace(/\b(The|the) cabinet (still )?pins him fast\b/g, (_m, t, s) => `${t} cabinet ${s ?? ""}pins me fast`)
    .replace(/\b(The|the) cabinet (still )?pins him\b/g, (_m, t, s) => `${t} cabinet ${s ?? ""}pins me`)
    .replace(/\b(The|the) crushing cabinet holds him flat\b/g, (_m, t) => `${t} crushing cabinet holds me flat`)
    .replace(/\b(Pins|pins) him fast\b/g, (_m, p) => `${p === "Pins" ? "Pins" : "pins"} me fast`)
    .replace(/\b(Pins|pins) him\b/g, (_m, p) => `${p === "Pins" ? "Pins" : "pins"} me`)
    .replace(/\b(Holds|holds) him flat\b/g, (_m, h) => `${h === "Holds" ? "Holds" : "holds"} me flat`)
    .replace(/\b(Holds|holds) him fast\b/g, (_m, h) => `${h === "Holds" ? "Holds" : "holds"} me fast`)
    .replace(/\boff his back\b/gi, "off my back")
    .replace(/\bonto his back\b/gi, "onto my back")
    .replace(/\bon his back\b/gi, "on my back")
    .replace(/\b(He|he) is still face down\b/g, "I am still face down")
    .replace(/\bkeeps him still\b/gi, "keeps me still")
    .replace(/\bkeep him still\b/gi, "keep me still")
    .replace(/\bheld him still\b/gi, "held me still")
    .replace(/\b(The|the) patient's\b/g, (_m, t) => (t === "The" ? "My" : "my"))
    .replace(/\b(comfort|against|beside|over|soothe|soothing|injures|reach|save|calm|calming)\s+the patient\b/gi, "$1 me")
    .replace(/\b(The|the) patient (is|cannot|can't|can|wants|needs|strains)\b/g, (_m, _t, v) => {
      const verb = v === "is" ? "am" : v === "wants" ? "want" : v === "needs" ? "need" : v === "strains" ? "strain" : v;
      return `I ${verb}`;
    })
    .replace(/\b(He|he) (cannot|can't) (stand|rise|move|turn|walk|get up)\b/g, "I $2 $3")
    .replace(/\b(He|he) is (pinned|trapped|held flat|face down)\b/g, "I am $2")
    .replace(/\b(He|he) is already on his back\b/g, "I am already on my back")
    .replace(/\b(He|he) is on his back\b/g, "I am on my back")
    .replace(/\b(traps|trapped|crushes|crushing)\s+him\b/gi, (_m, v) => `${v.toLowerCase()} me`)
    .replace(/\bacross his spine\b/gi, "across my spine")
    .replace(/\bin his spine\b/gi, "in my spine")
    .replace(/\bthrough his spine\b/gi, "through my spine")
    .replace(/\b(his|His) spine\b/g, (_m, h) => (h === "His" ? "My spine" : "my spine"))
    .replace(/\b(his|His) broken ribs\b/g, (_m, h) => (h === "His" ? "My broken ribs" : "my broken ribs"))
    .replace(/\b(his|His) (torn|wounded|exposed) flank\b/g, (_m, h, w) => `${h === "His" ? "My" : "my"} ${w} flank`);
}

const responseTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(400)
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
  private issuedIds = new Set<number>();
  private usedIds = new Set<number>();
  private inputActive = false;
  private interpretations = 0;

  beginInput(): void {
    this.inputActive = true;
    this.issuedIds.clear();
    this.usedIds.clear();
    this.interpretations = 0;
  }

  issue(): number {
    if (!this.inputActive) throw new Error("No active input.");
    const evidenceId = ++this.nextEvidenceId;
    this.issuedIds.add(evidenceId);
    return evidenceId;
  }

  accept(input: InterpretationInput): InterpretationDecision {
    if (!this.inputActive) {
      return {
        ok: false,
        message: "Interpretation arrived without an active player input.",
      };
    }
    if (!this.issuedIds.has(input.evidenceId)) {
      return {
        ok: false,
        message: `Evidence id ${input.evidenceId} is invalid or expired.`,
      };
    }
    if (this.usedIds.has(input.evidenceId)) {
      return {
        ok: false,
        message: `Evidence id ${input.evidenceId} has already been used.`,
      };
    }
    if (this.interpretations >= 3) {
      return {
        ok: false,
        message: "Limit three brief interpretations per player input.",
      };
    }

    this.usedIds.add(input.evidenceId);
    this.interpretations += 1;
    return { ok: true, text: sanitizeNarrativeVoice(input.text) };
  }
}
