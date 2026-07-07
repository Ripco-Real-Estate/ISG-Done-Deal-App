import type { FormData, Profile } from '@/lib/donedeal/types';

export interface StepProps {
  form: FormData;
  /** Mutate a structural clone of the form; App handles setState + autosave. */
  update: (mutator: (draft: FormData) => void) => void;
  itemId: string;
  profiles: Profile[];
  /** File upload in progress — App uses this to suppress the loading screen. */
  onUploadingChange?: (uploading: boolean) => void;
}
