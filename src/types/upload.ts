export interface UploadFile {
  id: string;
  file?: File;
  onformId?: string;
  url?: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  source: "file" | "onform";
  name: string;
}
