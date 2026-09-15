export const MEDIA_BUCKET = "athlete-media";
export const VIDEO_BUCKET = "athlete-videos";
export type MediaKind = "front" | "back" | "video";
export type AthleteMedia = {
  athlete_id: string;
  original_front: string | null; original_back: string | null;
  video_path: string | null; video_shared: boolean;
  candidate_front: string | null; candidate_back: string | null;
  approved_front: string | null; approved_back: string | null;
  state: "draft" | "processing" | "review" | "approved" | "failed";
  job_id: string | null; error: string | null; updated_at: string;
};
export type AthleteMediaView = {
  configured: boolean; aiEnabled: boolean; state: AthleteMedia["state"];
  originalFront: string | null; originalBack: string | null; video: string | null;
  candidateFront: string | null; candidateBack: string | null;
  approved: boolean; jobId: string | null; error: string | null;
};
