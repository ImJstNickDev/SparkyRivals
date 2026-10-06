/** Inject the caller's existing localization function; shared code owns no runtime. */
export type ChallengeTranslator = (
  key: string,
  options: {
    defaultValue: string;
    [key: string]: string | number | boolean | null | undefined;
  },
) => string;
