/**
 * EchoCompass and EchoMap.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  PLACEHOLDER SHAPES. THE CLIENT'S BUILD SPEC IS AUTHORITATIVE.
 *
 *  From the build brief: "The EchoCompass and EchoMap schemas in them are
 *  authoritative — put them in one module, lib/echo/schema.ts, as typed schemas
 *  used both for validation and as the Claude structured-output format, so that
 *  changing the spec means editing one file."
 *
 *  This is that one file. Everything downstream — the distiller, the closing
 *  ritual, the xTiles adapter, the tests — reads these definitions and nothing
 *  else. When Todd's spec arrives, edit below and the rest follows.
 *
 *  The field names here are a reasonable guess at the shape, chosen so the
 *  pipeline can be built and tested end to end. Do not treat them as final.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** A JSON Schema fragment, as Claude's output_config.format expects. */
export interface JsonSchema {
  // The SDK types the schema as an open record, so this must admit unknown keys.
  readonly [key: string]: unknown;
  readonly type: string;
  readonly properties?: Record<string, unknown>;
  readonly items?: unknown;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly maxItems?: number;
}

// ---------------------------------------------------------------------------
// EchoCompass — where a person is oriented right now.
// ---------------------------------------------------------------------------

export const COMPASS_FACETS = ["value", "tension", "direction", "question"] as const;
export type CompassFacet = (typeof COMPASS_FACETS)[number];

export interface CompassEntry {
  readonly facet: CompassFacet;
  /** A short phrase in the person's own register, not a clinical summary. */
  readonly label: string;
  /** One or two sentences of context. */
  readonly note: string;
}

// ---------------------------------------------------------------------------
// EchoMap — what recurs across a person's thinking.
// ---------------------------------------------------------------------------

export const MAP_KINDS = ["pattern", "theme", "relationship", "turning-point"] as const;
export type MapKind = (typeof MAP_KINDS)[number];

export interface MapEntry {
  readonly kind: MapKind;
  readonly label: string;
  readonly note: string;
}

export interface Distillation {
  readonly compass: CompassEntry[];
  readonly map: MapEntry[];
}

// ---------------------------------------------------------------------------
// The same shapes, as the structured-output format Claude is given.
// ---------------------------------------------------------------------------

const entrySchema = (kinds: readonly string[], kindField: string, kindNote: string): JsonSchema => ({
  type: "object",
  properties: {
    [kindField]: { type: "string", enum: kinds, description: kindNote },
    label: { type: "string", description: "A short phrase in the person's own words." },
    note: { type: "string", description: "One or two sentences of context." },
  },
  required: [kindField, "label", "note"],
  additionalProperties: false,
});

export const DISTILLATION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    compass: {
      type: "array",
      maxItems: 8,
      items: entrySchema(COMPASS_FACETS, "facet", "Which compass facet this belongs to."),
      description: "Where this person is oriented right now.",
    },
    map: {
      type: "array",
      maxItems: 8,
      items: entrySchema(MAP_KINDS, "kind", "Which kind of map entry this is."),
      description: "What recurs in this person's thinking.",
    },
  },
  required: ["compass", "map"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Validation. The distiller returns JSON or it fails — never prose.
// ---------------------------------------------------------------------------

export class DistillationShapeError extends Error {
  override readonly name = "DistillationShapeError";
}

function validEntry<K extends string>(
  value: unknown,
  kindField: string,
  kinds: readonly K[],
): boolean {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry[kindField] === "string" &&
    (kinds as readonly string[]).includes(entry[kindField] as string) &&
    typeof entry.label === "string" &&
    entry.label.trim().length > 0 &&
    typeof entry.note === "string"
  );
}

/**
 * Validate a parsed distillation. Errors describe the SHAPE that was wrong and
 * never quote the value, because the value is distilled from a conversation.
 */
export function parseDistillation(value: unknown): Distillation {
  if (typeof value !== "object" || value === null) {
    throw new DistillationShapeError("Distillation is not an object.");
  }
  const candidate = value as { compass?: unknown; map?: unknown };

  if (!Array.isArray(candidate.compass)) {
    throw new DistillationShapeError("Distillation has no compass array.");
  }
  if (!Array.isArray(candidate.map)) {
    throw new DistillationShapeError("Distillation has no map array.");
  }

  const badCompass = candidate.compass.findIndex((e) => !validEntry(e, "facet", COMPASS_FACETS));
  if (badCompass !== -1) {
    throw new DistillationShapeError(`Compass entry ${badCompass} has the wrong shape.`);
  }

  const badMap = candidate.map.findIndex((e) => !validEntry(e, "kind", MAP_KINDS));
  if (badMap !== -1) {
    throw new DistillationShapeError(`Map entry ${badMap} has the wrong shape.`);
  }

  return {
    compass: candidate.compass as CompassEntry[],
    map: candidate.map as MapEntry[],
  };
}

/** Stable ids for the closing ritual's keep/discard choices. */
export function entryId(kind: "compass" | "map", index: number): string {
  return `${kind}-${index}`;
}

/** Narrow a distillation to the entries the person chose to keep. */
export function keepOnly(distillation: Distillation, keptIds: readonly string[]): Distillation {
  const kept = new Set(keptIds);
  return {
    compass: distillation.compass.filter((_, i) => kept.has(entryId("compass", i))),
    map: distillation.map.filter((_, i) => kept.has(entryId("map", i))),
  };
}

export function countEntries(distillation: Distillation): number {
  return distillation.compass.length + distillation.map.length;
}
