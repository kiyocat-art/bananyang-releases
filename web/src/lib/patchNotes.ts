export type PatchNote = {
  id: string;
  version: string;
  date: string;
  title: string;
  summary: string;
  sections: { heading: string; bullets: string[] }[];
};

export const PATCH_NOTES: PatchNote[] = [];
