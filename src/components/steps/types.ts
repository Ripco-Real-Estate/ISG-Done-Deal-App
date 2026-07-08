import type { FormData, Profile } from '@/lib/donedeal/types';
import type { LeadOption } from '@/lib/donedeal/read';

export interface StepProps {
  form: FormData;
  /** Mutate a structural clone of the form; App handles setState + autosave. */
  update: (mutator: (draft: FormData) => void) => void;
  itemId: string;
  profiles: Profile[];
  /** Linked ISG Leads Tracker leads ([] = no funnel data; picker hidden). */
  leads: LeadOption[];
  /** File upload in progress — App uses this to suppress the loading screen. */
  onUploadingChange?: (uploading: boolean) => void;
}
