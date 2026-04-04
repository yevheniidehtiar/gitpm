export interface ValidationError {
  entityId: string;
  filePath: string;
  code: string;
  message: string;
}

export interface ValidationWarning {
  entityId: string;
  filePath: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
