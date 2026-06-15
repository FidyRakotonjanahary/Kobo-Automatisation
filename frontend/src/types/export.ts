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

export interface ExportRequest {
  account_forms: AccountFormPair[];
  form_name: string;
  pivot_column?: string;
  selected_columns?: string[];
  selected_sheets?: string[];
  filter_sites?: string[];
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
}

export interface ExportResult {
  status: string;
  message: string;
  files: ExportFileResult[];
  directory?: string;
  drive_success?: number;
}

export interface PreviewResult {
  preview: string;
}

export interface PreviewSitesResult {
  sites?: string[];
  sheets?: string[];
  columns?: unknown[];
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

