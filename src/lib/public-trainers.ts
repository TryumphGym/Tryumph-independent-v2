import type { TrainerAchievementId } from "./trainer-achievements";

export type PublicTrainer = {
  focus_tags?: string[];
  services?: string[];
  id: string;
  name: string;
  bio: string;
  specialties: string[];
  website: string | null;
  instagram: string | null;
  rate: number;
  qualifications: string[];
  avatarUrl: string | null;
  achievements?: TrainerAchievementId[];
};
