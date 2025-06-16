use std::{collections::HashMap, fs, path::Path};

use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct FileEntry {
    pub path: String,
    pub filename: String,
}

pub fn traverse_and_find_txt_files(paths: Vec<String>) -> Result<HashMap<String, Vec<FileEntry>>, AppError> {
  let mut result = HashMap::new();
  
  for path_str in paths {
      let path = Path::new(&path_str);
      if path.is_dir() {
          traverse_directory_recursive(path, &mut result)?;
      } else if path.is_file() && path.extension().map_or(false, |ext| ext == "txt") {
          // If it's directly a .txt file
          if let Some(parent) = path.parent() {
              let files_in_dir = get_files_in_directory(parent)?;
              result.insert(path.to_string_lossy().to_string(), files_in_dir);
          }
      }
  }
  
  Ok(result)
}

fn traverse_directory_recursive(dir: &Path, result: &mut HashMap<String, Vec<FileEntry>>) -> Result<(), AppError> {
  if dir.is_dir() {
      let entries = fs::read_dir(dir).map_err(|e| AppError::IoError(e.to_string()))?;
      
      for entry in entries {
          let entry = entry.map_err(|e| AppError::IoError(e.to_string()))?;
          let path = entry.path();
          
          if path.is_dir() {
              traverse_directory_recursive(&path, result)?;
          } else if path.is_file() && path.extension().map_or(false, |ext| ext == "txt") {
              if let Some(parent) = path.parent() {
                  let files_in_dir = get_files_in_directory(parent)?;
                  result.insert(path.to_string_lossy().to_string(), files_in_dir);
              }
          }
      }
  }
  
  Ok(())
}

fn get_files_in_directory(dir: &Path) -> Result<Vec<FileEntry>, AppError> {
  let mut files = Vec::new();
  let entries = fs::read_dir(dir).map_err(|e| AppError::IoError(e.to_string()))?;
  
  for entry in entries {
      let entry = entry.map_err(|e| AppError::IoError(e.to_string()))?;
      let path = entry.path();
      
      if path.is_file() {
          let filename = path.file_name()
              .and_then(|name| name.to_str())
              .unwrap_or("")
              .to_string();
          
          files.push(FileEntry {
              path: path.to_string_lossy().to_string(),
              filename,
          });
      }
  }
  
  Ok(files)
}