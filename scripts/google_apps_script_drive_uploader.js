/**
 * ============================================================================
 * NEXA CBT - GOOGLE APPS SCRIPT DRIVE UPLOADER WEBHOOK (SOP 3)
 * ============================================================================
 * Petunjuk Pemasangan untuk Operator / Admin Sekolah:
 * 1. Buka https://script.google.com dengan akun Google sekolah / pribadi.
 * 2. Klik "New project" (Proyek Baru) dan beri nama "NEXA Drive Webhook".
 * 3. Hapus seluruh isi default, lalu salin (copy-paste) seluruh kode ini.
 * 4. Klik menu "Deploy" (Terapkan) > "New deployment" (Penerapan baru).
 * 5. Klik ikon gerigi (Select type) > pilih "Web app".
 * 6. Atur konfigurasi:
 *    - Description: NEXA CBT Soal Uploader
 *    - Execute as: "Me" (email Anda)
 *    - Who has access: "Anyone" (Siapa saja)  <-- WAJIB PILIH 'ANYONE'
 * 7. Klik "Deploy" dan izinkan hak akses Google Drive (Authorize access).
 * 8. Salin "Web app URL" (akhiran /exec) dan tempelkan ke:
 *    Menu Admin NEXA CBT > Pengaturan Sekolah > URL Webhook Google Drive.
 * ============================================================================
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    service: 'NEXA CBT Drive Webhook',
    message: 'Webhook Google Drive aktif dan siap menerima unggahan gambar soal.',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ status: 'error', message: 'Payload data kosong.' });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'upload_soal_image';

    if (action === 'test_connection') {
      return responseJSON({
        status: 'success',
        message: 'Koneksi ke Google Drive Webhook berhasil!'
      });
    }

    if (action === 'upload_soal_image') {
      var base64Data = payload.base64Data;
      if (!base64Data) {
        return responseJSON({ status: 'error', message: 'Data base64 gambar tidak ditemukan.' });
      }

      // Bersihkan prefix data URL jika ada
      if (base64Data.indexOf(';base64,') > -1) {
        base64Data = base64Data.split(';base64,')[1];
      }

      var mimeType = payload.mimeType || 'image/jpeg';
      var fileName = payload.fileName || ('soal_' + new Date().getTime() + '.jpg');
      var decodedBytes = Utilities.base64Decode(base64Data);
      var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

      // Navigasi atau buat hirarki folder: NEXA > [Nama Sekolah] > [Kelas] > [Mata Pelajaran]
      var rootFolderName = payload.rootFolder || 'NEXA';
      var schoolName = payload.schoolName || payload.sekolah || 'Umum';
      var className = payload.className || payload.kelas || 'Semua Kelas';
      var subjectName = payload.subjectName || payload.mapel || 'Umum';

      var rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), rootFolderName);
      var schoolFolder = getOrCreateFolder(rootFolder, schoolName);
      var classFolder = getOrCreateFolder(schoolFolder, className);
      var targetFolder = getOrCreateFolder(classFolder, subjectName);

      // Simpan file ke target folder
      var file = targetFolder.createFile(blob);

      // Set permission agar bisa dibaca publik oleh browser siswa (Viewer)
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      var fileId = file.getId();
      // URL berkecepatan tinggi via Google User Content CDN
      var cdnUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
      var directDriveUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;

      return responseJSON({
        status: 'success',
        success: true,
        fileId: fileId,
        fileName: fileName,
        fileUrl: cdnUrl,
        drive_url: directDriveUrl,
        folderPath: rootFolderName + '/' + schoolName + '/' + className + '/' + subjectName,
        message: 'Gambar berhasil disimpan ke Google Drive.'
      });
    }

    return responseJSON({ status: 'error', message: 'Aksi ' + action + ' tidak dikenali.' });

  } catch (err) {
    return responseJSON({
      status: 'error',
      message: 'Gagal memproses unggahan ke Google Drive: ' + err.toString()
    });
  }
}

function getOrCreateFolder(parentFolder, folderName) {
  var cleanName = (folderName || 'Umum').toString().trim();
  var folders = parentFolder.getFoldersByName(cleanName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(cleanName);
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
