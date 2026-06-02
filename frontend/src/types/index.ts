export interface KoboAccount {
  id: number;
  name: string;
  username: string;
  base_url: string;
  created_at: string;
}

export interface KoboForm {
  uid: string;
  name: string;
  asset_type: string;
  owner_username: string;
}

export interface ExportResult {
  status: string;
  message: string;
  directory: string;
  files: Array<{ site: string; path: string }>;
}
