//! Synchronous file boundary; browser frontends can mount an in-memory backend.
use std::{io, path::Path};

pub struct FileEntry {
    pub name: String,
    pub is_directory: bool,
}

pub trait HostFileSystem: Send + Sync {
    fn read(&self, path: &Path) -> io::Result<Vec<u8>>;
    fn write(&self, path: &Path, bytes: &[u8]) -> io::Result<()>;
    /// Enumerate one directory, confined to the application's root.
    fn list(&self, root: &Path, directory: &Path) -> io::Result<Vec<FileEntry>>;
}

#[derive(Default)]
pub struct DiskFileSystem;
impl HostFileSystem for DiskFileSystem {
    fn read(&self, path: &Path) -> io::Result<Vec<u8>> {
        std::fs::read(path)
    }
    fn write(&self, path: &Path, bytes: &[u8]) -> io::Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, bytes)
    }
    fn list(&self, root: &Path, directory: &Path) -> io::Result<Vec<FileEntry>> {
        let root = root.canonicalize()?;
        let directory = directory.canonicalize()?;
        if !directory.starts_with(root) {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "Directory escapes application root",
            ));
        }
        std::fs::read_dir(directory)?
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| {
                let kind = entry.file_type().ok()?;
                (kind.is_file() || kind.is_dir()).then(|| {
                    Ok(FileEntry {
                        name: entry.file_name().to_string_lossy().into_owned(),
                        is_directory: kind.is_dir(),
                    })
                })
            })
            .collect()
    }
}
