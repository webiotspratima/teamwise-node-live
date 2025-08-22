const multer = require('multer');
const path = require('path');
const fs = require('fs');

function createUploader(subfolder = '') {
  const folderPath = path.join('uploads', subfolder);

  // Ensure subfolder exists
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, folderPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = `${subfolder || 'file'}_${Date.now()}${ext}`;
      cb(null, filename);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB max size (adjust as needed)
    },
  });

}

module.exports = createUploader;
