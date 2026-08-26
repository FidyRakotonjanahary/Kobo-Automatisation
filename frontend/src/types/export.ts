import type { KoboForm } from './index';

export type ExportFormat = 'xlsx' | 'csv';
export type CsvSeparator = ';' | ',';
export type CsvEncoding = 'utf-8-sig' | 'utf-8' | 'windows-1252';

export interface SheetStructure {
  name: string;
  columns: string[];
}

export interface FormStructure {
  sheets: SheetStructure[];
}

export type AccountFormsMap = Record<number, KoboForm[]>;

export interface AccountFormPair {
  account_id: number;
  form_uid: string;
}

export interface SubmissionItem {
  id: string;
  submission_time?: string;
  site?: string;
  label?: string;
}

export interface ExportRequest {
  account_forms: AccountFormPair[];
  form_name: string;
  pivot_column?: string;
  selected_columns?: string[];
  selected_sheets?: string[];
  filter_sites?: string[];
  filter_submission_ids?: string[];
  drive_folder_id?: string;
  export_format: ExportFormat;
  csv_separator: CsvSeparator;
  csv_encoding: CsvEncoding;
  csv_quotechar: string;
  task_id?: string;
}

export interface PreviewRequest {
  account_forms: AccountFormPair[];
  form_name: string;
  csv_separator: CsvSeparator;
  csv_encoding: CsvEncoding;
  csv_quotechar: string;
  selected_sheets: string[];
}

export interface ExportFileResult {
  site: string;
  path: string;
  folder_path: string;
  rows: number;
  drive_link?: string;
  server_file_exists?: boolean;
}

export interface ExportResult {
  status: string;
  message: string;
  files: ExportFileResult[];
  directory?: string;
  drive_success?: number;
  drive_errors?: string[];
}

export interface SessionExportItem {
  id: string | number;
  timestamp: string;
  formName: string;
  format: ExportFormat;
  status: 'success' | 'cancelled' | 'error';
  message: string;
  files: ExportFileResult[];
  directory?: string;
  driveSuccess?: number;
  driveErrors?: string[];
  errorMessage?: string;
  createdAt?: string;
}

export interface PreviewResult {
  preview: string;
}

export interface PreviewSitesResult {
  sites?: string[];
  sheets?: string[];
  columns?: unknown[];
  submissions?: SubmissionItem[];
}

export interface CsvPrefs {
  format?: ExportFormat;
  sep?: CsvSeparator;
  enc?: CsvEncoding;
  quote?: string;
}

export interface GoogleStatus {
  connected: boolean;
}

