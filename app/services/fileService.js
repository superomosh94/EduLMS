const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const sharp = require('sharp');
const archiver = require('archiver');
const { Generators, Validators, Helpers } = require('../utils');

class FileService {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'public', 'uploads');
    this.tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    this.allowedMimeTypes = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/rtf'
      ],
      video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'],
      audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac']
    };

    this.maxFileSizes = {
      image: 5 * 1024 * 1024, // 5MB
      document: 20 * 1024 * 1024, // 20MB
      video: 100 * 1024 * 1024, // 100MB
      audio: 10 * 1024 * 1024, // 10MB
      default: 10 * 1024 * 1024 // 10MB
    };

    this.initializeDirectories();
  }

  /**
   * Initialize required directories
   */
  initializeDirectories() {
    const directories = [
      this.uploadDir,
      this.tempDir,
      path.join(this.uploadDir, 'assignments'),
      path.join(this.uploadDir, 'submissions'),
      path.join(this.uploadDir, 'course-materials'),
      path.join(this.uploadDir, 'profiles'),
      path.join(this.uploadDir, 'documents'),
      path.join(this.uploadDir, 'reports')
    ];

    directories.forEach(dir => {
      if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Configure multer for file uploads
   */
  configureMulter(options = {}) {
    const {
      destination = 'documents',
      allowedTypes = ['document'],
      maxSize = null,
      fileNamePrefix = 'file'
    } = options;

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(this.uploadDir, destination);
        
        // Ensure directory exists
        if (!fsSync.existsSync(uploadPath)) {
          fsSync.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueName = Generators.generateFileName(file.originalname, fileNamePrefix);
        cb(null, uniqueName);
      }
    });

    const fileFilter = (req, file, cb) => {
      const allowedMimes = this.getAllowedMimeTypes(allowedTypes);
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
      }
    };

    const limits = {
      fileSize: maxSize || this.getMaxFileSize(allowedTypes[0])
    };

    return multer({
      storage,
      fileFilter,
      limits
    });
  }

  /**
   * Upload single file
   */
  async uploadFile(file, options = {}) {
    try {
      const {
        destination = 'documents',
        fileNamePrefix = 'file',
        resizeImage = false,
        maxWidth = 1200,
        maxHeight = 1200,
        quality = 80
      } = options;

      if (!file) {
        throw new Error('No file provided');
      }

      // Validate file type
      const fileType = this.getFileType(file.mimetype);
      if (!fileType) {
        throw new Error('Invalid file type');
      }

      // Validate file size
      const maxSize = this.getMaxFileSize(fileType);
      if (file.size > maxSize) {
        throw new Error(`File size exceeds maximum allowed size of ${Helpers.formatFileSize(maxSize)}`);
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = Generators.generateFileName(file.originalname, fileNamePrefix);
      const uploadPath = path.join(this.uploadDir, destination);
      const filePath = path.join(uploadPath, fileName);

      // Ensure directory exists
      await fs.mkdir(uploadPath, { recursive: true });

      let finalFilePath = filePath;

      // Process image if needed
      if (resizeImage && fileType === 'image') {
        finalFilePath = await this.processImage(file.buffer, filePath, {
          maxWidth,
          maxHeight,
          quality
        });
      } else {
        // Save original file
        await fs.writeFile(finalFilePath, file.buffer);
      }

      // Get file statistics
      const stats = await fs.stat(finalFilePath);

      const fileInfo = {
        originalName: file.originalname,
        fileName: fileName,
        filePath: path.relative(process.cwd(), finalFilePath),
        fileSize: stats.size,
        fileType: fileType,
        mimeType: file.mimetype,
        extension: fileExtension.toLowerCase(),
        uploadDate: new Date(),
        url: this.getFileUrl(finalFilePath)
      };

      // Log file upload
      await this.logFileUpload(fileInfo);

      return {
        success: true,
        file: fileInfo
      };

    } catch (error) {
      console.error('❌ File upload failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(files, options = {}) {
    const results = [];

    for (const file of files) {
      const result = await this.uploadFile(file, options);
      results.push(result);
    }

    return {
      success: true,
      results,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  }

  /**
   * Process and resize image
   */
  async processImage(buffer, outputPath, options = {}) {
    try {
      const {
        maxWidth = 1200,
        maxHeight = 1200,
        quality = 80
      } = options;

      await sharp(buffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality })
        .png({ quality })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath) {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

      if (!fsSync.existsSync(fullPath)) {
        throw new Error('File not found');
      }

      await fs.unlink(fullPath);

      // Log file deletion
      await this.logFileDeletion(filePath);

      return {
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      console.error('❌ File deletion failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath) {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

      if (!fsSync.existsSync(fullPath)) {
        throw new Error('File not found');
      }

      const stats = await fs.stat(fullPath);
      const fileExtension = path.extname(fullPath).toLowerCase();

      return {
        path: fullPath,
        name: path.basename(fullPath),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: fileExtension,
        mimeType: this.getMimeType(fileExtension),
        url: this.getFileUrl(fullPath)
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  /**
   * Create zip archive of multiple files
   */
  async createZipArchive(files, zipFileName, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const outputPath = path.join(this.tempDir, zipFileName);
        const output = fsSync.createWriteStream(outputPath);
        const archive = archiver('zip', {
          zlib: { level: 9 } // Maximum compression
        });

        output.on('close', () => {
          resolve({
            success: true,
            filePath: outputPath,
            size: archive.pointer(),
            url: this.getFileUrl(outputPath)
          });
        });

        archive.on('error', (err) => {
          reject(new Error(`Archive creation failed: ${err.message}`));
        });

        archive.pipe(output);

        // Add files to archive
        files.forEach(file => {
          if (fsSync.existsSync(file.path)) {
            archive.file(file.path, { name: file.name || path.basename(file.path) });
          }
        });

        archive.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Extract zip archive
   */
  async extractZipArchive(zipFilePath, extractTo) {
    return new Promise((resolve, reject) => {
      try {
        const extract = require('extract-zip');

        extract(zipFilePath, { dir: extractTo })
          .then(() => {
            resolve({
              success: true,
              extractedTo: extractTo,
              message: 'Archive extracted successfully'
            });
          })
          .catch(err => {
            reject(new Error(`Archive extraction failed: ${err.message}`));
          });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate file thumbnail
   */
  async generateThumbnail(filePath, options = {}) {
    try {
      const {
        width = 200,
        height = 200,
        outputFormat = 'jpeg'
      } = options;

      const fileInfo = await this.getFileInfo(filePath);

      if (!this.isImageFile(fileInfo.mimeType)) {
        throw new Error('Thumbnail generation only supported for image files');
      }

      const thumbnailName = `thumb_${path.basename(filePath, path.extname(filePath))}.${outputFormat}`;
      const thumbnailPath = path.join(path.dirname(filePath), 'thumbnails', thumbnailName);

      // Ensure thumbnail directory exists
      await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });

      await sharp(filePath)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .toFormat(outputFormat)
        .toFile(thumbnailPath);

      return {
        success: true,
        thumbnailPath,
        url: this.getFileUrl(thumbnailPath)
      };
    } catch (error) {
      console.error('❌ Thumbnail generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file, allowedTypes = ['document']) {
    const errors = [];

    // Check file type
    const fileType = this.getFileType(file.mimetype);
    if (!fileType || !allowedTypes.includes(fileType)) {
      errors.push(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
    }

    // Check file size
    const maxSize = this.getMaxFileSize(fileType);
    if (file.size > maxSize) {
      errors.push(`File size exceeds maximum allowed size of ${Helpers.formatFileSize(maxSize)}`);
    }

    // Check file extension
    const extension = path.extname(file.originalname).toLowerCase().substring(1);
    const allowedExtensions = this.getAllowedExtensions(allowedTypes);
    if (!allowedExtensions.includes(extension)) {
      errors.push(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(maxAgeHours = 24) {
    try {
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      let deletedCount = 0;

      const files = await fs.readdir(this.tempDir);
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      console.log(`🧹 Cleaned up ${deletedCount} temporary files`);
      return {
        success: true,
        deletedCount
      };
    } catch (error) {
      console.error('❌ Temp file cleanup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get file storage statistics
   */
  async getStorageStats() {
    try {
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        byType: {},
        byDirectory: {}
      };

      await this.calculateDirectoryStats(this.uploadDir, stats);

      return stats;
    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }

  /**
   * Calculate directory statistics recursively
   */
  async calculateDirectoryStats(dirPath, stats) {
    const items = await fs.readdir(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const itemStat = await fs.stat(itemPath);

      if (itemStat.isDirectory()) {
        await this.calculateDirectoryStats(itemPath, stats);
      } else {
        stats.totalFiles++;
        stats.totalSize += itemStat.size;

        // Group by file type
        const fileType = this.getFileTypeFromExtension(path.extname(item));
        stats.byType[fileType] = (stats.byType[fileType] || 0) + itemStat.size;

        // Group by directory
        const relativeDir = path.relative(this.uploadDir, path.dirname(itemPath));
        stats.byDirectory[relativeDir] = (stats.byDirectory[relativeDir] || 0) + itemStat.size;
      }
    }
  }

  // Helper Methods

  getAllowedMimeTypes(types) {
    return types.flatMap(type => this.allowedMimeTypes[type] || []);
  }

  getAllowedExtensions(types) {
    const mimeTypes = this.getAllowedMimeTypes(types);
    const extensions = [];

    mimeTypes.forEach(mimeType => {
      const extension = this.getExtensionFromMimeType(mimeType);
      if (extension) {
        extensions.push(extension);
      }
    });

    return [...new Set(extensions)];
  }

  getMaxFileSize(fileType) {
    return this.maxFileSizes[fileType] || this.maxFileSizes.default;
  }

  getFileType(mimeType) {
    for (const [type, mimes] of Object.entries(this.allowedMimeTypes)) {
      if (mimes.includes(mimeType)) {
        return type;
      }
    }
    return null;
  }

  getFileTypeFromExtension(extension) {
    const mimeType = this.getMimeType(extension);
    return this.getFileType(mimeType);
  }

  getMimeType(extension) {
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.rtf': 'application/rtf',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };

    return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
  }

  getExtensionFromMimeType(mimeType) {
    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'text/plain': '.txt',
      'application/rtf': '.rtf',
      'video/mp4': '.mp4',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav'
    };

    return extensionMap[mimeType] || null;
  }

  isImageFile(mimeType) {
    return this.allowedMimeTypes.image.includes(mimeType);
  }

  isDocumentFile(mimeType) {
    return this.allowedMimeTypes.document.includes(mimeType);
  }

  getFileUrl(filePath) {
    const relativePath = path.relative(path.join(process.cwd(), 'public'), filePath);
    return `/${relativePath.replace(/\\/g, '/')}`;
  }

  async logFileUpload(fileInfo) {
    try {
      const db = require('../../config/database');
      
      await db.query(
        `INSERT INTO file_uploads 
         (original_name, file_name, file_path, file_size, file_type, mime_type, uploaded_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          fileInfo.originalName,
          fileInfo.fileName,
          fileInfo.filePath,
          fileInfo.fileSize,
          fileInfo.fileType,
          fileInfo.mimeType,
          fileInfo.uploadDate
        ]
      );
    } catch (error) {
      console.error('❌ Error logging file upload:', error);
    }
  }

  async logFileDeletion(filePath) {
    try {
      const db = require('../../config/database');
      
      await db.query(
        'UPDATE file_uploads SET deleted_at = NOW() WHERE file_path = ?',
        [filePath]
      );
    } catch (error) {
      console.error('❌ Error logging file deletion:', error);
    }
  }

  /**
   * Generate secure download URL
   */
  generateDownloadUrl(filePath, expiresInMinutes = 60) {
    const crypto = require('crypto');
    const expires = Date.now() + (expiresInMinutes * 60 * 1000);
    const data = `${filePath}|${expires}`;
    const token = crypto.createHmac('sha256', process.env.FILE_DOWNLOAD_SECRET || 'default-secret')
                       .update(data)
                       .digest('hex');
    
    return `/api/files/download?file=${encodeURIComponent(filePath)}&expires=${expires}&token=${token}`;
  }

  /**
   * Verify download token
   */
  verifyDownloadToken(filePath, expires, token) {
    const crypto = require('crypto');
    const data = `${filePath}|${expires}`;
    const expectedToken = crypto.createHmac('sha256', process.env.FILE_DOWNLOAD_SECRET || 'default-secret')
                               .update(data)
                               .digest('hex');
    
    return token === expectedToken && Date.now() < parseInt(expires);
  }

  /**
   * Stream file for download
   */
  async streamFile(filePath, res) {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

      if (!fsSync.existsSync(fullPath)) {
        throw new Error('File not found');
      }

      const fileInfo = await this.getFileInfo(fullPath);
      const fileStream = fsSync.createReadStream(fullPath);

      // Set appropriate headers
      res.setHeader('Content-Type', fileInfo.mimeType);
      res.setHeader('Content-Length', fileInfo.size);
      res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.name}"`);

      fileStream.pipe(res);

      return new Promise((resolve, reject) => {
        fileStream.on('end', resolve);
        fileStream.on('error', reject);
      });
    } catch (error) {
      throw new Error(`File streaming failed: ${error.message}`);
    }
  }
}

module.exports = new FileService();